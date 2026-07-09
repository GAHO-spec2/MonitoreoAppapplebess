// ================================================
// Applebee's Loyalty Control Center
// cliente-detalle.js
// ================================================

let clienteUid = null;

document.addEventListener("DOMContentLoaded", async () => {
  await esperarLogin();
  pintarUsuario();

  const params = new URLSearchParams(window.location.search);
  clienteUid = params.get("uid");

  if (!clienteUid) {
    showToast("No se recibió UID del cliente.", "error");
    setTimeout(() => {
      window.location.href = "clientes.html";
    }, 1200);
    return;
  }

  cargarDetalleCliente(clienteUid);
});

async function cargarDetalleCliente(uid) {
  showLoader("Cargando expediente del cliente...");

  try {
    const [userSnap, ticketsSnap, canjesSnap, movimientosSnap] = await Promise.all([
      rtdb.ref(`users/${uid}`).once("value"),
      rtdb.ref("tickets").orderByChild("userId").equalTo(uid).once("value"),
      rtdb.ref("redemptions").orderByChild("userId").equalTo(uid).once("value"),
      rtdb.ref(`walletMovements/${uid}`).once("value")
    ]);

    const cliente = userSnap.val();

    if (!cliente) {
      hideLoader();
      showToast("Cliente no encontrado.", "error");
      return;
    }

    const tickets = Object.values(ticketsSnap.val() || {})
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const canjes = Object.values(canjesSnap.val() || {})
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const movimientos = Object.values(movimientosSnap.val() || {})
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    pintarPerfilCliente(cliente, uid);
    pintarKPIsDetalle(cliente, tickets, canjes);
    pintarTicketsCliente(tickets);
    pintarCanjesCliente(canjes);
    pintarMovimientosCliente(movimientos);

    hideLoader();

  } catch (error) {
    console.error(error);
    hideLoader();
    showToast("No se pudo cargar el expediente.", "error");
  }
}

function pintarPerfilCliente(cliente, uid) {
  const nombre = cliente.nombre || "Cliente";

  document.getElementById("clienteNombreTitulo").textContent = nombre;
  document.getElementById("clienteNombre").textContent = nombre;
  document.getElementById("clienteEmail").textContent = cliente.email || "---";
  document.getElementById("clienteTelefono").textContent = cliente.telefono || "---";

  const avatar = document.getElementById("clienteAvatar");
  if (avatar) {
    avatar.textContent = nombre.charAt(0).toUpperCase();
  }

  document.getElementById("clienteSubtitulo").textContent =
    `UID: ${uid} · Registro: ${formatDateTime(cliente.createdAt)}`;
}

function pintarKPIsDetalle(cliente, tickets, canjes) {
  const aprobados = tickets.filter(t => t.status === "aprobado");

  const totalGastado = aprobados.reduce((sum, t) => {
    return sum + Number(t.totalValidado || t.total || 0);
  }, 0);

  document.getElementById("detalleSaldo").textContent = money(cliente.saldoDisponible || 0);
  document.getElementById("detalleTotalGastado").textContent = money(totalGastado);
  document.getElementById("detalleTickets").textContent = tickets.length;
  document.getElementById("detalleCanjes").textContent = canjes.length;
}

function pintarTicketsCliente(tickets) {
  const tbody = document.getElementById("tablaTicketsCliente");

  if (!tickets.length) {
    tbody.innerHTML = `<tr><td colspan="6">Este cliente no tiene tickets.</td></tr>`;
    return;
  }

  tbody.innerHTML = tickets.map(t => `
    <tr>
      <td>${formatDateTime(t.createdAt)}</td>
      <td>${safeText(t.folio || "---")}</td>
      <td>${safeText(t.sucursal || "---")}</td>
      <td>${money(t.total || 0)}</td>
      <td>
        <span class="status ${getStatusClass(t.status)}">
          ${getStatusLabel(t.status)}
        </span>
      </td>
      <td>${safeText(t.motivoRechazo || t.mensajeCliente || "---")}</td>
    </tr>
  `).join("");
}

function pintarCanjesCliente(canjes) {
  const tbody = document.getElementById("tablaCanjesCliente");

  if (!canjes.length) {
    tbody.innerHTML = `<tr><td colspan="4">Este cliente no tiene canjes.</td></tr>`;
    return;
  }

  tbody.innerHTML = canjes.map(c => `
    <tr>
      <td>${formatDateTime(c.createdAt)}</td>
      <td>${safeText(c.beneficio || "---")}</td>
      <td>${money(c.monto || 0)}</td>
      <td>
        <span class="status ${getStatusClass(c.status)}">
          ${getStatusLabel(c.status)}
        </span>
      </td>
    </tr>
  `).join("");
}

function pintarMovimientosCliente(movimientos) {
  const tbody = document.getElementById("tablaMovimientosCliente");

  if (!movimientos.length) {
    tbody.innerHTML = `<tr><td colspan="6">Este cliente no tiene movimientos.</td></tr>`;
    return;
  }

  tbody.innerHTML = movimientos.map(m => `
    <tr>
      <td>${formatDateTime(m.createdAt)}</td>
      <td>${safeText(m.concepto || "---")}</td>
      <td>${safeText(m.tipo || "---")}</td>
      <td>${money(m.monto || 0)}</td>
      <td>${money(m.saldoAnterior || 0)}</td>
      <td>${money(m.saldoNuevo || 0)}</td>
    </tr>
  `).join("");
}