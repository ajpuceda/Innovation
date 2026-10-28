/* =========================================================
   Startup-in-a-Box AI Architect
   Estado persistente: business_project.json
   ========================================================= */

const APP_VERSION = "1.0.0";
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = "mistral-small-latest";

const STEPS = {
  WELCOME: "welcome",
  BASICS: "basics",
  VALIDATION: "validation",
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
  };
}

/* ---------------- Referencias DOM ---------------- */
const $ = (id) => document.getElementById(id);
const screens = {
  welcome: $("screen-welcome"),
  basics: $("screen-basics"),
  validation: $("screen-validation"),
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
}

function stepLabel(step) {
  if (step === STEPS.BASICS) return "1 · Datos Básicos";
  if (step === STEPS.VALIDATION) return "2 · Validación Preliminar";
  return "Bienvenida";
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
function renderSummary() {
  const b = state.business;
  els.businessSummary.innerHTML = `
    <strong>${escapeHtml(b.projectName)}</strong> · ${escapeHtml(b.sector)}<br/>
    📍 ${escapeHtml(b.city)}, ${escapeHtml(b.country)}<br/><br/>
    ${escapeHtml(b.description)}
  `;
}

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

function buildValidationPrompt() {
  const b = state.business;
  return `Negocio: ${b.projectName}
Sector: ${b.sector}
Ubicación: ${b.city}, ${b.country}
Descripción: ${b.description}`;
}

function buildSystemPrompt() {
  return (
    "Eres un consultor de negocios senior. Responde ÚNICAMENTE con JSON puro, " +
    "sin markdown ni texto adicional, con este formato exacto:\n" +
    '{"challenges": [{"title": "...", "detail": "..."}]}\n' +
    "Devuelve exactamente 3 viñetas sobre los principales desafíos iniciales del negocio descrito. " +
    "Los textos de 'title' y 'detail' deben ser concisos y estar en español."
  );
}

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

async function callMistral(apiKey, userPrompt) {
  const res = await fetch(MISTRAL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });

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

  const parsed = extractJson(content);
  const challenges = Array.isArray(parsed.challenges) ? parsed.challenges : null;
  if (!challenges || challenges.length === 0) {
    throw new Error("El formato de la respuesta de Mistral no incluye desafíos en 'challenges'.");
  }
  return { challenges, raw: content };
}

async function runValidation() {
  showError(els.validationError, "");
  els.validationLoading.hidden = false;
  els.btnRunValidation.disabled = true;

  try {
    const { challenges, raw } = await callMistral(
      state.mistralApiKey,
      buildValidationPrompt()
    );
    state.validation = {
      completed: true,
      challenges,
      rawResponse: raw,
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

/* ---------------- Escape HTML ---------------- */
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------------- Listeners ---------------- */
els.btnNewProject.addEventListener("click", startNewProject);
els.importFile.addEventListener("change", loadPreviousProject);
els.btnSaveProgress.addEventListener("click", exportProject);
els.basicsForm.addEventListener("submit", submitBasics);
els.btnBackToWelcome.addEventListener("click", () => goTo(STEPS.WELCOME));
els.btnBackToBasics.addEventListener("click", () => goTo(STEPS.BASICS));
els.btnRunValidation.addEventListener("click", runValidation);
els.apiKey.addEventListener("input", () => {
  state.mistralApiKey = els.apiKey.value.trim();
});

bindBasicsInputs();
render();
