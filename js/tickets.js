// ================================================
// Applebee's Loyalty Control Center
// tickets.js
// ================================================

let ticketsGlobal = [];

document.addEventListener("DOMContentLoaded", async () => {
  await esperarLogin();
  pintarUsuario();

  cargarTickets();
});

function cargarTickets() {
  showLoader("Cargando tickets...");

  rtdb.ref("tickets")
    .on("value", snapshot => {
      const data = snapshot.val() || {};

      ticketsGlobal = Object.entries(data)
        .map(([key, value]) => ({
          ticketKey: value.ticketKey || key,
          ...value
        }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      pintarKPIsTickets();
      pintarTablaTickets(ticketsGlobal);

      hideLoader();
    }, error => {
      console.error(error);
      hideLoader();
      showToast("No se pudieron cargar los tickets.", "error");
    });
}

function pintarKPIsTickets() {
  const total = ticketsGlobal.length;

  const aprobados = ticketsGlobal.filter(t => t.status === "aprobado").length;

  const pendientes = ticketsGlobal.filter(t =>
    ["pendiente_validacion", "pendiente_revision_manual"].includes(t.status)
  ).length;

  const riesgos = ticketsGlobal.filter(t => calcularRiesgoTicket(t).nivel !== "bajo").length;

  document.getElementById("kpiTicketsTotal").textContent = total;
  document.getElementById("kpiTicketsAprobados").textContent = aprobados;
  document.getElementById("kpiTicketsPendientes").textContent = pendientes;
  document.getElementById("kpiTicketsRiesgo").textContent = riesgos;
}

function calcularRiesgoTicket(t) {
  let score = 0;
  const motivos = [];

  if (t.status === "rechazado_corregible") {
    score += 35;
    motivos.push("Requiere corrección");
  }

  if (t.status === "anulado") {
    score += 70;
    motivos.push("Anulado");
  }

  if (t.status === "error_validacion") {
    score += 40;
    motivos.push("Error de validación");
  }

  if (Number(t.intentosValidacion || 0) >= 1) {
    score += 20;
    motivos.push("Intentos fallidos");
  }

  if (t.ticketVision?.camposCorregidos?.length) {
    score += 25;
    motivos.push("Datos corregidos manualmente");
  }

  if (t.ticketVision?.modoManual) {
    score += 20;
    motivos.push("Registro manual");
  }

  if (t.motivoRechazo) {
    score += 25;
    motivos.push(t.motivoRechazo);
  }

  let nivel = "bajo";
  if (score >= 70) nivel = "alto";
  else if (score >= 35) nivel = "medio";

  return {
    score,
    nivel,
    motivos
  };
}

function pintarTablaTickets(tickets) {
  const tbody = document.getElementById("tablaTickets");
  if (!tbody) return;

  if (!tickets.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10">No hay tickets registrados.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tickets.map(t => {
    const riesgo = calcularRiesgoTicket(t);

    return `
      <tr>
        <td>${formatDateTime(t.createdAt)}</td>
        <td>${safeText(t.clienteEmail || t.userId || "---")}</td>
        <td>${safeText(t.folio || "---")}</td>
        <td>${safeText(t.sucursal || "---")}</td>
        <td>${safeText(t.fechaTicket || "---")}</td>
        <td>${money(t.total || 0)}</td>
        <td>
          <span class="status ${getStatusClass(t.status)}">
            ${getStatusLabel(t.status)}
          </span>
        </td>
        <td>${Number(t.intentosValidacion || 0)} / ${Number(t.maxIntentos || 2)}</td>
        <td>
          <span class="risk risk-${riesgo.nivel}" title="${safeText(riesgo.motivos.join(" · "))}">
            ${riesgo.nivel.toUpperCase()}
          </span>
        </td>
        <td>
          <button class="btn btn-secondary" onclick="abrirTicket('${safeText(t.ticketKey)}')">
            Ver
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function filtrarTickets() {
  const q = String(document.getElementById("buscarTicket")?.value || "")
    .toLowerCase()
    .trim();

  const estado = String(document.getElementById("filtroEstadoTicket")?.value || "")
    .toLowerCase()
    .trim();

  let filtrados = ticketsGlobal;

  if (estado) {
    filtrados = filtrados.filter(t => String(t.status || "").toLowerCase() === estado);
  }

  if (q) {
    filtrados = filtrados.filter(t => {
      const riesgo = calcularRiesgoTicket(t);

      return (
        String(t.clienteEmail || "").toLowerCase().includes(q) ||
        String(t.userId || "").toLowerCase().includes(q) ||
        String(t.folio || "").toLowerCase().includes(q) ||
        String(t.sucursal || "").toLowerCase().includes(q) ||
        String(t.status || "").toLowerCase().includes(q) ||
        String(t.fechaTicket || "").toLowerCase().includes(q) ||
        String(t.motivoRechazo || "").toLowerCase().includes(q) ||
        riesgo.motivos.join(" ").toLowerCase().includes(q)
      );
    });
  }

  pintarTablaTickets(filtrados);
}

function abrirTicket(ticketKey) {
  window.location.href = `ticket-detalle.html?ticketKey=${encodeURIComponent(ticketKey)}`;
}