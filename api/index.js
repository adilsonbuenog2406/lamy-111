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
  debugLog("R6", "api/index.js:load", "Express app loaded for Vercel", {
    vercel: process.env.VERCEL || null,
    nodeEnv: process.env.NODE_ENV || null,
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    fix: "removed-framework-null",
  });
  // #endregion
} catch (error) {
  // #region agent log
  debugLog("R6", "api/index.js:load-error", "Express app failed to load", {
    name: error?.name || null,
    message: error?.message || String(error),
  });
  // #endregion
  throw error;
}

module.exports = app;
