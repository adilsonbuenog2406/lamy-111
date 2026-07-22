# Mapa Editável do Site — relatório da Fase 0.7

Data: 21/07/2026  
Status: **interrompida com segurança**. Nenhum pré-requisito administrativo completo.

Nenhuma migration foi aplicada. Nenhum registro foi alterado. Nenhuma RPC foi criada. Nenhuma página foi migrada. Nenhuma URL pública foi alterada.

## 1. Projeto identificado

Fonte local usada pelo backend (`lib/cms-db.js` + `.env`):

| Item | Valor |
|------|--------|
| URL | `https://qwvxonvtqvdvwdsqehsl.supabase.co` |
| Project ref (derivado do host) | `qwvxonvtqvdvwdsqehsl` |
| `supabase/config.toml` `project_id` | `site111-lamy` (apenas ID local do CLI) |
| Correspondência backend ↔ `.env` | Confirmada: `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` estão configuradas |
| Acesso REST read-only com a mesma service role | Responde no host acima |

Variáveis administrativas **ausentes** no `.env`:

- `SUPABASE_ACCESS_TOKEN`
- `DATABASE_URL` / `POSTGRES_URL`
- `SUPABASE_DB_PASSWORD`

## 2. Project ref

`qwvxonvtqvdvwdsqehsl`

## 3. Ambiente confirmado?

**Não.**

Não foi possível confirmar nome do projeto, organização, região, branch ou se o ref é produção/staging.

O ref só está confirmado como “o destino configurado no `.env` local”. Isso **não** equivale a confirmação administrativa do ambiente correto.

## 4. Estado da autenticação do CLI

| Item | Estado |
|------|--------|
| CLI disponível via `npx` | Sim (`2.109.1`) |
| CLI no PATH global | Não |
| Autenticado | **Não** |
| Erro observado | `Access token not provided. Supply an access token by running supabase login or setting the SUPABASE_ACCESS_TOKEN environment variable.` |

### O que o usuário precisa fazer manualmente

1. Abrir um terminal na pasta do projeto.
2. Autenticar o CLI **sem colar tokens no código ou em arquivos versionados**:

```bash
npx supabase login
```

3. Confirmar no Dashboard do Supabase que o projeto aberto é o desejado.
4. Informar explicitamente se `qwvxonvtqvdvwdsqehsl` é:
   - produção, ou
   - staging/teste, ou
   - projeto incorreto.

Não solicitar, registrar ou versionar senhas/tokens nesta fase.

## 5. Estado do vínculo CLI

| Item | Estado |
|------|--------|
| Pasta `.supabase/` | Ausente |
| `supabase/.temp` | Ausente |
| Projeto vinculado | **Não** |

Vínculo **não** foi tentado, porque autenticação e confirmação de ambiente ainda falham.

Quando autenticado e o ambiente estiver confirmado, o comando esperado será:

```bash
npx supabase link --project-ref qwvxonvtqvdvwdsqehsl
```

Somente após confirmação explícita de que esse ref é o projeto correto.

## 6. Estado do backup remoto

**Não verificado.**

Sem Dashboard autenticado e sem CLI autenticado/vinculado, não há como consultar:

- backups automáticos;
- data/hora do último backup;
- retenção;
- Point-in-Time Recovery;
- procedimento de restauração.

Dump local **não** foi gerado e **não** seria aceito como substituto de backup remoto restaurável.

## 7. Possibilidade de restauração

**Não comprovada.**

### O que o usuário precisa fazer no Dashboard

1. Abrir o projeto `qwvxonvtqvdvwdsqehsl` no [Supabase Dashboard](https://supabase.com/dashboard).
2. Confirmar nome, organização e se é produção/staging.
3. Em **Database → Backups** (ou equivalente do plano):
   - verificar se existe backup recente;
   - anotar data/hora;
   - confirmar se a restauração está disponível no plano atual.
4. Se o plano permitir, criar/confirmar um backup restaurável **antes** de qualquer retomada da Fase 0.6.
5. Registrar a data/hora e o tipo do backup.

Sem esse passo, a Fase 0.6 continua bloqueada.

## 8. Estado do schema remoto (somente leitura REST)

Inspeção possível apenas via PostgREST OpenAPI/REST com a service role do backend. Isso **não** substitui inspeção administrativa completa (constraints, índices, RLS, grants, `schema_migrations`).

### Tabelas expostas no OpenAPI remoto

- `lamy_pages`
- `lamy_calculator_leads`
- `cms_editor_current`
- `cms_editor_revisions`

### `lamy_pages`

- 2 registros, ambos `draft`, **não publicados**:
  - id `1`, slug `teste`
  - id `2`, slug `teste-2`
- Colunas observadas: `id`, `title`, `slug`, `status`, `project_data`, `html`, `css`, `js`, `created_at`, `updated_at`, `published_at`
- **Ausentes:** `path`, `source_file`, `latest_draft_version_id`, `published_version_id`, `previous_published_version_id`

### RPCs

Nenhuma rota `/rpc/` exposta no OpenAPI. Em particular, **não** existem:

- `cms_create_page`
- `cms_save_page_draft`
- `cms_publish_page`
- `cms_rollback_page`

### Tabelas da Fase 0.5

Não observadas remotamente:

- `lamy_page_versions`
- views `lamy_page_drafts` / `lamy_page_published`

## 9. Migrations existentes

### Locais no repositório

1. `20260714005701_create_lamy_pages.sql`
2. `20260714010643_create_lamy_calculator_leads.sql`
3. `20260721123000_expand_calculator_lead_steps.sql`
4. `20260721190000_prepare_cms_page_versions.sql` ← ainda **não** aplicada

### Remotas

Não foi possível listar `supabase_migrations.schema_migrations` sem CLI autenticado/vinculado.

Pelo schema observado, a migration `20260721190000_prepare_cms_page_versions.sql` **não** está aplicada.

## 10. RPCs existentes

Remotas da Fase 0.5: **nenhuma**.

## 11. Comparação com a migration pendente

| Esperado pela migration 0.5 | Remoto atual |
|-----------------------------|--------------|
| Colunas `path` / `source_file` / ponteiros de versão em `lamy_pages` | Ausentes |
| Tabela `lamy_page_versions` | Ausente |
| Views draft/published | Ausentes |
| RPCs `cms_*` | Ausentes |
| Backfill de versão 1 a partir de `lamy_pages` | Ainda não ocorreu |

### Divergência adicional relevante

O remoto expõe `cms_editor_current` e `cms_editor_revisions`, mas **não há qualquer referência a essas tabelas no código/migrations locais**.

Isso indica schema remoto à frente ou paralelo ao repositório. Antes de aplicar a migration 0.5, essa divergência precisa ser inspecionada com CLI vinculado para garantir que não há conflito de responsabilidades com o novo modelo de versões.

A migration pendente contém apenas `DROP CONSTRAINT IF EXISTS` e `REVOKE` pontuais; não contém `DROP TABLE`, `TRUNCATE` ou `DELETE` de dados. Ainda assim, dry-run remoto continua obrigatório.

## 12. Resultado do dry-run

**Não executado.**

Motivos:

- CLI não autenticado;
- projeto não vinculado;
- ambiente não confirmado;
- backup remoto não confirmado.

Análise estática local da migration permanece válida como preparação, mas **não** substitui:

```bash
npx supabase db push --dry-run
```

após `login` + `link` no projeto confirmado.

## 13. Bloqueios restantes

Ordem obrigatória para desbloquear a retomada da Fase 0.6:

1. **Confirmar administrativamente** se `qwvxonvtqvdvwdsqehsl` é produção, staging ou projeto incorreto.
2. **Autenticar o CLI** com `npx supabase login` (sem versionar tokens).
3. **Vincular** com `npx supabase link --project-ref qwvxonvtqvdvwdsqehsl` somente após a confirmação do item 1.
4. **Confirmar backup remoto restaurável** no Dashboard e documentar data/hora/tipo.
5. **Inspecionar schema administrativo completo**, inclusive `cms_editor_current` / `cms_editor_revisions` e migrations já aplicadas.
6. **Executar dry-run** da migration `20260721190000_prepare_cms_page_versions.sql`.
7. Só então retomar a Fase 0.6 (aplicação + RPCs + isolamento).

## Critério de conclusão da Fase 0.7

| Critério | Status |
|----------|--------|
| Projeto correto confirmado | Não |
| CLI autenticado | Não |
| CLI vinculado | Não |
| Backup remoto restaurável confirmado | Não |
| Schema remoto inspecionado administrativamente | Parcial (somente REST/OpenAPI) |
| Dry-run aprovado | Não |
| Nenhum dado alterado | Sim |

**Fase 0.7 não concluída.**  
**Fase 0.6 não deve ser retomada.**  
**Fase 1 não deve ser iniciada.**
