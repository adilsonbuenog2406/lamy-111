const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

test("importação CLI do site map permanece protegida por flag explícita", () => {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "..", "scripts", "import-static-pages.js")],
    {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PHASE1_CMS_IMPORT_ENABLED: "false",
      },
      encoding: "utf8",
    }
  );

  assert.equal(result.status, 1);
  assert.match(
    `${result.stdout}\n${result.stderr}`,
    /Importação bloqueada\. Defina PHASE1_CMS_IMPORT_ENABLED=true/
  );
});
