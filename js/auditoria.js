// ================================================
// Applebee's Loyalty Control Center
// auditoria.js
// ================================================

let auditoriaGlobal = [];

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await esperarLogin())) return;
  pintarUsuario();

  cargarAuditoria();
});

function cargarAuditoria() {
  showLoader("Cargando auditoría...");

  escucharDatos(rtdb.ref("auditLogs"), snapshot => {
      const data = snapshot.val() || {};

      auditoriaGlobal = registros(data, "logKey")
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      pintarKPIsAuditoria();
      filtrarAuditoria();

      hideLoader();
    }, "auditLogs:lista", error => {
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

  const hoy = fechaLocal(Date.now());

  const eventosHoy = auditoriaGlobal.filter(a => {
    if (!a.createdAt) return false;
    return fechaLocal(a.createdAt) === hoy;
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