const SITE_MAP_PAGES = Object.freeze([
  Object.freeze({
    title: "Home",
    description:
      "Lamy Advogados — Decisões jurídicas que impactam diretamente o resultado da sua empresa.",
    path: "/",
    slug: "home",
    sourceFile: "index.html",
    aliases: Object.freeze(["/index.html"]),
  }),
  Object.freeze({
    title: "Artigos",
    description:
      "Insights estratégicos — Análises sobre inteligência de negócios, tendências regulatórias e o futuro do ecossistema jurídico corporativo.",
    path: "/artigos.html",
    slug: "artigos-page",
    sourceFile: "artigos.html",
    aliases: Object.freeze([]),
  }),
  Object.freeze({
    title: "Calculadora",
    description:
      "Descubra quanto sua empresa pode economizar na negociação da dívida tributária — Lamy Advogados",
    path: "/calculadora.html",
    slug: "calculadora-page",
    sourceFile: "calculadora.html",
    aliases: Object.freeze([]),
  }),
  Object.freeze({
    title: "Desafios Regulatórios na Era Digital",
    description:
      "Como empresas brasileiras devem se preparar para as novas exigências de compliance transfronteiriço na era digital.",
    path: "/artigos/desafios-regulatorios-era-digital.html",
    slug: "desafios-regulatorios-era-digital",
    sourceFile: "artigos/desafios-regulatorios-era-digital.html",
    aliases: Object.freeze([]),
  }),
  Object.freeze({
    title: "Exclusão do ICMS-DIFAL do PIS e da COFINS",
    description:
      "Empresas do e-commerce: exclusão do ICMS-DIFAL da base de cálculo do PIS e da COFINS, com base no Tema 69 do STF e no Tema 1125 do STJ.",
    path: "/artigos/exclusao-icms-difal-pis-cofins.html",
    slug: "exclusao-icms-difal-pis-cofins",
    sourceFile: "artigos/exclusao-icms-difal-pis-cofins.html",
    aliases: Object.freeze([]),
  }),
  Object.freeze({
    title: "Liquidity Events e M&A em 2024",
    description:
      "Tendências de consolidação em mercados emergentes e estratégias para rodadas de investimento e exits em 2024.",
    path: "/artigos/liquidity-events-ma-2024.html",
    slug: "liquidity-events-ma-2024",
    sourceFile: "artigos/liquidity-events-ma-2024.html",
    aliases: Object.freeze([]),
  }),
  Object.freeze({
    title: "TRF3 afasta vedação da Portaria nº 6.757/22 da PGFN",
    description:
      "A vedação da Portaria nº 6.757/22 da PGFN à adesão de débitos tributários inscritos em dívida ativa há menos de 90 dias foi afastada por decisão do TRF3.",
    path: "/artigos/transacao-tributaria-debitos-posteriores.html",
    slug: "transacao-tributaria-debitos-posteriores",
    sourceFile: "artigos/transacao-tributaria-debitos-posteriores.html",
    aliases: Object.freeze([]),
  }),
]);

// Rotas deliberadamente fora do editor. Esta lista é explícita para que novos
// grupos técnicos não sejam excluídos por heurísticas silenciosas.
const EXCLUDED_PUBLIC_ROUTES = Object.freeze([
  Object.freeze({ path: "/admin", match: "prefix", reason: "Painel privado" }),
  Object.freeze({ path: "/admin-assets", match: "prefix", reason: "Assets do painel" }),
  Object.freeze({ path: "/api", match: "prefix", reason: "Endpoints de API" }),
  Object.freeze({ path: "/assets", match: "prefix", reason: "Arquivos estáticos" }),
  Object.freeze({ path: "/css", match: "prefix", reason: "Folhas de estilo" }),
  Object.freeze({ path: "/js", match: "prefix", reason: "Bundles JavaScript" }),
  Object.freeze({ path: "/vendor", match: "prefix", reason: "Dependências do editor" }),
  Object.freeze({ path: "/favicon.ico", match: "exact", reason: "Ícone do site" }),
  Object.freeze({ path: "/robots.txt", match: "exact", reason: "Arquivo técnico de SEO" }),
  Object.freeze({ path: "/sitemap.xml", match: "exact", reason: "Arquivo técnico de SEO" }),
]);

const SITE_MAP_BY_PATH = new Map();
const SITE_MAP_BY_SOURCE_FILE = new Map();
const SITE_MAP_ALIASES = new Map();

for (const page of SITE_MAP_PAGES) {
  SITE_MAP_BY_PATH.set(page.path, page);
  SITE_MAP_BY_SOURCE_FILE.set(page.sourceFile, page);
  for (const alias of page.aliases) {
    SITE_MAP_ALIASES.set(alias, page.path);
  }
}

const BASELINE_PATHS = new Set([
  ...SITE_MAP_PAGES.map((page) => page.path),
  ...SITE_MAP_ALIASES.keys(),
]);

const BASELINE_SOURCE_FILES = new Set(SITE_MAP_PAGES.map((page) => page.sourceFile));

function normalizeLookupPath(value) {
  const normalized = String(value || "").trim().replaceAll("\\", "/");
  if (!normalized) return null;
  if (normalized === "/index.html") return "/";
  return SITE_MAP_ALIASES.get(normalized) || normalized;
}

function getSiteMapPageByPath(pagePath) {
  const canonical = normalizeLookupPath(pagePath);
  if (!canonical) return null;
  return SITE_MAP_BY_PATH.get(canonical) || null;
}

function getSiteMapPageBySourceFile(sourceFile) {
  const normalized = String(sourceFile || "").replaceAll("\\", "/").replace(/^\/+/, "");
  return SITE_MAP_BY_SOURCE_FILE.get(normalized) || null;
}

function isBaselinePath(pagePath) {
  return BASELINE_PATHS.has(String(pagePath || ""));
}

function isBaselineSourceFile(sourceFile) {
  const normalized = String(sourceFile || "").replaceAll("\\", "/").replace(/^\/+/, "");
  return BASELINE_SOURCE_FILES.has(normalized);
}

function listSiteMapPages() {
  return SITE_MAP_PAGES.slice();
}

function listPublicBaselinePaths() {
  return SITE_MAP_PAGES.flatMap((page) => [page.path, ...page.aliases]);
}

function isExcludedPublicRoute(pagePath) {
  let normalized = String(pagePath || "").toLowerCase();
  while (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  normalized ||= "/";
  return EXCLUDED_PUBLIC_ROUTES.some((route) => {
    if (route.match === "exact") return normalized === route.path;
    return normalized === route.path || normalized.startsWith(`${route.path}/`);
  });
}

module.exports = {
  BASELINE_PATHS,
  BASELINE_SOURCE_FILES,
  EXCLUDED_PUBLIC_ROUTES,
  SITE_MAP_PAGES,
  getSiteMapPageByPath,
  getSiteMapPageBySourceFile,
  isBaselinePath,
  isBaselineSourceFile,
  isExcludedPublicRoute,
  listPublicBaselinePaths,
  listSiteMapPages,
  normalizeLookupPath,
};
