const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");

const { isCmsArticlePath } = require("./cms-article-template");
const {
  BASELINE_PATHS,
  BASELINE_SOURCE_FILES,
  getSiteMapPageByPath,
  getSiteMapPageBySourceFile,
} = require("./cms-site-map");

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Stack+Sans+Headline:wght@400;500;600;700&family=Stack+Sans+Text:wght@700&display=swap";

const CALCULATOR_REQUIRED_SELECTORS = [
  "#calculadora-form",
  "#calculadora-progress",
  "#progress-step-label",
  "#progress-percent-label",
  "#progress-track",
  "#result-economia",
  "#segment",
  "#rbt12",
  "#vehicleValue",
  "#simples",
  "#regime",
  "#regimeTime",
  "#ecommerceSegment",
  "#monthlyRevenue",
  "#companyAge",
  "#taxRecovery",
  "#email",
  "#phone",
  "#cnpj",
  '.calculadora-form__panel[data-panel="1"]',
  '.calculadora-form__panel[data-panel="2"][data-flow="default"]',
  '.calculadora-form__panel[data-panel="2"][data-flow="ecommerce"]',
  '.calculadora-form__panel[data-panel="3"]',
  '.calculadora-form__panel[data-panel="4"]',
  '[data-action="next"]',
  '[data-action="back"]',
  '[name="contactConsent"]',
  '[name="marketingConsent"]',
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizePageHtml(html) {
  const value = String(html || "").trim();
  if (!value) return "";
  if (!/<\/?(html|head|body)[\s>]/i.test(value)) return value;

  const dom = new JSDOM(value);
  return dom.window.document.body.innerHTML.trim();
}

function sanitizeCss(css) {
  return String(css || "")
    .replace(/@import[^;]+;/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/javascript:/gi, "")
    .replaceAll("<", String.raw`\3C `);
}

function normalizeSourceFile(value) {
  return String(value || "").replaceAll("\\", "/").replace(/^\/+/, "");
}

function isBaselinePage(page) {
  return (
    BASELINE_PATHS.has(String(page?.path || "")) ||
    BASELINE_SOURCE_FILES.has(normalizeSourceFile(page?.source_file)) ||
    isCmsArticlePath(page?.path)
  );
}

function isCalculatorPage(page) {
  return (
    String(page?.path || "") === "/calculadora.html" ||
    normalizeSourceFile(page?.source_file) === "calculadora.html"
  );
}

function getTrustedPageResources(page) {
  if (!isBaselinePage(page)) {
    return { fonts: [], scripts: [] };
  }

  const scripts = ["/js/main.js"];
  if (isCalculatorPage(page)) scripts.push("/js/calculadora.js");

  return {
    fonts: [GOOGLE_FONTS_URL],
    scripts,
  };
}

function isTrustedIframeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const trustedHost = new Set(["www.google.com", "maps.google.com", "www.google.com.br"]);
    return (
      url.protocol === "https:" &&
      trustedHost.has(url.hostname) &&
      url.pathname.startsWith("/maps/embed")
    );
  } catch {
    return false;
  }
}

function isSafeUrl(value, { tagName = "", attributeName = "" } = {}) {
  const url = String(value || "").trim();
  if (!url) return true;
  if (/[\u0000-\u001f\u007f]/.test(url)) return false;
  if (/^\s*(javascript|vbscript):/i.test(url)) return false;
  if (/^\s*data:/i.test(url)) {
    return tagName === "img" && attributeName === "src" && /^data:image\//i.test(url);
  }
  if (url.startsWith("#") || url.startsWith("/") || url.startsWith("./") || url.startsWith("../")) {
    return !url.startsWith("//");
  }

  try {
    const parsed = new URL(url);
    return ["https:", "http:", "mailto:", "tel:"].includes(parsed.protocol);
  } catch {
    return !/^[a-z][a-z0-9+.-]*:/i.test(url);
  }
}

function sanitizePublicHtml(html) {
  const purifierWindow = new JSDOM("").window;
  const purifier = createDOMPurify(purifierWindow);
  const urlAttributes = new Set(["href", "src", "action", "poster", "cite"]);

  purifier.addHook("uponSanitizeAttribute", (node, data) => {
    const attributeName = String(data.attrName || "").toLowerCase();
    const tagName = String(node.nodeName || "").toLowerCase();

    if (attributeName.startsWith("on") || attributeName === "srcdoc") {
      data.keepAttr = false;
      return;
    }

    if (attributeName === "style") {
      data.attrValue = sanitizeCss(data.attrValue);
      return;
    }

    if (
      urlAttributes.has(attributeName) &&
      !isSafeUrl(data.attrValue, { tagName, attributeName })
    ) {
      data.keepAttr = false;
    }
  });

  purifier.addHook("afterSanitizeAttributes", (node) => {
    if (String(node.nodeName || "").toLowerCase() !== "iframe") return;
    if (!isTrustedIframeUrl(node.getAttribute("src"))) {
      node.remove();
    }
  });

  const sanitized = purifier.sanitize(html || "", {
    USE_PROFILES: { html: true, svg: true },
    ADD_TAGS: [
      "section",
      "main",
      "picture",
      "source",
      "details",
      "summary",
      "form",
      "input",
      "textarea",
      "select",
      "option",
      "button",
      "label",
      "video",
      "iframe",
      "svg",
      "path",
    ],
    ADD_ATTR: [
      "class",
      "id",
      "style",
      "name",
      "type",
      "value",
      "action",
      "method",
      "placeholder",
      "required",
      "disabled",
      "checked",
      "selected",
      "hidden",
      "novalidate",
      "inputmode",
      "autocomplete",
      "min",
      "max",
      "step",
      "rows",
      "cols",
      "target",
      "rel",
      "loading",
      "srcset",
      "sizes",
      "poster",
      "autoplay",
      "muted",
      "loop",
      "playsinline",
      "controls",
      "preload",
      "crossorigin",
      "referrerpolicy",
      "allow",
      "allowfullscreen",
      "frameborder",
      "role",
      "viewBox",
      "xmlns",
      "fill",
      "d",
      "width",
      "height",
    ],
    ALLOW_ARIA_ATTR: true,
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ["script", "object", "embed"],
    FORBID_ATTR: ["srcdoc"],
  });

  purifierWindow.close();
  return sanitized;
}

function createValidationError(message) {
  const error = new Error(message);
  error.code = "CMS_PAGE_VALIDATION";
  return error;
}

function validatePublishablePage(page) {
  const normalizedHtml = normalizePageHtml(page?.html);
  if (!normalizedHtml) {
    throw createValidationError("A página precisa ter conteúdo salvo antes da publicação.");
  }

  const sanitizedHtml = sanitizePublicHtml(normalizedHtml);
  const document = new JSDOM(`<body>${sanitizedHtml}</body>`).window.document;

  if (isCalculatorPage(page)) {
    const missingSelector = CALCULATOR_REQUIRED_SELECTORS.find(
      (selector) => !document.querySelector(selector)
    );
    if (missingSelector) {
      throw createValidationError(
        `A estrutura obrigatória da calculadora foi alterada: ${missingSelector}.`
      );
    }

    const panels = document.querySelectorAll(".calculadora-form__panel");
    if (panels.length < 5) {
      throw createValidationError("A calculadora precisa manter os cinco painéis do fluxo.");
    }
  }

  if (
    String(page?.path || "") === "/" ||
    String(page?.path || "") === "/index.html" ||
    normalizeSourceFile(page?.source_file) === "index.html"
  ) {
    const requiredHomeSelectors = [
      "#contact-form",
      "#team-carousel",
      "#team-prev",
      "#team-next",
      "video source",
      'iframe[src*="/maps/embed"]',
    ];
    const missingSelector = requiredHomeSelectors.find(
      (selector) => !document.querySelector(selector)
    );
    if (missingSelector) {
      throw createValidationError(
        `A estrutura obrigatória da Home foi alterada: ${missingSelector}.`
      );
    }
  }

  return { sanitizedHtml };
}

function getPageBaseHref(page) {
  const pagePath = String(page?.path || "");
  if (!pagePath || pagePath === "/") return "/";
  const lastSlash = pagePath.lastIndexOf("/");
  return `${pagePath.slice(0, lastSlash + 1) || "/"}`;
}

const WHATSAPP_ICON_PATH_D =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.881 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";

function ensureWhatsappButtonIcon(html) {
  const dom = new JSDOM(`<body>${html || ""}</body>`);
  const { document } = dom.window;
  const buttons = Array.from(document.querySelectorAll("a.whatsapp-btn"));
  if (!buttons.length) return String(html || "");

  for (const button of buttons) {
    let svg = button.querySelector("svg");
    let path = svg?.querySelector("path");
    const pathD = String(path?.getAttribute("d") || "").trim();

    if (!svg || !path || !pathD) {
      button.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="36" height="36" aria-hidden="true"><path fill="#ffffff" d="${WHATSAPP_ICON_PATH_D}"></path></svg>`;
      continue;
    }

    // Garante ícone visível mesmo se o CSS inlined não aplicar fill/tamanho ao SVG.
    svg.setAttribute("width", "36");
    svg.setAttribute("height", "36");
    svg.setAttribute("aria-hidden", "true");
    path.setAttribute("fill", "#ffffff");
  }

  return document.body.innerHTML.trim();
}

function renderPublicPage(page, { preview = false } = {}) {
  const title = page?.title || "Página";
  const html = ensureWhatsappButtonIcon(
    sanitizePublicHtml(normalizePageHtml(page?.html))
  );
  const css = sanitizeCss(page?.css);
  const resources = getTrustedPageResources(page);
  const robots = preview || page?.status !== "published" ? "noindex,nofollow" : "index,follow";
  const baseHref = getPageBaseHref(page);
  const sitePage =
    getSiteMapPageByPath(page?.path) || getSiteMapPageBySourceFile(page?.source_file);
  const descriptionMeta = sitePage?.description
    ? `<meta name="description" content="${escapeHtml(sitePage.description)}">`
    : "";
  const canonicalLink = sitePage?.path
    ? `<link rel="canonical" href="${escapeHtml(sitePage.path)}">`
    : "";
  const fontLinks = resources.fonts
    .map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`)
    .join("\n  ");
  const scripts = resources.scripts
    .map((src) => `<script src="${escapeHtml(src)}"></script>`)
    .join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="${robots}">
  ${descriptionMeta}
  ${canonicalLink}
  <base href="${escapeHtml(baseHref)}">
  <title>${escapeHtml(title)}</title>
  ${fontLinks}
  <style>
    *,*::before,*::after{box-sizing:border-box}
    body{margin:0;color:#10131c;background:#fff}
    img{max-width:100%;height:auto}
    ${css}
  </style>
</head>
<body>
${html}
${scripts}
</body>
</html>`;
}

module.exports = {
  BASELINE_PATHS,
  CALCULATOR_REQUIRED_SELECTORS,
  GOOGLE_FONTS_URL,
  getTrustedPageResources,
  isTrustedIframeUrl,
  normalizePageHtml,
  renderPublicPage,
  sanitizeCss,
  sanitizePublicHtml,
  validatePublishablePage,
};
