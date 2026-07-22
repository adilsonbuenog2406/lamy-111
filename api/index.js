// #region agent log
function debugLog(hypothesisId, location, message, data) {
  const payload = {
    sessionId: "17859a",
    runId: process.env.DEBUG_RUN_ID || "runtime",
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  console.log(`DEBUG_17859a ${JSON.stringify(payload)}`);
  fetch("http://127.0.0.1:7356/ingest/30b1e897-e730-403a-921a-cfb8f842ec31", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "17859a",
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
// #endregion

let app;
try {
  app = require("../server");
  // #region agent log
  debugLog("R8", "api/index.js:load", "Express app loaded for Vercel", {
    vercel: process.env.VERCEL || null,
    nodeEnv: process.env.NODE_ENV || null,
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    fix: "pin-jsdom-26.1.0",
  });
  // #endregion
} catch (error) {
  // #region agent log
  const data = {
    name: error?.name || null,
    message: error?.message || String(error),
    code: error?.code || null,
    stack: String(error?.stack || "")
      .split("\n")
      .slice(0, 12),
  };
  console.error("LAMY_LOAD_FAIL_MESSAGE", data.message);
  console.error("LAMY_LOAD_FAIL_CODE", data.code);
  console.error("LAMY_LOAD_FAIL_STACK", data.stack.join("\n"));
  debugLog("R8", "api/index.js:load-error", "Express app failed to load", data);
  // #endregion
  throw error;
}

module.exports = app;
