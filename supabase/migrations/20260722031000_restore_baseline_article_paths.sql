-- Restaura path/slug canônicos de artigos do site map cujo Save regenerou URL pelo título.
update public.lamy_pages as page
set
  path = canonical.path,
  slug = canonical.slug
from (
  values
    (
      'artigos/desafios-regulatorios-era-digital.html',
      '/artigos/desafios-regulatorios-era-digital.html',
      'desafios-regulatorios-era-digital'
    ),
    (
      'artigos/exclusao-icms-difal-pis-cofins.html',
      '/artigos/exclusao-icms-difal-pis-cofins.html',
      'exclusao-icms-difal-pis-cofins'
    ),
    (
      'artigos/liquidity-events-ma-2024.html',
      '/artigos/liquidity-events-ma-2024.html',
      'liquidity-events-ma-2024'
    ),
    (
      'artigos/transacao-tributaria-debitos-posteriores.html',
      '/artigos/transacao-tributaria-debitos-posteriores.html',
      'transacao-tributaria-debitos-posteriores'
    )
) as canonical(source_file, path, slug)
where page.source_file = canonical.source_file
  and (
    page.path is distinct from canonical.path
    or page.slug is distinct from canonical.slug
  );
