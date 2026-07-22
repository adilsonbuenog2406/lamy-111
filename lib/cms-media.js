const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UPLOAD_DIR = "assets/cms-uploads";
const SCAN_ROOTS = Object.freeze(["assets"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
const ALLOWED_MIME_TYPES = Object.freeze({
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
});
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function createMediaError(message, code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function toPosix(relativePath) {
  return String(relativePath || "").split(path.sep).join("/");
}

function toPublicUrl(relativePosix) {
  const normalized = toPosix(relativePosix).replace(/^\/+/, "");
  return `/${normalized}`;
}

function isInsideRoot(rootDir, absolutePath) {
  const relative = path.relative(rootDir, absolutePath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function listImageFiles(rootDir, directory, collected = []) {
  if (!fs.existsSync(directory)) return collected;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".DS_Store" || entry.name === "Thumbs.db") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      listImageFiles(rootDir, absolute, collected);
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(extension)) continue;
    const relative = toPosix(path.relative(rootDir, absolute));
    collected.push({
      src: toPublicUrl(relative),
      name: entry.name,
      type: "image",
    });
  }

  return collected;
}

function listMediaAssets(rootDir) {
  const assets = [];
  for (const scanRoot of SCAN_ROOTS) {
    listImageFiles(rootDir, path.join(rootDir, scanRoot), assets);
  }

  assets.sort((left, right) => left.src.localeCompare(right.src, "pt-BR"));
  return assets;
}

function sanitizeUploadBasename(filename) {
  const base = path.basename(String(filename || "imagem"));
  const extension = path.extname(base).toLowerCase();
  const stemSource = extension
    ? base.slice(0, base.length - path.extname(base).length)
    : base;
  const stem = stemSource
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return {
    stem: stem || "imagem",
    extension: IMAGE_EXTENSIONS.has(extension) ? extension : "",
  };
}

function decodeBase64Payload(data) {
  const raw = String(data || "");
  const match = raw.match(/^data:([^;]+);base64,(.+)$/i);
  if (match) {
    return {
      contentType: match[1].toLowerCase(),
      buffer: Buffer.from(match[2], "base64"),
    };
  }
  return {
    contentType: null,
    buffer: Buffer.from(raw, "base64"),
  };
}

function saveUploadedMedia(rootDir, { filename, contentType, data }) {
  const decoded = decodeBase64Payload(data);
  const mime = String(contentType || decoded.contentType || "")
    .toLowerCase()
    .trim();
  const extensionFromMime = ALLOWED_MIME_TYPES[mime];
  if (!extensionFromMime) {
    throw createMediaError(
      "Formato de imagem não suportado. Use JPG, PNG, WEBP, GIF ou SVG.",
      "CMS_MEDIA_TYPE_INVALID"
    );
  }

  const buffer = decoded.buffer;
  if (!buffer.length) {
    throw createMediaError("Arquivo de imagem vazio.", "CMS_MEDIA_EMPTY");
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw createMediaError(
      "A imagem excede o limite de 8 MB.",
      "CMS_MEDIA_TOO_LARGE"
    );
  }

  const { stem, extension } = sanitizeUploadBasename(filename);
  const finalExtension = extensionFromMime || extension || ".png";
  const uniqueName = `${stem}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}${finalExtension}`;
  const uploadDir = path.join(rootDir, UPLOAD_DIR);
  fs.mkdirSync(uploadDir, { recursive: true });

  const absolute = path.join(uploadDir, uniqueName);
  if (!isInsideRoot(path.join(rootDir, "assets"), absolute)) {
    throw createMediaError("Caminho de upload inválido.", "CMS_MEDIA_PATH_INVALID", 500);
  }

  fs.writeFileSync(absolute, buffer);
  const relative = toPosix(path.join(UPLOAD_DIR, uniqueName));
  return {
    src: toPublicUrl(relative),
    name: uniqueName,
    type: "image",
  };
}

module.exports = {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  UPLOAD_DIR,
  listMediaAssets,
  saveUploadedMedia,
};
