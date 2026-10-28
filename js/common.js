// ================================================
// Applebee's Loyalty Control Center
// common.js
// ================================================

function money(n) {
  return "$" + numeroSeguro(n).toFixed(2);
}

const ZONA_HORARIA = "America/Ciudad_Juarez";

function numeroSeguro(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function totalTicket(t) {
  return numeroSeguro(t.totalValidado ?? t.total);
}

function normalizarEstado(value) {
  return String(value ?? "").trim().toLowerCase();
}

function fechaValida(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function fechaLocal(value) {
  const date = fechaValida(value);
  if (!date) return "Sin fecha";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_HORARIA, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const part = type => parts.find(p => p.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatDateTime(value) {
  const date = fechaValida(value);
  return date ? date.toLocaleString("es-MX", {
    timeZone: ZONA_HORARIA, dateStyle: "short", timeStyle: "short"
  }) : "---";
}

function formatDateOnly(value) {
  // Las fechas de ticket sin hora representan un día local, no medianoche UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  const date = fechaValida(value);
  return date ? date.toLocaleDateString("es-MX", { timeZone: ZONA_HORARIA }) : "---";
}

function showToast(message, type = "info") {
  let toast = document.getElementById("globalToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "globalToast";
    toast.className = "global-toast";
    document.body.appendChild(toast);
  }

  toast.className = `global-toast ${type}`;
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

function showLoader(message = "Cargando información...") {
  let loader = document.getElementById("globalLoader");

  if (!loader) {
    loader = document.createElement("div");
    loader.id = "globalLoader";
    loader.className = "global-loader";
    loader.innerHTML = `
      <div class="loader-card">
        <div class="loader-spinner"></div>
        <p id="globalLoaderText"></p>
      </div>
    `;
    document.body.appendChild(loader);
  }

  document.getElementById("globalLoaderText").textContent = message;
  loader.classList.add("active");
}

function hideLoader() {
  const loader = document.getElementById("globalLoader");
  if (loader) loader.classList.remove("active");
}

function getStatusLabel(status) {
  const map = {
    pendiente_validacion: "Pendiente de validación",
    pendiente_revision_manual: "Revisión manual",
    rechazado_corregible: "Requiere corrección",
    aprobado: "Aprobado",
    anulado: "Anulado",
    error_validacion: "Error validación",
    pendiente: "Pendiente",
    canjeado: "Canjeado",
    cancelado: "Cancelado"
  };

  return map[normalizarEstado(status)] || status || "---";
}

function getStatusClass(status) {
  const s = normalizarEstado(status);

  if (["aprobado", "canjeado"].includes(s)) return "status-ok";
  if (["pendiente", "pendiente_validacion", "pendiente_revision_manual"].includes(s)) return "status-warning";
  if (["rechazado_corregible", "error_validacion"].includes(s)) return "status-danger";
  if (["anulado", "cancelado"].includes(s)) return "status-muted";

  return "status-muted";
}

function irA(url) {
  window.location.href = url;
}

function safeText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
// Una sola política de riesgo para Dashboard, Alertas, Tickets y detalle.
function calcularRiesgo(t) {
  let score = 0;
  const motivos = [];
  const status = normalizarEstado(t.status);
  const reglas = {
    anulado: [80, "Ticket anulado"],
    rechazado_corregible: [45, "Datos por corregir"],
    error_validacion: [45, "Error de validación"],
    pendiente_revision_manual: [40, "Requiere revisión manual"]
  };
  if (reglas[status]) {
    score += reglas[status][0]; motivos.push(reglas[status][1]);
  }
  const intentos = Math.max(0, Math.floor(numeroSeguro(t.intentosValidacion)));
  if (intentos) { score += intentos * 20; motivos.push(`Intentos de validación: ${intentos}`); }
  const campos = Array.isArray(t.ticketVision?.camposCorregidos) ? t.ticketVision.camposCorregidos : [];
  if (campos.length) { score += campos.length * 18; motivos.push(`Campos corregidos: ${campos.join(", ")}`); }
  if (t.ticketVision?.modoManual === true) { score += 25; motivos.push("Registro manual"); }
  if (t.motivoRechazo) { score += 30; motivos.push(String(t.motivoRechazo)); }
  if (String(t.mensajeCliente || "").toLowerCase().includes("agotaron")) {
    score += 35; motivos.push("Intentos agotados");
  }
  return { score, nivel: score >= 80 ? "alto" : score >= 40 ? "medio" : "bajo", motivos };
}

function registros(data, keyName) {
  if (!data || typeof data !== "object") return [];
  return Object.entries(data).filter(([, value]) => value && typeof value === "object")
    .map(([key, value]) => ({ ...value, ...(keyName ? { [keyName]: key } : {}),
      ...(value.status !== undefined ? { status: normalizarEstado(value.status) } : {}) }));
}

function conTiempoLimite(promise, ms = 20000) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Tiempo de espera agotado")), ms);
  })]).finally(() => clearTimeout(timer));
}

// Las claves se insertan como datos, nunca dentro de código JavaScript.
document.addEventListener("click", event => {
  const button = event.target.closest?.("[data-ticket-key], [data-cliente-uid]");
  if (!button) return;
  const ticket = button.dataset.ticketKey;
  const uid = button.dataset.clienteUid;
  if (ticket) irA(`ticket-detalle.html?ticketKey=${encodeURIComponent(ticket)}`);
  else if (uid) irA(`cliente-detalle.html?uid=${encodeURIComponent(uid)}`);
});

function claveFirebaseValida(value) {
  return typeof value === "string" && value.length > 0 && !/[.#$\[\]\/\u0000-\u001F\u007F]/.test(value);
}
