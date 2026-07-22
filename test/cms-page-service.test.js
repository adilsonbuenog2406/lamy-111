const assert = require("node:assert/strict");
const test = require("node:test");

const { createCmsPageService } = require("../lib/cms-page-service");

function createMemoryDb({ publishedHtml = "versão A", withDraft = true } = {}) {
  let nextVersionId = 2;
  let failNextPublish = false;
  const versions = new Map();
  const page = {
    id: 1,
    path: "/teste.html",
    source_file: null,
    status: publishedHtml ? "published" : "draft",
    latest_draft_version_id: withDraft ? 1 : null,
    published_version_id: publishedHtml ? 1 : null,
    previous_published_version_id: null,
    updated_at: "2026-07-21T00:00:00.000Z",
    published_at: publishedHtml ? "2026-07-21T00:00:00.000Z" : null,
  };

  if (withDraft) {
    versions.set(1, {
      id: 1,
      version_number: 1,
      title: "Página",
      slug: "teste",
      project_data: null,
      html: publishedHtml || "rascunho inicial",
      css: "",
      js: "",
    });
  }

  function snapshot(versionId) {
    if (!versionId) return null;
    const version = versions.get(versionId);
    if (!version) return null;
    return {
      ...page,
      ...version,
      version_id: version.id,
      has_unpublished_changes:
        page.published_version_id === null ||
        page.latest_draft_version_id !== page.published_version_id,
    };
  }

  return {
    setFailNextPublish(value) {
      failNextPublish = value;
    },
    async getPageById(id) {
      if (Number(id) !== page.id) return null;
      return (
        snapshot(page.latest_draft_version_id) || {
          ...page,
          title: "Página",
          slug: "teste",
          project_data: null,
          html: "",
          css: "",
          js: "",
        }
      );
    },
    async savePageDraft(input) {
      const currentVersion = snapshot(page.latest_draft_version_id);
      const id = nextVersionId++;
      versions.set(id, {
        id,
        version_number: (currentVersion?.version_number || 0) + 1,
        title: input.title,
        slug: input.slug,
        project_data: input.projectData,
        html: input.html,
        css: input.css,
        js: input.js,
      });
      page.latest_draft_version_id = id;
      page.updated_at = input.timestamp;
    },
    async publishLatestDraft({ versionId, timestamp }) {
      if (failNextPublish) {
        failNextPublish = false;
        throw new Error("falha transacional simulada");
      }
      if (versionId !== page.latest_draft_version_id) {
        throw new Error("rascunho mudou durante a publicação");
      }
      page.previous_published_version_id = page.published_version_id;
      page.published_version_id = versionId;
      page.status = "published";
      page.published_at = timestamp;
    },
    async rollbackPublished({ versionId, timestamp }) {
      const target = versionId || page.previous_published_version_id;
      if (!target || !versions.has(target)) throw new Error("versão anterior ausente");
      page.previous_published_version_id = page.published_version_id;
      page.published_version_id = target;
      page.published_at = timestamp;
    },
    async getPublishedPageByPath(pagePath) {
      if (pagePath !== page.path) return null;
      return snapshot(page.published_version_id);
    },
    async getPublishedPageBySlug(slug) {
      const published = snapshot(page.published_version_id);
      return published?.slug === slug ? published : null;
    },
  };
}

function draftInput(html, timestamp) {
  return {
    id: 1,
    title: "Página",
    slug: "teste",
    projectData: null,
    html,
    css: "",
    js: "",
    timestamp,
  };
}

test("Save, Preview e Publish mantêm snapshots independentes", async () => {
  const db = createMemoryDb();
  const service = createCmsPageService({ db });

  assert.equal((await service.getPublishedByPath("/teste.html")).html, "versão A");

  await service.saveDraft(draftInput("versão B", "2026-07-21T01:00:00.000Z"));
  assert.equal((await service.getDraftById(1)).html, "versão B");
  assert.equal((await service.getPublishedByPath("/teste.html")).html, "versão A");

  await service.publishLatestDraft({ id: 1, timestamp: "2026-07-21T02:00:00.000Z" });
  assert.equal((await service.getDraftById(1)).html, "versão B");
  assert.equal((await service.getPublishedByPath("/teste.html")).html, "versão B");

  await service.saveDraft(draftInput("versão C", "2026-07-21T03:00:00.000Z"));
  assert.equal((await service.getDraftById(1)).html, "versão C");
  assert.equal((await service.getPublishedByPath("/teste.html")).html, "versão B");

  await service.publishLatestDraft({ id: 1, timestamp: "2026-07-21T04:00:00.000Z" });
  assert.equal((await service.getPublishedByPath("/teste.html")).html, "versão C");
});

test("múltiplos Saves não alteram o snapshot publicado", async () => {
  const db = createMemoryDb();
  const service = createCmsPageService({ db });

  await service.saveDraft(draftInput("B1", "2026-07-21T01:00:00.000Z"));
  await service.saveDraft(draftInput("B2", "2026-07-21T02:00:00.000Z"));
  await service.saveDraft(draftInput("B3", "2026-07-21T03:00:00.000Z"));

  const reloadedEditor = await service.getDraftById(1);
  assert.equal(reloadedEditor.html, "B3");
  assert.equal(reloadedEditor.version_number, 4);
  assert.equal((await service.getPublishedByPath("/teste.html")).html, "versão A");
});

test("falha durante Publish preserva a publicação anterior", async () => {
  const db = createMemoryDb();
  const service = createCmsPageService({ db });

  await service.saveDraft(draftInput("versão B", "2026-07-21T01:00:00.000Z"));
  db.setFailNextPublish(true);

  await assert.rejects(
    service.publishLatestDraft({ id: 1, timestamp: "2026-07-21T02:00:00.000Z" }),
    /falha transacional/
  );
  assert.equal((await service.getPublishedByPath("/teste.html")).html, "versão A");
  assert.equal((await service.getDraftById(1)).html, "versão B");
});

test("página sem rascunho não pode ser publicada", async () => {
  const service = createCmsPageService({
    db: createMemoryDb({ publishedHtml: "", withDraft: false }),
  });

  await assert.rejects(
    service.publishLatestDraft({ id: 1, timestamp: "2026-07-21T02:00:00.000Z" }),
    (error) => error.code === "CMS_DRAFT_REQUIRED"
  );
});

test("página sem publicação não aparece na leitura pública", async () => {
  const db = createMemoryDb({ publishedHtml: "", withDraft: true });
  const service = createCmsPageService({ db });

  assert.equal(await service.getPublishedByPath("/teste.html"), null);
  assert.equal((await service.getDraftById(1)).html, "rascunho inicial");
});

test("rollback troca somente o snapshot publicado e mantém o rascunho", async () => {
  const db = createMemoryDb();
  const service = createCmsPageService({ db });

  await service.saveDraft(draftInput("versão B", "2026-07-21T01:00:00.000Z"));
  await service.publishLatestDraft({ id: 1, timestamp: "2026-07-21T02:00:00.000Z" });
  await service.saveDraft(draftInput("versão C", "2026-07-21T03:00:00.000Z"));

  await service.rollbackPublished({
    id: 1,
    versionId: 1,
    timestamp: "2026-07-21T04:00:00.000Z",
  });

  assert.equal((await service.getPublishedByPath("/teste.html")).html, "versão A");
  assert.equal((await service.getDraftById(1)).html, "versão C");
});
