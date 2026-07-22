const { validatePublishablePage } = require("./cms-content");
const {
  LISTING_PAGE_PATH,
  canDeleteCmsArticle,
  extractArticleListingMeta,
  isCmsArticlePath,
  removeArticleCardFromListingHtml,
  upsertArticleCardInListingHtml,
} = require("./cms-article-template");

function createNotFoundError() {
  const error = new Error("Página não encontrada.");
  error.code = "CMS_PAGE_NOT_FOUND";
  return error;
}

function createNoDraftError() {
  const error = new Error("Salve um rascunho antes de publicar.");
  error.code = "CMS_DRAFT_REQUIRED";
  return error;
}

function createListingMissingError() {
  const error = new Error(
    "A listagem /artigos.html ainda não está no CMS. Sincronize o site map antes de publicar novos artigos."
  );
  error.code = "CMS_ARTICLES_LISTING_MISSING";
  return error;
}

function createArticleDeleteForbiddenError() {
  const error = new Error(
    "A exclusão está disponível somente para artigos/notícias criados no CMS em /artigos/*.html."
  );
  error.code = "CMS_ARTICLE_DELETE_FORBIDDEN";
  return error;
}

function createCmsPageService({ db, onAfterPublishArticle = null } = {}) {
  async function syncArticleIntoListing(publishedArticle, timestamp) {
    if (!isCmsArticlePath(publishedArticle?.path)) return null;

    const listingRef = await db.findPageIdByPath(LISTING_PAGE_PATH);
    if (!listingRef?.id) throw createListingMissingError();

    const listingDraft = await db.getPageById(listingRef.id);
    if (!listingDraft) throw createListingMissingError();

    const meta = {
      path: publishedArticle.path,
      ...extractArticleListingMeta(publishedArticle),
    };
    const { html, changed } = upsertArticleCardInListingHtml(listingDraft.html || "", meta);
    if (!changed) return listingDraft;

    await db.savePageDraft({
      id: listingDraft.id,
      title: listingDraft.title,
      slug: listingDraft.slug,
      projectData: null,
      html,
      css: listingDraft.css || "",
      js: listingDraft.js || "",
      timestamp,
    });

    const updatedListing = await db.getPageById(listingDraft.id);
    if (!updatedListing?.latest_draft_version_id) throw createNoDraftError();

    validatePublishablePage(updatedListing);
    await db.publishLatestDraft({
      id: updatedListing.id,
      versionId: updatedListing.version_id,
      timestamp,
    });

    return db.getPageById(updatedListing.id);
  }

  async function removeArticleFromListing(articlePath, timestamp) {
    if (!isCmsArticlePath(articlePath)) return null;

    const listingRef = await db.findPageIdByPath(LISTING_PAGE_PATH);
    if (!listingRef?.id) return null;

    const listingDraft = await db.getPageById(listingRef.id);
    if (!listingDraft) return null;

    const { html, changed } = removeArticleCardFromListingHtml(
      listingDraft.html || "",
      articlePath
    );
    if (!changed) return listingDraft;

    await db.savePageDraft({
      id: listingDraft.id,
      title: listingDraft.title,
      slug: listingDraft.slug,
      projectData: null,
      html,
      css: listingDraft.css || "",
      js: listingDraft.js || "",
      timestamp,
    });

    const updatedListing = await db.getPageById(listingDraft.id);
    if (!updatedListing?.latest_draft_version_id) throw createNoDraftError();

    validatePublishablePage(updatedListing);
    await db.publishLatestDraft({
      id: updatedListing.id,
      versionId: updatedListing.version_id,
      timestamp,
    });

    return db.getPageById(updatedListing.id);
  }

  return {
    async getDraftById(id) {
      return db.getPageById(id);
    },

    async getPublishedBySlug(slug) {
      return db.getPublishedPageBySlug(slug);
    },

    async getPublishedByPath(path) {
      return db.getPublishedPageByPath(path);
    },

    async saveDraft(input) {
      const existing = await db.getPageById(input.id);
      if (!existing) throw createNotFoundError();

      await db.savePageDraft(input);
      return db.getPageById(input.id);
    },

    async publishLatestDraft({ id, timestamp }) {
      const draft = await db.getPageById(id);
      if (!draft) throw createNotFoundError();
      if (!draft.latest_draft_version_id) throw createNoDraftError();

      validatePublishablePage(draft);
      await db.publishLatestDraft({
        id,
        versionId: draft.version_id,
        timestamp,
      });

      const published = await db.getPageById(id);
      if (isCmsArticlePath(published?.path)) {
        await syncArticleIntoListing(published, timestamp);
        if (typeof onAfterPublishArticle === "function") {
          await onAfterPublishArticle(published);
        }
      }

      return published;
    },

    async rollbackPublished({ id, versionId, timestamp }) {
      const draft = await db.getPageById(id);
      if (!draft) throw createNotFoundError();

      await db.rollbackPublished({ id, versionId, timestamp });
      return db.getPageById(id);
    },

    async deleteArticle({ id, timestamp }) {
      const page = await db.getPageById(id);
      if (!page) throw createNotFoundError();

      if (!canDeleteCmsArticle(page.path, page.source_file)) {
        throw createArticleDeleteForbiddenError();
      }

      const articlePath = page.path;
      await removeArticleFromListing(articlePath, timestamp || new Date().toISOString());
      await db.deleteArticlePage({ id });

      return {
        id: page.id,
        path: articlePath,
        title: page.title,
        slug: page.slug,
      };
    },
  };
}

module.exports = { createCmsPageService };
