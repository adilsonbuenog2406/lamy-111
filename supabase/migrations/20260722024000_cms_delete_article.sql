create or replace function public.cms_delete_article(
  p_page_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_page public.lamy_pages%rowtype;
  v_path text;
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

  v_path := coalesce(v_page.path, '');

  -- Somente artigos/notícias sob /artigos/<slug>.html.
  -- Bloqueia páginas comuns, /artigos.html e qualquer outro path.
  if v_path !~* '^/artigos/[^/]+\.html$' then
    raise exception
      'Somente artigos/notícias em /artigos/*.html podem ser excluídos por esta operação.'
      using errcode = 'P0001';
  end if;

  update public.lamy_pages
  set
    latest_draft_version_id = null,
    published_version_id = null,
    previous_published_version_id = null
  where id = p_page_id;

  delete from public.lamy_page_versions
  where page_id = p_page_id;

  delete from public.lamy_pages
  where id = p_page_id;

  return true;
end;
$$;

revoke all on function public.cms_delete_article(bigint) from public, anon, authenticated;
grant execute on function public.cms_delete_article(bigint) to service_role;
