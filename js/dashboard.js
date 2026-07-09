// ================================================
// Applebee's Loyalty Control Center
// dashboard.js
// ================================================

document.addEventListener("DOMContentLoaded", async () => {
  const user = await esperarLogin();

  pintarUsuario();

  cargarKPIs();
  cargarTicketsRecientes();
  cargarActividadReciente();

  showToast("Dashboard conectado en tiempo real.", "success");
});

function cargarKPIs() {
  const clientesRef = rtdb.ref("users");
  const ticketsRef = rtdb.ref("tickets");
  const redemptionsRef = rtdb.ref("redemptions");

  clientesRef.on("value", snapshot => {
    const users = Object.values(snapshot.val() || {});
    const clientes = users.filter(u => String(u.role || "cliente").toLowerCase() === "cliente");

    const saldoTotal = clientes.reduce((sum, u) => {
      return sum + Number(u.saldoDisponible || 0);
    }, 0);

    document.getElementById("kpiClientes").textContent = clientes.length;
    document.getElementById("kpiSaldo").textContent = money(saldoTotal);
  });

  ticketsRef.on("value", snapshot => {
    const tickets = Object.values(snapshot.val() || {});

    const aprobados = tickets.filter(t => t.status === "aprobado");
    const alertas = tickets.filter(t =>
      ["rechazado_corregible", "anulado", "error_validacion"].includes(t.status)
    );

    const ventaAprobada = aprobados.reduce((sum, t) => {
      return sum + Number(t.totalValidado || t.total || 0);
    }, 0);

    document.getElementById("kpiTickets").textContent = tickets.length;
    document.getElementById("kpiAprobados").textContent = aprobados.length;
    document.getElementById("kpiAlertas").textContent = alertas.length;
    document.getElementById("kpiVenta").textContent = money(ventaAprobada);
  });

  redemptionsRef.on("value", snapshot => {
    const canjes = Object.values(snapshot.val() || {});

    const pendientes = canjes.filter(c => c.status === "pendiente");
    const realizados = canjes.filter(c => c.status === "canjeado");

    document.getElementById("kpiCanjesPendientes").textContent = pendientes.length;
    document.getElementById("kpiCanjesRealizados").textContent = realizados.length;
  });
}

function cargarTicketsRecientes() {
  const tbody = document.getElementById("tablaTicketsRecientes");
  if (!tbody) return;

  rtdb.ref("tickets")
    .orderByChild("createdAt")
    .limitToLast(12)
    .on("value", snapshot => {
      const data = snapshot.val();

      if (!data) {
        tbody.innerHTML = `<tr><td colspan="6">No hay tickets registrados.</td></tr>`;
        return;
      }

      const tickets = Object.values(data)
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
              ${getStatusLabel(t.status)}
            </span>
          </td>
        </tr>
      `).join("");
    });
}

function cargarActividadReciente() {
  const box = document.getElementById("actividadReciente");
  if (!box) return;

  rtdb.ref("auditLogs")
    .limitToLast(15)
    .on("value", snapshot => {
      const data = snapshot.val();

      if (!data) {
        box.innerHTML = `<p class="muted">Todavía no hay actividad de auditoría.</p>`;
        return;
      }

      const logs = Object.values(data)
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
    }, error => {
      console.error(error);
      box.innerHTML = `<p class="muted">No se pudo cargar la auditoría.</p>`;
    });
}