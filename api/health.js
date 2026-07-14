const { createCmsDb } = require("../lib/cms-db");

const db = createCmsDb();

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

module.exports = async function healthHandler(_req, res) {
  const env = db.getHealth();
  const health = {
    ok: env.ok,
    database: db.kind,
    env,
    tables: {
      pages: "unknown",
      calculatorLeads: "unknown",
    },
  };

  if (env.ok) {
    try {
      await db.listPages();
      health.tables.pages = "ok";
    } catch (error) {
      health.ok = false;
      health.tables.pages = error.code || error.message;
    }

    try {
      await db.checkCalculatorLeadsTable();
      health.tables.calculatorLeads = "ok";
    } catch (error) {
      health.ok = false;
      health.tables.calculatorLeads = error.code || error.message;
    }
  }

  sendJson(res, health.ok ? 200 : 500, health);
};
