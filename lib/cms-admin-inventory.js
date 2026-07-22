const {
  getSiteMapPageByPath,
  listSiteMapPages,
  normalizeLookupPath,
} = require("./cms-site-map");

function getPageAdminStatusLabel(page, { editor = false } = {}) {
  if (!page || page.status === "static") return "Estática";
  if (page.status !== "published") return "Rascunho";
  if (page.has_unpublished_changes) {
    return editor ? "Alterações não publicadas" : "Publicado · alterações pendentes";
  }
  return "Publicado";
}

function getPageAdminStatusClass(page) {
  if (!page || page.status === "static") return "static";
  if (page.status !== "published") return "draft";
  if (page.has_unpublished_changes) return "pending";
  return "published";
}

function buildAdminPageInventory(cmsPages) {
  const pagesByPath = new Map();
  const extraPages = [];

  for (const page of cmsPages || []) {
    const canonicalPath = normalizeLookupPath(page.path) || page.path;
    if (canonicalPath && getSiteMapPageByPath(canonicalPath)) {
      pagesByPath.set(canonicalPath, page);
      continue;
    }
    extraPages.push(page);
  }

  const officialPages = listSiteMapPages().map((sitePage) => {
    const cmsPage = pagesByPath.get(sitePage.path) || null;
    if (!cmsPage) {
      return {
        id: null,
        title: sitePage.title,
        path: sitePage.path,
        slug: sitePage.slug,
        source_file: sitePage.sourceFile,
        status: "static",
        updated_at: null,
        published_at: null,
        has_unpublished_changes: false,
        official: true,
      };
    }

    return {
      ...cmsPage,
      title: cmsPage.title || sitePage.title,
      path: sitePage.path,
      slug: cmsPage.slug || sitePage.slug,
      source_file: cmsPage.source_file || sitePage.sourceFile,
      official: true,
    };
  });

  return {
    officialPages,
    extraPages: extraPages.map((page) => ({ ...page, official: false })),
  };
}

module.exports = {
  buildAdminPageInventory,
  getPageAdminStatusClass,
  getPageAdminStatusLabel,
};
