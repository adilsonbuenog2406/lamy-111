const assert = require("node:assert/strict");
const test = require("node:test");

const { createStaticPageImporter, isEmptyGrapesProjectData } = require("../lib/cms-static-import");
const { listSiteMapPages } = require("../lib/cms-site-map");

function createMemoryDb() {
  const pages = [];
  let nextId = 1;

  return {
    kind: "memory",
    async findPageIdByPath(pagePath) {
      const page = pages.find((entry) => entry.path === pagePath);
      return page ? { id: page.id } : null;
    },
    async findPageIdBySlug(slug) {
      const page = pages.find((entry) => entry.slug === slug);
      return page ? { id: page.id } : null;
    },
    async createPage({ title, slug, path = null, sourceFile = null }) {
      const id = nextId;
      nextId += 1;
      pages.push({
        id,
        title,
        slug,
        path,
        source_file: sourceFile,
        html: "",
        css: "",
        js: "",
      });
      return { id };
    },
    async ensurePageCanonicalMeta({ id, path = null, sourceFile = null }) {
      const page = pages.find((entry) => entry.id === id);
      if (!page) throw new Error("missing page");
      if (path != null) page.path = path;
      if (sourceFile != null) page.source_file = sourceFile;
    },
    async getPageById(id) {
      return pages.find((entry) => entry.id === id) || null;
    },
    async updatePage({ id, title, slug, html, css, js }) {
      const page = pages.find((entry) => entry.id === id);
      if (!page) throw new Error("missing page");
      page.title = title;
      page.slug = slug;
      page.html = html;
      page.css = css;
      page.js = js;
    },
    list() {
      return pages.slice();
    },
  };
}

test("importação do site map é idempotente por path canônico", async () => {
  const db = createMemoryDb();
  const importer = createStaticPageImporter({
    db,
    rootDir: require("node:path").join(__dirname, ".."),
  });

  const first = await importer.syncBaselinePages();
  const second = await importer.syncBaselinePages();

  assert.equal(first.length, 7);
  assert.equal(second.length, 7);
  assert.ok(first.every((result) => result.action === "created"));
  assert.ok(second.every((result) => result.action === "unchanged"));
  assert.equal(db.list().length, 7);

  for (const sitePage of listSiteMapPages()) {
    const stored = db.list().find((page) => page.path === sitePage.path);
    assert.ok(stored, `página ausente para ${sitePage.path}`);
    assert.equal(stored.slug, sitePage.slug);
    assert.equal(stored.source_file, sitePage.sourceFile);
    assert.ok(stored.html.includes("<"));
    assert.ok(stored.css.length > 0);
  }
});

test("reimporta página legado por slug e preenche path/source_file", async () => {
  const db = createMemoryDb();
  const home = listSiteMapPages().find((page) => page.path === "/");
  await db.createPage({
    title: "Home antiga",
    slug: home.slug,
    path: null,
    sourceFile: null,
  });

  const importer = createStaticPageImporter({
    db,
    rootDir: require("node:path").join(__dirname, ".."),
  });

  const [result] = await importer.syncBaselinePages();
  const stored = db.list().find((page) => page.slug === home.slug);

  assert.equal(result.action, "updated");
  assert.equal(stored.path, "/");
  assert.equal(stored.source_file, "index.html");
  assert.equal(db.list().length, 7);
});

test("sincronização não sobrescreve conteúdo já armazenado no CMS", async () => {
  const db = createMemoryDb();
  const home = listSiteMapPages().find((page) => page.path === "/");
  const created = await db.createPage({
    title: "Home editada",
    slug: home.slug,
    path: home.path,
    sourceFile: home.sourceFile,
  });
  await db.updatePage({
    id: created.id,
    title: "Home editada",
    slug: home.slug,
    html: "<main>Conteúdo preservado</main>",
    css: ".preservado{}",
    js: "",
  });

  const importer = createStaticPageImporter({
    db,
    rootDir: require("node:path").join(__dirname, ".."),
  });
  const result = await importer.importPage(home);
  const stored = await db.getPageById(created.id);

  assert.equal(result.action, "unchanged");
  assert.equal(stored.title, "Home editada");
  assert.equal(stored.html, "<main>Conteúdo preservado</main>");
  assert.equal(stored.css, ".preservado{}");
});

test("project_data vazio do GrapesJS não bloqueia reimportação do HTML", async () => {
  assert.equal(
    isEmptyGrapesProjectData({
      pages: [{ frames: [{ component: { type: "wrapper" } }] }],
    }),
    true
  );
  assert.equal(
    isEmptyGrapesProjectData({
      pages: [
        {
          frames: [
            {
              component: {
                type: "wrapper",
                components: [{ type: "text", content: "Olá" }],
              },
            },
          ],
        },
      ],
    }),
    false
  );

  const db = createMemoryDb();
  const article = listSiteMapPages().find(
    (page) => page.path === "/artigos/desafios-regulatorios-era-digital.html"
  );
  const created = await db.createPage({
    title: article.title,
    slug: article.slug,
    path: article.path,
    sourceFile: article.sourceFile,
  });
  const page = await db.getPageById(created.id);
  page.project_data = { pages: [{ frames: [{ component: { type: "wrapper" } }] }] };
  page.html = "";
  page.css = "";
  page.js = "";

  const importer = createStaticPageImporter({
    db,
    rootDir: require("node:path").join(__dirname, ".."),
  });
  const result = await importer.importPage(article);
  const stored = await db.getPageById(created.id);

  assert.equal(result.action, "updated");
  assert.match(stored.html, /Desafios Regulatórios Transfronteiriços/);
  assert.ok(stored.css.length > 0);
});

test("sincronização rejeita slug legado ligado a outra URL", async () => {
  const db = createMemoryDb();
  const home = listSiteMapPages().find((page) => page.path === "/");
  await db.createPage({
    title: "Conflito",
    slug: home.slug,
    path: "/outra-url",
  });
  const importer = createStaticPageImporter({
    db,
    rootDir: require("node:path").join(__dirname, ".."),
  });

  await assert.rejects(
    importer.importPage(home),
    (error) => error.code === "CMS_PAGE_SLUG_CONFLICT"
  );
});
