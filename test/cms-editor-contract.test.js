const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const editorSource = fs.readFileSync(
  path.join(__dirname, "..", "admin", "cms-editor.js"),
  "utf8"
);

test("Preview não salva nem publica implicitamente", () => {
  const previewHandler = editorSource.match(
    /previewButton\.addEventListener\("click"[\s\S]+?\n  \}\);/
  )?.[0];

  assert.ok(previewHandler);
  assert.match(previewHandler, /hasUnsavedChanges/);
  assert.match(previewHandler, /\/preview/);
  assert.doesNotMatch(previewHandler, /saveDraft\(/);
  assert.doesNotMatch(previewHandler, /\/publish/);
});

test("Publish recusa alterações não salvas e envia somente comando de promoção", () => {
  const publishHandler = editorSource.match(
    /publishButton\.addEventListener\("click"[\s\S]+?\n  \}\);/
  )?.[0];

  assert.ok(publishHandler);
  assert.match(publishHandler, /hasUnsavedChanges/);
  assert.match(publishHandler, /\/publish/);
  assert.match(publishHandler, /method: "POST"/);
  assert.doesNotMatch(publishHandler, /editor\.getHtml/);
  assert.doesNotMatch(publishHandler, /body:\s*JSON\.stringify/);
});
