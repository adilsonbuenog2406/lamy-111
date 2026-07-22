const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

const express = require("express");

const { normalizeCalculatorLeadPayload, validateCompleteLeadPayload } = require("./lib/calculator-lead-payload");
const {
  normalizePageHtml,
  renderPublicPage,
} = require("./lib/cms-content");
const { createCmsDb } = require("./lib/cms-db");
const { createCmsPageService } = require("./lib/cms-page-service");
const { createStaticPageImporter } = require("./lib/cms-static-import");
const {
  buildArticleTemplate,
  articlePathFromSlug,
  canDeleteCmsArticle,
  isCmsArticlePath,
} = require("./lib/cms-article-template");
const { listMediaAssets, saveUploadedMedia } = require("./lib/cms-media");
const {
  getSiteMapPageByPath,
  getSiteMapPageBySourceFile,
  isBaselinePath,
  isExcludedPublicRoute,
  normalizeLookupPath,
} = require("./lib/cms-site-map");
const {
  buildAdminPageInventory,
  getPageAdminStatusClass,
  getPageAdminStatusLabel,
} = require("./lib/cms-admin-inventory");
const { getLeadAnswers } = require("./lib/lead-answers");

const app = express();
const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);
const adminUsername = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const sessionSecret =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const db = createCmsDb({ rootDir });
const pageService = createCmsPageService({ db });
const staticImporter = createStaticPageImporter({ db, rootDir });
const servesStaticFiles = process.env.VERCEL !== "1";

app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false, limit: "2mb" }));
app.use(express.json({ limit: "20mb" }));

if (servesStaticFiles) {
  app.use(
    "/vendor/grapesjs",
    express.static(path.join(rootDir, "node_modules/grapesjs/dist"))
  );
  app.use(
    "/vendor/grapesjs-preset-webpage",
    express.static(path.join(rootDir, "node_modules/grapesjs-preset-webpage/dist"))
  );
  app.use("/admin-assets", express.static(path.join(rootDir, "admin")));
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function parseCookies(header) {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf("=");
      if (index === -1) return cookies;
      cookies[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
      return cookies;
    }, {});
}

function signCookiePayload(payload) {
  return crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
}

function encodeSessionCookie(sessionData) {
  const payload = Buffer.from(JSON.stringify(sessionData)).toString("base64url");
  return `${payload}.${signCookiePayload(payload)}`;
}

function decodeSessionCookie(value) {
  const [payload, signature] = String(value || "").split(".");
  if (!payload || !signature) return null;

  const expected = signCookiePayload(payload);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const sessionData = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!sessionData.exp || sessionData.exp < Date.now()) return null;
    return sessionData;
  } catch {
    return null;
  }
}

function setAuthCookie(res) {
  const maxAge = 1000 * 60 * 60 * 24 * 7;
  res.cookie(
    "lamy_cms_session",
    encodeSessionCookie({ authenticated: true, exp: Date.now() + maxAge }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge,
      path: "/",
    }
  );
}

function clearAuthCookie(res) {
  res.clearCookie("lamy_cms_session", { path: "/" });
}

app.use((req, _res, next) => {
  // #region agent log
  if (process.env.VERCEL === "1") {
    fetch("http://127.0.0.1:7356/ingest/30b1e897-e730-403a-921a-cfb8f842ec31", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "17859a",
      },
      body: JSON.stringify({
        sessionId: "17859a",
        runId: process.env.DEBUG_RUN_ID || "runtime",
        hypothesisId: "R4",
        location: "server.js:request",
        message: "incoming request on Vercel",
        data: {
          method: req.method,
          url: req.originalUrl || req.url || null,
          path: req.path || null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    console.log(
      `DEBUG_17859a ${JSON.stringify({
        sessionId: "17859a",
        hypothesisId: "R4",
        message: "incoming request on Vercel",
        data: { method: req.method, path: req.path || null, url: req.originalUrl || req.url || null },
        timestamp: Date.now(),
      })}`
    );
  }
  // #endregion
  const cookies = parseCookies(req.headers.cookie);
  req.cmsSession = decodeSessionCookie(cookies.lamy_cms_session);
  next();
});

app.use(
  asyncHandler(async (_req, _res, next) => {
    await db.ready;
    next();
  })
);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeSlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function isReservedSlug(slug) {
  const reserved = new Set([
    "admin",
    "admin-assets",
    "api",
    "assets",
    "css",
    "js",
    "artigos",
    "vendor",
    "calculadora",
    "artigos.html",
    "calculadora.html",
    "index.html",
  ]);
  return reserved.has(slug);
}

async function ensureAvailableSlug(rawSlug, pageId) {
  const base = normalizeSlug(rawSlug) || "pagina";
  let slug = isReservedSlug(base) ? `${base}-pagina` : base;
  let suffix = 2;

  while (true) {
    const existing = await db.findPageIdBySlug(slug);
    if (!existing || Number(existing.id) === Number(pageId)) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

function normalizePagePath(value) {
  const normalized = String(value || "").trim().replaceAll("\\", "/");
  if (
    !normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.length > 240 ||
    normalized.includes("?") ||
    normalized.includes("#") ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    return null;
  }

  return normalized === "/" ? "/" : normalized.replace(/\/{2,}/g, "/").replace(/\/$/, "");
}

function isReservedSystemPath(pagePath) {
  return isExcludedPublicRoute(pagePath);
}

async function ensureAvailablePath(rawPath, pageId) {
  const pagePath = normalizePagePath(rawPath);
  if (!pagePath || isReservedSystemPath(pagePath)) {
    const error = new Error("Informe um path público válido e não reservado.");
    error.code = "CMS_PAGE_PATH_INVALID";
    throw error;
  }

  const siteMapPage = getSiteMapPageByPath(pagePath);
  if (siteMapPage) {
    const existingOfficial = await db.findPageIdByPath(siteMapPage.path);
    if (!existingOfficial || Number(existingOfficial.id) !== Number(pageId)) {
      const error = new Error(
        "Este path pertence ao site map oficial. Use a sincronização do editor para prepará-lo."
      );
      error.code = "CMS_PAGE_PATH_RESERVED";
      throw error;
    }
  }

  const existing = await db.findPageIdByPath(pagePath);
  if (existing && Number(existing.id) !== Number(pageId)) {
    const error = new Error("Este path já pertence a outra página.");
    error.code = "CMS_PAGE_PATH_CONFLICT";
    throw error;
  }

  return pagePath;
}

function parseProjectData(value) {
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function pageFromRow(row) {
  if (!row) return null;
  return {
    ...row,
    project_data: parseProjectData(row.project_data),
  };
}

function requireAuth(req, res, next) {
  if (req.cmsSession?.authenticated) {
    next();
    return;
  }

  const isApiRequest =
    String(req.path || "").startsWith("/api/") ||
    String(req.originalUrl || "").startsWith("/api/");

  if (isApiRequest) {
    res.status(401).json({ error: "Autenticação obrigatória." });
    return;
  }

  if (req.accepts("html")) {
    res.redirect(`/admin/login?next=${encodeURIComponent(req.originalUrl)}`);
    return;
  }

  res.status(401).json({ error: "Autenticação obrigatória." });
}

function safeAdminNext(value) {
  const nextUrl = String(value || "/admin");
  if (!nextUrl.startsWith("/admin") || nextUrl.startsWith("//")) {
    return "/admin";
  }
  return nextUrl;
}

function formatAdminDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR");
}

function renderAdminPageRow(page) {
  const publicPath = page.path || `/${page.slug}`;
  const statusLabel = getPageAdminStatusLabel(page);
  const statusClass = getPageAdminStatusClass(page);
  const updatedLabel = page.updated_at
    ? escapeHtml(new Date(page.updated_at).toLocaleString("pt-BR"))
    : "—";

  let actions = "";
  if (!page.id) {
    actions = `<form method="post" action="/admin/cms/pages/sync-baseline" data-loading-label="Preparando...">
            <input type="hidden" name="path" value="${escapeHtml(publicPath)}">
            <button class="admin-button admin-button--primary" type="submit">Editar</button>
          </form>
          <a class="admin-button" href="${escapeHtml(publicPath)}" target="_blank" rel="noopener">Ver URL</a>`;
  } else {
    actions = `<a class="admin-button" href="/admin/cms/pages/${page.id}/editor">Editar</a>
          <a class="admin-button" href="/admin/cms/pages/${page.id}/preview" target="_blank" rel="noopener">Pré-visualizar</a>
          <a class="admin-button" href="${escapeHtml(publicPath)}" target="_blank" rel="noopener">Ver URL</a>`;
    if (canDeleteCmsArticle(page.path, page.source_file)) {
      actions += `
          <form class="admin-inline-form" method="post" action="/admin/cms/articles/${page.id}/delete" data-confirm-delete="1">
            <button class="admin-button admin-button--danger" type="submit">Excluir artigo</button>
          </form>`;
    }
  }

  return `<tr>
        <td>
          <strong>${escapeHtml(page.title)}</strong>
          <span>${escapeHtml(publicPath)}${page.official ? " · site map" : ""}</span>
        </td>
        <td><span class="status status--${escapeHtml(statusClass)}">${escapeHtml(statusLabel)}</span></td>
        <td>${updatedLabel}</td>
        <td class="actions">${actions}</td>
      </tr>`;
}

function renderAdminNav({ active = "" } = {}) {
  return `<nav class="admin-nav" aria-label="Navegação administrativa">
    <a class="admin-button${active === "dashboard" ? " admin-button--active" : ""}" href="/admin">Painel</a>
    <a class="admin-button${active === "pages" ? " admin-button--active" : ""}" href="/admin/cms/pages">Editor de Página</a>
    <a class="admin-button${active === "leads" ? " admin-button--active" : ""}" href="/admin/leads">Visualizar Leads</a>
  </nav>`;
}

function renderAdminChrome({ title, active, content }) {
  return renderAdminLayout({
    title,
    body: `<header class="admin-topbar">
  <a class="admin-brand" href="/admin">CMS Lamy</a>
  ${renderAdminNav({ active })}
  <form method="post" action="/admin/logout"><button class="admin-button" type="submit">Sair</button></form>
</header>
<main class="admin-page">
  ${content}
</main>`,
  });
}

function renderAdminLayout({ title, body, editor = false }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | CMS Lamy</title>
  ${editor ? '<link rel="stylesheet" href="/vendor/grapesjs/css/grapes.min.css">' : ""}
  <link rel="stylesheet" href="/admin-assets/admin.css">
</head>
<body class="admin-shell${editor ? " admin-shell--editor" : ""}">
  ${body}
</body>
</html>`;
}

app.get("/admin/login", (req, res) => {
  if (req.cmsSession?.authenticated) {
    res.redirect("/admin");
    return;
  }

  const hasError = req.query.error === "1";
  res.send(
    renderAdminLayout({
      title: "Entrar",
      body: `<main class="login-page">
  <form class="login-card" method="post" action="/admin/login">
    <h1>CMS Lamy</h1>
    <p>Acesse o painel administrativo.</p>
    ${hasError ? '<div class="alert alert--error">Usuário ou senha inválidos.</div>' : ""}
    <input type="hidden" name="next" value="${escapeHtml(safeAdminNext(req.query.next))}">
    <label>Usuário <input name="username" autocomplete="username" required></label>
    <label>Senha <input name="password" type="password" autocomplete="current-password" required></label>
    <button class="admin-button admin-button--primary" type="submit">Entrar</button>
  </form>
</main>`,
    })
  );
});

app.post("/admin/login", (req, res) => {
  const username = String(req.body.username || "");
  const password = String(req.body.password || "");

  if (username === adminUsername && password === adminPassword) {
    setAuthCookie(res);
    res.redirect(safeAdminNext(req.body.next));
    return;
  }

  res.redirect("/admin/login?error=1");
});

app.post("/admin/logout", requireAuth, (req, res) => {
  clearAuthCookie(res);
  res.redirect("/admin/login");
});

app.get("/api/health", asyncHandler(async (_req, res) => {
  const env = db.getHealth();
  const health = {
    ok: env.ok,
    database: db.kind,
    env,
    tables: {
      pages: "unknown",
      calculatorLeads: "unknown",
    },
  };

  if (env.ok) {
    try {
      await db.listPages();
      health.tables.pages = "ok";
    } catch (error) {
      health.ok = false;
      health.tables.pages = error.code || error.message;
    }

    try {
      await db.checkCalculatorLeadsTable();
      health.tables.calculatorLeads = "ok";
    } catch (error) {
      health.ok = false;
      health.tables.calculatorLeads = error.code || error.message;
    }
  }

  res.status(health.ok ? 200 : 500).json(health);
}));

app.post("/api/calculator-leads", asyncHandler(async (req, res) => {
  const lead = normalizeCalculatorLeadPayload({
    body: req.body,
    userAgent: req.get("user-agent"),
  });
  const saved = await db.upsertCalculatorLead(lead);
  res.json({ ok: true, leadId: saved.id, status: saved.status });
}));

app.post("/api/leads", asyncHandler(async (req, res) => {
  const validation = validateCompleteLeadPayload(req.body);

  if (!validation.valid) {
    res.status(400).json({ error: validation.errors[0], errors: validation.errors });
    return;
  }

  const lead = normalizeCalculatorLeadPayload({
    body: {
      ...req.body,
      status: "complete",
      step: req.body?.step || 4,
    },
    userAgent: req.get("user-agent"),
  });
  const saved = await db.upsertCalculatorLead(lead);
  res.json({ ok: true, leadId: saved.id, status: saved.status });
}));

app.get("/api/leads", requireAuth, asyncHandler(async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : "complete";
  const limit = Number(req.query.limit || 100);
  const leads = await db.listCalculatorLeads({ status, limit });
  res.json({ ok: true, leads });
}));

app.get("/admin", requireAuth, (_req, res) => {
  res.send(
    renderAdminChrome({
      title: "Painel Administrativo",
      active: "dashboard",
      content: `<section class="admin-panel">
  <div class="panel-heading">
    <div>
      <h1>Painel Administrativo</h1>
      <p>Escolha uma área para continuar.</p>
    </div>
  </div>
  <div class="admin-home-grid">
    <a class="admin-home-card" href="/admin/cms/pages">
      <h2>Editor de Página</h2>
      <p>Abra o CMS GrapesJS para criar, editar e publicar páginas.</p>
    </a>
    <a class="admin-home-card" href="/admin/leads">
      <h2>Visualizar Leads</h2>
      <p>Consulte os leads capturados pela calculadora do site.</p>
    </a>
  </div>
</section>`,
    })
  );
});

app.get("/admin/leads", requireAuth, asyncHandler(async (_req, res) => {
  const leads = await db.listCalculatorLeads({ status: "complete", limit: 200 });

  const rows = leads
    .map(
      (lead) => `<tr>
        <td>${escapeHtml(formatAdminDate(lead.created_at || lead.completed_at || lead.updated_at))}</td>
        <td>${escapeHtml(lead.segment_label || lead.segment || "—")}</td>
        <td>${escapeHtml(lead.email || "—")}</td>
        <td>${escapeHtml(lead.phone || "—")}</td>
        <td>${escapeHtml(lead.cnpj || "—")}</td>
        <td class="actions">
          <a class="admin-button" href="/admin/leads/${escapeHtml(lead.id)}">Ver detalhes</a>
        </td>
      </tr>`
    )
    .join("");

  res.send(
    renderAdminChrome({
      title: "Leads",
      active: "leads",
      content: `<section class="admin-panel">
  <div class="panel-heading">
    <div>
      <h1>Visualizar Leads</h1>
      <p>Leads finalizados pela calculadora.</p>
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Data de cadastro</th>
          <th>Segmento</th>
          <th>E-mail</th>
          <th>Celular</th>
          <th>CNPJ</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="6" class="empty">Nenhum lead finalizado ainda.</td></tr>'}</tbody>
    </table>
  </div>
</section>`,
    })
  );
}));

app.get("/admin/leads/:id", requireAuth, asyncHandler(async (req, res) => {
  const lead = await db.getCalculatorLeadById(req.params.id);

  if (!lead) {
    res.status(404).send("Lead não encontrado.");
    return;
  }

  const answers = getLeadAnswers(lead)
    .map(
      (item) => `<div class="lead-detail__item">
      <dt>${escapeHtml(item.label)}</dt>
      <dd>${escapeHtml(item.value)}</dd>
    </div>`
    )
    .join("");

  res.send(
    renderAdminChrome({
      title: "Detalhes do Lead",
      active: "leads",
      content: `<section class="admin-panel">
  <div class="panel-heading">
    <div>
      <h1>Detalhes do Lead</h1>
      <p>Informações capturadas na calculadora.</p>
    </div>
    <a class="admin-button" href="/admin/leads">Voltar para a listagem</a>
  </div>
  <div class="lead-detail">
    <section class="lead-detail__section">
      <h2>Dados do lead</h2>
      <dl class="lead-detail__grid">
        <div class="lead-detail__item">
          <dt>Data de cadastro</dt>
          <dd>${escapeHtml(formatAdminDate(lead.created_at || lead.completed_at || lead.updated_at))}</dd>
        </div>
        <div class="lead-detail__item">
          <dt>Segmento</dt>
          <dd>${escapeHtml(lead.segment_label || lead.segment || "—")}</dd>
        </div>
        <div class="lead-detail__item">
          <dt>E-mail</dt>
          <dd>${escapeHtml(lead.email || "—")}</dd>
        </div>
        <div class="lead-detail__item">
          <dt>Celular</dt>
          <dd>${escapeHtml(lead.phone || "—")}</dd>
        </div>
        <div class="lead-detail__item">
          <dt>CNPJ</dt>
          <dd>${escapeHtml(lead.cnpj || "—")}</dd>
        </div>
      </dl>
    </section>
    <section class="lead-detail__section">
      <h2>Respostas da calculadora</h2>
      <dl class="lead-detail__grid">
        ${answers}
      </dl>
    </section>
  </div>
</section>`,
    })
  );
}));

app.get("/admin/cms/pages", requireAuth, asyncHandler(async (_req, res) => {
  let pages = [];
  let listError = null;

  try {
    pages = await db.listPages();
  } catch (error) {
    listError = error;
    console.error("Falha ao listar páginas do CMS:", error);
  }

  const { officialPages, extraPages } = buildAdminPageInventory(pages);
  const officialRows = officialPages.map(renderAdminPageRow).join("");
  const extraRows = extraPages.map(renderAdminPageRow).join("");

  res.send(
    renderAdminChrome({
      title: "Páginas",
      active: "pages",
      content: `${
        listError
          ? `<div class="alert alert--error" style="margin-bottom:16px">Não foi possível carregar o status do CMS. O site map estático continua listado abaixo.</div>`
          : ""
      }<section class="admin-panel">
  <div class="panel-heading">
    <div>
      <h1>Editor de Página</h1>
      <p>Site map das URLs atuais do site, com edição e publicação no CMS. Novos artigos geram slug/URL automaticamente a partir do título (<code>/artigos/slug.html</code>).</p>
    </div>
    <div class="panel-heading__actions">
      <form method="post" action="/admin/cms/pages/sync-baseline" data-loading-label="Sincronizando...">
        <button class="admin-button admin-button--primary" type="submit">Sincronizar site map</button>
      </form>
      <form class="create-form" method="post" action="/admin/cms/pages" data-loading-label="Criando...">
        <input name="title" placeholder="Título do artigo ou notícia" required>
        <button class="admin-button" type="submit">Criar artigo</button>
      </form>
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Página / URL atual</th><th>Status</th><th>Atualizada</th><th></th></tr></thead>
      <tbody>
        ${officialRows}
      </tbody>
    </table>
  </div>
</section>
${
  extraPages.length
    ? `<section class="admin-panel admin-panel--spaced">
  <div class="panel-heading">
    <div>
      <h2>Páginas extras do CMS</h2>
      <p>Páginas criadas fora do site map oficial.</p>
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Página / URL</th><th>Status</th><th>Atualizada</th><th></th></tr></thead>
      <tbody>${extraRows}</tbody>
    </table>
  </div>
</section>`
    : '<p class="empty admin-panel--spaced">Nenhuma página extra criada no CMS.</p>'
}
<script>
  document.querySelectorAll("form[data-loading-label]").forEach((form) => {
    form.addEventListener("submit", () => {
      const button = form.querySelector('button[type="submit"]');
      if (!button) return;
      button.disabled = true;
      button.textContent = form.dataset.loadingLabel;
    });
  });
  document.querySelectorAll("form[data-confirm-delete]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      const ok = window.confirm(
        "Tem certeza que deseja excluir este artigo? Esta ação removerá o artigo da listagem de Artigos e Notícias e deixará sua página indisponível."
      );
      if (!ok) {
        event.preventDefault();
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      if (button) {
        button.disabled = true;
        button.textContent = "Excluindo...";
      }
    });
  });
</script>`,
    })
  );
}));

app.post("/admin/cms/pages/sync-baseline", requireAuth, asyncHandler(async (req, res) => {
  const requestedPath = normalizeLookupPath(normalizePagePath(req.body.path || ""));
  let results;

  if (requestedPath) {
    const sitePage = getSiteMapPageByPath(requestedPath);
    if (!sitePage) {
      const error = new Error("Path do site map não encontrado.");
      error.code = "CMS_PAGE_PATH_INVALID";
      throw error;
    }
    results = [await staticImporter.importPage(sitePage)];
  } else {
    results = await staticImporter.syncBaselinePages();
  }

  const prepared = results.find((result) => result.path === requestedPath) || results[0];
  if (requestedPath && prepared?.id) {
    res.redirect(`/admin/cms/pages/${prepared.id}/editor`);
    return;
  }

  res.redirect("/admin/cms/pages");
}));

app.post("/admin/cms/pages", requireAuth, asyncHandler(async (req, res) => {
  const title = String(req.body.title || "Nova página").trim() || "Nova página";
  const timestamp = nowIso();

  // Artigo/notícia: slug e URL derivados do título (estrutura oficial /artigos/*.html).
  // Path manual opcional só para páginas extras fora do fluxo de artigos.
  const requestedPath = String(req.body.path || "").trim();
  let slug;
  let pagePath;

  if (requestedPath) {
    slug = await ensureAvailableSlug(req.body.slug || title);
    pagePath = await ensureAvailablePath(requestedPath);
  } else {
    slug = await ensureAvailableSlug(title);
    pagePath = await ensureAvailablePath(articlePathFromSlug(slug));
  }

  const result = await db.createPage({ title, slug, path: pagePath, timestamp });

  if (isCmsArticlePath(pagePath)) {
    const template = buildArticleTemplate({ title, rootDir });
    await pageService.saveDraft({
      id: result.id,
      title,
      slug,
      path: pagePath,
      projectData: null,
      html: template.html,
      css: template.css,
      js: template.js,
      timestamp,
    });
  }

  res.redirect(`/admin/cms/pages/${result.id}/editor`);
}));

app.get("/admin/cms/pages/:id/editor", requireAuth, asyncHandler(async (req, res) => {
  const page = pageFromRow(await pageService.getDraftById(req.params.id));

  if (!page) {
    res.status(404).send("Página não encontrada.");
    return;
  }

  const editorStatusLabel = getPageAdminStatusLabel(page, { editor: true });
  const isArticle = isCmsArticlePath(page.path);
  const canDeleteArticle = canDeleteCmsArticle(page.path, page.source_file);
  const isPublished = Boolean(page.published_version_id) || page.status === "published";
  res.send(
    renderAdminLayout({
      title: `Editar ${page.title}`,
      editor: true,
      body: `<header class="editor-topbar">
  <a class="admin-brand" href="/admin/cms/pages">CMS Lamy</a>
  <label>Título <input id="page-title" value="${escapeHtml(page.title)}"></label>
  <label>Slug <input id="page-slug" value="${escapeHtml(page.slug)}" readonly></label>
  <label>URL canônica <input id="page-path" value="${escapeHtml(page.path || `/${page.slug}`)}" readonly></label>
  <span id="save-state" class="save-state">${escapeHtml(editorStatusLabel)}</span>
  <button id="save-page" class="admin-button" type="button">Salvar</button>
  <button id="publish-page" class="admin-button admin-button--primary" type="button">Publicar</button>
  <button id="preview-page" class="admin-button" type="button">Preview</button>
  ${
    canDeleteArticle
      ? '<button id="delete-article" class="admin-button admin-button--danger" type="button">Excluir artigo</button>'
      : ""
  }
</header>
<div id="gjs"></div>
<script id="cms-page-data" type="application/json">${jsonForScript({
        ...page,
        is_article: isArticle,
        can_delete_article: canDeleteArticle,
        is_published: isPublished,
      })}</script>
<script src="/vendor/grapesjs/grapes.min.js"></script>
<script src="/vendor/grapesjs-preset-webpage/index.js"></script>
<script src="/admin-assets/cms-editor.js"></script>`,
    })
  );
}));

app.get("/admin/cms/pages/:id/preview", requireAuth, asyncHandler(async (req, res) => {
  const page = pageFromRow(await pageService.getDraftById(req.params.id));

  if (!page) {
    res.status(404).send("Página não encontrada.");
    return;
  }

  res.send(renderPublicPage(page, { preview: true }));
}));

app.get("/admin/api/media", requireAuth, asyncHandler(async (_req, res) => {
  const assets = listMediaAssets(rootDir);
  res.json({ ok: true, assets });
}));

app.post("/admin/api/media", requireAuth, asyncHandler(async (req, res) => {
  const asset = saveUploadedMedia(rootDir, {
    filename: req.body?.filename,
    contentType: req.body?.contentType,
    data: req.body?.data,
  });
  res.status(201).json({ ok: true, asset });
}));

app.get("/admin/api/pages/:id", requireAuth, asyncHandler(async (req, res) => {
  const page = pageFromRow(await pageService.getDraftById(req.params.id));

  if (!page) {
    res.status(404).json({ error: "Página não encontrada." });
    return;
  }

  res.json(page);
}));

app.put("/admin/api/pages/:id", requireAuth, asyncHandler(async (req, res) => {
  const page = await pageService.getDraftById(req.params.id);
  if (!page) {
    res.status(404).json({ error: "Página não encontrada." });
    return;
  }

  const title = String(req.body.title || "Página sem título").trim() || "Página sem título";
  const isPublished = Boolean(page.published_version_id) || page.status === "published";
  const canonicalSitePage =
    getSiteMapPageBySourceFile(page.source_file) || getSiteMapPageByPath(page.path);
  const isCanonicalArticle =
    Boolean(canonicalSitePage) && isCmsArticlePath(canonicalSitePage.path);
  const isArticle = isCmsArticlePath(page.path) || isCanonicalArticle;

  let slug;
  let nextPath = null;

  // Artigos oficiais do site map e artigos já publicados preservam ID/slug/URL.
  // Só artigos novos (ainda não publicados e fora do site map) regeneram slug pelo título.
  if (isCanonicalArticle || (isArticle && isPublished)) {
    slug = isCanonicalArticle ? canonicalSitePage.slug : page.slug;
    if (!isPublished && isCanonicalArticle) {
      nextPath = canonicalSitePage.path;
    }
  } else if (isArticle && !isPublished) {
    slug = await ensureAvailableSlug(title, req.params.id);
    nextPath = await ensureAvailablePath(articlePathFromSlug(slug), req.params.id);
  } else if (isPublished) {
    slug = page.slug;
  } else {
    slug = await ensureAvailableSlug(req.body.slug || title, req.params.id);
  }

  const projectData = req.body.project_data ? JSON.stringify(req.body.project_data) : null;
  const html = String(req.body.html || "");
  const css = String(req.body.css || "");
  const js = String(req.body.js || "");
  const timestamp = nowIso();

  const savedPage = await pageService.saveDraft({
    id: req.params.id,
    title,
    slug,
    path: nextPath,
    projectData,
    html: normalizePageHtml(html),
    css,
    js,
    timestamp,
  });

  res.json(
    pageFromRow({
      ...savedPage,
      is_article: isCmsArticlePath(savedPage.path) || isCanonicalArticle,
      is_published: Boolean(savedPage.published_version_id) || savedPage.status === "published",
    })
  );
}));

app.post("/admin/api/pages/:id/publish", requireAuth, asyncHandler(async (req, res) => {
  const publishedPage = await pageService.publishLatestDraft({
    id: req.params.id,
    timestamp: nowIso(),
  });

  res.json(pageFromRow(publishedPage));
}));

app.post("/admin/api/pages/:id/rollback", requireAuth, asyncHandler(async (req, res) => {
  const rolledBackPage = await pageService.rollbackPublished({
    id: req.params.id,
    versionId: req.body.version_id || null,
    timestamp: nowIso(),
  });

  res.json(pageFromRow(rolledBackPage));
}));

app.delete("/admin/api/articles/:id", requireAuth, asyncHandler(async (req, res) => {
  const deleted = await pageService.deleteArticle({
    id: req.params.id,
    timestamp: nowIso(),
  });
  res.json({ ok: true, deleted });
}));

app.post("/admin/cms/articles/:id/delete", requireAuth, asyncHandler(async (req, res) => {
  await pageService.deleteArticle({
    id: req.params.id,
    timestamp: nowIso(),
  });
  res.redirect("/admin/cms/pages");
}));

if (servesStaticFiles) {
  app.use("/assets", express.static(path.join(rootDir, "assets")));
  app.use("/css", express.static(path.join(rootDir, "css")));
  app.use("/js", express.static(path.join(rootDir, "js")));
}

async function trySendPublishedPage(res, pagePath) {
  const canonicalPath = normalizeLookupPath(pagePath) || pagePath;
  if (!db.getHealth().ok) {
    return false;
  }

  try {
    const page = pageFromRow(await pageService.getPublishedByPath(canonicalPath));
    if (!page) return false;
    res.send(renderPublicPage(page));
    return true;
  } catch (error) {
    const code = error?.code || error?.cause?.code;
    if (code !== "PGRST205" && code !== "42P01") {
      console.error(`Falha ao carregar página CMS publicada em ${canonicalPath}:`, error);
    }
    return false;
  }
}

function sendStaticFallback(res, sourceFile) {
  const candidates = [
    path.join(rootDir, sourceFile),
    path.join(rootDir, "public", "_static-fallback", sourceFile),
  ];

  // #region agent log
  const candidateStatus = candidates.map((candidate) => ({
    candidate,
    exists: fs.existsSync(candidate),
  }));
  if (process.env.VERCEL === "1") {
    console.log(
      `DEBUG_17859a ${JSON.stringify({
        sessionId: "17859a",
        hypothesisId: "R5",
        location: "server.js:sendStaticFallback",
        message: "static fallback candidates",
        data: { sourceFile, rootDir, candidateStatus },
        timestamp: Date.now(),
      })}`
    );
  }
  // #endregion

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      res.sendFile(candidate, (error) => {
        if (error) {
          // #region agent log
          console.log(
            `DEBUG_17859a ${JSON.stringify({
              sessionId: "17859a",
              hypothesisId: "R5",
              location: "server.js:sendFile",
              message: "sendFile failed",
              data: { candidate, code: error.code || null, message: error.message },
              timestamp: Date.now(),
            })}`
          );
          // #endregion
          if (!res.headersSent) {
            res.status(500).send("Erro ao carregar página.");
          }
        }
      });
      return;
    }
  }

  res.status(404).send("Página não encontrada.");
}

async function sendSiteMapPath(req, res, next, requestPath) {
  const pagePath = normalizePagePath(requestPath);
  if (!pagePath) {
    next();
    return;
  }

  const sitePage = getSiteMapPageByPath(pagePath);
  if (sitePage) {
    if (await trySendPublishedPage(res, sitePage.path)) return;
    sendStaticFallback(res, sitePage.sourceFile);
    return;
  }

  if (await trySendPublishedPage(res, pagePath)) return;
  next();
}

app.get("/", asyncHandler(async (req, res, next) => {
  await sendSiteMapPath(req, res, next, "/");
}));

app.get("/index.html", asyncHandler(async (req, res, next) => {
  await sendSiteMapPath(req, res, next, "/index.html");
}));

app.get("/artigos.html", asyncHandler(async (req, res, next) => {
  await sendSiteMapPath(req, res, next, "/artigos.html");
}));

app.get("/calculadora.html", asyncHandler(async (req, res, next) => {
  await sendSiteMapPath(req, res, next, "/calculadora.html");
}));

app.get(/^\/artigos\/.+\.html$/, asyncHandler(async (req, res, next) => {
  await sendSiteMapPath(req, res, next, req.path);
}));

app.use(asyncHandler(async (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    next();
    return;
  }

  const pagePath = normalizePagePath(req.path);
  if (!pagePath || isReservedSystemPath(pagePath) || isBaselinePath(pagePath)) {
    next();
    return;
  }

  await sendSiteMapPath(req, res, next, pagePath);
}));

app.get("/:slug", asyncHandler(async (req, res, next) => {
  const slug = normalizeSlug(req.params.slug);
  if (!slug || isReservedSlug(slug)) {
    next();
    return;
  }

  try {
    if (!db.getHealth().ok) {
      next();
      return;
    }

    const page = pageFromRow(await pageService.getPublishedBySlug(slug));
    if (!page) {
      next();
      return;
    }
    const canonicalPath = normalizeLookupPath(page.path) || page.path;
    if (canonicalPath && canonicalPath !== `/${slug}`) {
      next();
      return;
    }
    res.send(renderPublicPage(page));
  } catch (error) {
    console.error(`Falha ao carregar página CMS publicada por slug /${slug}:`, error);
    next();
  }
}));

app.use((_req, res) => {
  res.status(404).send("Página não encontrada.");
});

app.use((error, req, res, _next) => {
  const statusByCode = {
    CMS_PAGE_NOT_FOUND: 404,
    CMS_PAGE_PATH_CONFLICT: 409,
    CMS_PAGE_PATH_INVALID: 400,
    CMS_PAGE_PATH_RESERVED: 400,
    CMS_PAGE_SLUG_CONFLICT: 409,
    CMS_DRAFT_REQUIRED: 400,
    CMS_PAGE_VALIDATION: 400,
    CMS_ARTICLES_LISTING_MISSING: 400,
    CMS_ARTICLES_LISTING_INVALID: 400,
    CMS_ARTICLE_DELETE_FORBIDDEN: 403,
    CMS_MEDIA_TYPE_INVALID: 400,
    CMS_MEDIA_EMPTY: 400,
    CMS_MEDIA_TOO_LARGE: 400,
    CMS_MEDIA_PATH_INVALID: 500,
  };
  const status = statusByCode[error.code] || error.status || error.statusCode || 500;
  const requestPath = String(req.originalUrl || req.url || req.path || "");
  const wantsJson =
    requestPath.startsWith("/admin/api/") ||
    requestPath.startsWith("/api/") ||
    String(req.headers.accept || "").includes("application/json") ||
    String(req.headers["content-type"] || "").includes("application/json");

  console.error(error);
  if (wantsJson) {
    res.status(status).json({
      error: status === 500 ? "Erro interno do servidor." : error.message,
      code: error.code || null,
    });
    return;
  }

  res.status(status).send(status === 500 ? "Erro interno do servidor." : escapeHtml(error.message));
});

if (require.main === module) {
  app.listen(port, () => {
    if (!process.env.ADMIN_PASSWORD) {
      console.warn("CMS usando senha padrão admin123. Defina ADMIN_PASSWORD em produção.");
    }
    console.log(`Servidor Lamy rodando em http://localhost:${port}`);
    console.log(`Admin CMS: http://localhost:${port}/admin`);
    console.log(`Banco do CMS: ${db.kind}`);
  });
}

module.exports = app;
