const fs = require("fs");
const path = require("path");

const { JSDOM } = require("jsdom");

const { listSiteMapPages } = require("./cms-site-map");

function isEmptyGrapesProjectData(projectData) {
  let data = projectData;
  if (!data) return true;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return true;
    }
  }
  if (typeof data !== "object") return true;

  const pages = data.pages;
  if (!Array.isArray(pages) || !pages.length) return true;

  return pages.every((pageItem) => {
    const frames = pageItem?.frames;
    if (!Array.isArray(frames) || !frames.length) return true;
    return frames.every((frame) => {
      const component = frame?.component;
      if (!component || typeof component !== "object") return true;
      const children = component.components;
      if (Array.isArray(children)) return children.length === 0;
      if (children && typeof children === "object") {
        return Object.keys(children).length === 0;
      }
      return !children;
    });
  });
}

function hasStoredContent(page) {
  return Boolean(
    !isEmptyGrapesProjectData(page?.project_data) ||
      String(page?.html || "").trim() ||
      String(page?.css || "").trim() ||
      String(page?.js || "").trim()
  );
}

function createStaticPageImporter({ db, rootDir }) {
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

  async function resolveExistingPage(page) {
    const byPath = await db.findPageIdByPath(page.path);
    if (byPath) return { page: byPath, matchedBy: "path" };

    const bySlug = await db.findPageIdBySlug(page.slug);
    if (!bySlug) return null;

    const stored = typeof db.getPageById === "function" ? await db.getPageById(bySlug.id) : bySlug;
    if (stored?.path && stored.path !== page.path) {
      const error = new Error(
        `O slug "${page.slug}" já pertence à URL ${stored.path}; a URL ${page.path} não foi associada.`
      );
      error.code = "CMS_PAGE_SLUG_CONFLICT";
      throw error;
    }

    return { page: stored || bySlug, matchedBy: "slug" };
  }

  async function importPage(page, { timestamp = new Date().toISOString() } = {}) {
    const htmlFile = readText(page.sourceFile);
    const pageDir =
      path.posix.dirname(page.sourceFile) === "." ? "" : path.posix.dirname(page.sourceFile);
    const dom = new JSDOM(htmlFile);
    const { document } = dom.window;
    const title = extractTitle(document, page.title);
    const css = collectCss(document, pageDir);
    const js = collectJs(document, pageDir);

    document.querySelectorAll("script").forEach((script) => script.remove());
    rewriteRelativeUrls(document, pageDir);

    const bodyHtml = document.body.innerHTML.trim();
    const existingMatch = await resolveExistingPage(page);

    if (existingMatch) {
      const existing = existingMatch.page;
      if (typeof db.ensurePageCanonicalMeta === "function") {
        await db.ensurePageCanonicalMeta({
          id: existing.id,
          path: page.path,
          sourceFile: page.sourceFile,
        });
      }

      const stored =
        typeof db.getPageById === "function" ? await db.getPageById(existing.id) : existing;
      if (hasStoredContent(stored)) {
        return {
          action: "unchanged",
          id: existing.id,
          title: stored.title || title,
          slug: stored.slug || page.slug,
          path: page.path,
          sourceFile: page.sourceFile,
        };
      }

      await db.updatePage({
        id: existing.id,
        title,
        slug: page.slug,
        projectData: null,
        html: bodyHtml,
        css,
        js,
        timestamp,
      });
      return {
        action: "updated",
        id: existing.id,
        title,
        slug: page.slug,
        path: page.path,
        sourceFile: page.sourceFile,
      };
    }

    const result = await db.createPage({
      title,
      slug: page.slug,
      path: page.path,
      sourceFile: page.sourceFile,
      timestamp,
    });
    await db.updatePage({
      id: result.id,
      title,
      slug: page.slug,
      projectData: null,
      html: bodyHtml,
      css,
      js,
      timestamp,
    });

    return {
      action: "created",
      id: result.id,
      title,
      slug: page.slug,
      path: page.path,
      sourceFile: page.sourceFile,
    };
  }

  async function syncBaselinePages(options = {}) {
    const results = [];
    for (const page of listSiteMapPages()) {
      results.push(await importPage(page, options));
    }
    return results;
  }

  return {
    importPage,
    syncBaselinePages,
  };
}

module.exports = {
  createStaticPageImporter,
  isEmptyGrapesProjectData,
};
