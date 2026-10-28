// ================================================
// Applebee's Loyalty Control Center
// configuracion.js
// ================================================

const SUCURSALES_BASE = {
  applebees_torres: {
    id: "applebees_torres",
    nombre: "Applebee’s Torres",
    marca: "Applebee’s",
    ciudad: "Ciudad Juárez",
    estado: "Chihuahua",
    activo: true
  },
  applebees_triunfo: {
    id: "applebees_triunfo",
    nombre: "Applebee’s Triunfo",
    marca: "Applebee’s",
    ciudad: "Ciudad Juárez",
    estado: "Chihuahua",
    activo: true
  },
  applebees_tecnologico: {
    id: "applebees_tecnologico",
    nombre: "Applebee’s Tecnológico",
    marca: "Applebee’s",
    ciudad: "Ciudad Juárez",
    estado: "Chihuahua",
    activo: true
  }
};

let configuracionLista = false;
let configuracionEditada = false;
let guardandoConfiguracion = false;

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await esperarLogin())) return;
  pintarUsuario();
  const editable = tieneRol("admin", "sistemas", "director");
  document.querySelectorAll(".config-grid input, .config-grid select, [data-config-write]")
    .forEach(node => { node.disabled = true; });
  document.querySelector(".config-grid").addEventListener("input", () => { configuracionEditada = true; });
  if (!editable) showToast("Modo solo lectura para este rol.", "info");
  cargarConfiguracion();
  cargarSucursales();
  const authStatus = document.getElementById("estadoAuth");
  authStatus.textContent = "Sesión autorizada";
  authStatus.className = "status status-ok";
});

function cargarConfiguracion() {
  escucharDatos(rtdb.ref("config/programa"), snap => {
    const config = snap.val() || {};
    if (typeof config !== "object" || Array.isArray(config)) throw new Error("Configuración inválida");
    const defaults = { porcentajeMonedero: 0.05, toleranciaTotal: 0.50, maxTicketsDia: 2,
      diasRegistro: 3, vigenciaMonedero: 180, ambienteSistema: "pruebas" };
    if (!configuracionEditada) {
      for (const [key, value] of Object.entries(defaults)) {
        document.getElementById(key).value = config[key] ?? value;
      }
    }
    configuracionLista = true;
    const editable = tieneRol("admin", "sistemas", "director");
    document.querySelectorAll(".config-grid input, .config-grid select, [data-config-write]")
      .forEach(node => { node.disabled = !editable; });
    document.getElementById("ambienteActual").textContent = config.ambienteSistema || "Sin definir (valores propuestos para pruebas)";
  }, "config/programa");
}

function leerConfiguracionFormulario() {
  const ranges = { porcentajeMonedero: [0, 1, false], toleranciaTotal: [0, Infinity, false],
    maxTicketsDia: [1, Infinity, true], diasRegistro: [1, Infinity, true], vigenciaMonedero: [1, Infinity, true] };
  const config = {};
  for (const [key, [min, max, entero]] of Object.entries(ranges)) {
    const raw = document.getElementById(key).value.trim();
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value < min || value > max || (entero && !Number.isSafeInteger(value))) {
      throw new Error(`Revisa el valor de ${key}.`);
    }
    config[key] = value;
  }
  config.ambienteSistema = document.getElementById("ambienteSistema").value;
  if (!["pruebas", "produccion"].includes(config.ambienteSistema)) throw new Error("Elige un ambiente válido.");
  return config;
}

async function guardarConAuditoria(path, value, type, merge = false) {
  const usuario = getUsuarioActual();
  const now = firebase.database.ServerValue.TIMESTAMP;
  const logKey = rtdb.ref("auditLogs").push().key;
  const updates = {};
  if (merge) {
    for (const [key, item] of Object.entries(value)) updates[`${path}/${key}`] = item;
  } else updates[path] = value;
  updates[`auditLogs/${logKey}`] = { type, userEmail: usuario.email, userId: usuario.uid, createdAt: now };
  // Una sola operación: si las reglas rechazan la auditoría, tampoco cambia la configuración.
  await conTiempoLimite(rtdb.ref().update(updates));
}

async function guardarConfiguracion() {
  if (!configuracionLista || guardandoConfiguracion || !tieneRol("admin", "sistemas", "director")) return;
  try {
    const config = leerConfiguracionFormulario();
    guardandoConfiguracion = true;
    await guardarConAuditoria("config/programa", {
      ...config, updatedAt: firebase.database.ServerValue.TIMESTAMP, updatedBy: getUsuarioActual().email
    }, "CONFIG_ACTUALIZADA", true);
    configuracionEditada = false;
    showToast("Configuración y auditoría guardadas.", "success");
  } catch (error) {
    showToast(`No se confirmó el guardado. ${error.message}`, "error");
  } finally { guardandoConfiguracion = false; }
}

function cargarSucursales() {
  const tbody = document.getElementById("tablaSucursales");
  escucharDatos(rtdb.ref("config/sucursales"), snap => {
    const sucursales = snap.val();
    const lista = registros(sucursales);
    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="5">No hay sucursales configuradas. El catálogo base solo se guarda con el botón Restaurar.</td></tr>';
      return;
    }
    tbody.innerHTML = lista.map(s => `<tr><td>${safeText(s.id || "---")}</td><td>${safeText(s.nombre || "---")}</td>
      <td>${safeText(s.marca || "---")}</td><td>${safeText(s.ciudad || "---")}</td><td>${safeText(s.estado || "---")}</td></tr>`).join("");
  }, "config/sucursales");
}

async function restaurarSucursalesBase() {
  if (!configuracionLista || guardandoConfiguracion || !tieneRol("admin", "sistemas", "director")) return;
  if (!confirm("¿Reemplazar todas las sucursales configuradas por las tres sucursales base?")) return;
  try {
    guardandoConfiguracion = true;
    await guardarConAuditoria("config/sucursales", SUCURSALES_BASE, "SUCURSALES_RESTAURADAS");
    showToast("Sucursales y auditoría guardadas.", "success");
  } catch (error) {
    showToast("No se confirmó el guardado de sucursales. Revisa conexión y permisos.", "error");
  } finally { guardandoConfiguracion = false; }
}
