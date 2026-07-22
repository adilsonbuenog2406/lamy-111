const { createClient } = require("@supabase/supabase-js");

const TABLE = "lamy_pages";
const DRAFT_VIEW = "lamy_page_drafts";
const PUBLISHED_VIEW = "lamy_page_published";
const VERSIONS_TABLE = "lamy_page_versions";
const CALCULATOR_LEADS_TABLE = "lamy_calculator_leads";

function normalizeRow(row) {
  if (!row) return null;

  return {
    ...row,
    project_data:
      typeof row.project_data === "string"
        ? JSON.parse(row.project_data)
        : row.project_data,
  };
}

function requireSupabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  }

  return { url, serviceRoleKey };
}

function createCmsDb() {
  let supabase;

  function getClient() {
    if (supabase) return supabase;

    const { url, serviceRoleKey } = requireSupabaseEnv();
    supabase = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    return supabase;
  }

  function throwIfError(error) {
    if (error) throw error;
  }

  async function savePageDraft({ id, title, slug, projectData, html, css, js, timestamp, path = null }) {
    const parsedProjectData =
      typeof projectData === "string"
        ? JSON.parse(projectData)
        : projectData || null;
    const payload = {
      p_page_id: id,
      p_title: title,
      p_slug: slug,
      p_project_data: parsedProjectData,
      p_html: html,
      p_css: css,
      p_js: js,
      p_timestamp: timestamp,
    };
    if (path != null) payload.p_path = path;

    const { error } = await getClient().rpc("cms_save_page_draft", payload);
    throwIfError(error);
  }

  async function publishLatestDraft({ id, versionId, timestamp }) {
    const { error } = await getClient().rpc("cms_publish_page", {
      p_page_id: id,
      p_version_id: versionId,
      p_timestamp: timestamp,
    });
    throwIfError(error);
  }

  return {
    kind: "supabase",
    ready: Promise.resolve(),
    getHealth() {
      return {
        ok: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
        hasUrl: Boolean(process.env.SUPABASE_URL),
        hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      };
    },
    async findPageIdBySlug(slug) {
      const { data, error } = await getClient()
        .from(TABLE)
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      throwIfError(error);
      if (data) return normalizeRow(data);

      const { data: published, error: publishedError } = await getClient()
        .from(PUBLISHED_VIEW)
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      throwIfError(publishedError);
      return normalizeRow(published);
    },
    async findPageIdByPath(path) {
      const { data, error } = await getClient()
        .from(TABLE)
        .select("id")
        .eq("path", path)
        .maybeSingle();
      throwIfError(error);
      return normalizeRow(data);
    },
    async listPages() {
      const { data, error } = await getClient()
        .from(DRAFT_VIEW)
        .select(
          "id,title,slug,path,source_file,status,updated_at,published_at,version_number,published_version_id,has_unpublished_changes"
        )
        .order("updated_at", { ascending: false });
      throwIfError(error);
      return (data || []).map(normalizeRow);
    },
    async createPage({ title, slug, path = null, sourceFile = null, timestamp }) {
      const { data, error } = await getClient().rpc("cms_create_page", {
        p_title: title,
        p_slug: slug,
        p_path: path,
        p_source_file: sourceFile,
        p_timestamp: timestamp,
      });
      throwIfError(error);
      return { id: data };
    },
    async ensurePageCanonicalMeta({ id, path = null, sourceFile = null }) {
      const { error } = await getClient().rpc("cms_attach_page_source", {
        p_page_id: id,
        p_path: path,
        p_source_file: sourceFile,
      });
      throwIfError(error);
    },
    async getPageById(id) {
      const { data, error } = await getClient()
        .from(DRAFT_VIEW)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      throwIfError(error);
      if (data) return normalizeRow(data);

      const { data: page, error: pageError } = await getClient()
        .from(TABLE)
        .select(
          "id,title,slug,path,source_file,status,created_at,updated_at,published_at,latest_draft_version_id,published_version_id,previous_published_version_id"
        )
        .eq("id", id)
        .maybeSingle();
      throwIfError(pageError);
      return normalizeRow(page);
    },
    savePageDraft,
    updatePage: savePageDraft,
    publishLatestDraft,
    publishPage: publishLatestDraft,
    async rollbackPublished({ id, versionId = null, timestamp }) {
      const { error } = await getClient().rpc("cms_rollback_page", {
        p_page_id: id,
        p_version_id: versionId,
        p_timestamp: timestamp,
      });
      throwIfError(error);
    },
    async deleteArticlePage({ id }) {
      const { error } = await getClient().rpc("cms_delete_article", {
        p_page_id: id,
      });
      throwIfError(error);
    },
    async getPublishedPageBySlug(slug) {
      const { data, error } = await getClient()
        .from(PUBLISHED_VIEW)
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      throwIfError(error);
      return normalizeRow(data);
    },
    async getPublishedPageByPath(path) {
      const { data, error } = await getClient()
        .from(PUBLISHED_VIEW)
        .select("*")
        .eq("path", path)
        .maybeSingle();
      throwIfError(error);
      return normalizeRow(data);
    },
    async checkCalculatorLeadsTable() {
      const { error } = await getClient()
        .from(CALCULATOR_LEADS_TABLE)
        .select("id")
        .limit(1);
      throwIfError(error);
      return true;
    },
    async upsertCalculatorLead(lead) {
      const { data, error } = await getClient()
        .from(CALCULATOR_LEADS_TABLE)
        .upsert(lead)
        .select("id,status,current_step,updated_at")
        .single();
      throwIfError(error);
      return normalizeRow(data);
    },
    async listCalculatorLeads({ status = "complete", limit = 100, offset = 0 } = {}) {
      const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
      const safeOffset = Math.max(Number(offset) || 0, 0);

      let query = getClient()
        .from(CALCULATOR_LEADS_TABLE)
        .select(
          "id,status,current_step,created_at,updated_at,completed_at,segment,segment_label,email,phone,cnpj,contact_consent,marketing_consent,rbt12,vehicle_value,simples,estimated_savings,raw_payload"
        )
        .order("created_at", { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      throwIfError(error);
      return (data || []).map(normalizeRow);
    },
    async getCalculatorLeadById(id) {
      const { data, error } = await getClient()
        .from(CALCULATOR_LEADS_TABLE)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      throwIfError(error);
      return normalizeRow(data);
    },
  };
}

module.exports = {
  createCmsDb,
  TABLE,
  DRAFT_VIEW,
  PUBLISHED_VIEW,
  VERSIONS_TABLE,
  CALCULATOR_LEADS_TABLE,
};
