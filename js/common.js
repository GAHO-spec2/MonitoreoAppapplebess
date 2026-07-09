// ================================================
// Applebee's Loyalty Control Center
// common.js
// ================================================

function money(n) {
  return "$" + Number(n || 0).toFixed(2);
}

function formatDateTime(timestamp) {
  if (!timestamp) return "---";

  return new Date(timestamp).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function formatDateOnly(value) {
  if (!value) return "---";

  const date = new Date(value);

  if (isNaN(date.getTime())) return value;

  return date.toLocaleDateString("es-MX");
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

  return map[status] || status || "---";
}

function getStatusClass(status) {
  const s = String(status || "").toLowerCase();

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