# Mapa Editável do Site — relatório da Fase 0.5

Data: 21/07/2026  
Escopo: preparar versionamento seguro, sanitização, recursos confiáveis e testes. Nenhuma das sete páginas foi importada ou substituída.

## 1. Schema e migration

Foi criada a migration:

- `supabase/migrations/20260721190000_prepare_cms_page_versions.sql`

Estrutura adicionada:

- `lamy_pages.path`: identidade canônica, única quando preenchida.
- `lamy_pages.source_file`: origem da importação inicial.
- `latest_draft_version_id`: último rascunho salvo.
- `published_version_id`: snapshot servido publicamente.
- `previous_published_version_id`: atalho para desfazer a última publicação.
- `lamy_page_versions`: snapshots append-only com número de versão, título, slug, `project_data`, HTML, CSS e JS.
- Views `lamy_page_drafts` e `lamy_page_published`.

O conteúdo existente em `lamy_pages` é backfilled como versão 1 quando a migration for aplicada. Registros publicados apontam a versão 1 como draft e publicado; registros em draft apontam somente o draft.

As mutações são feitas por RPCs `SECURITY DEFINER` concedidas apenas ao `service_role`:

- `cms_create_page`
- `cms_save_page_draft`
- `cms_publish_page`
- `cms_rollback_page`

O `service_role` não recebe INSERT, UPDATE ou DELETE direto na tabela de versões.

Status de aplicação:

- A migration foi criada, revisada e testada por contrato.
- Ela não foi aplicada ao Supabase remoto.
- `npm run db:push:dry` não pôde executar porque esta cópia não possui projeto Supabase vinculado: `Cannot find project ref`.
- Aplicar a migration sem vínculo confirmado e backup remoto violaria o requisito de rollback seguro.

## 2. Backend

Arquivos principais:

- `lib/cms-db.js`
- `lib/cms-page-service.js`
- `lib/cms-content.js`
- `server.js`

Mudanças:

- A leitura do editor usa `lamy_page_drafts`.
- A leitura pública usa `lamy_page_published`.
- Save cria uma nova versão por RPC.
- Publish não recebe conteúdo do editor; promove o `version_id` exato que foi validado.
- A RPC bloqueia a página com `FOR UPDATE`, evitando versões concorrentes com o mesmo número.
- Publish falha se o draft mudar entre validação e promoção.
- Publish rejeita slug já publicado por outra página.
- Rollback pode apontar a publicação para uma versão anterior sem mover ou apagar o draft atual.
- Páginas podem ser localizadas por `path`; o lookup legado por slug continua disponível.
- Os sete fallbacks estáticos continuam antes do lookup dinâmico.

## 3. Save, Preview e Publish

Save:

- É o único comando que grava conteúdo editável.
- Cria snapshot novo em `lamy_page_versions`.
- Move somente `latest_draft_version_id`.
- Não altera `published_version_id`.
- Reabrir o editor carrega o último draft.

Preview:

- Lê exclusivamente o último draft.
- Não salva automaticamente.
- Não publica.
- Recusa abrir quando existem alterações ainda não salvas no navegador.
- Usa `<base>` calculado pelo path público para resolver assets como na URL final.
- Continua com `noindex,nofollow`.

Publish:

- Recusa alterações não salvas.
- Não envia HTML/CSS/JS no POST.
- Valida o último draft.
- Passa o `version_id` validado para uma RPC transacional.
- Move atomicamente `published_version_id`.
- Preserva o snapshot publicado anterior em `previous_published_version_id`.
- Mantém o draft disponível.

## 4. Snapshot publicado

O snapshot público é uma linha imutável de `lamy_page_versions`, referenciada por `published_version_id`.

Salvar B sobre uma página publicada em A produz:

- draft = B;
- publicado = A.

Publicar promove B:

- draft = B;
- publicado = B;
- anterior = A.

Salvar C depois disso produz:

- draft = C;
- publicado = B.

Uma falha antes da troca do ponteiro não altera B.

## 5. Rollback

Rollback de conteúdo:

- `cms_rollback_page` aceita uma versão da mesma página ou usa `previous_published_version_id`.
- Altera somente o ponteiro publicado.
- O draft mais recente permanece intacto.
- Existe endpoint autenticado `POST /admin/api/pages/:id/rollback`.
- Não foi adicionada UI de rollback nesta fase.

Rollback de schema:

- `supabase/rollback/20260721190000_prepare_cms_page_versions.sql`.
- O script copia o snapshot público atual de volta às colunas legadas antes de remover views, RPCs, ponteiros e tabela de versões.
- Deve ser usado somente após exportar `lamy_pages` e `lamy_page_versions`, pois drafts pendentes ficariam disponíveis apenas nesse backup.

Rollback de arquivos:

- O baseline anterior permanece em `backups/phase0-source-baseline-2026-07-21.zip`.
- SHA-256: `DF846F44EAF5D4C9A63440E12E3AE76739E7E7B26224FBF4449B265593B01829`.
- A cópia continua sem `.git`.

## 6. Sanitização

Foi criada uma allowlist explícita em `lib/cms-content.js`.

Preservado:

- `form`, `input`, `textarea`, `select`, `option`, `button` e `label`;
- `img`, `video`, `source` e iframe confiável;
- IDs, classes, atributos de formulário, `hidden`, `data-*` e ARIA;
- atributos necessários a vídeo, imagens responsivas e acessibilidade.

Bloqueado:

- `script`, `object` e `embed`;
- todos os atributos iniciados por `on`;
- `srcdoc`;
- `javascript:`, `vbscript:` e data URLs não autorizadas;
- iframe fora da allowlist.

Iframes:

- Somente HTTPS.
- Hosts permitidos: Google Maps usados pelo projeto.
- Path obrigatório `/maps/embed`.

CSS:

- Remove `@import`, `expression(` e `javascript:`.
- Escapa `<` para impedir encerramento de `<style>` e stored XSS.

Contratos da Home e calculadora são validados antes do Publish. A calculadora precisa manter os IDs, painéis, flows, actions, names e wrappers registrados no baseline.

## 7. JavaScript confiável

JavaScript salvo no campo editável não é injetado na página pública.

Bundles permitidos por path/source:

- Todas as sete páginas: `/js/main.js`.
- Calculadora: `/js/main.js` e `/js/calculadora.js`.

O Editor não executa esses bundles durante a edição. Preview e publicação os carregam como arquivos externos confiáveis. Isso evita que scripts do conteúdo editável sejam executados no domínio do Admin.

`CMS_ALLOW_PAGE_JS` foi removido do exemplo de ambiente por não fazer mais parte do fluxo seguro.

## 8. Google Fonts

- A URL exata das famílias Stack Sans do baseline foi centralizada.
- O GrapesJS carrega a fonte no canvas do Editor.
- Preview e publicação incluem o stylesheet para páginas reconhecidas por path ou `source_file`.
- As páginas estáticas originais continuam com seus links atuais.

## 9. Testes adicionados

Arquivos em `test/`:

- `cms-content.test.js`
- `cms-editor-contract.test.js`
- `cms-import-guard.test.js`
- `cms-migration-contract.test.js`
- `cms-page-service.test.js`
- `server-static-fallback.test.js`

Cobertura:

- Save não altera publicado.
- Múltiplos Saves.
- Reload lê último draft.
- Preview lê draft.
- Publish promove draft.
- Nova edição após Publish.
- Falha de Publish preserva snapshot anterior.
- Página sem draft e sem publicação.
- Rollback sem mover draft.
- Formulários, inputs, botões, vídeo/source, `data-*` e ARIA.
- Google Maps permitido e iframe externo removido.
- Google Fonts.
- Bundles confiáveis executando o bootstrap da calculadora.
- JavaScript arbitrário não executado.
- CSS sem quebra de `</style>`.
- Contrato estrutural da calculadora.
- Sete HTMLs estáticos disponíveis como fallback.
- Importação das sete páginas bloqueada durante a Fase 0.5.

## 10. Resultado

Passaram:

- `npm test`: 24 testes.
- `npm run check`.
- `npm run build`: sete HTMLs em `dist/`.
- `npm run verify:vercel-output`.
- Validação ampliada de páginas, CSS, JS, vídeo, imagens e assets no output Vercel.

Não executado:

- Teste de integração contra RPCs reais do Postgres/Supabase, porque o projeto não está vinculado.
- Aplicação da migration remota.
- Save/Preview/Publish real contra o banco remoto.

Nenhum sitemap, `robots.txt` ou funcionalidade SEO foi criado ou alterado.

## 11. Riscos restantes e gate

1. A migration precisa de dry-run e aplicação em um projeto Supabase explicitamente confirmado, com backup remoto.
2. As RPCs precisam de teste integrado real após a aplicação.
3. Paths aninhados ainda não chegam ao CMS pela regra Vercel `/:slug`. Isso foi deliberadamente adiado: alterar o catch-all agora poderia interceptar e quebrar os quatro artigos estáticos. Deve ser resolvido na fase de cutover, com fallback testado.
4. O importador ainda contém o mapeamento legado, mas está bloqueado por `PHASE1_CMS_IMPORT_ENABLED`; ele deve ser convertido para paths canônicos antes da Fase 1.
5. Cada Save armazena snapshot completo e aumenta o uso do banco. Política de retenção pode ser adicionada depois de medir uso.
6. O backfill só consegue preservar o estado atual das páginas CMS existentes; versões sobrescritas antes desta migration não podem ser recuperadas.
7. A UI de rollback foi adiada; a RPC e o endpoint autenticado existem.

A Fase 1 não deve começar até a migration ser aplicada em ambiente confirmado e os testes integrados de Save → Preview → Publish → Rollback passarem.
