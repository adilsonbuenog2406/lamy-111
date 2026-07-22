const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260721190000_prepare_cms_page_versions.sql"
);
const migration = fs.readFileSync(migrationPath, "utf8");
const sourceSyncMigration = fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260721210000_secure_cms_page_source_sync.sql"
  ),
  "utf8"
);
const savePathMigration = fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260722013000_cms_save_draft_optional_path.sql"
  ),
  "utf8"
);
const deleteArticleMigration = fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260722024000_cms_delete_article.sql"
  ),
  "utf8"
);
const rollback = fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "supabase",
    "rollback",
    "20260721190000_prepare_cms_page_versions.sql"
  ),
  "utf8"
);

test("migration cria snapshots versionados e ponteiros independentes", () => {
  assert.match(migration, /create table if not exists public\.lamy_page_versions/i);
  assert.match(migration, /latest_draft_version_id bigint/i);
  assert.match(migration, /published_version_id bigint/i);
  assert.match(migration, /previous_published_version_id bigint/i);
  assert.match(migration, /unique \(page_id, version_number\)/i);
  assert.match(migration, /create unique index if not exists lamy_pages_path_unique_idx/i);
});

test("Save e Publish são RPCs transacionais separadas", () => {
  assert.match(migration, /function public\.cms_save_page_draft/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /latest_draft_version_id = v_version_id/i);
  assert.match(migration, /function public\.cms_publish_page/i);
  assert.match(migration, /latest_draft_version_id is distinct from p_version_id/i);
  assert.match(migration, /published_version_id = p_version_id/i);
  assert.match(migration, /previous_published_version_id = published_version_id/i);
});

test("Publish rejeita colisão com slug já publicado", () => {
  assert.match(migration, /join public\.lamy_page_versions published_version/i);
  assert.match(migration, /published_version\.slug = v_slug/i);
  assert.match(migration, /using errcode = '23505'/i);
});

test("tabela de versões não concede mutação direta ao service role", () => {
  assert.match(
    migration,
    /revoke all on table public\.lamy_page_versions from service_role/i
  );
  assert.match(
    migration,
    /grant select on table public\.lamy_page_versions to service_role/i
  );
  assert.doesNotMatch(
    migration,
    /grant\s+(?:insert|update|delete)[^;]*lamy_page_versions[^;]*service_role/i
  );
});

test("migration oferece rollback de snapshot publicado sem mover o draft", () => {
  const rollbackFunction = migration.match(
    /create or replace function public\.cms_rollback_page[\s\S]+?(?=\n\$\$;)/i
  )?.[0];

  assert.ok(rollbackFunction);
  assert.match(rollbackFunction, /published_version_id = v_target_version_id/i);
  assert.doesNotMatch(rollbackFunction, /latest_draft_version_id\s*=/i);
});

test("rollback de schema preserva o snapshot público antes de remover versões", () => {
  assert.match(rollback, /version\.id = page\.published_version_id/i);
  assert.match(rollback, /drop table if exists public\.lamy_page_versions/i);
  assert.match(rollback, /grant select, insert, update, delete on table public\.lamy_pages/i);
});

test("associação de URL canônica usa RPC restrita e imutável", () => {
  assert.match(sourceSyncMigration, /function public\.cms_attach_page_source/i);
  assert.match(sourceSyncMigration, /for update/i);
  assert.match(sourceSyncMigration, /v_page\.path is distinct from p_path/i);
  assert.match(sourceSyncMigration, /lamy_pages_source_file_unique_idx/i);
  assert.match(
    sourceSyncMigration,
    /grant execute on function public\.cms_attach_page_source[\s\S]+?to service_role/i
  );
});

test("save draft aceita path opcional só para páginas ainda não publicadas", () => {
  assert.match(savePathMigration, /p_path text default null/i);
  assert.match(savePathMigration, /published_version_id is not null/i);
  assert.match(savePathMigration, /path = v_next_path/i);
});

test("delete article é RPC exclusiva para /artigos/*.html", () => {
  assert.match(deleteArticleMigration, /function public\.cms_delete_article/i);
  assert.match(deleteArticleMigration, /\^\/artigos\/\[\^\/\]\+\\\.html\$/i);
  assert.match(deleteArticleMigration, /delete from public\.lamy_pages/i);
  assert.match(
    deleteArticleMigration,
    /grant execute on function public\.cms_delete_article\(bigint\) to service_role/i
  );
  assert.match(
    deleteArticleMigration,
    /revoke all on function public\.cms_delete_article\(bigint\) from public, anon, authenticated/i
  );
});
