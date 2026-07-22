const fs = require("fs");
const path = require("path");

const { JSDOM } = require("jsdom");
const { isBaselinePath, isBaselineSourceFile } = require("./cms-site-map");

const ARTICLE_CSS_FILES = Object.freeze([
  "css/variables.css",
  "css/base.css",
  "css/components.css",
  "css/sections.css",
  "css/artigo-detail.css",
]);

const LISTING_PAGE_PATH = "/artigos.html";
const ARTICLE_PATH_PATTERN = /^\/artigos\/[^/]+\.html$/i;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isCmsArticlePath(pagePath) {
  return ARTICLE_PATH_PATTERN.test(String(pagePath || ""));
}

function isArtigosListingPath(pagePath) {
  return String(pagePath || "") === LISTING_PAGE_PATH;
}

function articlePathFromSlug(slug) {
  const safeSlug = String(slug || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\.html$/i, "");
  return `/artigos/${safeSlug}.html`;
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

function collectArticleCss(rootDir) {
  const css = ARTICLE_CSS_FILES.map((relativePath) => {
    const absolute = path.join(rootDir, relativePath);
    if (!fs.existsSync(absolute)) {
      throw new Error(`CSS do template de artigo ausente: ${relativePath}`);
    }
    return `/* ${relativePath} */\n${fs.readFileSync(absolute, "utf8")}`;
  }).join("\n\n");

  return inlineCssVariables(`.nav__logo-text{display:none!important}\n${css}`);
}

function buildArticleTemplateHtml({ title }) {
  const safeTitle = escapeHtml(title || "Novo artigo");

  return `<header class="nav">
  <div class="nav__inner">
    <a href="/" class="nav__logo" aria-label="Lamy Advogados — Início">
      <img src="/assets/images/logo-principal.png" alt="Lamy Advogados" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
      <span class="nav__logo-text" style="display:none">LAMY</span>
    </a>
    <button class="nav__toggle" aria-label="Abrir menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav__links" aria-label="Navegação principal">
      <a href="/#escritorio" class="nav__link">O Escritório</a>
      <a href="/#segmentos" class="nav__link">Segmentos</a>
      <a href="/#equipe" class="nav__link">Equipe</a>
      <a href="/calculadora.html" class="nav__link">Calculadora</a>
      <a href="/calculadora.html" class="btn btn--nav nav__cta-mobile">Iniciar Diagnóstico</a>
    </nav>
    <a href="/calculadora.html" class="btn btn--nav nav__cta">Iniciar Diagnóstico</a>
  </div>
</header>

<article class="artigo-detail">
  <main class="artigo-detail__main">
    <a href="/artigos.html" class="artigo-detail__back">← Voltar para Artigos</a>

    <header class="artigo-detail__header">
      <div class="artigo-detail__meta">
        <span class="artigo-detail__badge">Notícias</span>
        <span class="artigo-detail__read-time">5 min de leitura</span>
      </div>
      <h1 class="artigo-detail__title">${safeTitle}</h1>
    </header>

    <img class="artigo-detail__hero-img" src="/assets/site-home/CAPA ARTIGO 01.png" alt="${safeTitle}" loading="lazy">

    <div class="artigo-detail__content">
      <p>Escreva aqui a introdução do artigo.</p>
      <p>Substitua este parágrafo pelo desenvolvimento do conteúdo.</p>
    </div>

    <div class="artigo-detail__cta">
      <h2 class="artigo-detail__cta-title">Quer falar com um especialista?</h2>
      <p class="artigo-detail__cta-text">Converse com a equipe Lamy e avance com segurança jurídica.</p>
      <a href="/#formulario" class="btn btn--primary">Falar com um especialista</a>
    </div>
  </main>
</article>

<footer class="footer">
  <div class="footer__inner">
    <div class="footer__brand">
      <a href="/" class="footer__logo" aria-label="Lamy Advogados — Início">
        <img src="/assets/site-home/4f75435e2711bc520e1487fe1dfb689ab802bbbb%20(1).png" alt="Lamy Advogados" class="footer__logo-img">
      </a>
      <p class="footer__copyright">© 2024 Lamy Advogados. Todos os direitos reservados.</p>
    </div>
    <nav class="footer__links" aria-label="Links do rodapé">
      <a href="/#escritorio" class="footer__link">O Escritório</a>
      <a href="/#segmentos" class="footer__link">Segmentos</a>
      <a href="/#equipe" class="footer__link">Equipe</a>
      <a href="#" class="footer__link">Área do Cliente</a>
      <a href="/#contato" class="footer__link">Contato</a>
    </nav>
  </div>
</footer>

<a href="https://wa.me/5541998618931" class="whatsapp-btn" target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp">
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.881 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path></svg>
</a>`;
}

function buildArticleTemplate({ title, rootDir }) {
  return {
    html: buildArticleTemplateHtml({ title }),
    css: collectArticleCss(rootDir),
    js: "",
  };
}

function truncateText(value, maxLength = 140) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function extractArticleListingMeta(page) {
  const document = new JSDOM(`<body>${page?.html || ""}</body>`).window.document;
  const title =
    document.querySelector(".artigo-detail__title")?.textContent?.trim() ||
    page?.title ||
    "Artigo";
  const badge =
    document.querySelector(".artigo-detail__badge")?.textContent?.trim() || "Notícias";
  const readTime =
    document.querySelector(".artigo-detail__read-time")?.textContent?.trim() ||
    "5 min de leitura";
  const image =
    document.querySelector(".artigo-detail__hero-img")?.getAttribute("src") ||
    "/assets/site-home/CAPA ARTIGO 01.png";
  const excerpt =
    truncateText(document.querySelector(".artigo-detail__content p")?.textContent) ||
    "Leia o artigo completo.";

  return { title, badge, readTime, image, excerpt };
}

function normalizeArticleHref(pagePath) {
  const value = String(pagePath || "").trim();
  if (!value) return "";
  if (value.startsWith("/")) return value;
  return `/${value.replace(/^\/+/, "")}`;
}

function hrefMatchesArticle(href, articlePath) {
  const left = String(href || "").split(/[?#]/)[0].replace(/^\.\//, "");
  const right = normalizeArticleHref(articlePath);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left === right.replace(/^\//, "")) return true;
  if (`/${left.replace(/^\//, "")}` === right) return true;
  return false;
}

function buildArticleListingCard({ title, path: articlePath, badge, readTime, image, excerpt }) {
  const href = normalizeArticleHref(articlePath);
  const safeTitle = escapeHtml(title);
  const safeBadge = escapeHtml(badge || "Notícias");
  const safeReadTime = escapeHtml(readTime || "5 min de leitura");
  const safeImage = escapeHtml(image || "/assets/site-home/CAPA ARTIGO 01.png");
  const safeExcerpt = escapeHtml(excerpt || "Leia o artigo completo.");

  return `<a href="${escapeHtml(href)}" class="artigos-card" data-cms-article-path="${escapeHtml(href)}">
          <div class="artigos-card__media">
            <img class="artigos-card__image" src="${safeImage}" alt="${safeTitle}" loading="lazy">
            <span class="artigos-card__badge">${safeBadge}</span>
          </div>
          <div class="artigos-card__body">
            <h3 class="artigos-card__title">${safeTitle}</h3>
            <p class="artigos-card__excerpt">${safeExcerpt}</p>
            <div class="artigos-card__footer">
              <span class="artigos-card__read-time">${safeReadTime}</span>
              <svg class="artigos-card__arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
          </div>
        </a>`;
}

function applyListingMetaToCard(link, articleMeta) {
  const href = normalizeArticleHref(articleMeta.path);
  const before = link.outerHTML;
  const title = String(articleMeta.title || "").trim();
  const badge = String(articleMeta.badge || "Notícias").trim();
  const readTime = String(articleMeta.readTime || "5 min de leitura").trim();
  const image = String(articleMeta.image || "/assets/site-home/CAPA ARTIGO 01.png").trim();
  const excerpt = String(articleMeta.excerpt || "Leia o artigo completo.").trim();

  link.setAttribute("href", href);
  if (link.classList.contains("artigos-card") || link.hasAttribute("data-cms-article-path")) {
    link.setAttribute("data-cms-article-path", href);
  }

  const titleEl = link.querySelector(
    ".artigos-card__title, .artigos-featured__title, h2, h3"
  );
  if (titleEl && title) titleEl.textContent = title;

  const badgeEl = link.querySelector(".artigos-card__badge, .artigos-featured__badge");
  if (badgeEl && badge) badgeEl.textContent = badge;

  const readEl = link.querySelector(
    ".artigos-card__read-time, .artigos-featured__read-time"
  );
  if (readEl && readTime) readEl.textContent = readTime;

  const excerptEl = link.querySelector(
    ".artigos-card__excerpt, .artigos-featured__excerpt"
  );
  if (excerptEl && excerpt) excerptEl.textContent = excerpt;

  const imgEl = link.querySelector("img");
  if (imgEl && image) {
    imgEl.setAttribute("src", image);
    if (title) imgEl.setAttribute("alt", title);
  }

  return link.outerHTML !== before;
}

function upsertArticleCardInListingHtml(listingHtml, articleMeta) {
  const href = normalizeArticleHref(articleMeta.path);
  const dom = new JSDOM(`<body>${listingHtml || ""}</body>`);
  const { document } = dom.window;
  const cardHtml = buildArticleListingCard(articleMeta);

  const existingLinks = Array.from(
    document.querySelectorAll("a.artigos-card, a.artigos-featured")
  );
  const existing = existingLinks.find(
    (link) =>
      hrefMatchesArticle(link.getAttribute("href"), href) ||
      hrefMatchesArticle(link.getAttribute("data-cms-article-path"), href)
  );

  if (existing) {
    const changed = applyListingMetaToCard(existing, articleMeta);
    return {
      html: document.body.innerHTML.trim(),
      changed,
      action: "updated",
    };
  }

  const grid = document.querySelector(".artigos-grid");
  if (!grid) {
    const error = new Error(
      "A listagem de artigos não possui um grid (.artigos-grid) para receber o novo card."
    );
    error.code = "CMS_ARTICLES_LISTING_INVALID";
    throw error;
  }

  grid.insertAdjacentHTML("afterbegin", cardHtml);

  return {
    html: document.body.innerHTML.trim(),
    changed: true,
    action: "inserted",
  };
}

function removeArticleCardFromListingHtml(listingHtml, articlePath) {
  const href = normalizeArticleHref(articlePath);
  const dom = new JSDOM(`<body>${listingHtml || ""}</body>`);
  const { document } = dom.window;
  const links = Array.from(document.querySelectorAll("a.artigos-card, a.artigos-featured"));
  let removed = 0;

  for (const link of links) {
    const linkHref = link.getAttribute("href");
    const dataPath = link.getAttribute("data-cms-article-path");
    if (hrefMatchesArticle(linkHref, href) || hrefMatchesArticle(dataPath, href)) {
      link.remove();
      removed += 1;
    }
  }

  return {
    html: document.body.innerHTML.trim(),
    changed: removed > 0,
    removed,
  };
}

function canDeleteCmsArticle(pagePath, sourceFile = null) {
  if (isBaselinePath(pagePath) || isBaselineSourceFile(sourceFile)) return false;
  return isCmsArticlePath(pagePath);
}

module.exports = {
  ARTICLE_CSS_FILES,
  LISTING_PAGE_PATH,
  articlePathFromSlug,
  buildArticleListingCard,
  buildArticleTemplate,
  buildArticleTemplateHtml,
  canDeleteCmsArticle,
  collectArticleCss,
  extractArticleListingMeta,
  hrefMatchesArticle,
  isArtigosListingPath,
  isCmsArticlePath,
  normalizeArticleHref,
  removeArticleCardFromListingHtml,
  upsertArticleCardInListingHtml,
};
