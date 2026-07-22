const fs = require("fs");
const path = require("path");

const { listPublicBaselinePaths, listSiteMapPages } = require("../lib/cms-site-map");

const rootDir = path.join(__dirname, "..");
const vercelConfigPath = path.join(rootDir, "vercel.json");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const config = readJson(vercelConfigPath);
const publicDir = path.join(rootDir, "public");

const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
const apiCatchAllRewrite = rewrites.find((rewrite) => rewrite.source === "/api/:path*");

if (apiCatchAllRewrite) {
  fail('Remova o rewrite "/api/:path*"; ele impede a Vercel de usar funções API dedicadas.');
}

const requiredRewriteSources = new Set([
  "/",
  "/index.html",
  "/artigos.html",
  "/calculadora.html",
  "/artigos/:path*",
  "/:slug",
  "/admin",
  "/admin/:path*",
]);

for (const source of requiredRewriteSources) {
  if (!rewrites.some((rewrite) => rewrite.source === source)) {
    fail(`Rewrite obrigatório ausente em vercel.json: ${source}`);
  }
}

const indexFunction = config.functions && config.functions["api/index.js"];
const includeFiles = String(indexFunction?.includeFiles || "");
const requiredIncludeFragments = [
  "index.html",
  "artigos.html",
  "calculadora.html",
  "artigos/**",
  "lib/**",
  "admin/**",
  "css/**",
  "public/_static-fallback/**",
];

for (const fragment of requiredIncludeFragments) {
  if (!includeFiles.includes(fragment)) {
    fail(`includeFiles de api/index.js deve incluir "${fragment}"`);
  }
}

if (process.exitCode) {
  process.exit();
}

const requiredStaticFiles = [
  "css/variables.css",
  "css/base.css",
  "css/components.css",
  "css/sections.css",
  "css/artigos.css",
  "css/artigo-detail.css",
  "css/calculadora.css",
  "js/main.js",
  "js/calculadora.js",
  "assets/images/logo-principal.png",
  "assets/images/lamy-video.mp4",
  "assets/images/artigos/venture-capital.png",
  "assets/images/artigos/global-compliance.png",
  "assets/images/calculadora/icon-simulacao.svg",
  "assets/site-home/artigo1.png",
  "assets/site-home/artigo3.png",
];

for (const file of requiredStaticFiles) {
  const filePath = path.join(publicDir, file);
  if (!fs.existsSync(filePath)) {
    fail(`Arquivo obrigatório ausente no output da Vercel: public/${file}`);
  }
}

for (const page of listSiteMapPages()) {
  const fallbackPath = path.join(publicDir, "_static-fallback", page.sourceFile);
  const rootPath = path.join(rootDir, page.sourceFile);
  if (!fs.existsSync(fallbackPath)) {
    fail(`Fallback ausente no output da Vercel: public/_static-fallback/${page.sourceFile}`);
  }
  if (!fs.existsSync(rootPath)) {
    fail(`HTML canônico ausente na raiz do projeto: ${page.sourceFile}`);
  }

  const contents = fs.readFileSync(rootPath, "utf8");
  if (!contents.includes("fonts.googleapis.com")) {
    fail(`Google Fonts ausente no HTML de baseline: ${page.sourceFile}`);
  }

  if (fs.existsSync(path.join(publicDir, page.sourceFile.replace(/^\//, "")))) {
    fail(
      `HTML do site map não pode ficar na raiz de public/ (bloqueia o CMS): public/${page.sourceFile}`
    );
  }
}

for (const publicPath of listPublicBaselinePaths()) {
  if (publicPath === "/") continue;
  const publicFile = path.join(publicDir, publicPath.replace(/^\//, ""));
  if (fs.existsSync(publicFile)) {
    fail(`Remova ${publicPath} de public/ para o rewrite da Vercel alcançar o CMS.`);
  }
}

if (process.exitCode) {
  process.exit();
}

console.log("Output estático da Vercel validado.");
