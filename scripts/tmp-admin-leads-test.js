const puppeteer = require("puppeteer-core");
const crypto = require("crypto");
require("dotenv").config();

const BASE = "http://localhost:3000";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, json, text, headers: response.headers };
}

(async () => {
  const unauthGet = await requestJson(`${BASE}/api/leads`);
  if (unauthGet.status !== 401) {
    throw new Error(`GET /api/leads sem auth deveria ser 401, veio ${unauthGet.status}`);
  }

  const unauthAdmin = await fetch(`${BASE}/admin/leads`, { redirect: "manual" });
  if (![302, 303, 307].includes(unauthAdmin.status)) {
    throw new Error(`GET /admin/leads sem auth deveria redirecionar, veio ${unauthAdmin.status}`);
  }

  const invalidPost = await requestJson(`${BASE}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "complete", data: { segment: "veiculos-usados" } }),
  });
  if (invalidPost.status !== 400) {
    throw new Error(`POST inválido deveria ser 400, veio ${invalidPost.status}`);
  }

  const leadId = crypto.randomUUID();
  const completePayload = {
    leadId,
    status: "complete",
    step: 4,
    data: {
      segment: "veiculos-usados",
      segmentLabel: "Lojas de veículos usados",
      email: "lead.teste@empresa.com.br",
      phone: "+55 (41) 99999-8888",
      cnpj: "12.345.678/0001-99",
      contactConsent: true,
      marketingConsent: false,
      rbt12: "R$ 1.000.000,00",
      vehicleValue: "R$ 200.000,00",
      simples: "sim",
    },
    estimatedSavings: "R$ 220.000,00",
    pageUrl: `${BASE}/calculadora.html`,
    referrer: "",
  };

  const incomplete = await requestJson(`${BASE}/api/calculator-leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...completePayload,
      status: "incomplete",
      step: 2,
    }),
  });
  if (!incomplete.json?.ok || incomplete.json.leadId !== leadId) {
    throw new Error(`Upsert incomplete falhou: ${JSON.stringify(incomplete)}`);
  }

  const complete = await requestJson(`${BASE}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(completePayload),
  });
  if (!complete.json?.ok || complete.json.status !== "complete") {
    throw new Error(`POST /api/leads falhou: ${JSON.stringify(complete)}`);
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: EDGE,
  });

  try {
    const page = await browser.newPage();
    await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle0" });
    await page.type('input[name="username"]', process.env.ADMIN_USERNAME || "admin");
    await page.type('input[name="password"]', process.env.ADMIN_PASSWORD || "admin");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      page.click('button[type="submit"]'),
    ]);

    if (!page.url().includes("/admin")) {
      throw new Error(`Login não redirecionou para /admin: ${page.url()}`);
    }

    const dashboard = await page.content();
    if (!dashboard.includes("Editor de Página") || !dashboard.includes("Visualizar Leads")) {
      throw new Error("Painel administrativo sem as duas opções");
    }

    await page.goto(`${BASE}/admin/leads`, { waitUntil: "networkidle0" });
    const leadsHtml = await page.content();
    if (!leadsHtml.includes("lead.teste@empresa.com.br")) {
      throw new Error("Lead não apareceu na listagem");
    }

    await page.goto(`${BASE}/admin/leads/${leadId}`, { waitUntil: "networkidle0" });
    const detailHtml = await page.content();
    if (
      !detailHtml.includes("Valor da folha de pagamento dos últimos 12 meses") ||
      !detailHtml.includes("R$ 200.000,00") ||
      !detailHtml.includes("lead.teste@empresa.com.br")
    ) {
      throw new Error("Detalhes do lead incompletos");
    }

    const apiLeads = await page.evaluate(async () => {
      const response = await fetch("/api/leads");
      return { status: response.status, body: await response.json() };
    });
    if (apiLeads.status !== 200 || !apiLeads.body.leads?.some((item) => item.id === leadId)) {
      throw new Error(`GET autenticado /api/leads falhou: ${JSON.stringify(apiLeads)}`);
    }

    await page.goto(`${BASE}/admin/cms/pages`, { waitUntil: "networkidle0" });
    const pagesHtml = await page.content();
    if (!pagesHtml.includes("Editor de Página") || !pagesHtml.includes("Criar página")) {
      throw new Error("Lista de páginas/CMS alterada indevidamente");
    }

    await page.goto(`${BASE}/calculadora.html`, { waitUntil: "networkidle0" });
    await page.select("#segment", "clinicas-medicas-odontologica");
    await page.click('[data-panel="1"] [data-action="next"]');
    await page.waitForFunction(() => document.querySelector("#calculadora-form")?.dataset.step === "2");
    await page.type("#rbt12", "50000000");
    await page.type("#vehicleValue", "10000000");
    await page.click('[data-panel="2"][data-flow="default"] [data-action="next"]');
    await page.waitForFunction(() => document.querySelector("#calculadora-form")?.dataset.step === "3");
    await page.type("#email", "clinica.flow@empresa.com.br");
    await page.type("#phone", "5541988776655");
    await page.type("#cnpj", "11222333000181");
    await page.click('[name="contactConsent"]');
    await page.click('[data-panel="3"] [data-action="next"]');
    await page.waitForFunction(() => document.querySelector("#calculadora-form")?.dataset.step === "4");

    await page.waitForFunction(async () => {
      const response = await fetch("/api/leads");
      if (!response.ok) return false;
      const body = await response.json();
      return body.leads?.some((item) => item.email === "clinica.flow@empresa.com.br");
    }, { timeout: 15000 });

    console.log("Segurança, API, painel, detalhes e fluxo da calculadora aprovados");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
