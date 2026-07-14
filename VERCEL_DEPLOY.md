# Deploy na Vercel com Supabase

Este projeto está preparado para rodar na Vercel com:

- site estático servido a partir de `public/`;
- CMS Express rodando como Vercel Function em `api/index.js`;
- persistência do CMS no Supabase, tabela `public.lamy_pages`;
- captura da calculadora no Supabase, tabela `public.lamy_calculator_leads`;
- autenticação do CMS por cookie assinado, sem sessão em memória.

## 1. Variáveis obrigatórias

No painel da Vercel, configure:

```env
NODE_ENV=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=use-uma-senha-forte
SESSION_SECRET=gere-uma-string-longa-aleatoria
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
CMS_ALLOW_PAGE_JS=false
```

`SUPABASE_SERVICE_ROLE_KEY` é usado apenas no backend da Vercel Function. Não coloque essa chave em código frontend nem em variáveis `NEXT_PUBLIC_*`.

Gere o `SESSION_SECRET` localmente com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 2. Migrations

As migrations principais estão em:

```text
supabase/migrations/20260714005701_create_lamy_pages.sql
supabase/migrations/20260714010643_create_lamy_calculator_leads.sql
```

Elas criam `public.lamy_pages` e `public.lamy_calculator_leads`, seguindo a nomenclatura `lamy_TABLENAME`.

Para aplicar pelo CLI, primeiro faça login/link do projeto:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
```

O `SEU_PROJECT_REF` é a parte entre `https://` e `.supabase.co` em `SUPABASE_URL`.

Depois aplique:

```bash
npm run db:push
```

Se preferir, copie o SQL da migration e execute no SQL Editor do Supabase.

## 3. Build

A Vercel executa:

```bash
npm run verify:vercel-output
```

Esse comando gera `public/` com HTML, assets, CSS, JS, artigos, arquivos do admin e dependências do editor visual. Em seguida, valida se `vercel.json` está publicando `public/` como output estático.

## 4. Deploy

Pelo Git:

```bash
vercel
vercel --prod
```

Ou conecte o repositório no painel da Vercel. O arquivo `vercel.json` já define o build e os rewrites necessários.

## 5. Importar páginas estáticas para o CMS

Depois de aplicar a migration e configurar as variáveis Supabase, rode:

```bash
npm run import:cms
```

Isso importa as páginas HTML existentes como rascunhos no CMS.

## 6. Checagem antes de subir

```bash
npm run check
npm run verify:vercel-output
```

Depois do deploy, acesse:

```text
/api/health
/admin/login
```

`/api/health` deve retornar `ok: true`. Se retornar `ok: false`, confira no JSON se faltam variáveis (`hasUrl` ou `hasServiceRoleKey`) ou se alguma tabela ainda não foi criada.

A calculadora envia snapshots para `/api/calculator-leads` durante o preenchimento. Leads abandonados ficam com `status = 'incomplete'`; leads que chegam ao resultado ficam com `status = 'complete'`.
