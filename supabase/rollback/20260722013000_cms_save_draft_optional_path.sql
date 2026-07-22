-- Rollback: restaura cms_save_page_draft sem p_path.
create or replace function public.cms_save_page_draft(
  p_page_id bigint,
  p_title text,
  p_slug text,
  p_project_data jsonb,
  p_html text,
  p_css text,
  p_js text,
  p_timestamp timestamptz default now()
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_page public.lamy_pages%rowtype;
  v_version_number bigint;
  v_version_id bigint;
begin
  select *
  into v_page
  from public.lamy_pages
  where id = p_page_id
  for update;

  if not found then
    raise exception 'Página % não encontrada.', p_page_id
      using errcode = 'P0002';
  end if;

  select coalesce(max(version_number), 0) + 1
  into v_version_number
  from public.lamy_page_versions
  where page_id = p_page_id;

  insert into public.lamy_page_versions (
    page_id,
    version_number,
    title,
    slug,
    project_data,
    html,
    css,
    js,
    created_at,
    updated_at
  )
  values (
    p_page_id,
    v_version_number,
    p_title,
    p_slug,
    p_project_data,
    coalesce(p_html, ''),
    coalesce(p_css, ''),
    coalesce(p_js, ''),
    p_timestamp,
    p_timestamp
  )
  returning id into v_version_id;

  update public.lamy_pages
  set
    title = p_title,
    slug = p_slug,
    project_data = p_project_data,
    html = coalesce(p_html, ''),
    css = coalesce(p_css, ''),
    js = coalesce(p_js, ''),
    latest_draft_version_id = v_version_id,
    updated_at = p_timestamp
  where id = p_page_id;

  return v_version_id;
end;
$$;

drop function if exists public.cms_save_page_draft(bigint, text, text, jsonb, text, text, text, timestamptz, text);

revoke all on function public.cms_save_page_draft(bigint, text, text, jsonb, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.cms_save_page_draft(bigint, text, text, jsonb, text, text, text, timestamptz)
  to service_role;
