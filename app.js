/* =========================================================
   Startup-in-a-Box AI Architect
   Estado persistente: business_project.json
   ========================================================= */

const APP_VERSION = "1.1.0";
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = "mistral-small-latest";

const STEPS = {
  WELCOME: "welcome",
  BASICS: "basics",
  VALIDATION: "validation",
  MARKET: "market",
  LEGAL: "legal",
  COSTS: "costs",
};

/* ---------------- Objeto de estado central ---------------- */
let state = createEmptyState();

function createEmptyState() {
  return {
    appVersion: APP_VERSION,
    savedAt: new Date().toISOString(),
    currentStep: STEPS.WELCOME,
    mistralApiKey: "",
    business: {
      projectName: "",
      sector: "",
      country: "",
      city: "",
      description: "",
    },
    validation: {
      completed: false,
      challenges: [],
      rawResponse: null,
      validatedAt: null,
    },
    market: {
      completed: false,
      currency: "USD",
      avgPrice: 0,
      cogs: 0,
      competitors: [],
      rawResponse: null,
      analyzedAt: null,
    },
    legal: {
      completed: false,
      currency: "USD",
      items: [],
      rawResponse: null,
      analyzedAt: null,
    },
    costs: {
      completed: false,
      currency: "USD",
      fixed: [],
      variable: [],
      totals: {
        fixedMonthlyTotal: 0,
        variableRatePerUnit: 0,
      },
      rawResponse: null,
      analyzedAt: null,
    },
  };
}

/* ---------------- Funciones puras de matemáticas ---------------- */
function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let s = String(value ?? "").trim();
  if (!s) return 0;
  // extrae la primera cifra aunque venga con texto alrededor (ej. "150.00 USD", "$1.200,50/año")
  const match = s.match(/-?[\d.,]*\d/);
  if (!match) return 0;
  s = match[0];
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    // el último separador es el decimal; el otro, de miles
    if (s.lastIndexOf(".") > s.lastIndexOf(",")) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(/\./g, "").replace(",", ".");
    }
  } else if (hasComma) {
    const parts = s.split(",");
    // una sola coma con 1-2 decimales => decimal; el resto, miles
    if (parts.length === 2 && parts[1].length <= 2) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasDot) {
    const parts = s.split(".");
    if (parts.length > 2 || parts[1]?.length === 3) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function sumFixedCosts(fixedItems) {
  return (fixedItems || []).reduce((acc, item) => acc + toNumber(item.amount), 0);
}

function variableRatePerUnit(variableItems) {
  return (variableItems || []).reduce((acc, item) => acc + toNumber(item.perUnit), 0);
}

function legalTotal(items) {
  return (items || []).reduce((acc, item) => acc + toNumber(item.cost), 0);
}

function unitEconomics(market, costs) {
  const price = toNumber(market.avgPrice);
  const cogs = toNumber(market.cogs);
  const varRate = toNumber(costs.totals?.variableRatePerUnit);
  return {
    contributionMargin: price - cogs - varRate,
    marginPct: price > 0 ? ((price - cogs - varRate) / price) * 100 : 0,
  };
}

/* ---------------- Referencias DOM ---------------- */
const $ = (id) => document.getElementById(id);
const screens = {
  welcome: $("screen-welcome"),
  basics: $("screen-basics"),
  validation: $("screen-validation"),
  market: $("screen-market"),
  legal: $("screen-legal"),
  costs: $("screen-costs"),
};

const els = {
  topbar: $("topbar"),
  stepIndicator: $("stepIndicator"),
  btnSaveProgress: $("btnSaveProgress"),
  apiKey: $("apiKey"),
  btnNewProject: $("btnNewProject"),
  importFile: $("importFile"),
  importHint: $("importHint"),
  welcomeError: $("welcomeError"),
  basicsForm: $("basicsForm"),
  projectName: $("projectName"),
  sector: $("sector"),
  country: $("country"),
  city: $("city"),
  description: $("description"),
  btnBackToWelcome: $("btnBackToWelcome"),
  businessSummary: $("businessSummary"),
  btnBackToBasics: $("btnBackToBasics"),
  btnRunValidation: $("btnRunValidation"),
  validationResult: $("validationResult"),
  challengesList: $("challengesList"),
  validationError: $("validationError"),
  validationLoading: $("validationLoading"),
  btnValidationNext: $("btnValidationNext"),
  // Mercado
  btnRunMarket: $("btnRunMarket"),
  marketError: $("marketError"),
  marketLoading: $("marketLoading"),
  marketResult: $("marketResult"),
  marketSummary: $("marketSummary"),
  avgPriceInput: $("avgPriceInput"),
  cogsInput: $("cogsInput"),
  marketCurrencyInput: $("marketCurrencyInput"),
  competitorsList: $("competitorsList"),
  btnMarketNext: $("btnMarketNext"),
  // Legal
  btnRunLegal: $("btnRunLegal"),
  legalError: $("legalError"),
  legalLoading: $("legalLoading"),
  legalResult: $("legalResult"),
  legalSummary: $("legalSummary"),
  legalChecklist: $("legalChecklist"),
  legalTotalBox: $("legalTotalBox"),
  legalManualName: $("legalManualName"),
  legalManualCost: $("legalManualCost"),
  btnAddLegalItem: $("btnAddLegalItem"),
  btnLegalNext: $("btnLegalNext"),
  // Costes
  btnRunCosts: $("btnRunCosts"),
  costsError: $("costsError"),
  costsLoading: $("costsLoading"),
  costsResult: $("costsResult"),
  costsSummary: $("costsSummary"),
  fixedCostsCards: $("fixedCostsCards"),
  variableCostsCards: $("variableCostsCards"),
  fixedTotalBox: $("fixedTotalBox"),
  variableRateBox: $("variableRateBox"),
};

/* ---------------- Render / navegación ---------------- */
function render() {
  const isWelcome = state.currentStep === STEPS.WELCOME;
  els.topbar.hidden = isWelcome;

  Object.entries(screens).forEach(([key, el]) => {
    el.hidden = key !== state.currentStep;
  });

  els.stepIndicator.textContent = isWelcome
    ? ""
    : `Paso actual: ${stepLabel(state.currentStep)}`;

  if (state.currentStep === STEPS.WELCOME) {
    els.apiKey.value = state.mistralApiKey || "";
  }
  if (state.currentStep === STEPS.BASICS) {
    fillBasicsForm();
  }
  if (state.currentStep === STEPS.VALIDATION) {
    renderSummary();
    renderValidationResult();
  }
  if (state.currentStep === STEPS.MARKET) {
    renderBusinessSummary(els.marketSummary);
    renderMarket();
  }
  if (state.currentStep === STEPS.LEGAL) {
    renderBusinessSummary(els.legalSummary);
    renderLegal();
  }
  if (state.currentStep === STEPS.COSTS) {
    renderBusinessSummary(els.costsSummary);
    renderCosts();
  }
}

function stepLabel(step) {
  const labels = {
    [STEPS.BASICS]: "1 · Datos Básicos",
    [STEPS.VALIDATION]: "2 · Validación Preliminar",
    [STEPS.MARKET]: "3 · Análisis de Mercado Real",
    [STEPS.LEGAL]: "4 · Legalidad y Registro",
    [STEPS.COSTS]: "5 · Modelo Financiero Base — Costes",
  };
  return labels[step] || "Bienvenida";
}

function goTo(step) {
  state.currentStep = step;
  render();
}

/* ---------------- Utilidades de UI ---------------- */
function showError(el, message) {
  el.textContent = message;
  el.hidden = !message;
}

function touch() {
  state.savedAt = new Date().toISOString();
}

function renderBusinessSummary(target) {
  const b = state.business;
  target.innerHTML = `
    <strong>${escapeHtml(b.projectName)}</strong> · ${escapeHtml(b.sector)}<br/>
    📍 ${escapeHtml(b.city)}, ${escapeHtml(b.country)}<br/><br/>
    ${escapeHtml(b.description)}
  `;
}

/* ---------------- Export / Import JSON ---------------- */
function exportProject() {
  touch();
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "business_project.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importProject(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (typeof data !== "object" || data === null || !("business" in data)) {
          reject(
            new Error(
              "El archivo no parece un 'business_project.json' válido (falta la sección 'business')."
            )
          );
          return;
        }
        restoreState(data);
        resolve();
      } catch (err) {
        reject(
          new Error(
            "No se pudo leer el archivo JSON. Verifica que sea un 'business_project.json' descargado de esta app. Detalle: " +
              err.message
          )
        );
      }
    };
    reader.onerror = () => reject(new Error("Error de lectura del archivo."));
    reader.readAsText(file);
  });
}

function restoreState(data) {
  state = {
    ...createEmptyState(),
    ...data,
    business: { ...data.business },
    validation: { ...createEmptyState().validation, ...data.validation },
    market: { ...createEmptyState().market, ...data.market },
    legal: { ...createEmptyState().legal, ...data.legal },
    costs: { ...createEmptyState().costs, ...data.costs },
  };
}

/* ---------------- Pantalla de Bienvenida ---------------- */
function startNewProject() {
  const apiKey = els.apiKey.value.trim();
  if (!apiKey) {
    showError(els.welcomeError, "Por favor, introduce tu Clave API de Mistral AI antes de iniciar.");
    els.apiKey.focus();
    return;
  }
  state = createEmptyState();
  state.mistralApiKey = apiKey;
  goTo(STEPS.BASICS);
}

async function loadPreviousProject() {
  const file = els.importFile.files && els.importFile.files[0];
  if (!file) return;
  try {
    await importProject(file);
    showError(els.welcomeError, "");
    if (state.mistralApiKey) els.apiKey.value = state.mistralApiKey;
    goTo(state.currentStep || STEPS.WELCOME);
  } catch (err) {
    showError(els.welcomeError, err.message);
  } finally {
    els.importFile.value = "";
  }
}

/* ---------------- Paso 1: Formulario de datos básicos ---------------- */
function fillBasicsForm() {
  els.projectName.value = state.business.projectName || "";
  els.sector.value = state.business.sector || "";
  els.country.value = state.business.country || "";
  els.city.value = state.business.city || "";
  els.description.value = state.business.description || "";
}

function bindBasicsInputs() {
  [
    [els.projectName, "projectName"],
    [els.sector, "sector"],
    [els.country, "country"],
    [els.city, "city"],
    [els.description, "description"],
  ].forEach(([input, key]) => {
    input.addEventListener("input", () => {
      state.business[key] = input.value;
      touch();
    });
  });
}

function submitBasics(e) {
  e.preventDefault();
  state.business = {
    projectName: els.projectName.value.trim(),
    sector: els.sector.value,
    country: els.country.value.trim(),
    city: els.city.value.trim(),
    description: els.description.value.trim(),
  };
  touch();
  goTo(STEPS.VALIDATION);
}

/* ---------------- Paso 2: Validación Preliminar (Mistral) ---------------- */
function renderValidationResult() {
  const v = state.validation;
  if (!v.completed || !Array.isArray(v.challenges) || v.challenges.length === 0) {
    els.validationResult.hidden = true;
    return;
  }
  els.challengesList.innerHTML = v.challenges
    .map((c) => {
      const title = escapeHtml(c.title || "");
      const detail = escapeHtml(c.detail || c.description || "");
      return `<li><strong>${title}</strong>${detail}</li>`;
    })
    .join("");
  els.validationResult.hidden = false;
}

function validationSystemPrompt() {
  return (
    "Eres un consultor de negocios senior. Responde ÚNICAMENTE con JSON puro, " +
    "sin markdown ni texto adicional, con este formato exacto:\n" +
    '{"challenges": [{"title": "...", "detail": "..."}]}\n' +
    "Devuelve exactamente 3 viñetas sobre los principales desafíos iniciales del negocio descrito. " +
    "Los textos de 'title' y 'detail' deben ser concisos y estar en español."
  );
}

function businessContextText() {
  const b = state.business;
  return `Negocio: ${b.projectName}
Sector: ${b.sector}
Ubicación: ${b.city}, ${b.country}
Descripción: ${b.description}`;
}

async function runValidation() {
  showError(els.validationError, "");
  els.validationLoading.hidden = false;
  els.btnRunValidation.disabled = true;

  try {
    const parsed = await callMistral(validationSystemPrompt(), businessContextText());
    const challenges = Array.isArray(parsed.challenges) ? parsed.challenges : null;
    if (!challenges || challenges.length === 0) {
      throw new Error("El formato de la respuesta de Mistral no incluye desafíos en 'challenges'.");
    }
    state.validation = {
      completed: true,
      challenges,
      rawResponse: JSON.stringify(parsed),
      validatedAt: new Date().toISOString(),
    };
    touch();
    renderValidationResult();
  } catch (err) {
    showError(els.validationError, err.message);
    state.validation.completed = false;
  } finally {
    els.validationLoading.hidden = true;
    els.btnRunValidation.disabled = false;
  }
}

/* ---------------- Paso 3: Análisis de Mercado Real ---------------- */
function marketSystemPrompt() {
  return (
    "Actúa como un analista de mercado con datos actualizados del sector y la región indicados. " +
    "Responde ÚNICAMENTE con JSON puro, sin markdown ni texto adicional, con este formato exacto:\n" +
    '{"currency": "USD", "avgPrice": 0, "cogs": 0, "competitors": [{"name": "...", "type": "...", "note": "..."}]}\n' +
    "Claves numéricas limpias: 'avgPrice' = precio promedio de mercado del producto/servicio (número, sin símbolos ni texto), " +
    "'cogs' = coste estimado de proveedores por unidad (COGS, número limpio). " +
    "'currency' = código de moneda local de 3 letras (ej. MXN, EUR, USD). " +
    "Devuelve exactamente 3 competidores genéricos o tipos de competidores en esa región, con textos concisos en español."
  );
}

function marketUserPrompt() {
  return businessContextText();
}

function coerceMarket(parsed) {
  if (!("avgPrice" in parsed) || !("cogs" in parsed)) {
    throw new Error("El JSON de Mistral no incluye 'avgPrice' y 'cogs' como claves numéricas.");
  }
  return {
    currency: String(parsed.currency || "USD").toUpperCase().slice(0, 3),
    avgPrice: toNumber(parsed.avgPrice),
    cogs: toNumber(parsed.cogs),
    competitors: Array.isArray(parsed.competitors)
      ? parsed.competitors.map((c) => ({
          name: c.name || c.type || "Competidor",
          type: c.type || "",
          note: c.note || "",
        }))
      : [],
  };
}

async function runMarketAnalysis() {
  showError(els.marketError, "");
  els.marketLoading.hidden = false;
  els.btnRunMarket.disabled = true;

  try {
    const parsed = await callMistral(marketSystemPrompt(), marketUserPrompt());
    const market = coerceMarket(parsed);
    if (market.competitors.length === 0) {
      throw new Error("El JSON de Mistral no incluye la lista de competidores.");
    }
    state.market = {
      completed: true,
      ...market,
      rawResponse: JSON.stringify(parsed),
      analyzedAt: new Date().toISOString(),
    };
    touch();
    renderMarket();
  } catch (err) {
    showError(els.marketError, err.message);
    state.market.completed = false;
  } finally {
    els.marketLoading.hidden = true;
    els.btnRunMarket.disabled = false;
  }
}

function renderMarket() {
  const m = state.market;
  if (!m.completed) {
    els.marketResult.hidden = true;
    return;
  }
  els.marketResult.hidden = false;
  els.marketCurrencyInput.value = m.currency || "USD";
  if (document.activeElement !== els.avgPriceInput) {
    els.avgPriceInput.value = m.avgPrice;
  }
  if (document.activeElement !== els.cogsInput) {
    els.cogsInput.value = m.cogs;
  }
  els.competitorsList.innerHTML = m.competitors
    .map(
      (c) => `
      <tr>
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td>${escapeHtml(c.type)}</td>
        <td>${escapeHtml(c.note)}</td>
      </tr>`
    )
    .join("");
}

function bindMarketInputs() {
  els.avgPriceInput.addEventListener("input", () => {
    state.market.avgPrice = toNumber(els.avgPriceInput.value);
    touch();
  });
  els.cogsInput.addEventListener("input", () => {
    state.market.cogs = toNumber(els.cogsInput.value);
    touch();
  });
  els.marketCurrencyInput.addEventListener("input", () => {
    state.market.currency = els.marketCurrencyInput.value.trim().toUpperCase().slice(0, 3) || "USD";
    touch();
  });
}

/* ---------------- Paso 4: Legalidad y Registro ---------------- */
function legalSystemPrompt() {
  return (
    "Actúa como un asesor legal y registral experto en la jurisdicción indicada. " +
    "Lista los pasos legales exactos requeridos para constituir la empresa legalmente en esa región geográfica " +
    "(tasas gubernamentales de apertura, registro de marca, licencias comerciales, permisos fiscales, etc.). " +
    "Responde ÚNICAMENTE con JSON puro, sin markdown ni texto adicional, con este formato exacto:\n" +
    '{"currency": "USD", "items": [{"name": "Nombre del trámite", "cost": 0, "note": "Nota breve"}]}\n' +
    "'cost' debe ser un número limpio en moneda local o dólares (sin símbolos ni texto en la cifra); " +
    "usa 0 si el trámite es gratuito. Devuelve entre 4 y 8 trámites reales y verosímiles para esa región, en español."
  );
}

function legalUserPrompt() {
  return businessContextText();
}

function coerceLegal(parsed) {
  const items = Array.isArray(parsed.items) ? parsed.items : null;
  if (!items || items.length === 0) {
    throw new Error("El JSON de Mistral no incluye la lista de trámites en 'items'.");
  }
  return {
    currency: String(parsed.currency || "USD").toUpperCase().slice(0, 3),
    items: items.map((it) => ({
      name: it.name || "Trámite",
      cost: toNumber(it.cost),
      note: it.note || "",
      done: false,
      manual: false,
    })),
  };
}

async function runLegalAnalysis() {
  showError(els.legalError, "");
  els.legalLoading.hidden = false;
  els.btnRunLegal.disabled = true;

  try {
    const parsed = await callMistral(legalSystemPrompt(), legalUserPrompt());
    const legal = coerceLegal(parsed);
    state.legal = {
      completed: true,
      ...legal,
      rawResponse: JSON.stringify(parsed),
      analyzedAt: new Date().toISOString(),
    };
    touch();
    renderLegal();
  } catch (err) {
    showError(els.legalError, err.message);
    state.legal.completed = false;
  } finally {
    els.legalLoading.hidden = true;
    els.btnRunLegal.disabled = false;
  }
}

function renderLegal() {
  const l = state.legal;
  if (!l.completed) {
    els.legalResult.hidden = true;
    return;
  }
  els.legalResult.hidden = false;
  els.legalChecklist.innerHTML = l.items
    .map(
      (it, idx) => `
      <li class="checklist-item ${it.done ? "done" : ""}">
        <label>
          <input type="checkbox" data-legal-done="${idx}" ${it.done ? "checked" : ""} />
          <span class="check-name"><strong>${escapeHtml(it.name)}</strong>
          ${it.manual ? '<em class="tag-manual">manual</em>' : ""}
          ${it.note ? `<small>${escapeHtml(it.note)}</small>` : ""}</span>
        </label>
        <span class="check-cost">
          <input type="number" step="0.01" min="0" data-legal-cost="${idx}" value="${it.cost}" />
          <button class="btn-icon" data-legal-remove="${idx}" title="Eliminar trámite">✕</button>
        </span>
      </li>`
    )
    .join("");
  const total = legalTotal(l.items);
  els.legalTotalBox.innerHTML =
    `Inversión Inicial Legal: <strong>${formatMoney(total)} ${escapeHtml(l.currency)}</strong>` +
    ` · Completados: ${l.items.filter((i) => i.done).length}/${l.items.length}`;
}

function legalItemChanged(e) {
  const doneIdx = e.target.getAttribute("data-legal-done");
  const costIdx = e.target.getAttribute("data-legal-cost");
  const removeIdx = e.target.getAttribute("data-legal-remove");
  if (doneIdx !== null) {
    state.legal.items[Number(doneIdx)].done = e.target.checked;
    touch();
    renderLegal();
  } else if (costIdx !== null) {
    state.legal.items[Number(costIdx)].cost = toNumber(e.target.value);
    touch();
    renderLegal();
  } else if (removeIdx !== null) {
    state.legal.items.splice(Number(removeIdx), 1);
    touch();
    renderLegal();
  }
}

function addManualLegalItem() {
  const name = els.legalManualName.value.trim();
  const cost = toNumber(els.legalManualCost.value);
  if (!name) {
    showError(els.legalError, "Escribe el nombre del trámite manual antes de añadirlo.");
    els.legalManualName.focus();
    return;
  }
  showError(els.legalError, "");
  state.legal.items.push({ name, cost, note: "", done: false, manual: true });
  state.legal.completed = true;
  els.legalManualName.value = "";
  els.legalManualCost.value = "";
  touch();
  renderLegal();
}

/* ---------------- Paso 5: Modelo Financiero Base — Costes ---------------- */
function costsSystemPrompt() {
  return (
    "Actúa como un director financiero de startups. Basándote en el sector, la ubicación, la descripción del negocio " +
    "y los trámites legales conocidos, propone los costes operativos de la empresa. " +
    "Responde ÚNICAMENTE con JSON puro, sin markdown ni texto adicional, con este formato exacto:\n" +
    '{"currency": "USD", "fixed": [{"concept": "Alquiler estimado", "amount": 0}], "variable": [{"concept": "Coste variable por unidad", "perUnit": 0}]}\n' +
    "REGLA DE ORO: NO devuelvas totales, sumas, textos con cálculos ni fórmulas; solo conceptos individuales con números limpios. " +
    "'amount' = coste fijo MENSUAL en números limpios (alquiler estimado, herramientas de software esenciales, " +
    "marketing digital base, salarios mínimos estimados, servicios y suministros). " +
    "'perUnit' = coste variable por unidad vendida en números limpios (materiales, comisiones, embalaje, envío). " +
    "Devuelve entre 4 y 8 conceptos fijos y entre 2 y 4 variables, realistas para la región, en español."
  );
}

function costsUserPrompt() {
  const l = state.legal;
  const legalSummary = l.completed
    ? l.items.map((i) => `${i.name} (${i.cost})`).join("; ")
    : "Trámites legales aún no definidos.";
  return (
    businessContextText() +
    `\nPrecio promedio de mercado: ${state.market.avgPrice} ${state.market.currency}` +
    `\nCOGS por unidad: ${state.market.cogs}` +
    `\nTrámites legales previstos: ${legalSummary}`
  );
}

function coerceCosts(parsed) {
  const fixed = Array.isArray(parsed.fixed) ? parsed.fixed : null;
  const variable = Array.isArray(parsed.variable) ? parsed.variable : null;
  if (!fixed || fixed.length === 0) {
    throw new Error("El JSON de Mistral no incluye la lista de costes fijos en 'fixed'.");
  }
  const items = {
    currency: String(parsed.currency || "USD").toUpperCase().slice(0, 3),
    fixed: fixed.map((f) => ({ concept: f.concept || "Coste fijo", amount: toNumber(f.amount) })),
    variable: (variable || []).map((v) => ({
      concept: v.concept || "Coste variable",
      perUnit: toNumber(v.perUnit),
    })),
  };
  items.totals = {
    fixedMonthlyTotal: sumFixedCosts(items.fixed),
    variableRatePerUnit: variableRatePerUnit(items.variable),
  };
  return items;
}

async function runCostsAnalysis() {
  showError(els.costsError, "");
  els.costsLoading.hidden = false;
  els.btnRunCosts.disabled = true;

  try {
    const parsed = await callMistral(costsSystemPrompt(), costsUserPrompt());
    const costs = coerceCosts(parsed);
    state.costs = {
      completed: true,
      ...costs,
      rawResponse: JSON.stringify(parsed),
      analyzedAt: new Date().toISOString(),
    };
    touch();
    renderCosts();
  } catch (err) {
    showError(els.costsError, err.message);
    state.costs.completed = false;
  } finally {
    els.costsLoading.hidden = true;
    els.btnRunCosts.disabled = false;
  }
}

function renderCosts() {
  const c = state.costs;
  if (!c.completed) {
    els.costsResult.hidden = true;
    return;
  }
  els.costsResult.hidden = false;

  els.fixedCostsCards.innerHTML = c.fixed
    .map(
      (f, idx) => `
      <div class="cost-card">
        <label>${escapeHtml(f.concept)} <small>(mensual)</small></label>
        <div class="cost-input-row">
          <input type="number" step="0.01" min="0" data-fixed-amount="${idx}" value="${f.amount}" />
          <span>${escapeHtml(c.currency)}</span>
        </div>
      </div>`
    )
    .join("");

  els.variableCostsCards.innerHTML = c.variable
    .map(
      (v, idx) => `
      <div class="cost-card">
        <label>${escapeHtml(v.concept)} <small>(por unidad)</small></label>
        <div class="cost-input-row">
          <input type="number" step="0.01" min="0" data-variable-perunit="${idx}" value="${v.perUnit}" />
          <span>${escapeHtml(c.currency)}</span>
        </div>
      </div>`
    )
    .join("");

  state.costs.totals = {
    fixedMonthlyTotal: sumFixedCosts(c.fixed),
    variableRatePerUnit: variableRatePerUnit(c.variable),
  };
  const ue = unitEconomics(state.market, state.costs);
  els.fixedTotalBox.innerHTML =
    `Total costes fijos mensuales: <strong>${formatMoney(state.costs.totals.fixedMonthlyTotal)} ${escapeHtml(c.currency)}</strong>`;
  els.variableRateBox.innerHTML =
    `Tasa de coste variable: <strong>${formatMoney(state.costs.totals.variableRatePerUnit)} ${escapeHtml(c.currency)}/unidad</strong>` +
    (state.market.completed
      ? ` · Margen de contribución estimado: <strong>${formatMoney(ue.contributionMargin)} ${escapeHtml(c.currency)}</strong> (${ue.marginPct.toFixed(1)}%)`
      : "");
}

function costsChanged(e) {
  const fixedIdx = e.target.getAttribute("data-fixed-amount");
  const varIdx = e.target.getAttribute("data-variable-perunit");
  if (fixedIdx !== null) {
    state.costs.fixed[Number(fixedIdx)].amount = toNumber(e.target.value);
  } else if (varIdx !== null) {
    state.costs.variable[Number(varIdx)].perUnit = toNumber(e.target.value);
  } else {
    return;
  }
  touch();
  renderCosts();
}

/* ---------------- Cliente genérico de Mistral ---------------- */
function extractJson(text) {
  const trimmed = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("La respuesta de Mistral no contiene un JSON válido.");
  }
}

async function callMistral(systemPrompt, userPrompt) {
  let res;
  try {
    res = await fetch(MISTRAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.mistralApiKey}`,
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });
  } catch {
    throw new Error("No se pudo conectar con Mistral AI. Revisa tu conexión a internet y la clave API.");
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error("La Clave API de Mistral AI no es válida o no está autorizada. Corrígela en la pantalla de bienvenida y vuelve a cargar tu proyecto.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Error de conexión con Mistral AI (HTTP ${res.status}). ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Mistral AI respondió sin contenido.");

  return extractJson(content);
}

/* ---------------- Utilidades ---------------- */
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ---------------- Listeners ---------------- */
els.btnNewProject.addEventListener("click", startNewProject);
els.importFile.addEventListener("change", loadPreviousProject);
els.btnSaveProgress.addEventListener("click", exportProject);
els.basicsForm.addEventListener("submit", submitBasics);
els.btnBackToWelcome.addEventListener("click", () => goTo(STEPS.WELCOME));
els.btnBackToBasics.addEventListener("click", () => goTo(STEPS.BASICS));
els.btnRunValidation.addEventListener("click", runValidation);
els.btnValidationNext.addEventListener("click", () => goTo(STEPS.MARKET));
els.apiKey.addEventListener("input", () => {
  state.mistralApiKey = els.apiKey.value.trim();
});

// Mercado
$("btnBackToValidation").addEventListener("click", () => goTo(STEPS.VALIDATION));
els.btnRunMarket.addEventListener("click", runMarketAnalysis);
bindMarketInputs();
els.btnMarketNext.addEventListener("click", () => goTo(STEPS.LEGAL));

// Legal
$("btnBackToMarket").addEventListener("click", () => goTo(STEPS.MARKET));
els.btnRunLegal.addEventListener("click", runLegalAnalysis);
els.legalChecklist.addEventListener("change", legalItemChanged);
els.btnAddLegalItem.addEventListener("click", addManualLegalItem);
els.btnLegalNext.addEventListener("click", () => goTo(STEPS.COSTS));

// Costes
$("btnBackToLegal").addEventListener("click", () => goTo(STEPS.LEGAL));
els.btnRunCosts.addEventListener("click", runCostsAnalysis);
els.fixedCostsCards.addEventListener("input", costsChanged);
els.variableCostsCards.addEventListener("input", costsChanged);

bindBasicsInputs();
render();
