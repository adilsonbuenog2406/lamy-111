# Deploy na Vercel

Este projeto está preparado para rodar na Vercel com:

- site estático servido a partir de `public/`;
- CMS Express rodando como Vercel Function em `api/index.js`;
- banco persistente em Postgres via `DATABASE_URL`;
- autenticação do CMS por cookie assinado, sem sessão em memória.

## 1. Criar o banco

Crie um Postgres pelo Vercel Marketplace, por exemplo Neon, e conecte ao projeto.

A Vercel deve disponibilizar uma variável de conexão como `DATABASE_URL`, `POSTGRES_URL` ou `POSTGRES_PRISMA_URL`. O app usa essa ordem:

1. `DATABASE_URL`
2. `POSTGRES_URL`
3. `POSTGRES_PRISMA_URL`

## 2. Configurar variáveis

No painel da Vercel, configure:

```env
NODE_ENV=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=use-uma-senha-forte
SESSION_SECRET=gere-uma-string-longa-aleatoria
DATABASE_URL=postgres://...
CMS_ALLOW_PAGE_JS=false
```

Gere o `SESSION_SECRET` localmente com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Build

A Vercel executa:

```bash
npm run vercel-build
```

Esse comando gera `public/` com HTML, assets, CSS, JS, artigos, arquivos do admin e dependências do editor visual.

## 4. Deploy

Pelo Git:

```bash
vercel
vercel --prod
```

Ou conecte o repositório no painel da Vercel. O arquivo `vercel.json` já define o build e os rewrites necessários.

## 5. Importar páginas estáticas para o CMS

Opcionalmente, depois de configurar `DATABASE_URL`, rode:

```bash
npm run import:cms
```

Isso importa as páginas HTML existentes como rascunhos no CMS.

## 6. Checagem antes de subir

```bash
npm run check
npm run vercel-build
```

Depois do deploy, acesse:

```text
/admin/login
```
