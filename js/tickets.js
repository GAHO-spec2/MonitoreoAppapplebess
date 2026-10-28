// ================================================
// Applebee's Loyalty Control Center
// tickets.js
// ================================================

let ticketsGlobal = [];

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await esperarLogin())) return;
  pintarUsuario();

  cargarTickets();
});

function cargarTickets() {
  showLoader("Cargando tickets...");

  escucharDatos(rtdb.ref("tickets"), snapshot => {
      const data = snapshot.val() || {};

      ticketsGlobal = registros(data, "ticketKey")
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      pintarKPIsTickets();
      filtrarTickets();

      hideLoader();
    }, "tickets:lista", error => {
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

  const riesgos = ticketsGlobal.filter(t => calcularRiesgo(t).score > 0).length;

  document.getElementById("kpiTicketsTotal").textContent = total;
  document.getElementById("kpiTicketsAprobados").textContent = aprobados;
  document.getElementById("kpiTicketsPendientes").textContent = pendientes;
  document.getElementById("kpiTicketsRiesgo").textContent = riesgos;
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
    const riesgo = calcularRiesgo(t);

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
            ${safeText(getStatusLabel(t.status))}
          </span>
        </td>
        <td>${numeroSeguro(t.intentosValidacion)} / ${numeroSeguro(t.maxIntentos, 2)}</td>
        <td>
          <span class="risk risk-${riesgo.nivel}" title="${safeText(riesgo.motivos.join(" · "))}">
            ${riesgo.nivel.toUpperCase()}
          </span>
        </td>
        <td>
          <button class="btn btn-secondary" data-ticket-key="${safeText(t.ticketKey)}">
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
      const riesgo = calcularRiesgo(t);

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