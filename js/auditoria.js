// ================================================
// Applebee's Loyalty Control Center
// auditoria.js
// ================================================

let auditoriaGlobal = [];

document.addEventListener("DOMContentLoaded", async () => {
  await esperarLogin();
  pintarUsuario();

  cargarAuditoria();
});

function cargarAuditoria() {
  showLoader("Cargando auditoría...");

  rtdb.ref("auditLogs")
    .on("value", snapshot => {
      const data = snapshot.val() || {};

      auditoriaGlobal = Object.entries(data)
        .map(([key, value]) => ({
          logKey: key,
          ...value
        }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      pintarKPIsAuditoria();
      pintarTablaAuditoria(auditoriaGlobal);

      hideLoader();
    }, error => {
      console.error(error);
      hideLoader();
      showToast("No se pudo cargar la auditoría.", "error");
    });
}

function pintarKPIsAuditoria() {
  const total = auditoriaGlobal.length;

  const canjes = auditoriaGlobal.filter(a =>
    String(a.type || "").toUpperCase().includes("CANJE")
  ).length;

  const hoy = new Date().toISOString().slice(0, 10);

  const eventosHoy = auditoriaGlobal.filter(a => {
    if (!a.createdAt) return false;
    return new Date(a.createdAt).toISOString().slice(0, 10) === hoy;
  }).length;

  const usuarios = new Set(
    auditoriaGlobal
      .map(a => a.gerenteEmail || a.userEmail || a.clienteEmail || a.userId || "")
      .filter(Boolean)
  );

  document.getElementById("kpiEventosTotal").textContent = total;
  document.getElementById("kpiAuditCanjes").textContent = canjes;
  document.getElementById("kpiEventosHoy").textContent = eventosHoy;
  document.getElementById("kpiUsuariosAudit").textContent = usuarios.size;
}

function pintarTablaAuditoria(logs) {
  const tbody = document.getElementById("tablaAuditoria");
  if (!tbody) return;

  if (!logs.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">No hay registros de auditoría todavía.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = logs.map(log => `
    <tr>
      <td>${formatDateTime(log.createdAt)}</td>
      <td>
        <span class="status status-warning">${safeText(log.type || "EVENTO")}</span>
      </td>
      <td>${safeText(log.gerenteEmail || log.userEmail || log.gerenteUid || "---")}</td>
      <td>${safeText(log.clienteNombre || log.clienteEmail || log.userId || "---")}</td>
      <td>${safeText(log.sucursalCanjeNombre || log.sucursalCanje || log.sucursal || "---")}</td>
      <td>${safeText(log.redemptionId || log.ticketKey || log.folio || log.logKey || "---")}</td>
      <td>${log.monto !== undefined ? money(log.monto) : "---"}</td>
    </tr>
  `).join("");
}

function filtrarAuditoria() {
  const q = String(document.getElementById("buscarAuditoria")?.value || "")
    .toLowerCase()
    .trim();

  if (!q) {
    pintarTablaAuditoria(auditoriaGlobal);
    return;
  }

  const filtrados = auditoriaGlobal.filter(log => {
    return (
      String(log.type || "").toLowerCase().includes(q) ||
      String(log.gerenteEmail || "").toLowerCase().includes(q) ||
      String(log.userEmail || "").toLowerCase().includes(q) ||
      String(log.clienteNombre || "").toLowerCase().includes(q) ||
      String(log.clienteEmail || "").toLowerCase().includes(q) ||
      String(log.userId || "").toLowerCase().includes(q) ||
      String(log.redemptionId || "").toLowerCase().includes(q) ||
      String(log.ticketKey || "").toLowerCase().includes(q) ||
      String(log.sucursalCanje || "").toLowerCase().includes(q) ||
      String(log.sucursalCanjeNombre || "").toLowerCase().includes(q)
    );
  });

  pintarTablaAuditoria(filtrados);
}