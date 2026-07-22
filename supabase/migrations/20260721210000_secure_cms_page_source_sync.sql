create unique index if not exists lamy_pages_source_file_unique_idx
  on public.lamy_pages (source_file)
  where source_file is not null;

create or replace function public.cms_attach_page_source(
  p_page_id bigint,
  p_path text,
  p_source_file text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_page public.lamy_pages%rowtype;
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

  if v_page.path is not null and v_page.path is distinct from p_path then
    raise exception 'A página % já está vinculada à URL %.', p_page_id, v_page.path
      using errcode = '23505';
  end if;

  if v_page.source_file is not null and v_page.source_file is distinct from p_source_file then
    raise exception 'A página % já está vinculada ao arquivo %.', p_page_id, v_page.source_file
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.lamy_pages other_page
    where other_page.id <> p_page_id
      and (
        other_page.path = p_path
        or other_page.source_file = p_source_file
      )
  ) then
    raise exception 'A URL ou arquivo de origem já pertence a outra página.'
      using errcode = '23505';
  end if;

  update public.lamy_pages
  set
    path = coalesce(path, p_path),
    source_file = coalesce(source_file, p_source_file)
  where id = p_page_id;
end;
$$;

revoke all on function public.cms_attach_page_source(bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.cms_attach_page_source(bigint, text, text)
  to service_role;
