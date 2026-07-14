const crypto = require("crypto");

function nowIso() {
  return new Date().toISOString();
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function parseCurrency(value) {
  const digits = digitsOnly(value);
  if (!digits) return null;
  return Number(digits) / 100;
}

function parseLeadId(value) {
  const id = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : crypto.randomUUID();
}

function parseStep(value) {
  const step = Number(value);
  if (Number.isInteger(step) && step >= 1 && step <= 3) return step;
  return 1;
}

function parseLeadStatus(value) {
  return value === "complete" ? "complete" : "incomplete";
}

function parseNullableString(value, maxLength = 500) {
  const text = String(value || "").trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function normalizeCalculatorLeadPayload({ body, userAgent }) {
  const payload = body || {};
  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const currentStep = parseStep(payload.step || data.step);
  const status = parseLeadStatus(payload.status);
  const rbt12Value = parseCurrency(data.rbt12);
  const vehicleValueNumeric = parseCurrency(data.vehicleValue);
  const estimatedSavings = parseCurrency(payload.estimatedSavings);

  return {
    id: parseLeadId(payload.leadId),
    status,
    current_step: currentStep,
    completed_at: status === "complete" ? nowIso() : null,
    segment: parseNullableString(data.segment, 120),
    segment_label: parseNullableString(data.segmentLabel, 180),
    email: parseNullableString(data.email, 254),
    phone: parseNullableString(data.phone, 40),
    cnpj: parseNullableString(data.cnpj, 30),
    contact_consent: Boolean(data.contactConsent),
    marketing_consent: Boolean(data.marketingConsent),
    rbt12: parseNullableString(data.rbt12, 60),
    rbt12_value: rbt12Value,
    vehicle_value: parseNullableString(data.vehicleValue, 60),
    vehicle_value_numeric: vehicleValueNumeric,
    simples: data.simples === "sim" || data.simples === "nao" ? data.simples : null,
    estimated_savings: estimatedSavings,
    page_url: parseNullableString(payload.pageUrl, 1000),
    referrer: parseNullableString(payload.referrer, 1000),
    user_agent: parseNullableString(userAgent, 1000),
    raw_payload: payload,
    updated_at: nowIso(),
  };
}

module.exports = { normalizeCalculatorLeadPayload };
