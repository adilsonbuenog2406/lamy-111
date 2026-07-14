const crypto = require("crypto");
const path = require("path");

require("dotenv").config();

const createDOMPurify = require("dompurify");
const express = require("express");
const { JSDOM } = require("jsdom");

const { createCmsDb } = require("./lib/cms-db");

const app = express();
const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);
const adminUsername = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const sessionSecret =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const allowPageJs = process.env.CMS_ALLOW_PAGE_JS === "true";
const db = createCmsDb({ rootDir });

const purifierWindow = new JSDOM("").window;
const DOMPurify = createDOMPurify(purifierWindow);

app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false, limit: "2mb" }));
app.use(express.json({ limit: "20mb" }));

app.use(
  "/vendor/grapesjs",
  express.static(path.join(rootDir, "node_modules/grapesjs/dist"))
);
app.use(
  "/vendor/grapesjs-preset-webpage",
  express.static(path.join(rootDir, "node_modules/grapesjs-preset-webpage/dist"))
);
app.use("/admin-assets", express.static(path.join(rootDir, "admin")));

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

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function parseCurrency(value) {
  const digits = digitsOnly(value);
  if (!digits) return null;
  return Number(digits) / 100;
}

function parseLeadId(value) {
  const id = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : crypto.randomUUID();
}

function parseStep(value) {
  const step = Number(value);
  if (Number.isInteger(step) && step >= 1 && step <= 3) return step;
  return 1;
}

function parseLeadStatus(value) {
  return value === "complete" ? "complete" : "incomplete";
}

function parseNullableString(value, maxLength = 500) {
  const text = String(value || "").trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function normalizeCalculatorLeadPayload(req) {
  const body = req.body || {};
  const data = body.data && typeof body.data === "object" ? body.data : {};
  const currentStep = parseStep(body.step || data.step);
  const status = parseLeadStatus(body.status);
  const rbt12Value = parseCurrency(data.rbt12);
  const vehicleValueNumeric = parseCurrency(data.vehicleValue);
  const estimatedSavings = parseCurrency(body.estimatedSavings);

  return {
    id: parseLeadId(body.leadId),
    status,
    current_step: currentStep,
    completed_at: status === "complete" ? nowIso() : null,
    segment: parseNullableString(data.segment, 120),
    segment_label: parseNullableString(data.segmentLabel, 180),
    email: parseNullableString(data.email, 254),
    phone: parseNullableString(data.phone, 40),
    cnpj: parseNullableString(data.cnpj, 30),
    contact_consent: Boolean(data.contactConsent),
    marketing_consent: Boolean(data.marketingConsent),
    rbt12: parseNullableString(data.rbt12, 60),
    rbt12_value: rbt12Value,
    vehicle_value: parseNullableString(data.vehicleValue, 60),
    vehicle_value_numeric: vehicleValueNumeric,
    simples: data.simples === "sim" || data.simples === "nao" ? data.simples : null,
    estimated_savings: estimatedSavings,
    page_url: parseNullableString(body.pageUrl, 1000),
    referrer: parseNullableString(body.referrer, 1000),
    user_agent: parseNullableString(req.get("user-agent"), 1000),
    raw_payload: body,
    updated_at: nowIso(),
  };
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

function normalizePageHtml(html) {
  const value = String(html || "").trim();
  if (!value) return "";
  if (!/<\/?(html|head|body)[\s>]/i.test(value)) return value;

  const dom = new JSDOM(value);
  return dom.window.document.body.innerHTML.trim();
}

function requireAuth(req, res, next) {
  if (req.cmsSession?.authenticated) {
    next();
    return;
  }

  if (req.accepts("html")) {
    res.redirect(`/admin/login?next=${encodeURIComponent(req.originalUrl)}`);
    return;
  }

  res.status(401).json({ error: "Autenticação obrigatória." });
}

function safeAdminNext(value) {
  const nextUrl = String(value || "/admin/cms/pages");
  if (!nextUrl.startsWith("/admin") || nextUrl.startsWith("//")) {
    return "/admin/cms/pages";
  }
  return nextUrl;
}

function sanitizePublicHtml(html) {
  return DOMPurify.sanitize(html || "", {
    USE_PROFILES: { html: true },
    ADD_TAGS: ["section", "main", "picture", "source", "details", "summary"],
    ADD_ATTR: [
      "class",
      "id",
      "style",
      "target",
      "rel",
      "loading",
      "srcset",
      "sizes",
      "aria-label",
      "aria-hidden",
      "role",
    ],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button"],
    FORBID_ATTR: [
      "onabort",
      "onblur",
      "onchange",
      "onclick",
      "onerror",
      "onfocus",
      "onload",
      "onmouseover",
      "onsubmit",
    ],
  });
}

function sanitizeCss(css) {
  return String(css || "")
    .replace(/@import[^;]+;/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/javascript:/gi, "");
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

function renderPublicPage(page, { preview = false } = {}) {
  const title = page.title || "Página";
  const html = sanitizePublicHtml(normalizePageHtml(page.html));
  const css = sanitizeCss(page.css);
  const js = allowPageJs ? String(page.js || "") : "";
  const robots = preview || page.status !== "published" ? "noindex,nofollow" : "index,follow";

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="${robots}">
  <title>${escapeHtml(title)}</title>
  <style>
    *,*::before,*::after{box-sizing:border-box}
    body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#10131c;background:#fff}
    img{max-width:100%;height:auto}
    ${css}
  </style>
</head>
<body>
${html}
${js ? `<script>${js}</script>` : ""}
</body>
</html>`;
}

app.get("/admin/login", (req, res) => {
  if (req.cmsSession?.authenticated) {
    res.redirect("/admin/cms/pages");
    return;
  }

  const hasError = req.query.error === "1";
  res.send(
    renderAdminLayout({
      title: "Entrar",
      body: `<main class="login-page">
  <form class="login-card" method="post" action="/admin/login">
    <h1>CMS Lamy</h1>
    <p>Acesse para criar, editar e publicar páginas.</p>
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
  const lead = normalizeCalculatorLeadPayload(req);
  const saved = await db.upsertCalculatorLead(lead);
  res.json({ ok: true, leadId: saved.id, status: saved.status });
}));

app.get("/admin", requireAuth, (_req, res) => {
  res.redirect("/admin/cms/pages");
});

app.get("/admin/cms/pages", requireAuth, asyncHandler(async (_req, res) => {
  const pages = await db.listPages();

  const rows = pages
    .map(
      (page) => `<tr>
        <td><strong>${escapeHtml(page.title)}</strong><span>/${escapeHtml(page.slug)}</span></td>
        <td><span class="status status--${escapeHtml(page.status)}">${page.status === "published" ? "Publicado" : "Rascunho"}</span></td>
        <td>${escapeHtml(new Date(page.updated_at).toLocaleString("pt-BR"))}</td>
        <td class="actions">
          <a class="admin-button" href="/admin/cms/pages/${page.id}/editor">Editar</a>
          ${
            page.status === "published"
              ? `<a class="admin-button" href="/${escapeHtml(page.slug)}" target="_blank" rel="noopener">Ver</a>`
              : ""
          }
        </td>
      </tr>`
    )
    .join("");

  res.send(
    renderAdminLayout({
      title: "Páginas",
      body: `<header class="admin-topbar">
  <a class="admin-brand" href="/admin/cms/pages">CMS Lamy</a>
  <form method="post" action="/admin/logout"><button class="admin-button" type="submit">Sair</button></form>
</header>
<main class="admin-page">
  <section class="admin-panel">
    <div class="panel-heading">
      <div>
        <h1>Páginas</h1>
        <p>Crie, edite e publique páginas visuais com GrapesJS.</p>
      </div>
      <form class="create-form" method="post" action="/admin/cms/pages">
        <input name="title" placeholder="Título da nova página" required>
        <input name="slug" placeholder="slug-opcional">
        <button class="admin-button admin-button--primary" type="submit">Criar página</button>
      </form>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Página</th><th>Status</th><th>Atualizada</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="empty">Nenhuma página criada ainda.</td></tr>'}</tbody>
      </table>
    </div>
  </section>
</main>`,
    })
  );
}));

app.post("/admin/cms/pages", requireAuth, asyncHandler(async (req, res) => {
  const title = String(req.body.title || "Nova página").trim() || "Nova página";
  const slug = await ensureAvailableSlug(req.body.slug || title);
  const timestamp = nowIso();
  const result = await db.createPage({ title, slug, timestamp });

  res.redirect(`/admin/cms/pages/${result.id}/editor`);
}));

app.get("/admin/cms/pages/:id/editor", requireAuth, asyncHandler(async (req, res) => {
  const page = pageFromRow(await db.getPageById(req.params.id));

  if (!page) {
    res.status(404).send("Página não encontrada.");
    return;
  }

  res.send(
    renderAdminLayout({
      title: `Editar ${page.title}`,
      editor: true,
      body: `<header class="editor-topbar">
  <a class="admin-brand" href="/admin/cms/pages">CMS Lamy</a>
  <label>Título <input id="page-title" value="${escapeHtml(page.title)}"></label>
  <label>Slug <input id="page-slug" value="${escapeHtml(page.slug)}"></label>
  <span id="save-state" class="save-state">${page.status === "published" ? "Publicado" : "Rascunho"}</span>
  <button id="save-page" class="admin-button" type="button">Salvar</button>
  <button id="publish-page" class="admin-button admin-button--primary" type="button">Publicar</button>
  <button id="preview-page" class="admin-button" type="button">Preview</button>
</header>
<div id="gjs"></div>
<script id="cms-page-data" type="application/json">${jsonForScript(page)}</script>
<script src="/vendor/grapesjs/grapes.min.js"></script>
<script src="/vendor/grapesjs-preset-webpage/index.js"></script>
<script src="/admin-assets/cms-editor.js"></script>`,
    })
  );
}));

app.get("/admin/cms/pages/:id/preview", requireAuth, asyncHandler(async (req, res) => {
  const page = pageFromRow(await db.getPageById(req.params.id));

  if (!page) {
    res.status(404).send("Página não encontrada.");
    return;
  }

  res.send(renderPublicPage(page, { preview: true }));
}));

app.get("/admin/api/pages/:id", requireAuth, asyncHandler(async (req, res) => {
  const page = pageFromRow(await db.getPageById(req.params.id));

  if (!page) {
    res.status(404).json({ error: "Página não encontrada." });
    return;
  }

  res.json(page);
}));

app.put("/admin/api/pages/:id", requireAuth, asyncHandler(async (req, res) => {
  const page = await db.getPageById(req.params.id);
  if (!page) {
    res.status(404).json({ error: "Página não encontrada." });
    return;
  }

  const title = String(req.body.title || "Página sem título").trim() || "Página sem título";
  const slug = await ensureAvailableSlug(req.body.slug || title, req.params.id);
  const projectData = req.body.project_data ? JSON.stringify(req.body.project_data) : null;
  const html = String(req.body.html || "");
  const css = String(req.body.css || "");
  const js = String(req.body.js || "");
  const timestamp = nowIso();

  await db.updatePage({
    id: req.params.id,
    title,
    slug,
    projectData,
    html: normalizePageHtml(html),
    css,
    js,
    timestamp,
  });

  res.json(pageFromRow(await db.getPageById(req.params.id)));
}));

app.post("/admin/api/pages/:id/publish", requireAuth, asyncHandler(async (req, res) => {
  const page = await db.getPageById(req.params.id);
  if (!page) {
    res.status(404).json({ error: "Página não encontrada." });
    return;
  }

  const title = String(req.body.title || "Página sem título").trim() || "Página sem título";
  const slug = await ensureAvailableSlug(req.body.slug || title, req.params.id);
  const projectData = req.body.project_data ? JSON.stringify(req.body.project_data) : null;
  const html = String(req.body.html || "");
  const css = String(req.body.css || "");
  const js = String(req.body.js || "");
  const timestamp = nowIso();

  await db.publishPage({
    id: req.params.id,
    title,
    slug,
    projectData,
    html: normalizePageHtml(html),
    css,
    js,
    timestamp,
  });

  res.json(pageFromRow(await db.getPageById(req.params.id)));
}));

app.use("/assets", express.static(path.join(rootDir, "assets")));
app.use("/css", express.static(path.join(rootDir, "css")));
app.use("/js", express.static(path.join(rootDir, "js")));
app.use("/artigos", express.static(path.join(rootDir, "artigos")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

app.get("/index.html", (_req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

app.get("/artigos.html", (_req, res) => {
  res.sendFile(path.join(rootDir, "artigos.html"));
});

app.get("/calculadora.html", (_req, res) => {
  res.sendFile(path.join(rootDir, "calculadora.html"));
});

app.get("/:slug", asyncHandler(async (req, res, next) => {
  const slug = normalizeSlug(req.params.slug);
  if (!slug || isReservedSlug(slug)) {
    next();
    return;
  }

  const page = pageFromRow(await db.getPublishedPageBySlug(slug));

  if (!page) {
    next();
    return;
  }

  res.send(renderPublicPage(page));
}));

app.use((_req, res) => {
  res.status(404).send("Página não encontrada.");
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).send("Erro interno do servidor.");
});

if (require.main === module) {
  app.listen(port, () => {
    if (!process.env.ADMIN_PASSWORD) {
      console.warn("CMS usando senha padrão admin123. Defina ADMIN_PASSWORD em produção.");
    }
    console.log(`Servidor Lamy rodando em http://localhost:${port}`);
    console.log(`Admin CMS: http://localhost:${port}/admin/cms/pages`);
    console.log(`Banco do CMS: ${db.kind}`);
  });
}

module.exports = app;
