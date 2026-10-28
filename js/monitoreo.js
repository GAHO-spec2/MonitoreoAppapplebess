// Estado del panel en esta sesión. No publica datos de clientes ni requiere escrituras.
const fuentesMonitoreo = new Map();
const cancelacionesMonitoreo = new Set();
let conexionMonitoreo = false;
let iniciadoMonitoreo = false;

function pintarMonitoreo() {
  let box = document.getElementById("estadoMonitoreo");
  if (!box) {
    box = document.createElement("section");
    box.id = "estadoMonitoreo";
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");
    (document.querySelector("main") || document.body).prepend(box);
  }
  const fuentes = [...fuentesMonitoreo.entries()];
  const fallas = fuentes.filter(([, f]) => f.error);
  const pendientes = fuentes.filter(([, f]) => !f.ready && !f.error);
  const ultima = Math.max(0, ...fuentes.map(([, f]) => f.at || 0));
  const estado = !conexionMonitoreo ? "Sin conexión a Realtime Database" : fallas.length
    ? "Lecturas con errores" : pendientes.length || !fuentes.length ? "Esperando datos" : "Lecturas recibidas";
  box.className = `monitor-status ${!conexionMonitoreo || fallas.length ? "monitor-error" : pendientes.length || !fuentes.length ? "monitor-pending" : "monitor-ok"}`;
  box.innerHTML = `<strong>${safeText(estado)}</strong><span>${ultima ? `Última lectura: ${formatDateTime(ultima)} (Ciudad Juárez).` : "Todavía no se han confirmado lecturas."}</span>` +
    (fallas.length ? `<span>${safeText(fallas.map(([name, f]) => `${name}: ${f.error}`).join(" · "))}</span>` : "") +
    (!conexionMonitoreo || fallas.length ? "<span>La información mostrada puede estar incompleta o desactualizada.</span>" : "");
  const dbStatus = document.getElementById("estadoRTDB");
  if (dbStatus) { dbStatus.textContent = estado; dbStatus.className = `status ${conexionMonitoreo && !fallas.length && !pendientes.length ? "status-ok" : "status-warning"}`; }
}

function iniciarMonitoreo() {
  if (iniciadoMonitoreo) return;
  iniciadoMonitoreo = true;
  const ref = rtdb.ref(".info/connected");
  const listener = snap => { conexionMonitoreo = snap.val() === true; pintarMonitoreo(); };
  ref.on("value", listener, () => { conexionMonitoreo = false; pintarMonitoreo(); });
  cancelacionesMonitoreo.add(() => ref.off("value", listener));
  pintarMonitoreo();
}

function escucharDatos(query, callback, name, onError) {
  const state = { ready: false, at: 0, error: "" };
  fuentesMonitoreo.set(name, state);
  pintarMonitoreo();
  const fail = error => {
    state.error = error?.code === "PERMISSION_DENIED" ? "Permiso denegado" : "No se pudo confirmar la lectura";
    console.error(`Error en ${name}`, error);
    hideLoader();
    pintarMonitoreo();
    if (onError) onError(error);
  };
  const timer = setTimeout(() => {
    if (!state.ready) fail(new Error("Tiempo de espera agotado"));
  }, 20000);
  const listener = snap => {
    clearTimeout(timer);
    try {
      callback(snap);
      state.ready = true; state.error = ""; state.at = Date.now();
      pintarMonitoreo();
    } catch (error) { fail(error); }
  };
  query.on("value", listener, fail);
  const stop = () => { clearTimeout(timer); query.off("value", listener); };
  cancelacionesMonitoreo.add(stop);
  return stop;
}

function escucharConsultas(queries, callback) {
  const snapshots = new Map();
  return queries.map(([query, name], index) => escucharDatos(query, snap => {
    snapshots.set(index, snap);
    if (snapshots.size === queries.length) callback(queries.map((_, i) => snapshots.get(i)));
  }, name));
}

function escucharGrupo(paths, callback) {
  return escucharConsultas(paths.map(path => [rtdb.ref(path), path]), callback);
}

function limpiarMonitoreo() {
  for (const stop of cancelacionesMonitoreo) stop();
  cancelacionesMonitoreo.clear(); fuentesMonitoreo.clear();
  iniciadoMonitoreo = false; conexionMonitoreo = false;
}
window.addEventListener("pagehide", limpiarMonitoreo);
window.addEventListener("pageshow", event => { if (event.persisted) window.location.reload(); });
