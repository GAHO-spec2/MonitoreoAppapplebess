// ================================================
// Applebee's Loyalty Control Center
// dashboard.js
// ================================================

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await esperarLogin())) return;

  pintarUsuario();

  cargarKPIs();
  cargarTicketsRecientes();
  cargarActividadReciente();


});

function cargarKPIs() {
  const clientesRef = rtdb.ref("users");
  const ticketsRef = rtdb.ref("tickets");
  const redemptionsRef = rtdb.ref("redemptions");

  escucharDatos(clientesRef, snapshot => {
    const users = registros(snapshot.val());
    const clientes = users.filter(u => normalizarEstado(u.role || "cliente") === "cliente");

    const saldoTotal = clientes.reduce((sum, u) => {
      return sum + numeroSeguro(u.saldoDisponible);
    }, 0);

    document.getElementById("kpiClientes").textContent = clientes.length;
    document.getElementById("kpiSaldo").textContent = money(saldoTotal);
  }, "users:resumen");

  escucharDatos(ticketsRef, snapshot => {
    const tickets = registros(snapshot.val());

    const aprobados = tickets.filter(t => t.status === "aprobado");
    const alertas = tickets.filter(t => calcularRiesgo(t).score > 0);

    const ventaAprobada = aprobados.reduce((sum, t) => {
      return sum + totalTicket(t);
    }, 0);

    document.getElementById("kpiTickets").textContent = tickets.length;
    document.getElementById("kpiAprobados").textContent = aprobados.length;
    document.getElementById("kpiAlertas").textContent = alertas.length;
    document.getElementById("kpiVenta").textContent = money(ventaAprobada);
  }, "tickets:resumen");

  escucharDatos(redemptionsRef, snapshot => {
    const canjes = registros(snapshot.val());

    const pendientes = canjes.filter(c => c.status === "pendiente");
    const realizados = canjes.filter(c => c.status === "canjeado");

    document.getElementById("kpiCanjesPendientes").textContent = pendientes.length;
    document.getElementById("kpiCanjesRealizados").textContent = realizados.length;
  }, "redemptions:resumen");
}

function cargarTicketsRecientes() {
  const tbody = document.getElementById("tablaTicketsRecientes");
  if (!tbody) return;

  escucharDatos(rtdb.ref("tickets")
    .orderByChild("createdAt")
    .limitToLast(12), snapshot => {
      const data = snapshot.val();

      if (!data) {
        tbody.innerHTML = `<tr><td colspan="6">No hay tickets registrados.</td></tr>`;
        return;
      }

      const tickets = registros(data)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      tbody.innerHTML = tickets.map(t => `
        <tr>
          <td>${formatDateTime(t.createdAt)}</td>
          <td>${safeText(t.clienteEmail || "---")}</td>
          <td>${safeText(t.folio || "---")}</td>
          <td>${safeText(t.sucursal || "---")}</td>
          <td>${money(t.total || 0)}</td>
          <td>
            <span class="status ${getStatusClass(t.status)}">
              ${safeText(getStatusLabel(t.status))}
            </span>
          </td>
        </tr>
      `).join("");
    }, "tickets:recientes");
}

function cargarActividadReciente() {
  const box = document.getElementById("actividadReciente");
  if (!box) return;

  escucharDatos(rtdb.ref("auditLogs")
    .orderByChild("createdAt")
    .limitToLast(15), snapshot => {
      const data = snapshot.val();

      if (!data) {
        box.innerHTML = `<p class="muted">Todavía no hay actividad de auditoría.</p>`;
        return;
      }

      const logs = registros(data)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      box.innerHTML = logs.map(log => `
        <div class="activity-item">
          <strong>${safeText(log.type || "Actividad")}</strong>
          <p>${formatDateTime(log.createdAt)}</p>
          <small>
            ${safeText(log.gerenteEmail || log.userEmail || log.clienteEmail || "")}
          </small>
        </div>
      `).join("");
    }, "auditLogs:recientes", error => {
      console.error(error);
      box.innerHTML = `<p class="muted">No se pudo cargar la auditoría.</p>`;
    });
}