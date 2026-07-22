const assert = require("node:assert/strict");
const test = require("node:test");

const {
  BASELINE_PATHS,
  BASELINE_SOURCE_FILES,
  EXCLUDED_PUBLIC_ROUTES,
  getSiteMapPageByPath,
  isExcludedPublicRoute,
  listPublicBaselinePaths,
  listSiteMapPages,
  normalizeLookupPath,
} = require("../lib/cms-site-map");

test("site map lista as sete páginas oficiais com paths únicos", () => {
  const pages = listSiteMapPages();
  assert.equal(pages.length, 7);

  const paths = pages.map((page) => page.path);
  assert.deepEqual(new Set(paths).size, paths.length);
  assert.ok(paths.includes("/"));
  assert.ok(paths.includes("/artigos.html"));
  assert.ok(paths.includes("/calculadora.html"));
  assert.ok(paths.includes("/artigos/desafios-regulatorios-era-digital.html"));
  assert.ok(pages.every((page) => page.description));
});

test("rotas técnicas e privadas usam uma configuração explícita", () => {
  assert.ok(EXCLUDED_PUBLIC_ROUTES.length > 0);
  assert.equal(isExcludedPublicRoute("/admin/cms/pages"), true);
  assert.equal(isExcludedPublicRoute("/API/leads"), true);
  assert.equal(isExcludedPublicRoute("/assets/logo.svg"), true);
  assert.equal(isExcludedPublicRoute("/artigos.html"), false);
});

test("alias /index.html resolve para a Home canônica", () => {
  assert.equal(normalizeLookupPath("/index.html"), "/");
  assert.equal(getSiteMapPageByPath("/index.html").path, "/");
  assert.equal(getSiteMapPageByPath("/").sourceFile, "index.html");
  assert.ok(BASELINE_PATHS.has("/index.html"));
  assert.ok(BASELINE_SOURCE_FILES.has("index.html"));
});

test("paths públicos do baseline incluem aliases sem duplicar a Home no inventário", () => {
  const inventoryPaths = listSiteMapPages().map((page) => page.path);
  const publicPaths = listPublicBaselinePaths();

  assert.equal(inventoryPaths.filter((path) => path === "/").length, 1);
  assert.ok(publicPaths.includes("/"));
  assert.ok(publicPaths.includes("/index.html"));
});
