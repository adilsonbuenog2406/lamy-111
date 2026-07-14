const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");

const copies = [
  ["assets", "assets"],
  ["css", "css"],
  ["js", "js"],
  ["artigos", "artigos"],
  ["admin", "admin-assets"],
  ["node_modules/grapesjs/dist", "vendor/grapesjs"],
  ["node_modules/grapesjs-preset-webpage/dist", "vendor/grapesjs-preset-webpage"],
];

const files = ["index.html", "artigos.html", "calculadora.html"];

function copyPath(from, to) {
  const source = path.join(rootDir, from);
  const target = path.join(publicDir, to);

  if (!fs.existsSync(source)) {
    throw new Error(`Arquivo ou pasta não encontrado: ${from}`);
  }

  fs.cpSync(source, target, { recursive: true });
}

fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(publicDir, { recursive: true });

for (const [from, to] of copies) {
  copyPath(from, to);
}

for (const file of files) {
  copyPath(file, file);
}

console.log(`Arquivos públicos preparados em ${path.relative(rootDir, publicDir)}`);
