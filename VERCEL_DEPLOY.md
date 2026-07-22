# Deploy na Vercel com Supabase

Este projeto está preparado para rodar na Vercel com:

- assets estáticos servidos de `public/` (CDN);
- CMS Express em `api/index.js` (rewrites no `vercel.json`);
- endpoints dedicados em `api/health.js`, `api/calculator-leads.js`, `api/leads.js`;
- persistência no Supabase (`lamy_pages`, `lamy_calculator_leads`);
- autenticação do CMS por cookie assinado.

## 1. Variáveis obrigatórias

No painel da Vercel → Project → Settings → Environment Variables:

```env
NODE_ENV=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=use-uma-senha-forte
SESSION_SECRET=gere-uma-string-longa-aleatoria
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` fica só no backend. Não use prefixo `NEXT_PUBLIC_` nem exponha no frontend.

Gere o `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 2. Migrations

Aplique as migrations em `supabase/migrations/` (CLI ou SQL Editor):

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npm run db:push
```

O `SEU_PROJECT_REF` é a parte entre `https://` e `.supabase.co` em `SUPABASE_URL`.

## 3. Build

A Vercel executa:

```bash
npm run verify:vercel-output
```

Isso regenera `public/` (CSS, JS, assets, vendor do editor, fallbacks HTML) e valida o output.

Root Directory do projeto na Vercel: raiz do repositório `lamy-111` (onde estão `package.json` e `vercel.json`).

## 4. Deploy

Conecte o GitHub no painel da Vercel, ou:

```bash
npx vercel
npx vercel --prod
```

## 5. Importar páginas para o CMS (após env + migrations)

```bash
PHASE1_CMS_IMPORT_ENABLED=true npm run import:cms
```

## 6. Checagem

Local:

```bash
npm install
npm run check
npm run verify:vercel-output
npm test
```

Depois do deploy:

```text
/api/health
/admin/login
/
```

`/api/health` deve retornar `ok: true`. Se `ok: false`, confira `hasUrl` / `hasServiceRoleKey` ou se as tabelas existem.

Sem Supabase configurado, o site ainda sobe com HTML de fallback estático; o CMS e a calculadora só persistem com as variáveis e migrations aplicadas.
