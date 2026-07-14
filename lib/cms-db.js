const { createClient } = require("@supabase/supabase-js");

const TABLE = "lamy_pages";
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
  const { url, serviceRoleKey } = requireSupabaseEnv();
  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  function throwIfError(error) {
    if (error) throw error;
  }

  return {
    kind: "supabase",
    ready: Promise.resolve(),
    async findPageIdBySlug(slug) {
      const { data, error } = await supabase
        .from(TABLE)
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      throwIfError(error);
      return normalizeRow(data);
    },
    async listPages() {
      const { data, error } = await supabase
        .from(TABLE)
        .select("id,title,slug,status,updated_at,published_at")
        .order("updated_at", { ascending: false });
      throwIfError(error);
      return (data || []).map(normalizeRow);
    },
    async createPage({ title, slug, timestamp }) {
      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          title,
          slug,
          status: "draft",
          html: "",
          css: "",
          js: "",
          created_at: timestamp,
          updated_at: timestamp,
        })
        .select("id")
        .single();
      throwIfError(error);
      return normalizeRow(data);
    },
    async getPageById(id) {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      throwIfError(error);
      return normalizeRow(data);
    },
    async updatePage({ id, title, slug, projectData, html, css, js, timestamp }) {
      const { error } = await supabase
        .from(TABLE)
        .update({
          title,
          slug,
          project_data: projectData ? JSON.parse(projectData) : null,
          html,
          css,
          js,
          updated_at: timestamp,
        })
        .eq("id", id);
      throwIfError(error);
    },
    async publishPage({ id, title, slug, projectData, html, css, js, timestamp }) {
      const { error } = await supabase
        .from(TABLE)
        .update({
          title,
          slug,
          status: "published",
          project_data: projectData ? JSON.parse(projectData) : null,
          html,
          css,
          js,
          updated_at: timestamp,
          published_at: timestamp,
        })
        .eq("id", id);
      throwIfError(error);
    },
    async getPublishedPageBySlug(slug) {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      throwIfError(error);
      return normalizeRow(data);
    },
    async upsertCalculatorLead(lead) {
      const { data, error } = await supabase
        .from(CALCULATOR_LEADS_TABLE)
        .upsert(lead)
        .select("id,status,current_step,updated_at")
        .single();
      throwIfError(error);
      return normalizeRow(data);
    },
  };
}

module.exports = { createCmsDb, TABLE, CALCULATOR_LEADS_TABLE };
