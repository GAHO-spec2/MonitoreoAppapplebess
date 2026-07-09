// ================================================
// Applebee's Loyalty Control Center
// gerentes.js
// ================================================

let gerentesGlobal = [];
let canjesValidadosGlobal = [];

const ROLES_OPERATIVOS = [
  "admin",
  "director",
  "sistemas",
  "gerente",
  "manager"
];

document.addEventListener("DOMContentLoaded", async () => {
  await esperarLogin();
  pintarUsuario();

  cargarGerentes();
});

function cargarGerentes() {
  showLoader("Cargando usuarios operativos...");

  Promise.all([
    rtdb.ref("users").once("value"),
    rtdb.ref("redemptions").once("value")
  ])
    .then(([usersSnap, redemptionsSnap]) => {
      const usersObj = usersSnap.val() || {};
      const canjesObj = redemptionsSnap.val() || {};

      canjesValidadosGlobal = Object.values(canjesObj)
        .filter(c => String(c.status || "").toLowerCase() === "canjeado");

      gerentesGlobal = Object.entries(usersObj)
        .map(([uid, data]) => ({
          uid,
          ...data,
          role: String(data.role || "").toLowerCase().trim()
        }))
        .filter(u => ROLES_OPERATIVOS.includes(u.role))
        .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));

      pintarKPIsGerentes();
      pintarTablaGerentes(gerentesGlobal);

      hideLoader();
    })
    .catch(error => {
      console.error(error);
      hideLoader();
      showToast("No se pudieron cargar los gerentes.", "error");
    });
}

function pintarKPIsGerentes() {
  const gerentesActivos = gerentesGlobal.filter(g =>
    ["gerente", "manager"].includes(g.role) && g.activo !== false
  ).length;

  const admins = gerentesGlobal.filter(g =>
    ["admin", "sistemas", "director"].includes(g.role)
  ).length;

  const totalCanjes = canjesValidadosGlobal.length;

  const montoValidado = canjesValidadosGlobal.reduce((sum, c) => {
    return sum + Number(c.monto || 0);
  }, 0);

  document.getElementById("kpiGerentesActivos").textContent = gerentesActivos;
  document.getElementById("kpiAdmins").textContent = admins;
  document.getElementById("kpiCanjesValidados").textContent = totalCanjes;
  document.getElementById("kpiMontoValidado").textContent = money(montoValidado);
}

function pintarTablaGerentes(gerentes) {
  const tbody = document.getElementById("tablaGerentes");
  if (!tbody) return;

  if (!gerentes.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">No hay usuarios operativos registrados.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = gerentes.map(g => {
    const canjesGerente = canjesValidadosGlobal.filter(c =>
      c.gerenteUid === g.uid || String(c.gerenteEmail || "").toLowerCase() === String(g.email || "").toLowerCase()
    );

    const monto = canjesGerente.reduce((sum, c) => sum + Number(c.monto || 0), 0);

    const ultimaValidacion = canjesGerente
      .sort((a, b) => (b.redeemedAt || 0) - (a.redeemedAt || 0))[0];

    const estadoTexto = g.activo === false ? "Inactivo" : "Activo";
    const estadoClase = g.activo === false ? "status-danger" : "status-ok";

    return `
      <tr>
        <td>
          <strong>${safeText(g.nombre || "Usuario")}</strong><br>
          <small class="muted">${safeText(g.uid)}</small>
        </td>
        <td>${safeText(g.email || "---")}</td>
        <td>
          <span class="status status-warning">${safeText(String(g.role || "---").toUpperCase())}</span>
        </td>
        <td>
          <span class="status ${estadoClase}">${estadoTexto}</span>
        </td>
        <td>${canjesGerente.length}</td>
        <td>${money(monto)}</td>
        <td>${formatDateTime(ultimaValidacion?.redeemedAt)}</td>
      </tr>
    `;
  }).join("");
}

function filtrarGerentes() {
  const q = String(document.getElementById("buscarGerente")?.value || "")
    .toLowerCase()
    .trim();

  if (!q) {
    pintarTablaGerentes(gerentesGlobal);
    return;
  }

  const filtrados = gerentesGlobal.filter(g => {
    return (
      String(g.nombre || "").toLowerCase().includes(q) ||
      String(g.email || "").toLowerCase().includes(q) ||
      String(g.role || "").toLowerCase().includes(q) ||
      String(g.uid || "").toLowerCase().includes(q)
    );
  });

  pintarTablaGerentes(filtrados);
}