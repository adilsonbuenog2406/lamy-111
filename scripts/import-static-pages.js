const path = require("path");

require("dotenv").config();

const { createCmsDb } = require("../lib/cms-db");
const { createStaticPageImporter } = require("../lib/cms-static-import");

const rootDir = path.join(__dirname, "..");
const db = createCmsDb({ rootDir });

async function main() {
  if (process.env.PHASE1_CMS_IMPORT_ENABLED !== "true") {
    throw new Error(
      "Importação bloqueada. Defina PHASE1_CMS_IMPORT_ENABLED=true para sincronizar as páginas do site map no CMS via CLI."
    );
  }

  await db.ready;
  const importer = createStaticPageImporter({ db, rootDir });
  const results = await importer.syncBaselinePages();

  for (const result of results) {
    console.log(
      `${result.action}: #${result.id} ${result.title} ${result.path} (/${result.slug})`
    );
  }

  console.log(`Imported ${results.length} page(s) into ${db.kind}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
