const crypto = require("crypto");

function parseCookies(header) {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf("=");
      if (index === -1) return cookies;
      cookies[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
      return cookies;
    }, {});
}

function createCmsAuth({ sessionSecret }) {
  function signCookiePayload(payload) {
    return crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  }

  function encodeSessionCookie(sessionData) {
    const payload = Buffer.from(JSON.stringify(sessionData)).toString("base64url");
    return `${payload}.${signCookiePayload(payload)}`;
  }

  function decodeSessionCookie(value) {
    const [payload, signature] = String(value || "").split(".");
    if (!payload || !signature) return null;

    const expected = signCookiePayload(payload);
    if (signature.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    try {
      const sessionData = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (!sessionData.exp || sessionData.exp < Date.now()) return null;
      return sessionData;
    } catch {
      return null;
    }
  }

  function getSessionFromRequest(req) {
    const cookies = parseCookies(req.headers.cookie);
    return decodeSessionCookie(cookies.lamy_cms_session);
  }

  function isAuthenticated(req) {
    return Boolean(req.cmsSession?.authenticated || getSessionFromRequest(req)?.authenticated);
  }

  return {
    parseCookies,
    encodeSessionCookie,
    decodeSessionCookie,
    getSessionFromRequest,
    isAuthenticated,
  };
}

module.exports = { createCmsAuth, parseCookies };
