const ECOMMERCE_SEGMENT = "ecommerce-e-outros";

function getLeadRawData(lead) {
  const payload = lead?.raw_payload;
  if (!payload || typeof payload !== "object") return {};
  if (payload.data && typeof payload.data === "object") return payload.data;
  return {};
}

function formatSimples(value) {
  if (value === "sim") return "SIM";
  if (value === "nao") return "NÃO";
  return value || "—";
}

function getLeadAnswers(lead) {
  const data = getLeadRawData(lead);
  const segment = lead?.segment || data.segment || "";

  if (segment === ECOMMERCE_SEGMENT) {
    return [
      { label: "Regime", value: data.regime || "—" },
      { label: "Tempo no regime", value: data.regimeTime || "—" },
      {
        label: "Segmento (e-commerce)",
        value: data.ecommerceSegmentLabel || data.ecommerceSegment || "—",
      },
      { label: "Média de faturamento mensal", value: data.monthlyRevenue || "—" },
      { label: "Idade da empresa", value: data.companyAge || "—" },
      { label: "Já fez recuperação tributária?", value: data.taxRecovery || "—" },
    ];
  }

  return [
    {
      label: "Valor da receita bruta dos últimos 12 meses (RBT12)",
      value: data.rbt12 || lead?.rbt12 || "—",
    },
    {
      label: "Valor da folha de pagamento dos últimos 12 meses",
      value: data.vehicleValue || lead?.vehicle_value || "—",
    },
    {
      label: "Empresa está no Simples",
      value: formatSimples(data.simples || lead?.simples),
    },
  ];
}

module.exports = { getLeadAnswers, getLeadRawData };
