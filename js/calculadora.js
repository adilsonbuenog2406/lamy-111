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
    outros: "Outros",
  };

  const STEP_CONFIG = {
    1: { progress: 33.3, stepLabel: "Etapa 1 de 3", percentLabel: "33,3% concluído" },
    2: { progress: 66.6, stepLabel: "Etapa 2 de 3", percentLabel: "66,6% concluído" },
    3: { progress: 100, stepLabel: "Etapa final", percentLabel: "" },
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

    if (options.keepalive && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/calculator-leads", blob);
      return;
    }

    if (state.isSyncing) {
      state.pendingSync = true;
      return;
    }

    state.isSyncing = true;
    try {
      const response = await fetch("/api/calculator-leads", {
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
    return form.querySelector(`.calculadora-form__panel[data-panel="${state.step}"]`);
  }

  function goToStep(step, options = {}) {
    state.step = step;
    const config = STEP_CONFIG[step];

    form.dataset.step = String(step);
    form.style.setProperty("--progress", `${config.progress}%`);
    form.classList.toggle("calculadora-form--compact", step === 2);
    form.classList.toggle("calculadora-form--result", step === 3);
    document.body.classList.toggle("calculadora-result-active", step === 3);
    innerEl?.classList.toggle("calculadora__inner--result", step === 3);

    progressEl.classList.toggle("calculadora-form__progress--result", step === 3);
    stepLabelEl.textContent = config.stepLabel;
    percentLabelEl.textContent = config.percentLabel;

    if (progressTrackEl) {
      progressTrackEl.setAttribute("aria-valuenow", String(Math.round(config.progress)));
      progressTrackEl.hidden = step === 3;
    }

    panels.forEach((panel) => {
      const isActive = panel.dataset.panel === String(step);
      panel.hidden = !isActive;
      panel.setAttribute("aria-hidden", String(!isActive));
    });

    if (step === 3) {
      state.completed = true;
      renderResults();
      syncLead("complete");
    } else {
      syncLead("incomplete");
    }

    if (!options.skipScroll) {
      if (step === 3 && window.matchMedia("(max-width: 767px)").matches) {
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
    let valid = true;
    const panel = getActivePanel();
    const fields = panel.querySelectorAll(".calculadora-form__input[required]");

    fields.forEach((field) => {
      clearFieldError(field);
      const value = field.value.trim();

      if (!value || (field.tagName === "SELECT" && !field.value)) {
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
      state.data.segment = form.querySelector("#segment").value;
      state.data.email = form.querySelector("#email").value.trim();
      state.data.phone = form.querySelector("#phone").value.trim();
      state.data.cnpj = form.querySelector("#cnpj").value.trim();
      state.data.contactConsent = form.querySelector('[name="contactConsent"]')?.checked || false;
      state.data.marketingConsent = form.querySelector('[name="marketingConsent"]')?.checked || false;
    }

    return valid;
  }

  function validateStep2() {
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
      setFieldError(vehicleValueField, "Informe o valor dos veículos.");
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

  function validateCurrentStep() {
    if (state.step === 1) return validateStep1();
    if (state.step === 2) return validateStep2();
    return true;
  }

  function getNextStep() {
    if (state.step === 1) return 2;
    if (state.step === 2) return 3;
    return 3;
  }

  function resetWizard() {
    state.step = 1;
    state.data = {};
    form.reset();
    goToStep(1);
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

  form.querySelectorAll("#rbt12, #vehicleValue").forEach((currencyInput) => {
    currencyInput.addEventListener("input", () => {
      currencyInput.value = formatCurrency(currencyInput.value);
      scheduleLeadSync();
    });
  });

  form.querySelectorAll("#segment, #email, #simples, [name='contactConsent'], [name='marketingConsent']").forEach((field) => {
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

  window.addEventListener("pagehide", () => {
    syncLead(state.step === 3 ? "complete" : "incomplete", { keepalive: true });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
  });

  goToStep(1, { skipScroll: true });
  syncLead("incomplete");
})();
