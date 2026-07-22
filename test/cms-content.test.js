const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { JSDOM, VirtualConsole } = require("jsdom");

const {
  CALCULATOR_REQUIRED_SELECTORS,
  GOOGLE_FONTS_URL,
  normalizePageHtml,
  renderPublicPage,
  sanitizePublicHtml,
  validatePublishablePage,
} = require("../lib/cms-content");

const rootDir = path.join(__dirname, "..");

function readSource(file) {
  return fs.readFileSync(path.join(rootDir, file), "utf8");
}

function sanitizedDocument(file) {
  const body = normalizePageHtml(readSource(file));
  const html = sanitizePublicHtml(body);
  return new JSDOM(`<body>${html}</body>`).window.document;
}

test("sanitização preserva formulário, vídeo, ARIA e Google Maps da Home", () => {
  const document = sanitizedDocument("index.html");

  assert.ok(document.querySelector("#contact-form"));
  assert.ok(document.querySelector('#contact-form input[name="email"][required]'));
  assert.ok(document.querySelector('#contact-form button[type="submit"]'));
  assert.ok(document.querySelector("video[autoplay][muted][loop][playsinline][preload='auto']"));
  assert.ok(document.querySelector("video[poster$='lamy-video-poster.jpg']"));
  assert.ok(document.querySelector('video source[src$="lamy-video.mp4"]'));
  assert.equal(document.querySelectorAll("iframe").length, 1);
  assert.match(document.querySelector("iframe").getAttribute("src"), /^https:\/\/www\.google\.com\/maps\/embed/);
  assert.ok(document.querySelector('.nav__toggle[aria-expanded="false"]'));
  assert.equal(document.querySelector("[onerror]"), null);
  const whatsapp = document.querySelector("a.whatsapp-btn");
  assert.ok(whatsapp);
  assert.match(whatsapp.getAttribute("href"), /wa\.me\/5541998618931/);
  assert.ok(whatsapp.querySelector("svg path"));
});

test("renderização pública mantém o ícone branco do WhatsApp visível", () => {
  const rendered = renderPublicPage({
    title: "Home",
    path: "/",
    status: "published",
    html: normalizePageHtml(readSource("index.html")),
    css: ".whatsapp-btn{position:fixed}",
  });
  const document = new JSDOM(rendered).window.document;
  const path = document.querySelector("a.whatsapp-btn svg path");
  assert.ok(path);
  assert.equal(path.getAttribute("fill"), "#ffffff");
  assert.equal(document.querySelector("a.whatsapp-btn svg").getAttribute("width"), "36");
  assert.equal(document.querySelector("a.whatsapp-btn svg").getAttribute("height"), "36");
});

test("sanitização preserva integralmente o contrato DOM da calculadora", () => {
  const document = sanitizedDocument("calculadora.html");

  for (const selector of CALCULATOR_REQUIRED_SELECTORS) {
    assert.ok(document.querySelector(selector), `Seletor ausente após sanitização: ${selector}`);
  }

  assert.equal(document.querySelectorAll(".calculadora-form__panel").length, 5);
  assert.equal(document.querySelector("#calculadora-form").dataset.step, "1");
  assert.equal(document.querySelector("#progress-track").getAttribute("role"), "progressbar");
  assert.equal(document.querySelector("#progress-track").getAttribute("aria-valuemax"), "100");
  assert.ok(document.querySelector("#rbt12[inputmode='decimal']"));
  assert.ok(document.querySelector("#cnpj[inputmode='numeric']"));
  assert.ok(document.querySelector('[name="contactConsent"][required]'));
});

test("sanitização bloqueia scripts, handlers, URLs perigosas e iframes não confiáveis", () => {
  const sanitized = sanitizePublicHtml(`
    <form action="javascript:alert(1)" onsubmit="alert(1)">
      <input name="safe" onfocus="alert(1)">
      <a href="javascript:alert(1)">ruim</a>
      <img src="javascript:alert(1)" onerror="alert(1)">
      <iframe src="https://evil.example/embed"></iframe>
      <script>alert(1)</script>
    </form>
  `);
  const document = new JSDOM(`<body>${sanitized}</body>`).window.document;

  assert.ok(document.querySelector("form"));
  assert.ok(document.querySelector('input[name="safe"]'));
  assert.equal(document.querySelector("script"), null);
  assert.equal(document.querySelector("iframe"), null);
  assert.equal(document.querySelector("[onsubmit]"), null);
  assert.equal(document.querySelector("[onfocus]"), null);
  assert.equal(document.querySelector("[onerror]"), null);
  assert.equal(document.querySelector("form").hasAttribute("action"), false);
  assert.equal(document.querySelector("a").hasAttribute("href"), false);
  assert.equal(document.querySelector("img").hasAttribute("src"), false);
});

test("validação rejeita calculadora com estrutura obrigatória removida", () => {
  const html = normalizePageHtml(readSource("calculadora.html")).replace('id="cnpj"', 'id="cnpj-removido"');

  assert.throws(
    () => validatePublishablePage({ path: "/calculadora.html", html }),
    /#cnpj/
  );
});

test("renderização usa Google Fonts e somente bundles confiáveis por path", () => {
  const rendered = renderPublicPage({
    path: "/calculadora.html",
    source_file: "calculadora.html",
    title: "Calculadora",
    status: "published",
    html: '<main id="calculadora-form">Conteúdo</main>',
    css: "body{font-family:'Stack Sans Headline'}",
    js: "window.ARBITRARY_SCRIPT = true",
  });

  assert.ok(rendered.includes(GOOGLE_FONTS_URL.replaceAll("&", "&amp;")));
  assert.ok(
    rendered.includes(
      '<meta name="description" content="Descubra quanto sua empresa pode economizar'
    )
  );
  assert.ok(rendered.includes('<link rel="canonical" href="/calculadora.html">'));
  assert.ok(rendered.includes('<script src="/js/main.js"></script>'));
  assert.ok(rendered.includes('<script src="/js/calculadora.js"></script>'));
  assert.equal(rendered.includes("ARBITRARY_SCRIPT"), false);
});

test("CSS não consegue encerrar style e injetar script", () => {
  const rendered = renderPublicPage({
    path: "/teste.html",
    title: "Teste",
    status: "published",
    html: "<main>Seguro</main>",
    css: "body{color:red}</style><script>window.CSS_XSS=true</script><style>",
  });
  const dom = new JSDOM(rendered, {
    runScripts: "dangerously",
    virtualConsole: new VirtualConsole(),
  });

  assert.equal(dom.window.CSS_XSS, undefined);
  assert.equal(dom.window.document.querySelector("script"), null);
  dom.window.close();
});

test("Preview usa base do path público e permanece noindex", () => {
  const rendered = renderPublicPage(
    {
      path: "/artigos/exemplo.html",
      title: "Preview",
      status: "published",
      html: "<main>Rascunho</main>",
      css: "",
    },
    { preview: true }
  );

  assert.ok(rendered.includes('<base href="/artigos/">'));
  assert.ok(rendered.includes('<meta name="robots" content="noindex,nofollow">'));
});

test("bundles confiáveis renderizados executam o bootstrap da calculadora", async () => {
  const rendered = renderPublicPage({
    path: "/calculadora.html",
    source_file: "calculadora.html",
    title: "Calculadora",
    status: "published",
    html: normalizePageHtml(readSource("calculadora.html")),
    css: "",
    js: "window.ARBITRARY_SCRIPT = true",
  });
  const fetchCalls = [];
  const dom = new JSDOM(rendered, {
    url: "http://localhost/calculadora.html",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  dom.window.alert = () => {};
  dom.window.fetch = async (url) => {
    fetchCalls.push(String(url));
    return {
      ok: true,
      json: async () => ({ ok: true, leadId: "teste", status: "incomplete" }),
    };
  };

  dom.window.eval(readSource("js/main.js"));
  dom.window.eval(readSource("js/calculadora.js"));
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(dom.window.document.querySelector("#calculadora-form").dataset.step, "1");
  assert.ok(fetchCalls.includes("/api/calculator-leads"));
  assert.equal(dom.window.ARBITRARY_SCRIPT, undefined);
  dom.window.close();
});
