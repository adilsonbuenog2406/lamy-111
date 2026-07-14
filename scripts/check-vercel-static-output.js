const fs = require("fs");
const path = require("path");

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

if (process.exitCode) {
  process.exit();
}

const requiredFiles = [
  "index.html",
  "calculadora.html",
  "css/base.css",
  "css/components.css",
  "css/sections.css",
  "css/calculadora.css",
  "js/main.js",
  "js/calculadora.js",
  "assets/images/logo-principal.png",
  "assets/images/lamy-video.mp4",
];

for (const file of requiredFiles) {
  const filePath = path.join(publicDir, file);
  if (!fs.existsSync(filePath)) {
    fail(`Arquivo obrigatório ausente no output da Vercel: public/${file}`);
  }
}

if (process.exitCode) {
  process.exit();
}

console.log("Output estático da Vercel validado.");
