const fs = require("fs");
const path = require("path");

const { listSiteMapPages } = require("../lib/cms-site-map");

const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");

const copies = [
  ["assets", "assets"],
  ["css", "css"],
  ["js", "js"],
  ["admin", "admin-assets"],
  ["node_modules/grapesjs/dist", "vendor/grapesjs"],
  ["node_modules/grapesjs-preset-webpage/dist", "vendor/grapesjs-preset-webpage"],
];

function copyPath(from, to) {
  const source = path.join(rootDir, from);
  const target = path.join(publicDir, to);

  if (!fs.existsSync(source)) {
    throw new Error(`Arquivo ou pasta não encontrado: ${from}`);
  }

  fs.cpSync(source, target, {
    recursive: true,
    filter: (sourcePath) => path.basename(sourcePath) !== ".DS_Store",
  });
}

function removeByName(directory, fileName) {
  if (!fs.existsSync(directory)) return;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.name === fileName) {
      fs.rmSync(entryPath, { force: true, recursive: true });
    } else if (entry.isDirectory()) {
      removeByName(entryPath, fileName);
    }
  }
}

fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(publicDir, { recursive: true });

for (const [from, to] of copies) {
  copyPath(from, to);
}

const fallbackDir = path.join(publicDir, "_static-fallback");
fs.mkdirSync(fallbackDir, { recursive: true });

for (const page of listSiteMapPages()) {
  copyPath(page.sourceFile, path.posix.join("_static-fallback", page.sourceFile));
}

removeByName(publicDir, ".DS_Store");

console.log(`Arquivos públicos preparados em ${path.relative(rootDir, publicDir)}`);
console.log(
  "HTMLs do site map ficam em public/_static-fallback para fallback via API (URLs canônicas passam pelo CMS)."
);
