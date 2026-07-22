const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  UPLOAD_DIR,
  listMediaAssets,
  saveUploadedMedia,
} = require("../lib/cms-media");

function makeTempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lamy-cms-media-"));
  fs.mkdirSync(path.join(root, "assets", "site-home"), { recursive: true });
  fs.writeFileSync(path.join(root, "assets", "site-home", "capa.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.mkdirSync(path.join(root, "assets", "docs"), { recursive: true });
  fs.writeFileSync(path.join(root, "assets", "docs", "nota.txt"), "ignore");
  return root;
}

test("listMediaAssets lista apenas imagens sob assets/", () => {
  const root = makeTempRoot();
  try {
    const assets = listMediaAssets(root);
    assert.equal(assets.length, 1);
    assert.equal(assets[0].src, "/assets/site-home/capa.png");
    assert.equal(assets[0].type, "image");
    assert.equal(assets[0].name, "capa.png");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("saveUploadedMedia grava em assets/cms-uploads e devolve URL pública", () => {
  const root = makeTempRoot();
  try {
    const pngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");
    const asset = saveUploadedMedia(root, {
      filename: "Nova Capa!.PNG",
      contentType: "image/png",
      data: `data:image/png;base64,${pngBase64}`,
    });

    assert.match(asset.src, /^\/assets\/cms-uploads\/nova-capa-\d+-[a-f0-9]+\.png$/);
    assert.equal(asset.type, "image");
    assert.ok(fs.existsSync(path.join(root, asset.src.slice(1))));
    assert.equal(UPLOAD_DIR, "assets/cms-uploads");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("saveUploadedMedia rejeita MIME não suportado", () => {
  const root = makeTempRoot();
  try {
    assert.throws(
      () =>
        saveUploadedMedia(root, {
          filename: "doc.pdf",
          contentType: "application/pdf",
          data: Buffer.from("%PDF").toString("base64"),
        }),
      (error) => error && error.code === "CMS_MEDIA_TYPE_INVALID"
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("saveUploadedMedia rejeita arquivo acima do limite", () => {
  const root = makeTempRoot();
  try {
    const oversized = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 1);
    assert.throws(
      () =>
        saveUploadedMedia(root, {
          filename: "grande.png",
          contentType: "image/png",
          data: `data:image/png;base64,${oversized.toString("base64")}`,
        }),
      (error) => error && error.code === "CMS_MEDIA_TOO_LARGE"
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("formatos de imagem aceitos permanecem estáveis", () => {
  assert.deepEqual(Object.keys(ALLOWED_MIME_TYPES).sort(), [
    "image/gif",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/svg+xml",
    "image/webp",
  ]);
});
