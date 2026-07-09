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

document.addEventListener("DOMContentLoaded", async () => {
  await esperarLogin();
  pintarUsuario();

  if (!tieneRol("admin", "sistemas", "director")) {
    showToast("Modo solo lectura para este rol.", "info");
  }

  cargarConfiguracion();
  cargarSucursales();
});

async function cargarConfiguracion() {
  try {
    const snap = await rtdb.ref("config/programa").once("value");
    const config = snap.val() || {};

    document.getElementById("porcentajeMonedero").value = config.porcentajeMonedero ?? 0.05;
    document.getElementById("toleranciaTotal").value = config.toleranciaTotal ?? 0.50;
    document.getElementById("maxTicketsDia").value = config.maxTicketsDia ?? 2;
    document.getElementById("diasRegistro").value = config.diasRegistro ?? 3;
    document.getElementById("vigenciaMonedero").value = config.vigenciaMonedero ?? 180;
    document.getElementById("ambienteSistema").value = config.ambienteSistema || "produccion";

  } catch (error) {
    console.error(error);
    showToast("No se pudo cargar la configuración.", "error");
  }
}

async function guardarConfiguracion() {
  if (!tieneRol("admin", "sistemas", "director")) {
    showToast("No tienes permisos para modificar configuración.", "error");
    return;
  }

  try {
    const usuario = getUsuarioActual();
    const now = Date.now();

    const config = {
      porcentajeMonedero: Number(document.getElementById("porcentajeMonedero").value || 0.05),
      toleranciaTotal: Number(document.getElementById("toleranciaTotal").value || 0.50),
      maxTicketsDia: Number(document.getElementById("maxTicketsDia").value || 2),
      diasRegistro: Number(document.getElementById("diasRegistro").value || 3),
      vigenciaMonedero: Number(document.getElementById("vigenciaMonedero").value || 180),
      ambienteSistema: document.getElementById("ambienteSistema").value || "produccion",
      updatedAt: now,
      updatedBy: usuario?.email || ""
    };

    await rtdb.ref("config/programa").update(config);

    await rtdb.ref("auditLogs").push().set({
      type: "CONFIG_ACTUALIZADA",
      userEmail: usuario?.email || "",
      userId: usuario?.uid || "",
      createdAt: now,
      config
    });

    showToast("Configuración guardada correctamente.", "success");

  } catch (error) {
    console.error(error);
    showToast("No se pudo guardar la configuración.", "error");
  }
}

async function cargarSucursales() {
  const tbody = document.getElementById("tablaSucursales");

  try {
    const snap = await rtdb.ref("config/sucursales").once("value");
    let sucursales = snap.val();

    if (!sucursales) {
      sucursales = SUCURSALES_BASE;
    }

    const lista = Object.values(sucursales);

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="5">No hay sucursales configuradas.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(s => `
      <tr>
        <td>${safeText(s.id || "---")}</td>
        <td>${safeText(s.nombre || "---")}</td>
        <td>${safeText(s.marca || "---")}</td>
        <td>${safeText(s.ciudad || "---")}</td>
        <td>${safeText(s.estado || "---")}</td>
      </tr>
    `).join("");

  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="5">Error cargando sucursales.</td></tr>`;
  }
}

async function restaurarSucursalesBase() {
  if (!tieneRol("admin", "sistemas", "director")) {
    showToast("No tienes permisos para modificar sucursales.", "error");
    return;
  }

  if (!confirm("¿Restaurar sucursales base de Applebee's?")) return;

  try {
    const usuario = getUsuarioActual();
    const now = Date.now();

    await rtdb.ref("config/sucursales").set(SUCURSALES_BASE);

    await rtdb.ref("auditLogs").push().set({
      type: "SUCURSALES_RESTAURADAS",
      userEmail: usuario?.email || "",
      userId: usuario?.uid || "",
      createdAt: now
    });

    cargarSucursales();
    showToast("Sucursales restauradas correctamente.", "success");

  } catch (error) {
    console.error(error);
    showToast("No se pudieron restaurar las sucursales.", "error");
  }
}