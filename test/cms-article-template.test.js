const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  articlePathFromSlug,
  buildArticleTemplate,
  canDeleteCmsArticle,
  extractArticleListingMeta,
  isCmsArticlePath,
  isArtigosListingPath,
  removeArticleCardFromListingHtml,
  upsertArticleCardInListingHtml,
} = require("../lib/cms-article-template");
const { createCmsPageService } = require("../lib/cms-page-service");
const { getTrustedPageResources } = require("../lib/cms-content");

const rootDir = path.join(__dirname, "..");

test("detecta paths de artigo CMS e listagem", () => {
  assert.equal(isCmsArticlePath("/artigos/novo-artigo.html"), true);
  assert.equal(isCmsArticlePath("/artigos.html"), false);
  assert.equal(isCmsArticlePath("/landing.html"), false);
  assert.equal(isArtigosListingPath("/artigos.html"), true);
});

test("articlePathFromSlug segue a estrutura oficial /artigos/*.html", () => {
  assert.equal(
    articlePathFromSlug("nova-decisao-do-stf-impacta-empresas-brasileiras"),
    "/artigos/nova-decisao-do-stf-impacta-empresas-brasileiras.html"
  );
  assert.equal(
    articlePathFromSlug("reforma-tributaria-o-que-muda-em-2026"),
    "/artigos/reforma-tributaria-o-que-muda-em-2026.html"
  );
  assert.equal(articlePathFromSlug("foo.html"), "/artigos/foo.html");
});

function normalizeSlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

test("normalizeSlug remove acentos, pontuação e hífens extras como no CMS", () => {
  assert.equal(
    normalizeSlug("Nova Decisão do STF Impacta Empresas Brasileiras"),
    "nova-decisao-do-stf-impacta-empresas-brasileiras"
  );
  assert.equal(
    normalizeSlug("Reforma Tributária: O Que Muda em 2026?"),
    "reforma-tributaria-o-que-muda-em-2026"
  );
  assert.equal(articlePathFromSlug(normalizeSlug("Reforma Tributária: O Que Muda em 2026?")), "/artigos/reforma-tributaria-o-que-muda-em-2026.html");
});

test("template de artigo gera estrutura artigo-detail e CSS inlined", () => {
  const template = buildArticleTemplate({
    title: "Novo Insight Tributário",
    rootDir,
  });

  assert.match(template.html, /class="artigo-detail"/);
  assert.match(template.html, /Novo Insight Tributário/);
  assert.match(template.html, /artigo-detail__hero-img/);
  assert.match(template.html, /class="nav"/);
  assert.match(template.css, /artigo-detail__/);
  assert.match(template.css, /\.nav__logo-text\{display:none!important\}/);
  assert.equal(template.js, "");
});

test("upsert do card na listagem é idempotente por href", () => {
  const listingHtml = `<div class="artigos">
  <main class="artigos__main">
    <div class="artigos-grid">
      <a href="/artigos/existente.html" class="artigos-card"><h3 class="artigos-card__title">Existente</h3></a>
    </div>
  </main>
</div>`;

  const first = upsertArticleCardInListingHtml(listingHtml, {
    title: "Artigo Novo",
    path: "/artigos/artigo-novo.html",
    badge: "Tributário",
    readTime: "4 min de leitura",
    image: "/assets/site-home/CAPA ARTIGO 02.png",
    excerpt: "Resumo do artigo novo.",
  });

  assert.equal(first.changed, true);
  assert.equal(first.action, "inserted");
  assert.match(first.html, /href="\/artigos\/artigo-novo\.html"/);
  assert.match(first.html, /Artigo Novo/);

  const second = upsertArticleCardInListingHtml(first.html, {
    title: "Artigo Novo",
    path: "/artigos/artigo-novo.html",
    badge: "Tributário",
    readTime: "4 min de leitura",
    image: "/assets/site-home/CAPA ARTIGO 02.png",
    excerpt: "Resumo do artigo novo.",
  });

  assert.equal(second.changed, false);
  assert.equal(second.action, "updated");
  assert.equal(
    second.html.match(/href="\/artigos\/artigo-novo\.html"/g)?.length,
    1
  );
});

test("upsert atualiza card existente sem duplicar na listagem", () => {
  const listingHtml = `<div class="artigos-grid">
    <a href="/artigos/desafios-regulatorios-era-digital.html" class="artigos-card" data-cms-article-path="/artigos/desafios-regulatorios-era-digital.html">
      <img class="artigos-card__image" src="/assets/old.png" alt="Antigo">
      <span class="artigos-card__badge">Old</span>
      <h3 class="artigos-card__title">Título antigo</h3>
      <p class="artigos-card__excerpt">Resumo antigo</p>
      <span class="artigos-card__read-time">1 min</span>
    </a>
  </div>`;

  const updated = upsertArticleCardInListingHtml(listingHtml, {
    title: "Desafios Regulatórios Transfronteiriços na Era Digital",
    path: "/artigos/desafios-regulatorios-era-digital.html",
    badge: "Global Law",
    readTime: "10 min de leitura",
    image: "/assets/site-home/CAPA ARTIGO 03.png",
    excerpt: "Resumo atualizado do artigo.",
  });

  assert.equal(updated.changed, true);
  assert.equal(updated.action, "updated");
  assert.equal(
    updated.html.match(/desafios-regulatorios-era-digital\.html/g)?.length,
    2
  );
  assert.match(updated.html, /Desafios Regulatórios Transfronteiriços na Era Digital/);
  assert.match(updated.html, /Resumo atualizado do artigo/);
  assert.match(updated.html, /CAPA ARTIGO 03\.png/);
  assert.doesNotMatch(updated.html, /Título antigo/);
  assert.equal(updated.html.match(/class="artigos-card"/g)?.length, 1);
});

test("extractArticleListingMeta lê campos do HTML do artigo", () => {
  const meta = extractArticleListingMeta({
    title: "Fallback",
    html: `<article class="artigo-detail">
      <span class="artigo-detail__badge">Societário</span>
      <span class="artigo-detail__read-time">8 min de leitura</span>
      <h1 class="artigo-detail__title">Título Extraído</h1>
      <img class="artigo-detail__hero-img" src="/assets/site-home/CAPA ARTIGO 03.png" alt="">
      <div class="artigo-detail__content"><p>Primeiro parágrafo do conteúdo.</p></div>
    </article>`,
  });

  assert.equal(meta.title, "Título Extraído");
  assert.equal(meta.badge, "Societário");
  assert.equal(meta.readTime, "8 min de leitura");
  assert.equal(meta.image, "/assets/site-home/CAPA ARTIGO 03.png");
  assert.match(meta.excerpt, /Primeiro parágrafo/);
});

test("artigos CMS sob /artigos/*.html recebem bundle confiável main.js", () => {
  const resources = getTrustedPageResources({
    path: "/artigos/novo-artigo.html",
  });
  assert.deepEqual(resources.scripts, ["/js/main.js"]);
  assert.ok(resources.fonts.length > 0);
});

function createListingAwareMemoryDb() {
  let nextVersionId = 10;
  const versions = new Map();
  const pages = new Map();

  function snapshot(pageId) {
    const page = pages.get(pageId);
    if (!page) return null;
    const version = versions.get(page.latest_draft_version_id);
    if (!version) return { ...page };
    return {
      ...page,
      ...version,
      id: page.id,
      version_id: version.id,
      has_unpublished_changes:
        page.published_version_id === null ||
        page.latest_draft_version_id !== page.published_version_id,
    };
  }

  pages.set(1, {
    id: 1,
    path: "/artigos/novo.html",
    source_file: null,
    status: "draft",
    latest_draft_version_id: 1,
    published_version_id: null,
    previous_published_version_id: null,
    updated_at: "2026-07-22T00:00:00.000Z",
    published_at: null,
  });
  versions.set(1, {
    id: 1,
    version_number: 1,
    title: "Novo Artigo",
    slug: "novo",
    project_data: null,
    html: `<article class="artigo-detail">
      <span class="artigo-detail__badge">Notícias</span>
      <span class="artigo-detail__read-time">5 min de leitura</span>
      <h1 class="artigo-detail__title">Novo Artigo</h1>
      <img class="artigo-detail__hero-img" src="/assets/site-home/CAPA ARTIGO 01.png" alt="">
      <div class="artigo-detail__content"><p>Conteúdo do novo artigo publicado.</p></div>
    </article>`,
    css: ".artigo-detail{display:block}",
    js: "",
  });

  pages.set(2, {
    id: 2,
    path: "/artigos.html",
    source_file: "artigos.html",
    status: "published",
    latest_draft_version_id: 2,
    published_version_id: 2,
    previous_published_version_id: null,
    updated_at: "2026-07-22T00:00:00.000Z",
    published_at: "2026-07-22T00:00:00.000Z",
  });
  versions.set(2, {
    id: 2,
    version_number: 1,
    title: "Artigos",
    slug: "artigos-page",
    project_data: null,
    html: `<div class="artigos"><main class="artigos__main"><div class="artigos-grid"><a href="/artigos/existente.html" class="artigos-card"><h3 class="artigos-card__title">Existente</h3></a></div></main></div>`,
    css: ".artigos-grid{display:grid}",
    js: "",
  });

  return {
    pages,
    versions,
    async findPageIdByPath(pagePath) {
      for (const page of pages.values()) {
        if (page.path === pagePath) return { id: page.id };
      }
      return null;
    },
    async getPageById(id) {
      return snapshot(Number(id));
    },
    async savePageDraft(input) {
      const page = pages.get(Number(input.id));
      if (!page) throw new Error("missing");
      const id = nextVersionId++;
      const current = versions.get(page.latest_draft_version_id);
      versions.set(id, {
        id,
        version_number: (current?.version_number || 0) + 1,
        title: input.title,
        slug: input.slug,
        project_data: input.projectData,
        html: input.html,
        css: input.css,
        js: input.js,
      });
      page.latest_draft_version_id = id;
      page.updated_at = input.timestamp;
      page.title = input.title;
      page.slug = input.slug;
    },
    async publishLatestDraft({ id, versionId, timestamp }) {
      const page = pages.get(Number(id));
      if (!page) throw new Error("missing");
      if (versionId !== page.latest_draft_version_id) {
        throw new Error("rascunho mudou");
      }
      page.previous_published_version_id = page.published_version_id;
      page.published_version_id = versionId;
      page.status = "published";
      page.published_at = timestamp;
    },
    async deleteArticlePage({ id }) {
      const pageId = Number(id);
      const page = pages.get(pageId);
      if (!page) throw new Error("missing");
      for (const versionId of [
        page.latest_draft_version_id,
        page.published_version_id,
        page.previous_published_version_id,
      ]) {
        if (versionId) versions.delete(versionId);
      }
      pages.delete(pageId);
    },
    async getPublishedPageByPath(pagePath) {
      for (const page of pages.values()) {
        if (page.path !== pagePath || !page.published_version_id) continue;
        const version = versions.get(page.published_version_id);
        if (!version) return null;
        return { ...page, ...version, version_id: version.id };
      }
      return null;
    },
  };
}

test("publish de artigo CMS injeta card na listagem e republica /artigos.html", async () => {
  const db = createListingAwareMemoryDb();
  const service = createCmsPageService({ db });

  await service.publishLatestDraft({
    id: 1,
    timestamp: "2026-07-22T01:00:00.000Z",
  });

  const listing = await db.getPublishedPageByPath("/artigos.html");
  assert.ok(listing);
  assert.match(listing.html, /href="\/artigos\/novo\.html"/);
  assert.match(listing.html, /Novo Artigo/);
  assert.equal(listing.status, "published");

  await service.publishLatestDraft({
    id: 1,
    timestamp: "2026-07-22T02:00:00.000Z",
  });
  const listingAgain = await db.getPublishedPageByPath("/artigos.html");
  assert.equal(listingAgain.html.match(/href="\/artigos\/novo\.html"/g)?.length, 1);

  await service.saveDraft({
    id: 1,
    title: "Novo Artigo Atualizado",
    slug: "novo",
    projectData: null,
    html: `<article class="artigo-detail">
      <span class="artigo-detail__badge">Notícias</span>
      <span class="artigo-detail__read-time">8 min de leitura</span>
      <h1 class="artigo-detail__title">Novo Artigo Atualizado</h1>
      <img class="artigo-detail__hero-img" src="/assets/site-home/CAPA ARTIGO 02.png" alt="">
      <div class="artigo-detail__content"><p>Conteúdo atualizado do mesmo artigo.</p></div>
    </article>`,
    css: ".artigo-detail{display:block}",
    js: "",
    timestamp: "2026-07-22T02:30:00.000Z",
  });

  await service.publishLatestDraft({
    id: 1,
    timestamp: "2026-07-22T03:00:00.000Z",
  });

  const listingUpdated = await db.getPublishedPageByPath("/artigos.html");
  assert.equal(listingUpdated.html.match(/href="\/artigos\/novo\.html"/g)?.length, 1);
  assert.match(listingUpdated.html, /Novo Artigo Atualizado/);
  assert.match(listingUpdated.html, /Conteúdo atualizado do mesmo artigo/);
  assert.doesNotMatch(listingUpdated.html, />Novo Artigo</);
});

test("removeArticleCardFromListingHtml remove apenas o card do artigo alvo", () => {
  const listing = `<div class="artigos-grid">
    <a href="/artigos/novo.html" class="artigos-card" data-cms-article-path="/artigos/novo.html"><h3>Novo</h3></a>
    <a href="/artigos/existente.html" class="artigos-card"><h3>Existente</h3></a>
  </div>`;
  const { html, changed, removed } = removeArticleCardFromListingHtml(
    listing,
    "/artigos/novo.html"
  );
  assert.equal(changed, true);
  assert.equal(removed, 1);
  assert.doesNotMatch(html, /novo\.html/);
  assert.match(html, /existente\.html/);
});

test("canDeleteCmsArticle libera apenas artigos CMS fora do site map oficial", () => {
  assert.equal(canDeleteCmsArticle("/artigos/meu-artigo-novo.html"), true);
  assert.equal(canDeleteCmsArticle("/artigos/desafios-regulatorios-era-digital.html"), false);
  assert.equal(
    canDeleteCmsArticle(
      "/artigos/desafios-regulatorios-transfronteiricos-na-era-digital.html",
      "artigos/desafios-regulatorios-era-digital.html"
    ),
    false
  );
  assert.equal(canDeleteCmsArticle("/artigos.html"), false);
  assert.equal(canDeleteCmsArticle("/"), false);
  assert.equal(canDeleteCmsArticle("/calculadora.html"), false);
});

test("deleteArticle remove da listagem, apaga o artigo e preserva os demais", async () => {
  const db = createListingAwareMemoryDb();
  const service = createCmsPageService({ db });

  db.pages.set(3, {
    id: 3,
    path: "/artigos/outro.html",
    source_file: null,
    status: "published",
    latest_draft_version_id: 3,
    published_version_id: 3,
    previous_published_version_id: null,
    updated_at: "2026-07-22T00:00:00.000Z",
    published_at: "2026-07-22T00:00:00.000Z",
  });
  db.versions.set(3, {
    id: 3,
    version_number: 1,
    title: "Outro Artigo",
    slug: "outro",
    project_data: null,
    html: `<article class="artigo-detail"><h1 class="artigo-detail__title">Outro Artigo</h1><div class="artigo-detail__content"><p>Outro</p></div></article>`,
    css: "",
    js: "",
  });

  await service.publishLatestDraft({
    id: 1,
    timestamp: "2026-07-22T01:00:00.000Z",
  });

  const deleted = await service.deleteArticle({
    id: 1,
    timestamp: "2026-07-22T03:00:00.000Z",
  });
  assert.equal(deleted.path, "/artigos/novo.html");

  assert.equal(await service.getDraftById(1), null);
  assert.equal(await service.getPublishedByPath("/artigos/novo.html"), null);

  const listing = await db.getPublishedPageByPath("/artigos.html");
  assert.doesNotMatch(listing.html, /\/artigos\/novo\.html/);
  assert.match(listing.html, /\/artigos\/existente\.html/);

  assert.equal((await service.getPublishedByPath("/artigos/outro.html")).title, "Outro Artigo");
  assert.equal((await service.getPublishedByPath("/artigos.html")).path, "/artigos.html");
});

test("deleteArticle bloqueia páginas comuns e artigos do site map oficial", async () => {
  const db = createListingAwareMemoryDb();
  const service = createCmsPageService({ db });

  db.pages.set(10, {
    id: 10,
    path: "/",
    source_file: "index.html",
    status: "published",
    latest_draft_version_id: 10,
    published_version_id: 10,
    previous_published_version_id: null,
    updated_at: "2026-07-22T00:00:00.000Z",
    published_at: "2026-07-22T00:00:00.000Z",
  });
  db.versions.set(10, {
    id: 10,
    version_number: 1,
    title: "Home",
    slug: "home",
    project_data: null,
    html: "<main>Home</main>",
    css: "",
    js: "",
  });

  await assert.rejects(
    () => service.deleteArticle({ id: 10, timestamp: "2026-07-22T04:00:00.000Z" }),
    (error) => error && error.code === "CMS_ARTICLE_DELETE_FORBIDDEN"
  );
  assert.ok(await service.getDraftById(10));

  await assert.rejects(
    () => service.deleteArticle({ id: 2, timestamp: "2026-07-22T04:00:00.000Z" }),
    (error) => error && error.code === "CMS_ARTICLE_DELETE_FORBIDDEN"
  );
  assert.ok(await service.getDraftById(2));

  db.pages.set(11, {
    id: 11,
    path: "/artigos/desafios-regulatorios-era-digital.html",
    source_file: "artigos/desafios-regulatorios-era-digital.html",
    status: "published",
    latest_draft_version_id: 11,
    published_version_id: 11,
    previous_published_version_id: null,
    updated_at: "2026-07-22T00:00:00.000Z",
    published_at: "2026-07-22T00:00:00.000Z",
  });
  db.versions.set(11, {
    id: 11,
    version_number: 1,
    title: "Baseline",
    slug: "desafios-regulatorios-era-digital",
    project_data: null,
    html: "<article>Baseline</article>",
    css: "",
    js: "",
  });

  await assert.rejects(
    () => service.deleteArticle({ id: 11, timestamp: "2026-07-22T04:00:00.000Z" }),
    (error) => error && error.code === "CMS_ARTICLE_DELETE_FORBIDDEN"
  );
  assert.ok(await service.getDraftById(11));
});
