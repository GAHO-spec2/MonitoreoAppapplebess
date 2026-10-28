// Los permisos también deben aplicarse mediante reglas de Firebase en el servidor.
const ROLES_PERMITIDOS = ["admin", "director", "sistemas", "gerente", "manager"];
let usuarioActual = null;
let loginPendiente = null;

function perfilAutorizado(datos) {
  return !!datos && datos.activo !== false && datos.bloqueado !== true && ROLES_PERMITIDOS.includes(normalizarEstado(datos.role));
}

function esperarLogin() {
  if (loginPendiente) return loginPendiente;
  loginPendiente = new Promise(resolve => {
    let perfilRef = null;
    let perfilListener = null;
    let generacion = 0;
    let terminado = false;
    const timer = setTimeout(() => denegar("No se pudo confirmar tu acceso. Vuelve a iniciar sesión."), 20000);
    function denegar(message) {
      if (terminado) return;
      terminado = true;
      clearTimeout(timer);
      usuarioActual = null;
      generacion++;
      if (perfilRef && perfilListener) perfilRef.off("value", perfilListener);
      limpiarMonitoreo();
      const main = document.querySelector("main");
      if (main) main.hidden = true;
      if (message) sessionStorage.setItem("accesoMensaje", message);
      resolve(null);
      window.location.replace("login-admin.html");
    }
    auth.onAuthStateChanged(user => {
      if (terminado) return;
      const version = ++generacion;
      if (perfilRef && perfilListener) perfilRef.off("value", perfilListener);
      if (!user) { denegar(""); return; }
      perfilRef = rtdb.ref(`users/${user.uid}`);
      perfilListener = snap => {
        if (version !== generacion || terminado) return;
        const datos = snap.val();
        if (!perfilAutorizado(datos)) { denegar("Tu cuenta no tiene acceso activo al panel."); return; }
        const role = normalizarEstado(datos.role);
        if (usuarioActual && (usuarioActual.role !== role || usuarioActual.uid !== user.uid)) {
          denegar("Tus permisos cambiaron. Vuelve a iniciar sesión."); return;
        }
        usuarioActual = { uid: user.uid, email: user.email || "", nombre: String(datos.nombre || ""), role };
        clearTimeout(timer);
        iniciarMonitoreo();
        pintarUsuario();
        resolve(usuarioActual);
      };
      perfilRef.on("value", perfilListener, () => denegar("No se pudo validar el permiso de tu cuenta."));
    }, () => denegar("No se pudo verificar la sesión."));
  });
  return loginPendiente;
}

function getUsuarioActual() { return usuarioActual; }
function tieneRol(...roles) { return !!usuarioActual && roles.includes(usuarioActual.role); }
async function cerrarSesion() {
  if (!confirm("¿Cerrar sesión?")) return;
  try { await auth.signOut(); window.location.replace("login-admin.html"); }
  catch (error) { showToast("No se pudo cerrar la sesión. Intenta de nuevo.", "error"); }
}
function pintarUsuario() {
  if (!usuarioActual) return;
  const nombre = document.getElementById("nombreUsuario");
  if (nombre) nombre.textContent = usuarioActual.nombre;
  const rol = document.getElementById("rolUsuario");
  if (rol) rol.textContent = usuarioActual.role.toUpperCase();
}
