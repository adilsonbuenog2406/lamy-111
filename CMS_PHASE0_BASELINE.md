# Mapa Editável do Site — baseline da Fase 0

Data do levantamento: 21/07/2026  
Escopo: inventário, análise, rollback e testes sem migração de páginas.

## Estado de segurança e rollback

- A pasta fornecida não é um repositório Git: não existe `.git` e os comandos `git status` e `git log` falham com `not a git repository`.
- Por isso, antes de qualquer alteração futura foi criado `backups/phase0-source-baseline-2026-07-21.zip`.
- SHA-256 do backup: `DF846F44EAF5D4C9A63440E12E3AE76739E7E7B26224FBF4449B265593B01829`.
- O backup contém HTMLs fonte, `admin/`, `api/`, `artigos/`, `assets/`, `css/`, `js/`, `lib/`, `scripts/`, `supabase/`, arquivos de configuração e lockfile.
- `.env`, `node_modules/`, `public/` e `dist/` não foram incluídos. Segredos não foram copiados; `public/` e `dist/` são artefatos reproduzíveis.
- Os HTMLs, CSS, JS e assets originais permanecem inalterados. Nenhuma migration ou importação foi executada.
- Antes da Fase 1, o caminho mais seguro é restaurar o histórico Git original ou inicializar um repositório local e criar um commit explícito do baseline. O ZIP é o rollback disponível nesta cópia.

## As 7 páginas e URLs atuais

1. Home
   - URL canônica: `/`
   - Alias existente: `/index.html`
   - Fonte: [`index.html`](index.html)
2. Listagem de artigos
   - URL: `/artigos.html`
   - Fonte: [`artigos.html`](artigos.html)
3. Calculadora
   - URL: `/calculadora.html`
   - Fonte: [`calculadora.html`](calculadora.html)
4. Transação tributária
   - URL: `/artigos/transacao-tributaria-debitos-posteriores.html`
   - Fonte: [`artigos/transacao-tributaria-debitos-posteriores.html`](artigos/transacao-tributaria-debitos-posteriores.html)
5. Exclusão do ICMS-DIFAL
   - URL: `/artigos/exclusao-icms-difal-pis-cofins.html`
   - Fonte: [`artigos/exclusao-icms-difal-pis-cofins.html`](artigos/exclusao-icms-difal-pis-cofins.html)
6. Liquidity Events e M&A
   - URL: `/artigos/liquidity-events-ma-2024.html`
   - Fonte: [`artigos/liquidity-events-ma-2024.html`](artigos/liquidity-events-ma-2024.html)
7. Desafios regulatórios
   - URL: `/artigos/desafios-regulatorios-era-digital.html`
   - Fonte: [`artigos/desafios-regulatorios-era-digital.html`](artigos/desafios-regulatorios-era-digital.html)

## Dependências compartilhadas

- Fontes externas em todas as páginas: Google Fonts, famílias Stack Sans Headline e Stack Sans Text.
- CSS base: [`css/variables.css`](css/variables.css), [`css/base.css`](css/base.css) e [`css/components.css`](css/components.css).
- [`css/sections.css`](css/sections.css) é usado pela Home, listagem e artigos.
- [`js/main.js`](js/main.js) é carregado pelas 7 páginas.
- Assets são servidos em `/assets`; CSS em `/css`; JavaScript em `/js`.
- Logo principal: `assets/images/logo-principal.png`.
- Logo do rodapé: `assets/site-home/4f75435e2711bc520e1487fe1dfb689ab802bbbb%20(1).png`.
- WhatsApp compartilhado: `https://wa.me/5541998618931`.
- O build estático copia as fontes para `dist/`; o build Vercel copia para `public/`.

## Inventário por página

### Home — `/` e `/index.html`

CSS:

- `css/variables.css`
- `css/base.css`
- `css/components.css`
- `css/sections.css`

Scripts:

- `js/main.js`

Mídia e dependências externas:

- Vídeo local `assets/images/lamy-video.mp4`, com `autoplay`, `muted`, `loop` e `playsinline`.
- Google Maps em `iframe`.
- Google Fonts.
- WhatsApp e `mailto:contato@lamy.adv.br`.

Imagens:

- Logo principal.
- Ícones de segmentos em `assets/images/*.svg`.
- Fotos `lucas.jpg`, `matheus.jpg`, `bruno.jpg`, `helena.jpg`, `isabelle.jpg` e `kerollen.jpg`.
- Capas `assets/site-home/CAPA ARTIGO 01.png`, `02.png` e `03.png`.
- Ícones de contato e logo do rodapé.

Links:

- Âncoras `#escritorio`, `#segmentos`, `#equipe`, `#insights`, `#faq`, `#formulario` e `#contato`.
- `/calculadora.html`, `/artigos.html` e três artigos.
- WhatsApp, e-mail e links de rodapé.

Formulário:

- `#contact-form`, `novalidate`.
- Campos `name`, `email`, `phone`, `contactConsent` e `marketingConsent`.
- Os três campos textuais e `contactConsent` são obrigatórios.
- O envio atual é tratado somente no navegador por `js/main.js`: valida, exibe `alert` e faz `reset`; não chama API.

Contratos interativos a preservar:

- Navegação: `.nav__toggle`, `.nav__links`, `.nav__link`, `aria-expanded` e classe `is-open`.
- Navegação ativa e smooth scroll: `section[id]` e links `href="#..."`.
- Carrossel: `#team-carousel`, `#team-prev` e `#team-next`.
- Biografias: `.team-card`, `.team-card__bio`, `.team-card__toggle`, `is-expanded` e `has-overflow`.
- FAQ: `<details class="faq-item">`.
- Formulário: `.form-input[required]`, `.form-error`, `.form-input--error` e `[name="contactConsent"]`.
- Fallback de imagens: `.team-card__photo` e `.article-card__image`.
- ARIA usado em navegação, botões da equipe, ícones decorativos, vídeo, rodapé e WhatsApp.

### Listagem — `/artigos.html`

CSS:

- CSS base compartilhado, `css/sections.css` e `css/artigos.css`.

Scripts:

- `js/main.js`.

Imagens:

- Logo principal e logo do rodapé.
- `assets/site-home/artigo1.png`.
- `assets/site-home/artigo3.png`.
- `assets/images/artigos/venture-capital.png`.
- `assets/images/artigos/global-compliance.png`.

Links:

- Home e suas âncoras, calculadora, os quatro artigos, rodapé e WhatsApp.
- Existem duas grids de cards semelhantes no HTML atual; isso faz parte do baseline e não deve ser “corrigido” durante a migração.

Comportamento:

- Menu mobile depende de `.nav__toggle`, `.nav__links`, `aria-expanded` e `is-open`.
- Fallbacks dependem de `.artigos-card__image`, `.artigos-featured__image` e `.artigos-featured__avatar`.
- Classes BEM `artigos-*`, `nav*`, `footer*`, `.btn` e `.whatsapp-btn` determinam o layout.
- Não há formulários, APIs, vídeos, iframes, IDs de conteúdo ou `data-*`.

### Calculadora — `/calculadora.html`

CSS:

- `css/variables.css`
- `css/base.css`
- `css/components.css`
- `css/calculadora.css`

Scripts:

- `js/main.js`
- `js/calculadora.js`

Assets:

- Logo principal e logo do rodapé.
- `assets/images/calculadora/icon-simulacao.svg`.
- `assets/images/calculadora/icon-resultado.svg`.
- `assets/images/calculadora/icon-analise.svg`.
- `assets/images/calculadora/icon-desconto.svg`.
- SVGs inline do WhatsApp.

Formulário e IDs obrigatórios:

- Raiz: `#calculadora-form`, `novalidate`, `data-step`.
- Progresso: `#calculadora-progress`, `#progress-step-label`, `#progress-percent-label` e `#progress-track`.
- Campos: `#segment`, `#rbt12`, `#vehicleValue`, `#simples`, `#regime`, `#regimeTime`, `#ecommerceSegment`, `#monthlyRevenue`, `#companyAge`, `#taxRecovery`, `#email`, `#phone` e `#cnpj`.
- Resultado: `#result-economia`.
- Names: `segment`, `rbt12`, `vehicleValue`, `simples`, `regime`, `regimeTime`, `ecommerceSegment`, `monthlyRevenue`, `companyAge`, `taxRecovery`, `email`, `phone`, `cnpj`, `contactConsent` e `marketingConsent`.

Data attributes e classes obrigatórios:

- Painéis `data-panel="1"`, dois painéis `data-panel="2"`, `data-panel="3"` e `data-panel="4"`.
- Fluxos `data-flow="default"` e `data-flow="ecommerce"`.
- Botões `data-action="next"` e `data-action="back"`.
- `.calculadora-form__panel`, `.calculadora-form__group`, `.calculadora-form__input`, `.calculadora__inner`, `.calculadora__section` e `.nav`.
- Estados CSS `calculadora-form--compact`, `calculadora-form--result`, `calculadora-form__progress--result`, `calculadora__inner--result` e `body.calculadora-result-active`.
- `hidden`, `required`, `inputmode`, opções e values dos selects são parte do contrato.

Fluxo:

- Etapa 1 escolhe o segmento.
- Etapa 2 usa o painel default ou ecommerce.
- Etapa 3 captura contato e consentimentos.
- Etapa 4 mostra o resultado.
- Voltar e avançar dependem da estrutura, seletores e atributos acima.

Persistência e APIs:

- Chave de sessão: `lamy_calculadora_lead_id` em `sessionStorage`.
- Sincronização incompleta: `POST /api/calculator-leads`.
- Lead completo: `POST /api/leads`.
- `navigator.sendBeacon` é usado em saída da página.
- Payload inclui status, etapa, respostas, economia estimada, URL e referrer.

Validações e máscaras:

- Segmento obrigatório.
- Valores monetários em BRL.
- Validação de e-mail.
- Máscaras e validações de telefone e CNPJ.
- Consentimento de contato obrigatório.
- Fluxos default e ecommerce possuem conjuntos de campos diferentes.

ARIA:

- Navegação, benefícios, barra de progresso, ícones e WhatsApp.
- A barra usa `role="progressbar"`, `aria-valuenow`, `aria-valuemin` e `aria-valuemax`.

### Quatro artigos — `/artigos/<nome>.html`

Dependências comuns:

- CSS base, `css/sections.css` e `css/artigo-detail.css`.
- Google Fonts.
- `js/main.js`.
- Mesmo shell de navegação, artigo, CTA, rodapé e WhatsApp.
- Menu mobile depende de `.nav__toggle`, `.nav__links`, `aria-expanded` e `is-open`.
- Fallback da imagem principal depende de `.artigo-detail__hero-img`.
- Classes BEM `artigo-detail*`, `nav*`, `footer*`, `.btn` e `.whatsapp-btn` são parte do contrato.
- Não há formulários, APIs, vídeos, iframes, IDs de conteúdo ou `data-*`.

Transação tributária:

- Hero: `assets/site-home/artigo1.png`.
- Conteúdo com parágrafos e `blockquote`.
- CTA para `/index.html#formulario`.

Exclusão do ICMS-DIFAL:

- Hero: `assets/site-home/artigo3.png`.
- Conteúdo com parágrafos e `blockquote`.
- CTA para `/index.html#formulario`.

Liquidity Events e M&A:

- Hero: `assets/images/artigos/venture-capital.png`.
- Conteúdo em parágrafos.
- CTA para `/index.html#formulario`.

Desafios regulatórios:

- Hero: `assets/images/artigos/global-compliance.png`.
- Conteúdo em parágrafos.
- CTA para `/index.html#formulario`.

## Contratos globais de JavaScript

[`js/main.js`](js/main.js):

- Menu mobile, navegação ativa, smooth scroll, carrossel, expansão de equipe, FAQ, formulário da Home e fallbacks de imagens.
- Contém duas chamadas de instrumentação para `http://127.0.0.1:7742/ingest/...`. São dependências de debug locais e representam risco/ruído; não devem ser removidas como parte da migração sem decisão separada.

[`js/calculadora.js`](js/calculadora.js):

- Depende diretamente dos IDs, names, classes e `data-*` listados no inventário da calculadora.
- Gerencia estado de quatro etapas, fluxo alternativo ecommerce, máscaras, validação, cálculo, `sessionStorage`, debounce, `fetch` e `sendBeacon`.
- Duplicar IDs, remover wrappers ou mover campos para fora de `#calculadora-form` quebra o comportamento.

## CMS, persistência e deploy atuais

- Tabela atual: `lamy_pages`, definida em `supabase/migrations/20260714005701_create_lamy_pages.sql`.
- Campos atuais: `id`, `title`, `slug`, `status`, `project_data`, `html`, `css`, `js` e timestamps. Não existem `path`, `source_file`, aliases ou histórico de versões.
- [`lib/cms-db.js`](lib/cms-db.js) identifica páginas por `slug`.
- Save e Publish usam os mesmos campos de conteúdo. O editor envia `title`, `slug`, `project_data`, `html`, `css` e `js`.
- Preview atual usa `/admin/cms/pages/:id/preview`, não o path público da página.
- [`scripts/import-static-pages.js`](scripts/import-static-pages.js) usa slugs paralelos como `home`, `artigos-cms` e `calculadora-cms`; a importação não foi executada nesta fase.
- [`server.js`](server.js) serve as rotas estáticas antes do CMS e o CMS somente em `/:slug`.
- [`vercel.json`](vercel.json) reescreve apenas `/admin`, `/admin/:path*` e `/:slug`; não há rota CMS para paths aninhados.
- [`scripts/prepare-vercel-public.js`](scripts/prepare-vercel-public.js) mantém os sete HTMLs estáticos em `public/`.
- [`scripts/build-static.js`](scripts/build-static.js) mantém os sete HTMLs em `dist/`.

## Riscos e divergências encontradas

1. Não há Git nesta cópia. O backup ZIP substitui temporariamente o rollback por commit, mas é inferior a histórico versionado.
2. A sanitização atual proíbe `iframe`, `form`, `input` e `button`; portanto destrói Home e calculadora no Preview/Public CMS.
3. O shell público do CMS não carrega Google Fonts e não replica integralmente o `<head>` das páginas.
4. `CMS_ALLOW_PAGE_JS` é `false` por padrão. Ativá-lo para JavaScript arbitrário criaria stored XSS no mesmo domínio.
5. O cookie administrativo atual usa `path: "/"`. JavaScript arbitrário em página pública de mesma origem poderia tentar acessar endpoints administrativos durante uma sessão autenticada.
6. A Home contém um iframe do Google Maps, vídeo local, formulário e vários contratos de DOM que o pipeline CMS atual não preserva.
7. A calculadora depende de estrutura DOM rígida, valores de options, APIs e estado em sessão. GrapesJS permite alterações capazes de quebrar silenciosamente esses contratos.
8. A URL `/index.html` é um alias da mesma Home. Um único campo `path` só pode representar `/`; o alias deve continuar no roteamento, sem criar uma oitava página.
9. O Preview atual não utiliza o path público; usa uma rota administrativa por ID.
10. Não existe versionamento/revisões no schema atual.
11. Em página já publicada, Save atualiza os mesmos campos lidos pela rota pública sem retirar o status `published`. Assim, alterações salvas podem aparecer publicamente antes de um novo Publish.
12. Publish recebe e grava o conteúdo corrente enviado pelo editor; ele não publica uma cópia separada da última versão previamente salva. Isso diverge do requisito “publicar somente a versão salva aprovada”.
13. Resolver os itens 10–12 exige snapshot publicado ou revisão separada; não é possível garantir Preview isolado e Publish aprovado alterando apenas `path`.
14. O check Vercel atual não exige `artigos.html`, os quatro artigos, `artigos.css` ou `artigo-detail.css`.
15. O único teste de navegador encontrado (`scripts/tmp-admin-leads-test.js`) não está em `package.json`, exige Edge e servidor local e grava leads no Supabase.
16. Não existe sitemap ou robots no projeto; nenhum foi criado ou alterado.

Os itens 10–13 precisam de decisão arquitetural explícita antes da Fase 1, porque o comportamento atual e o requisito de publicação isolada são incompatíveis.

## Arquivos previstos para as próximas fases

Nenhum destes arquivos foi alterado na Fase 0:

- Nova migration em `supabase/migrations/`.
- `lib/cms-db.js`.
- `scripts/import-static-pages.js`.
- `server.js`.
- `admin/cms-editor.js`.
- `admin/admin.css`.
- `vercel.json`, somente quando o roteamento canônico exigir.
- `scripts/prepare-vercel-public.js`, mantendo os fallbacks.
- `scripts/check-vercel-static-output.js`.
- Testes novos de sanitização, path, Preview, Save e Publish.

## Testes disponíveis e resultado da Fase 0

Executados com sucesso:

- `npm run check`: sintaxe de servidor, APIs, libs, scripts e importador.
- `npm run build`: gerou `dist/` com exatamente os sete HTMLs; tamanho aproximado de 102,8 MB.
- `npm run verify:vercel-output`: preparou `public/` e aprovou o check atual.
- Smoke HTTP no servidor já existente: status 200 para `/`, `/index.html`, `/artigos.html`, `/calculadora.html`, os quatro artigos, `/css/base.css`, `/js/main.js`, o vídeo, `/admin/login` e `/api/health`.

Não executados:

- `scripts/tmp-admin-leads-test.js`, porque grava registros no Supabase e não é um script oficial do `package.json`.
- Save, Preview e Publish, porque alterariam dados do CMS na etapa definida como inventário/baseline.
- Comparação visual automatizada, porque não existe suíte de screenshots no repositório.

Aviso não bloqueante:

- O npm reporta a configuração desconhecida `devdir`; os comandos concluíram com código 0.

## Hashes SHA-256 do baseline

- `index.html`: `E983C6AF3E1524527217BC89B59D1C24522B1AFB5FBDB95F632045F4DED56ACC`
- `artigos.html`: `A1B23CDD4C9B98E28A1CBC4549813BCD7E6722E50F25DD37430A9D8B882873ED`
- `calculadora.html`: `BADC4D55D812D602B1B2919D119CAE379726F335C72B78D3E688CA96824D3635`
- `artigos/transacao-tributaria-debitos-posteriores.html`: `DEC6EBA35FC1D071F20ACD4233B1231AAD2EDD843C3FED003C07C67C8A72B7D5`
- `artigos/exclusao-icms-difal-pis-cofins.html`: `0FD80CF1F7D01DFE3F319D0297D2ED0464A901F20DF31ED0C2DFC121D8A259A2`
- `artigos/liquidity-events-ma-2024.html`: `8ED442D383FD274C8C9C156F7AD8530610DC09786501EE6D96718C0239B72380`
- `artigos/desafios-regulatorios-era-digital.html`: `FCEBE24B7F9FAC079EF1B1012114E49CF378D896FF7113017EB24B6911866902`
- `js/main.js`: `CF964B5BA3A572B907FFF0578F72B3866D421BD5533743CD93E97D249568F3F0`
- `js/calculadora.js`: `D6EE20D9C3ABAD2E0B5CC9D230C0D1ACAB41B928461B3ED67960BD6AA9D050D8`
- `css/variables.css`: `97749154189EF763F552B342289EA7B49C9A939A9138E2453D9CEA19B7474993`
- `css/base.css`: `8591A98C1FF28A3E4B286079099EB699C41AAE496B79C807E5CCE20122420FD5`
- `css/components.css`: `CBC21A0A4C0C32AE40901EF6E3035DDF240AED4C057816976A6DF60B45025299`
- `css/sections.css`: `9C5E2A998E3E96E0524F21D38EE7CEA2CB95AE255E27B26AE3C6A483224DDDA4`
- `css/artigos.css`: `19E726D65EB002B7EC0B5EABB254F2F8476CFD8B45F22155EB17AB3F668FC1A5`
- `css/artigo-detail.css`: `B6E3C5A42B0D86DF46A739FA66C4CF0296C75258DF78D23A7A5BD834EA49E9E9`
- `css/calculadora.css`: `15046FC109E2186BFD841AB15FC0960B69A27B75BAD3A9CF24651C52675FEB02`

## Gate para a Fase 1

A Fase 0 está concluída. A Fase 1 não deve começar sem:

1. autorização explícita;
2. decisão sobre isolamento entre rascunho salvo e snapshot publicado;
3. confirmação da estratégia para o alias `/index.html`;
4. manutenção do ZIP de rollback ou restauração do Git;
5. escolha do primeiro artigo simples para a prova de conceito.
