const assert = require("node:assert/strict");
const test = require("node:test");

const app = require("../server");
const { listPublicBaselinePaths, listSiteMapPages } = require("../lib/cms-site-map");

const staticPages = listPublicBaselinePaths();

test("os HTMLs originais continuam disponíveis como fallback", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const { port } = server.address();
  for (const pagePath of staticPages) {
    const response = await fetch(`http://127.0.0.1:${port}${pagePath}`);
    assert.equal(response.status, 200, `${pagePath} deveria usar fallback estático`);
    assert.match(response.headers.get("content-type") || "", /^text\/html/);
    assert.match(await response.text(), /Lamy/i);
  }
});

test("site map oficial cobre sete páginas e alias da Home", () => {
  assert.equal(listSiteMapPages().length, 7);
  assert.ok(staticPages.includes("/"));
  assert.ok(staticPages.includes("/index.html"));
});
