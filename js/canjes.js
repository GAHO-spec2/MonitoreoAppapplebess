// ================================================
// Applebee's Loyalty Control Center
// canjes.js
// ================================================

let canjesGlobal = [];

document.addEventListener("DOMContentLoaded", async () => {
  await esperarLogin();
  pintarUsuario();

  cargarCanjes();
});

function cargarCanjes() {
  showLoader("Cargando canjes...");

  rtdb.ref("redemptions")
    .on("value", snapshot => {
      const data = snapshot.val() || {};

      canjesGlobal = Object.entries(data)
        .map(([key, value]) => ({
          redemptionKey: key,
          redemptionId: value.redemptionId || key,
          ...value
        }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      pintarKPIsCanjes();
      pintarTablaCanjes(canjesGlobal);

      hideLoader();
    }, error => {
      console.error(error);
      hideLoader();
      showToast("No se pudieron cargar los canjes.", "error");
    });
}

function pintarKPIsCanjes() {
  const total = canjesGlobal.length;
  const pendientes = canjesGlobal.filter(c => c.status === "pendiente").length;
  const canjeados = canjesGlobal.filter(c => c.status === "canjeado").length;

  const montoCanjeado = canjesGlobal
    .filter(c => c.status === "canjeado")
    .reduce((sum, c) => sum + Number(c.monto || 0), 0);

  document.getElementById("kpiCanjesTotal").textContent = total;
  document.getElementById("kpiCanjesPendientes").textContent = pendientes;
  document.getElementById("kpiCanjesCanjeados").textContent = canjeados;
  document.getElementById("kpiMontoCanjeado").textContent = money(montoCanjeado);
}

function pintarTablaCanjes(canjes) {
  const tbody = document.getElementById("tablaCanjesAdmin");
  if (!tbody) return;

  if (!canjes.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">No hay canjes registrados.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = canjes.map(c => `
    <tr>
      <td>${formatDateTime(c.createdAt)}</td>
      <td>
        <strong>${safeText(c.clienteNombre || "Cliente")}</strong><br>
        <small class="muted">${safeText(c.clienteEmail || c.userId || "---")}</small>
      </td>
      <td>${safeText(c.beneficio || "---")}</td>
      <td>${money(c.monto || 0)}</td>
      <td>
        <span class="status ${getStatusClass(c.status)}">
          ${getStatusLabel(c.status)}
        </span>
      </td>
      <td>${safeText(c.sucursalCanjeNombre || c.sucursalCanje || "---")}</td>
      <td>${safeText(c.gerenteEmail || "---")}</td>
      <td>${formatDateTime(c.redeemedAt)}</td>
    </tr>
  `).join("");
}

function filtrarCanjes() {
  const q = String(document.getElementById("buscarCanje")?.value || "")
    .toLowerCase()
    .trim();

  const estado = String(document.getElementById("filtroEstadoCanje")?.value || "")
    .toLowerCase()
    .trim();

  let filtrados = canjesGlobal;

  if (estado) {
    filtrados = filtrados.filter(c => String(c.status || "").toLowerCase() === estado);
  }

  if (q) {
    filtrados = filtrados.filter(c => {
      return (
        String(c.clienteNombre || "").toLowerCase().includes(q) ||
        String(c.clienteEmail || "").toLowerCase().includes(q) ||
        String(c.userId || "").toLowerCase().includes(q) ||
        String(c.beneficio || "").toLowerCase().includes(q) ||
        String(c.status || "").toLowerCase().includes(q) ||
        String(c.gerenteEmail || "").toLowerCase().includes(q) ||
        String(c.sucursalCanje || "").toLowerCase().includes(q) ||
        String(c.sucursalCanjeNombre || "").toLowerCase().includes(q) ||
        String(c.redemptionId || "").toLowerCase().includes(q)
      );
    });
  }

  pintarTablaCanjes(filtrados);
}