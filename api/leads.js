const {
  normalizeCalculatorLeadPayload,
  validateCompleteLeadPayload,
} = require("../lib/calculator-lead-payload");
const { createCmsAuth } = require("../lib/cms-auth");
const { createCmsDb } = require("../lib/cms-db");

const db = createCmsDb();
const auth = createCmsAuth({
  sessionSecret: process.env.SESSION_SECRET || "lamy-cms-fallback-secret",
});

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

module.exports = async function leadsHandler(req, res) {
  if (req.method === "GET") {
    if (!auth.isAuthenticated(req)) {
      sendJson(res, 401, { error: "Autenticação obrigatória." });
      return;
    }

    try {
      const requestUrl = new URL(req.url || "/api/leads", "http://localhost");
      const status =
        typeof req.query?.status === "string"
          ? req.query.status
          : requestUrl.searchParams.get("status") || "complete";
      const limit = Number(
        typeof req.query?.limit === "string"
          ? req.query.limit
          : requestUrl.searchParams.get("limit") || 100
      );
      const leads = await db.listCalculatorLeads({ status, limit });
      sendJson(res, 200, { ok: true, leads });
    } catch (error) {
      console.error(error);
      sendJson(res, 500, { error: "Erro interno do servidor." });
    }
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("allow", "GET, POST");
    sendJson(res, 405, { error: "Método não permitido." });
    return;
  }

  try {
    const body = await readBody(req);
    const validation = validateCompleteLeadPayload(body);

    if (!validation.valid) {
      sendJson(res, 400, { error: validation.errors[0], errors: validation.errors });
      return;
    }

    const lead = normalizeCalculatorLeadPayload({
      body: {
        ...body,
        status: "complete",
        step: body.step || 4,
      },
      userAgent: req.headers["user-agent"],
    });
    const saved = await db.upsertCalculatorLead(lead);
    sendJson(res, 200, { ok: true, leadId: saved.id, status: saved.status });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Erro interno do servidor." });
  }
};
