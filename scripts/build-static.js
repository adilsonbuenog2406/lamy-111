const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const distDir = path.join(rootDir, "dist");

/** Pastas necessárias para o site público estático (sem CMS/admin). */
const directories = [
  ["assets", "assets"],
  ["css", "css"],
  ["js", "js"],
  ["artigos", "artigos"],
];

const htmlFiles = ["index.html", "artigos.html", "calculadora.html"];

const ignoreNames = new Set([".DS_Store", "Thumbs.db"]);

function shouldCopy(sourcePath) {
  const base = path.basename(sourcePath);
  if (ignoreNames.has(base)) return false;
  // Artefatos de edição Word / originais não usados no front
  if (base.toLowerCase().endsWith(".docx")) return false;
  return true;
}

function copyPath(from, to) {
  const source = path.join(rootDir, from);
  const target = path.join(distDir, to);

  if (!fs.existsSync(source)) {
    throw new Error(`Arquivo ou pasta não encontrado: ${from}`);
  }

  fs.cpSync(source, target, {
    recursive: true,
    filter: (sourcePath) => shouldCopy(sourcePath),
  });
}

function listHtmlTree(directory, prefix = "") {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const pages = [];

  for (const entry of entries) {
    const rel = path.join(prefix, entry.name);
    const abs = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      pages.push(...listHtmlTree(abs, rel));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      pages.push(rel.split(path.sep).join("/"));
    }
  }

  return pages;
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

for (const [from, to] of directories) {
  copyPath(from, to);
}

for (const file of htmlFiles) {
  copyPath(file, file);
}

const pages = listHtmlTree(distDir).sort();
const sizeBytes = (() => {
  let total = 0;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else total += fs.statSync(full).size;
    }
  }
  walk(distDir);
  return total;
})();

console.log(`Build estático gerado em ${path.relative(rootDir, distDir)}/`);
console.log(`Tamanho aproximado: ${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`);
console.log("Páginas:");
for (const page of pages) {
  console.log(`  - ${page}`);
}
console.log("\nEnvie o conteúdo da pasta dist/ para a hospedagem (FTP, Netlify, Cloudflare Pages, etc.).");
console.log("Obs.: a calculadora usa /api/calculator-leads — em hosting só estático, o envio de leads precisa de backend separado.");
