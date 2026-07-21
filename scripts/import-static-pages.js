const fs = require("fs");
const path = require("path");

require("dotenv").config();

const { JSDOM } = require("jsdom");

const { createCmsDb } = require("../lib/cms-db");

const rootDir = path.join(__dirname, "..");

const pagesToImport = [
  { file: "index.html", title: "Home", slug: "home" },
  { file: "artigos.html", title: "Artigos", slug: "artigos-cms" },
  { file: "calculadora.html", title: "Calculadora", slug: "calculadora-cms" },
  {
    file: "artigos/desafios-regulatorios-era-digital.html",
    title: "Desafios Regulatórios na Era Digital",
    slug: "desafios-regulatorios-era-digital",
  },
  {
    file: "artigos/exclusao-icms-difal-pis-cofins.html",
    title: "Exclusão do ICMS-DIFAL do PIS e da COFINS",
    slug: "exclusao-icms-difal-pis-cofins",
  },
  {
    file: "artigos/liquidity-events-ma-2024.html",
    title: "Liquidity Events e M&A em 2024",
    slug: "liquidity-events-ma-2024",
  },
  {
    file: "artigos/transacao-tributaria-debitos-posteriores.html",
    title: "TRF3 afasta vedação da Portaria nº 6.757/22 da PGFN",
    slug: "transacao-tributaria-debitos-posteriores",
  },
];

const db = createCmsDb({ rootDir });

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function normalizeAssetUrl(value, pageDir) {
  if (!value) return value;
  if (/^(https?:|mailto:|tel:|#|data:)/i.test(value)) return value;

  const [pathname, suffix = ""] = String(value).split(/(?=[?#])/);
  const normalized = path.posix
    .normalize(path.posix.join("/", pageDir, pathname))
    .replace(/^\/index\.html$/, "/");

  return `${normalized}${suffix}`;
}

function localPathFromHref(href, pageDir) {
  if (!href || /^(https?:|mailto:|tel:|#|data:)/i.test(href)) return null;
  const pathname = String(href).split(/[?#]/)[0];
  const normalized = path.posix.normalize(path.posix.join(pageDir, pathname));
  return normalized.startsWith("../") ? null : normalized;
}

function extractTitle(document, fallback) {
  const title = document.querySelector("title")?.textContent?.trim();
  if (!title) return fallback;
  return title.replace(/\s+—\s+Lamy Advogados$/i, "").trim() || fallback;
}

function collectCss(document, pageDir) {
  const cssFiles = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'))
    .map((link) => localPathFromHref(link.getAttribute("href"), pageDir))
    .filter(Boolean)
    .filter(fileExists);

  const css = cssFiles
    .map((file) => `/* ${file} */\n${readText(file)}`)
    .join("\n\n");

  return inlineCssVariables(`.nav__logo-text{display:none!important}\n${css}`);
}

function inlineCssVariables(css) {
  const variables = new Map();
  const varDeclarationPattern = /(--[a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
  let match;

  while ((match = varDeclarationPattern.exec(css))) {
    variables.set(match[1], match[2].trim());
  }

  return css.replace(/var\(\s*(--[a-zA-Z0-9-_]+)\s*(?:,\s*([^)]+))?\)/g, (_full, name, fallback) => {
    return variables.get(name) || (fallback ? fallback.trim() : _full);
  });
}

function collectJs(document, pageDir) {
  const jsFiles = Array.from(document.querySelectorAll("script[src]"))
    .map((script) => localPathFromHref(script.getAttribute("src"), pageDir))
    .filter(Boolean)
    .filter(fileExists);

  return jsFiles
    .map((file) => `/* ${file} */\n${readText(file)}`)
    .join("\n\n");
}

function rewriteRelativeUrls(document, pageDir) {
  document.querySelectorAll("[src]").forEach((element) => {
    element.setAttribute("src", normalizeAssetUrl(element.getAttribute("src"), pageDir));
  });

  document.querySelectorAll("[href]").forEach((element) => {
    element.setAttribute("href", normalizeAssetUrl(element.getAttribute("href"), pageDir));
  });

  document.querySelectorAll("[srcset]").forEach((element) => {
    const srcset = element
      .getAttribute("srcset")
      .split(",")
      .map((part) => {
        const [url, descriptor] = part.trim().split(/\s+/, 2);
        return [normalizeAssetUrl(url, pageDir), descriptor].filter(Boolean).join(" ");
      })
      .join(", ");
    element.setAttribute("srcset", srcset);
  });
}

async function importPage(page) {
  const htmlFile = readText(page.file);
  const pageDir = path.posix.dirname(page.file) === "." ? "" : path.posix.dirname(page.file);
  const dom = new JSDOM(htmlFile);
  const { document } = dom.window;
  const title = extractTitle(document, page.title);
  const css = collectCss(document, pageDir);
  const js = collectJs(document, pageDir);

  document.querySelectorAll("script").forEach((script) => script.remove());
  rewriteRelativeUrls(document, pageDir);

  const bodyHtml = document.body.innerHTML.trim();
  const now = new Date().toISOString();
  const existing = await db.findPageIdBySlug(page.slug);

  if (existing) {
    await db.updatePage({
      id: existing.id,
      title,
      slug: page.slug,
      projectData: null,
      html: bodyHtml,
      css,
      js,
      timestamp: now,
    });
    return { action: "updated", id: existing.id, title, slug: page.slug };
  }

  const result = await db.createPage({ title, slug: page.slug, timestamp: now });
  await db.updatePage({
    id: result.id,
    title,
    slug: page.slug,
    projectData: null,
    html: bodyHtml,
    css,
    js,
    timestamp: now,
  });

  return { action: "created", id: result.id, title, slug: page.slug };
}

async function main() {
  await db.ready;
  const results = [];

  for (const page of pagesToImport) {
    results.push(await importPage(page));
  }

  for (const result of results) {
    console.log(`${result.action}: #${result.id} ${result.title} /${result.slug}`);
  }

  console.log(`Imported ${results.length} page(s) into ${db.kind}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
