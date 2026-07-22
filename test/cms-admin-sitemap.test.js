const assert = require("node:assert/strict");
const test = require("node:test");

const { buildAdminPageInventory, getPageAdminStatusLabel } = require("../lib/cms-admin-inventory");

test("inventário administrativo mistura site map estático com páginas CMS", () => {
  const { officialPages, extraPages } = buildAdminPageInventory([
    {
      id: 11,
      title: "Home CMS",
      path: "/",
      slug: "home",
      status: "published",
      updated_at: "2026-07-21T12:00:00.000Z",
      has_unpublished_changes: false,
    },
    {
      id: 99,
      title: "Landing Extra",
      path: "/landing-extra",
      slug: "landing-extra",
      status: "draft",
      updated_at: "2026-07-21T13:00:00.000Z",
      has_unpublished_changes: false,
    },
  ]);

  assert.equal(officialPages.length, 7);
  assert.equal(extraPages.length, 1);
  assert.equal(officialPages.find((page) => page.path === "/").status, "published");
  assert.equal(officialPages.find((page) => page.path === "/artigos.html").status, "static");
  assert.equal(getPageAdminStatusLabel(officialPages.find((page) => page.path === "/artigos.html")), "Estática");
  assert.equal(extraPages[0].path, "/landing-extra");
});
