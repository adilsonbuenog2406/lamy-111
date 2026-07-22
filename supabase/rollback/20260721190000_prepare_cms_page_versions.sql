-- Rollback manual de emergência da Fase 0.5.
-- Faça backup de lamy_pages e lamy_page_versions antes de executar.
-- Em páginas publicadas, o snapshot público atual é preservado no schema legado.
-- Rascunhos não publicados continuam disponíveis apenas no backup exportado.

begin;

update public.lamy_pages page
set
  title = version.title,
  slug = version.slug,
  project_data = version.project_data,
  html = version.html,
  css = version.css,
  js = version.js,
  updated_at = greatest(page.updated_at, version.updated_at)
from public.lamy_page_versions version
where version.id = page.published_version_id
  and version.page_id = page.id;

update public.lamy_pages page
set
  title = version.title,
  slug = version.slug,
  project_data = version.project_data,
  html = version.html,
  css = version.css,
  js = version.js,
  updated_at = greatest(page.updated_at, version.updated_at)
from public.lamy_page_versions version
where page.published_version_id is null
  and version.id = page.latest_draft_version_id
  and version.page_id = page.id;

drop view if exists public.lamy_page_drafts;
drop view if exists public.lamy_page_published;

drop function if exists public.cms_create_page(text, text, text, text, timestamptz);
drop function if exists public.cms_save_page_draft(bigint, text, text, jsonb, text, text, text, timestamptz);
drop function if exists public.cms_publish_page(bigint, bigint, timestamptz);
drop function if exists public.cms_rollback_page(bigint, bigint, timestamptz);

alter table public.lamy_pages
  drop constraint if exists lamy_pages_latest_draft_version_fk,
  drop constraint if exists lamy_pages_published_version_fk,
  drop constraint if exists lamy_pages_previous_published_version_fk,
  drop constraint if exists lamy_pages_path_format_check;

drop index if exists public.lamy_pages_path_unique_idx;

alter table public.lamy_pages
  drop column if exists latest_draft_version_id,
  drop column if exists published_version_id,
  drop column if exists previous_published_version_id,
  drop column if exists path,
  drop column if exists source_file;

drop table if exists public.lamy_page_versions;

grant select, insert, update, delete on table public.lamy_pages to service_role;
grant usage, select on sequence public.lamy_pages_id_seq to service_role;

commit;
