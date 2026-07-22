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

const suspectRelative = "assets/site-home/Vector (6).svg";

// #region agent log
function debugLog(hypothesisId, location, message, data) {
  const payload = {
    sessionId: "17859a",
    runId: process.env.DEBUG_RUN_ID || "post-fix",
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  const line = JSON.stringify(payload);
  console.log(`DEBUG_17859a ${line}`);
  fetch("http://127.0.0.1:7356/ingest/30b1e897-e730-403a-921a-cfb8f842ec31", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "17859a",
    },
    body: line,
  }).catch(() => {});
  try {
    fs.appendFileSync(
      path.join(rootDir, "..", ".cursor", "debug-17859a.log"),
      `${line}\n`
    );
  } catch {
    // ignore when path is unavailable (e.g. Vercel)
  }
}
// #endregion

function copyPath(from, to) {
  const source = path.join(rootDir, from);
  const target = path.join(publicDir, to);

  if (!fs.existsSync(source)) {
    throw new Error(`Arquivo ou pasta não encontrado: ${from}`);
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, {
    recursive: true,
    force: true,
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

function removePublicSiteMapHtml() {
  for (const page of listSiteMapPages()) {
    const publicHtml = path.join(publicDir, page.sourceFile);
    if (fs.existsSync(publicHtml) && fs.statSync(publicHtml).isFile()) {
      fs.rmSync(publicHtml, { force: true });
    }
  }
}

// #region agent log
const suspectPath = path.join(publicDir, suspectRelative);
debugLog("B", "prepare-vercel-public.js:before", "public state before prepare", {
  publicExists: fs.existsSync(publicDir),
  suspectExists: fs.existsSync(suspectPath),
  willWipePublic: false,
});
// #endregion

// Never delete the entire public/ tree during build. Vercel may read committed
// public assets concurrently; wiping the folder causes ENOENT on MultiStream.
fs.mkdirSync(publicDir, { recursive: true });

for (const [from, to] of copies) {
  copyPath(from, to);
}

// #region agent log
debugLog("B", "prepare-vercel-public.js:after-copies", "suspect file after asset copy", {
  suspectExists: fs.existsSync(suspectPath),
  suspectSize: fs.existsSync(suspectPath) ? fs.statSync(suspectPath).size : null,
});
// #endregion

const fallbackDir = path.join(publicDir, "_static-fallback");
fs.mkdirSync(fallbackDir, { recursive: true });

for (const page of listSiteMapPages()) {
  copyPath(page.sourceFile, path.posix.join("_static-fallback", page.sourceFile));
}

removePublicSiteMapHtml();
removeByName(publicDir, ".DS_Store");

// #region agent log
debugLog("B", "prepare-vercel-public.js:done", "prepare completed without public wipe", {
  suspectExists: fs.existsSync(suspectPath),
  publicExists: fs.existsSync(publicDir),
});
// #endregion

console.log(`Arquivos públicos preparados em ${path.relative(rootDir, publicDir)}`);
console.log(
  "HTMLs do site map ficam em public/_static-fallback para fallback via API (URLs canônicas passam pelo CMS)."
);
