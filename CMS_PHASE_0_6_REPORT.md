# Mapa Editável do Site — relatório da Fase 0.6

Data: 21/07/2026  
Status: **interrompida com segurança antes de backup, vínculo ou aplicação**.

Nenhuma migration foi aplicada. Nenhum HTML foi importado. Nenhuma das sete páginas foi migrada ou alterada.

## 1. Projeto Supabase configurado

O backend lê `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` em `lib/cms-db.js`.

Configuração encontrada em `.env`, sem exposição das chaves:

- `SUPABASE_URL`: configurada.
- `SUPABASE_ANON_KEY`: configurada.
- `SUPABASE_SERVICE_ROLE_KEY`: configurada.
- URL configurada: `https://qwvxonvtqvdvwdsqehsl.supabase.co`.
- Project ref derivado do host configurado: `qwvxonvtqvdvwdsqehsl`.

Uma consulta REST somente leitura, autenticada com a service role usada pelo backend, respondeu pelo host configurado. Isso comprova que as credenciais locais acessam esse endpoint, mas não comprova de forma independente que ele é o ambiente remoto correto para receber a migration.

O arquivo `supabase/config.toml` contém `project_id = "site111-lamy"`. Esse valor identifica o projeto local do CLI e não substitui o project ref remoto.

## 2. Project ref

Ref encontrado na URL: `qwvxonvtqvdvwdsqehsl`.

Confirmação segura: **pendente**.

Motivos:

- não existe vínculo local em `.supabase/`;
- o Supabase CLI não está autenticado;
- `npx supabase projects list` falhou com `Access token not provided`;
- não há MCP Supabase disponível;
- não foi possível confirmar nome, organização, região, branch ou classificação do ambiente como produção/staging.

## 3. Backup remoto

Backup remoto: **não verificado e não gerado**.

Não foi possível consultar:

- backups automáticos disponíveis;
- data/hora do último backup;
- retenção;
- status de restauração;
- Point-in-Time Recovery;
- branch de recuperação.

Também não há senha/conexão PostgreSQL administrativa disponível para executar `pg_dump`.

Nenhum dado foi apagado ou modificado.

## 4. Estratégia de rollback

Já existe rollback de schema preparado localmente:

- `supabase/rollback/20260721190000_prepare_cms_page_versions.sql`.

Ele não deve ser usado como substituto de backup remoto. Antes de qualquer aplicação ainda serão necessários:

1. backup gerenciado confirmado no Dashboard, ou `pg_dump` consistente;
2. registro da data/hora e identificação do projeto;
3. teste ou confirmação documentada do procedimento de restauração;
4. export de `lamy_pages` antes da migration;
5. aplicação somente após dry-run no projeto confirmado.

## 5. Schema remoto observado

Foi feita somente introspecção REST read-only.

Tabela `lamy_pages`:

- acessível com a conexão usada pelo backend;
- contém 2 registros;
- colunas expostas:
  - `id`
  - `title`
  - `slug`
  - `status`
  - `project_data`
  - `html`
  - `css`
  - `js`
  - `created_at`
  - `updated_at`
  - `published_at`

Não foram expostos registros nem conteúdo das páginas no relatório.

RPCs `cms_*` expostas: nenhuma.

Não foi possível inspecionar com segurança por REST:

- constraints;
- índices;
- policies RLS;
- grants;
- triggers;
- funções não expostas;
- dependências PostgreSQL;
- versão efetiva do servidor.

Esses itens exigem conexão administrativa ou CLI autenticado e vinculado.

## 6. Divergências

O schema remoto observado corresponde ao schema anterior da Fase 0:

- não existe `path`;
- não existe `source_file`;
- não existem ponteiros de draft/publicado;
- não existe `lamy_page_versions`;
- não existem views draft/published;
- não existem RPCs da Fase 0.5.

Isso confirma que `20260721190000_prepare_cms_page_versions.sql` ainda não foi aplicada.

Não foi possível concluir a comparação de constraints, índices, RLS e dependências.

## 7. Dry-run/análise

Dry-run remoto: **não executado**.

O projeto não está vinculado e o CLI não possui access token. Executar `db push` ou tentar contornar essa ausência violaria a regra de confirmação explícita do projeto.

A análise estática da migration e os testes de contrato da Fase 0.5 continuam disponíveis, mas não substituem o dry-run remoto nem a inspeção do schema PostgreSQL real.

## 8. Aplicação

Migration aplicada: **não**.

Motivos bloqueantes:

1. project ref ainda não confirmado como ambiente correto por fonte administrativa;
2. CLI sem autenticação e sem vínculo;
3. backup remoto não verificado;
4. restauração não comprovada;
5. schema administrativo incompleto;
6. dry-run remoto não executado.

## 9. RPCs

RPCs remotas validadas: nenhuma, pois elas ainda não existem remotamente.

Nenhum teste de escrita foi executado.

## 10. Teste de isolamento

Não executado.

Nenhum registro de teste foi criado, garantindo que:

- as duas páginas CMS existentes não foram tocadas;
- nenhuma das sete páginas baseline foi usada;
- nenhuma URL pública foi alterada.

## 11. Testes do projeto

Não foram repetidos nesta etapa porque o gate de segurança falhou na identificação/backup, exigindo interrupção antes das etapas seguintes.

Resultado anterior preservado:

- 24 testes aprovados na Fase 0.5.

## 12. Build

Não executado nesta etapa após o bloqueio.

Resultado anterior preservado:

- `npm run build` aprovado na Fase 0.5.

## 13. Vercel

Não executado nesta etapa após o bloqueio.

Resultado anterior preservado:

- `npm run verify:vercel-output` aprovado na Fase 0.5.

## 14. Migração das sete páginas

Confirmado:

- nenhum HTML foi importado;
- `scripts/import-static-pages.js` não foi executado;
- nenhuma das sete páginas foi migrada;
- nenhum registro de teste foi criado usando as páginas reais.

## 15. URLs públicas

Confirmado:

- nenhuma rota foi alterada nesta etapa;
- nenhuma URL pública foi alterada;
- nenhum conteúdo público foi modificado;
- nenhum sitemap ou `robots.txt` foi criado.

## 16. Riscos e requisitos para retomar

Para retomar a Fase 0.6 são necessários, sem enviar segredos pelo chat:

1. confirmar explicitamente que `qwvxonvtqvdvwdsqehsl` é o projeto correto e informar se é produção ou staging;
2. autenticar localmente o CLI com `npx supabase login` ou disponibilizar `SUPABASE_ACCESS_TOKEN` no ambiente seguro;
3. vincular esta pasta ao ref confirmado com `npx supabase link --project-ref qwvxonvtqvdvwdsqehsl`;
4. comprovar um backup remoto recente e restaurável no Dashboard, ou disponibilizar conexão administrativa para `pg_dump`;
5. permitir inspeção administrativa de schema, constraints, índices, RLS, grants e dependências;
6. executar `npx supabase db push --dry-run` somente depois das confirmações anteriores.

A Fase 0.6 não atende ao critério de conclusão e permanece bloqueada. A Fase 1 não deve ser iniciada.
