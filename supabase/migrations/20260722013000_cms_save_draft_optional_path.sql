drop function if exists public.cms_save_page_draft(bigint, text, text, jsonb, text, text, text, timestamptz);
drop function if exists public.cms_save_page_draft(bigint, text, text, jsonb, text, text, text, timestamptz, text);

create or replace function public.cms_save_page_draft(
  p_page_id bigint,
  p_title text,
  p_slug text,
  p_project_data jsonb,
  p_html text,
  p_css text,
  p_js text,
  p_timestamp timestamptz default now(),
  p_path text default null
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
  v_next_path text;
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

  v_next_path := v_page.path;

  if p_path is not null then
    if v_page.published_version_id is not null then
      v_next_path := v_page.path;
    else
      if exists (
        select 1
        from public.lamy_pages other_page
        where other_page.id <> p_page_id
          and other_page.path = p_path
      ) then
        raise exception 'A URL "%" já pertence a outra página.', p_path
          using errcode = '23505';
      end if;
      v_next_path := p_path;
    end if;
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
    path = v_next_path,
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

revoke all on function public.cms_save_page_draft(bigint, text, text, jsonb, text, text, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.cms_save_page_draft(bigint, text, text, jsonb, text, text, text, timestamptz, text)
  to service_role;
