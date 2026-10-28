// ================================================
// Applebee's Loyalty Control Center
// clientes.js
// ================================================

let clientesGlobal = [];
let ticketsGlobal = [];
let canjesGlobal = [];

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await esperarLogin())) return;
  pintarUsuario();

  cargarClientes();
});

async function cargarClientes() {
  showLoader("Cargando clientes...");

  escucharGrupo(['users', 'tickets', 'redemptions'], ([usersSnap, ticketsSnap, redemptionsSnap]) => {
    const usersObj = usersSnap.val() || {};
    ticketsGlobal = registros(ticketsSnap.val());
    canjesGlobal = registros(redemptionsSnap.val());

    clientesGlobal = registros(usersObj, "uid")
      .filter(u => normalizarEstado(u.role || "cliente") === "cliente")
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    pintarKPIsClientes();
    filtrarClientes();

    hideLoader();


  });
}

function pintarKPIsClientes() {
  const saldoTotal = clientesGlobal.reduce((sum, c) => {
    return sum + numeroSeguro(c.saldoDisponible);
  }, 0);

  const ticketsAprobados = ticketsGlobal.filter(t => t.status === "aprobado").length;
  const canjesActivos = canjesGlobal.filter(c => c.status === "pendiente").length;

  document.getElementById("kpiTotalClientes").textContent = clientesGlobal.length;
  document.getElementById("kpiSaldoClientes").textContent = money(saldoTotal);
  document.getElementById("kpiTicketsClientes").textContent = ticketsAprobados;
  document.getElementById("kpiCanjesClientes").textContent = canjesActivos;
}

function pintarTablaClientes(clientes) {
  const tbody = document.getElementById("tablaClientes");
  if (!tbody) return;

  if (!clientes.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">No hay clientes registrados.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = clientes.map(cliente => {
    const ticketsCliente = ticketsGlobal.filter(t => t.userId === cliente.uid);
    const canjesCliente = canjesGlobal.filter(c => c.userId === cliente.uid);

    return `
      <tr>
        <td>
          <strong>${safeText(cliente.nombre || "Cliente")}</strong><br>
          <small class="muted">${safeText(cliente.uid)}</small>
        </td>
        <td>${safeText(cliente.email || "---")}</td>
        <td>${safeText(cliente.telefono || "---")}</td>
        <td>${money(cliente.saldoDisponible || 0)}</td>
        <td>${ticketsCliente.length}</td>
        <td>${canjesCliente.length}</td>
        <td>${formatDateTime(cliente.createdAt)}</td>
        <td>
          <button class="btn btn-secondary" data-cliente-uid="${safeText(cliente.uid)}">
            Ver
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function filtrarClientes() {
  const q = String(document.getElementById("buscarCliente")?.value || "")
    .toLowerCase()
    .trim();

  if (!q) {
    pintarTablaClientes(clientesGlobal);
    return;
  }

  const filtrados = clientesGlobal.filter(c => {
    return (
      String(c.nombre || "").toLowerCase().includes(q) ||
      String(c.email || "").toLowerCase().includes(q) ||
      String(c.telefono || "").toLowerCase().includes(q) ||
      String(c.uid || "").toLowerCase().includes(q)
    );
  });

  pintarTablaClientes(filtrados);
}

function abrirCliente(uid) {
  window.location.href = `cliente-detalle.html?uid=${encodeURIComponent(uid)}`;
}