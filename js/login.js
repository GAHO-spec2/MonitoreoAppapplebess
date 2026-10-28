let loginEnCurso = false;
const firebaseStatus = document.getElementById("firebaseStatus");
const mensajeAcceso = sessionStorage.getItem("accesoMensaje");
if (mensajeAcceso) { sessionStorage.removeItem("accesoMensaje"); showToast(mensajeAcceso, "error"); }
const conexionLogin = rtdb.ref(".info/connected");
const pintarConexionLogin = snap => {
  firebaseStatus.textContent = snap.val() === true ? "Realtime Database conectada · acceso pendiente de verificar" : "Sin conexión confirmada a Realtime Database";
};
conexionLogin.on("value", pintarConexionLogin, () => { firebaseStatus.textContent = "No se pudo verificar la conexión"; });
window.addEventListener("pagehide", () => conexionLogin.off("value", pintarConexionLogin));

auth.onAuthStateChanged(async user => {
  if (!user || loginEnCurso) return;
  try {
    const snap = await conTiempoLimite(rtdb.ref(`users/${user.uid}`).once("value"));
    if (auth.currentUser?.uid !== user.uid || loginEnCurso) return;
    if (perfilAutorizado(snap.val())) window.location.replace("dashboard.html");
    else { await auth.signOut(); showToast("Tu cuenta no tiene acceso activo al panel.", "error"); }
  } catch (error) { showToast("No se pudo comprobar el acceso. Revisa tu conexión e intenta de nuevo.", "error"); }
});

async function loginAdmin() {
  if (loginEnCurso) return;
  const email = document.getElementById("emailAdmin").value.trim();
  const password = document.getElementById("passwordAdmin").value;
  if (!email || !password) { showToast("Ingresa correo y contraseña.", "error"); return; }
  loginEnCurso = true;
  const button = document.getElementById("ingresarAdmin");
  button.disabled = true;
  try {
    showLoader("Validando acceso...");
    const cred = await conTiempoLimite(auth.signInWithEmailAndPassword(email, password));
    const snap = await conTiempoLimite(rtdb.ref(`users/${cred.user.uid}`).once("value"));
    if (!perfilAutorizado(snap.val())) {
      await auth.signOut(); showToast("Tu cuenta no tiene acceso activo al panel.", "error"); return;
    }
    window.location.replace("dashboard.html");
  } catch (error) {
    const message = error.code === "auth/too-many-requests" ? "Demasiados intentos. Espera y vuelve a intentar." : "No se pudo iniciar sesión. Revisa tus datos, conexión y permisos.";
    showToast(message, "error");
  } finally { hideLoader(); button.disabled = false; loginEnCurso = false; }
}
document.addEventListener("keydown", event => { if (event.key === "Enter") loginAdmin(); });
