const { normalizeCalculatorLeadPayload } = require("../lib/calculator-lead-payload");
const { createCmsDb } = require("../lib/cms-db");

const db = createCmsDb();

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  if (req.body && typeof req.body === "object") {
    return Promise.resolve(req.body);
  }

  if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
    if (!req.body.length) return Promise.resolve({});

    try {
      return Promise.resolve(JSON.parse(req.body.toString()));
    } catch {
      return Promise.reject(new Error("JSON inválido."));
    }
  }

  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Payload muito grande."));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON inválido."));
      }
    });

    req.on("error", reject);
  });
}

module.exports = async function calculatorLeadsHandler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    sendJson(res, 405, { error: "Método não permitido." });
    return;
  }

  try {
    const body = await readBody(req);
    const lead = normalizeCalculatorLeadPayload({
      body,
      userAgent: req.headers["user-agent"],
    });
    const saved = await db.upsertCalculatorLead(lead);
    sendJson(res, 200, { ok: true, leadId: saved.id, status: saved.status });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Erro interno do servidor." });
  }
};
