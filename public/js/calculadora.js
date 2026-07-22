(function () {
  const form = document.getElementById("calculadora-form");
  if (!form) return;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const currencyInputFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const currencyResultFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

  const SEGMENT_LABELS = {
    "veiculos-usados": "Lojas de veículos usados",
    "clinicas-medicas-odontologica": "Clínicas médicas odontológica",
    "ecommerce-e-outros": "Ecommerce e Outros",
  };

  const ECOMMERCE_SEGMENT_LABELS = {
    "alimentos-e-bebidas": "Alimentos e bebidas",
    autopecas: "Autopeças",
    cigarros: "Cigarros",
    combustiveis: "Combustíveis",
    "eletronicos-e-eletrodomesticos": "Eletrônicos e eletrodomésticos",
    ferramentas: "Ferramentas",
    "material-de-construcao": "Material de construção",
    "material-de-limpeza": "Material de limpeza",
    "material-eletrico": "Material elétrico",
    medicamentos: "Medicamentos",
    papelaria: "Papelaria",
    pneumaticos: "Pneumáticos",
    "utilidades-domesticas": "Utilidades domésticas",
    "perfumaria-higiene-cosmeticos": "Perfumaria, higiene pessoal e cosméticos",
    racoes: "Rações",
    sorvetes: "Sorvetes",
    "servicos-em-geral": "Serviços em geral",
    "tintas-e-vernizes": "Tintas e vernizes",
    outros: "Outros",
  };

  const ECOMMERCE_SEGMENT = "ecommerce-e-outros";
  const RESULT_STEP = 4;

  const STEP_CONFIG = {
    1: { progress: 25, stepLabel: "Etapa 1 de 4", percentLabel: "25% concluído" },
    2: { progress: 50, stepLabel: "Etapa 2 de 4", percentLabel: "50% concluído" },
    3: { progress: 75, stepLabel: "Etapa 3 de 4", percentLabel: "75% concluído" },
    4: { progress: 100, stepLabel: "Etapa final", percentLabel: "" },
  };

  const LEAD_STORAGE_KEY = "lamy_calculadora_lead_id";
  const state = {
    step: 1,
    data: {},
    leadId: getStoredLeadId(),
    syncTimer: null,
    isSyncing: false,
    pendingSync: false,
    completed: false,
  };

  const progressEl = document.getElementById("calculadora-progress");
  const stepLabelEl = document.getElementById("progress-step-label");
  const percentLabelEl = document.getElementById("progress-percent-label");
  const progressTrackEl = document.getElementById("progress-track");
  const panels = form.querySelectorAll(".calculadora-form__panel");
  const resultEconomiaEl = document.getElementById("result-economia");
  const innerEl = form.closest(".calculadora__inner");

  function createLeadId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
      (Number(char) ^ (window.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(char) / 4)))).toString(16)
    );
  }

  function getStoredLeadId() {
    try {
      const stored = window.sessionStorage.getItem(LEAD_STORAGE_KEY);
      if (stored) return stored;
      const id = createLeadId();
      window.sessionStorage.setItem(LEAD_STORAGE_KEY, id);
      return id;
    } catch {
      return createLeadId();
    }
  }

  function isEcommerceFlow(segment = state.data.segment) {
    return segment === ECOMMERCE_SEGMENT;
  }

  function digitsOnly(value) {
    return value.replace(/\D/g, "");
  }

  function formatPhone(value) {
    const digits = digitsOnly(value);
    if (digits.length <= 2) return digits ? `+${digits}` : "";
    if (digits.length <= 4) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
    if (digits.length <= 9) {
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
    }
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  }

  function formatCnpj(value) {
    const digits = digitsOnly(value).slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  function formatCurrency(value) {
    const digits = digitsOnly(value);
    if (!digits) return "";
    const number = Number(digits) / 100;
    return currencyInputFormatter.format(number);
  }

  function parseCurrency(value) {
    const digits = digitsOnly(value);
    if (!digits) return 0;
    return Number(digits) / 100;
  }

  function readFormData() {
    const segment = form.querySelector("#segment")?.value || "";
    const ecommerceSegment = form.querySelector("#ecommerceSegment")?.value || "";
    return {
      segment,
      segmentLabel: SEGMENT_LABELS[segment] || "",
      email: form.querySelector("#email")?.value.trim() || "",
      phone: form.querySelector("#phone")?.value.trim() || "",
      cnpj: form.querySelector("#cnpj")?.value.trim() || "",
      contactConsent: form.querySelector('[name="contactConsent"]')?.checked || false,
      marketingConsent: form.querySelector('[name="marketingConsent"]')?.checked || false,
      rbt12: form.querySelector("#rbt12")?.value.trim() || "",
      vehicleValue: form.querySelector("#vehicleValue")?.value.trim() || "",
      simples: form.querySelector("#simples")?.value || "",
      regime: form.querySelector("#regime")?.value.trim() || "",
      regimeTime: form.querySelector("#regimeTime")?.value.trim() || "",
      ecommerceSegment,
      ecommerceSegmentLabel: ECOMMERCE_SEGMENT_LABELS[ecommerceSegment] || "",
      monthlyRevenue: form.querySelector("#monthlyRevenue")?.value.trim() || "",
      companyAge: form.querySelector("#companyAge")?.value.trim() || "",
      taxRecovery: form.querySelector("#taxRecovery")?.value.trim() || "",
    };
  }

  function buildLeadPayload(status = "incomplete") {
    const normalizedStatus = state.completed ? "complete" : status;
    const data = { ...state.data, ...readFormData() };
    return {
      leadId: state.leadId,
      status: normalizedStatus,
      step: state.step,
      data,
      estimatedSavings: normalizedStatus === "complete" ? currencyInputFormatter.format(calculate(data)) : "",
      pageUrl: window.location.href,
      referrer: document.referrer || "",
    };
  }

  async function syncLead(status = "incomplete", options = {}) {
    const payload = buildLeadPayload(status);
    const body = JSON.stringify(payload);
    const endpoint = payload.status === "complete" ? "/api/leads" : "/api/calculator-leads";

    if (options.keepalive && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(endpoint, blob);
      return;
    }

    if (state.isSyncing) {
      state.pendingSync = true;
      return;
    }

    state.isSyncing = true;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: Boolean(options.keepalive),
      });
      if (response.ok) {
        const result = await response.json();
        if (result.leadId && result.leadId !== state.leadId) {
          state.leadId = result.leadId;
          try {
            window.sessionStorage.setItem(LEAD_STORAGE_KEY, result.leadId);
          } catch {}
        }
      }
    } catch {
      // Lead capture must not block the calculator UX.
    } finally {
      state.isSyncing = false;
      if (state.pendingSync) {
        state.pendingSync = false;
        scheduleLeadSync();
      }
    }
  }

  function scheduleLeadSync() {
    window.clearTimeout(state.syncTimer);
    state.syncTimer = window.setTimeout(() => {
      syncLead("incomplete");
    }, 700);
  }

  function clearFieldError(field) {
    field.classList.remove("form-input--error");
    const group = field.closest(".calculadora-form__group");
    if (!group) return;
    const existing = group.querySelector(".form-error");
    if (existing) existing.remove();
  }

  function setFieldError(field, message) {
    clearFieldError(field);
    field.classList.add("form-input--error");
    const err = document.createElement("p");
    err.className = "form-error";
    err.textContent = message;
    field.closest(".calculadora-form__group")?.appendChild(err);
  }

  function getActivePanel() {
    if (state.step !== 2) {
      return form.querySelector(`.calculadora-form__panel[data-panel="${state.step}"]`);
    }
    const flow = isEcommerceFlow() ? "ecommerce" : "default";
    return form.querySelector(`.calculadora-form__panel[data-panel="2"][data-flow="${flow}"]`);
  }

  function goToStep(step, options = {}) {
    state.step = step;
    const config = STEP_CONFIG[step];
    const ecommerce = isEcommerceFlow();

    form.dataset.step = String(step);
    form.dataset.flow = ecommerce ? "ecommerce" : "default";
    form.style.setProperty("--progress", `${config.progress}%`);
    form.classList.toggle("calculadora-form--compact", step === 2 && !ecommerce);
    form.classList.toggle("calculadora-form--result", step === RESULT_STEP);
    document.body.classList.toggle("calculadora-result-active", step === RESULT_STEP);
    innerEl?.classList.toggle("calculadora__inner--result", step === RESULT_STEP);

    progressEl.classList.toggle("calculadora-form__progress--result", step === RESULT_STEP);
    stepLabelEl.textContent = config.stepLabel;
    percentLabelEl.textContent = config.percentLabel;

    if (progressTrackEl) {
      progressTrackEl.setAttribute("aria-valuenow", String(Math.round(config.progress)));
      progressTrackEl.hidden = step === RESULT_STEP;
    }

    panels.forEach((panel) => {
      const panelStep = panel.dataset.panel;
      let isActive = panelStep === String(step);

      if (step === 2 && panelStep === "2") {
        const flow = panel.dataset.flow || "default";
        isActive = ecommerce ? flow === "ecommerce" : flow === "default";
      }

      panel.hidden = !isActive;
      panel.setAttribute("aria-hidden", String(!isActive));
    });

    if (step === RESULT_STEP) {
      state.completed = true;
      renderResults();
      syncLead("complete");
    } else {
      state.completed = false;
      syncLead("incomplete");
    }

    if (!options.skipScroll) {
      if (step === RESULT_STEP && window.matchMedia("(max-width: 767px)").matches) {
        const nav = document.querySelector(".nav");
        const section = form.closest(".calculadora__section");
        const top = section
          ? window.scrollY + section.getBoundingClientRect().top - (nav?.offsetHeight || 0)
          : form.offsetTop;
        window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
        return;
      }

      form.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function calculate(data) {
    if (isEcommerceFlow(data.segment)) {
      const monthly = parseCurrency(data.monthlyRevenue);
      const rbt12 = monthly * 12;
      const base = Math.max(rbt12 * 0.2, 0);
      return Math.max(Math.min(base, 220000), 220000);
    }

    const rbt12 = parseCurrency(data.rbt12);
    const veiculos = parseCurrency(data.vehicleValue);
    const base = Math.max(rbt12 - veiculos, rbt12 * 0.2, 0);
    const simplesFactor = data.simples === "sim" ? 0.18 : 0.22;
    const economiaCincoAnos = Math.min(base * simplesFactor, 220000);
    return Math.max(economiaCincoAnos, 220000);
  }

  function renderResults() {
    if (resultEconomiaEl) {
      resultEconomiaEl.textContent = `Até ${currencyResultFormatter.format(calculate(state.data))}`;
    }
  }

  function validateStep1() {
    const segmentField = form.querySelector("#segment");
    clearFieldError(segmentField);

    if (!segmentField.value) {
      setFieldError(segmentField, "Este campo é obrigatório.");
      return false;
    }

    state.data.segment = segmentField.value;
    state.data.segmentLabel = SEGMENT_LABELS[segmentField.value] || "";
    return true;
  }

  function validateStep2Default() {
    let valid = true;
    const rbt12Field = form.querySelector("#rbt12");
    const vehicleValueField = form.querySelector("#vehicleValue");
    const simplesField = form.querySelector("#simples");

    [rbt12Field, vehicleValueField, simplesField].forEach((field) => {
      clearFieldError(field);
    });

    if (!rbt12Field.value.trim() || parseCurrency(rbt12Field.value) <= 0) {
      valid = false;
      setFieldError(rbt12Field, "Informe a receita bruta dos últimos 12 meses.");
    }

    if (!vehicleValueField.value.trim() || parseCurrency(vehicleValueField.value) < 0) {
      valid = false;
      setFieldError(vehicleValueField, "Informe o valor da folha de pagamento.");
    }

    if (!simplesField.value) {
      valid = false;
      setFieldError(simplesField, "Selecione uma opção.");
    }

    if (!valid) return false;

    state.data.rbt12 = rbt12Field.value.trim();
    state.data.vehicleValue = vehicleValueField.value.trim();
    state.data.simples = simplesField.value;
    return true;
  }

  function validateStep2Ecommerce() {
    let valid = true;
    const regimeField = form.querySelector("#regime");
    const regimeTimeField = form.querySelector("#regimeTime");
    const ecommerceSegmentField = form.querySelector("#ecommerceSegment");
    const monthlyRevenueField = form.querySelector("#monthlyRevenue");
    const companyAgeField = form.querySelector("#companyAge");
    const taxRecoveryField = form.querySelector("#taxRecovery");

    const fields = [
      regimeField,
      regimeTimeField,
      ecommerceSegmentField,
      monthlyRevenueField,
      companyAgeField,
      taxRecoveryField,
    ];

    fields.forEach((field) => clearFieldError(field));

    if (!regimeField.value.trim()) {
      valid = false;
      setFieldError(regimeField, "Informe o regime.");
    }

    if (!regimeTimeField.value.trim()) {
      valid = false;
      setFieldError(regimeTimeField, "Informe o tempo no regime.");
    }

    if (!ecommerceSegmentField.value) {
      valid = false;
      setFieldError(ecommerceSegmentField, "Selecione um segmento.");
    }

    if (!monthlyRevenueField.value.trim() || parseCurrency(monthlyRevenueField.value) <= 0) {
      valid = false;
      setFieldError(monthlyRevenueField, "Informe a média de faturamento mensal.");
    }

    if (!companyAgeField.value.trim()) {
      valid = false;
      setFieldError(companyAgeField, "Informe a idade da empresa.");
    }

    if (!taxRecoveryField.value.trim()) {
      valid = false;
      setFieldError(taxRecoveryField, "Informe se já fez recuperação tributária.");
    }

    if (!valid) return false;

    state.data.regime = regimeField.value.trim();
    state.data.regimeTime = regimeTimeField.value.trim();
    state.data.ecommerceSegment = ecommerceSegmentField.value;
    state.data.ecommerceSegmentLabel = ECOMMERCE_SEGMENT_LABELS[ecommerceSegmentField.value] || "";
    state.data.monthlyRevenue = monthlyRevenueField.value.trim();
    state.data.companyAge = companyAgeField.value.trim();
    state.data.taxRecovery = taxRecoveryField.value.trim();
    return true;
  }

  function validateStep2() {
    return isEcommerceFlow() ? validateStep2Ecommerce() : validateStep2Default();
  }

  function validateStep3() {
    let valid = true;
    const panel = getActivePanel();
    const fields = panel.querySelectorAll(".calculadora-form__input[required]");

    fields.forEach((field) => {
      clearFieldError(field);
      const value = field.value.trim();

      if (!value) {
        valid = false;
        setFieldError(field, "Este campo é obrigatório.");
        return;
      }

      if (field.type === "email" && !emailRegex.test(value)) {
        valid = false;
        setFieldError(field, "Informe um e-mail válido.");
        return;
      }

      if (field.id === "phone" && digitsOnly(value).length < 10) {
        valid = false;
        setFieldError(field, "Informe um telefone válido.");
        return;
      }

      if (field.id === "cnpj" && digitsOnly(value).length < 14) {
        valid = false;
        setFieldError(field, "Informe um CNPJ válido.");
      }
    });

    const contactConsent = form.querySelector('[name="contactConsent"]');
    if (contactConsent && !contactConsent.checked) {
      valid = false;
      alert("É necessário autorizar o contato para enviar o formulário.");
    }

    if (valid) {
      state.data.email = form.querySelector("#email").value.trim();
      state.data.phone = form.querySelector("#phone").value.trim();
      state.data.cnpj = form.querySelector("#cnpj").value.trim();
      state.data.contactConsent = contactConsent?.checked || false;
      state.data.marketingConsent = form.querySelector('[name="marketingConsent"]')?.checked || false;
    }

    return valid;
  }

  function validateCurrentStep() {
    if (state.step === 1) return validateStep1();
    if (state.step === 2) return validateStep2();
    if (state.step === 3) return validateStep3();
    return true;
  }

  function getNextStep() {
    if (state.step === 1) return 2;
    if (state.step === 2) return 3;
    if (state.step === 3) return RESULT_STEP;
    return RESULT_STEP;
  }

  function getPreviousStep() {
    if (state.step === RESULT_STEP) return 3;
    if (state.step === 3) return 2;
    return 1;
  }

  const phoneInput = form.querySelector("#phone");
  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      phoneInput.value = formatPhone(phoneInput.value);
      scheduleLeadSync();
    });
  }

  const cnpjInput = form.querySelector("#cnpj");
  if (cnpjInput) {
    cnpjInput.addEventListener("input", () => {
      cnpjInput.value = formatCnpj(cnpjInput.value);
      scheduleLeadSync();
    });
  }

  form.querySelectorAll("#rbt12, #vehicleValue, #monthlyRevenue").forEach((currencyInput) => {
    currencyInput.addEventListener("input", () => {
      currencyInput.value = formatCurrency(currencyInput.value);
      scheduleLeadSync();
    });
  });

  form
    .querySelectorAll(
      "#segment, #email, #simples, #regime, #regimeTime, #ecommerceSegment, #companyAge, #taxRecovery, [name='contactConsent'], [name='marketingConsent']"
    )
    .forEach((field) => {
      field.addEventListener("input", scheduleLeadSync);
      field.addEventListener("change", scheduleLeadSync);
    });

  form.querySelectorAll('[data-action="next"]').forEach((button) => {
    button.addEventListener("click", async () => {
      if (!validateCurrentStep()) return;
      await syncLead("incomplete");
      goToStep(getNextStep());
    });
  });

  form.querySelectorAll('[data-action="back"]').forEach((button) => {
    button.addEventListener("click", () => {
      goToStep(getPreviousStep());
    });
  });

  window.addEventListener("pagehide", () => {
    syncLead(state.step === RESULT_STEP ? "complete" : "incomplete", { keepalive: true });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
  });

  goToStep(1, { skipScroll: true });
  syncLead("incomplete");
})();
