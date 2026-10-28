// ================================================
// Applebee's Loyalty Control Center
// ticket-detalle.js
// ================================================

let ticketKeyActual = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await esperarLogin())) return;
  pintarUsuario();

  const params = new URLSearchParams(window.location.search);
  ticketKeyActual = params.get("ticketKey");

  if (!claveFirebaseValida(ticketKeyActual)) {
    showToast("No se recibió ticketKey.", "error");
    setTimeout(() => {
      window.location.href = "tickets.html";
    }, 1200);
    return;
  }

  cargarDetalleTicket(ticketKeyActual);
});

async function cargarDetalleTicket(ticketKey) {
  showLoader("Cargando detalle del ticket...");

  escucharDatos(rtdb.ref(`tickets/${ticketKey}`), snap => {
    const ticket = snap.val();

    if (!ticket) {
      document.querySelectorAll(".main .panel-card, .main .kpi-grid").forEach(node => { node.hidden = true; });
      throw new Error("Ticket no encontrado");
    }

    document.querySelectorAll(".main .panel-card, .main .kpi-grid").forEach(node => { node.hidden = false; });
    pintarResumenTicket(ticket);
    pintarDatosConfirmados(ticket);
    pintarDatosOCR(ticket);
    pintarCorrecciones(ticket);
    pintarResultadoValidacion(ticket);
    pintarJson(ticket);

    hideLoader();

  }, "tickets:detalle");
}

function pintarResumenTicket(t) {
  const riesgo = calcularRiesgo(t);

  document.getElementById("ticketTitulo").textContent = `Ticket ${t.folio || "---"}`;
  document.getElementById("ticketSubtitulo").textContent =
    `${t.fechaTicket || "---"} · ${t.sucursal || "---"} · ${formatDateTime(t.createdAt)}`;

  document.getElementById("ticketFolio").textContent = `Ticket ${t.folio || "---"}`;
  document.getElementById("ticketCliente").textContent = `Cliente: ${t.clienteEmail || t.userId || "---"}`;
  document.getElementById("ticketSucursal").textContent = `Sucursal: ${t.sucursal || "---"}`;

  const status = document.getElementById("ticketStatus");
  status.textContent = getStatusLabel(t.status);
  status.className = `status ${getStatusClass(t.status)}`;

  document.getElementById("detalleTotalCliente").textContent = money(t.total || 0);
  document.getElementById("detalleTotalValidado").textContent = t.totalValidado == null ? "Sin validar" : money(t.totalValidado);
  document.getElementById("detalleMonedero").textContent = money(t.monederoGenerado || 0);
  document.getElementById("detalleRiesgo").textContent = `${riesgo.nivel.toUpperCase()} ${riesgo.score}`;
}

function pintarDatosConfirmados(t) {
  document.getElementById("confirmadoFolio").textContent = t.folio || "---";
  document.getElementById("confirmadoFecha").textContent = t.fechaTicket || "---";
  document.getElementById("confirmadoTotal").textContent = money(t.total || 0);
  document.getElementById("confirmadoMesero").textContent = t.mesero || "---";
  document.getElementById("confirmadoFotos").textContent = t.fotosCantidad || 0;
  document.getElementById("confirmadoIntentos").textContent =
    `${numeroSeguro(t.intentosValidacion)} / ${numeroSeguro(t.maxIntentos, 2)}`;
}

function pintarDatosOCR(t) {
  const vision = t.ticketVision || {};
  const detectado = vision.detectado || {};

  document.getElementById("ocrFolio").textContent = detectado.folio || "---";
  document.getElementById("ocrFecha").textContent = detectado.fecha || "---";
  document.getElementById("ocrTotal").textContent = detectado.total != null ? money(detectado.total) : "---";
  document.getElementById("ocrMesero").textContent = detectado.mesero || "---";
  document.getElementById("ocrManual").textContent = vision.modoManual ? "Sí" : "No";
  document.getElementById("ocrFingerprint").textContent = vision.fingerprint || "---";
}

function pintarCorrecciones(t) {
  const box = document.getElementById("bloqueCorrecciones");
  const vision = t.ticketVision || {};

  const campos = Array.isArray(vision.camposCorregidos) ? vision.camposCorregidos : [];
  const advertencias = Array.isArray(vision.advertencias) ? vision.advertencias : [];

  if (!campos.length && !advertencias.length) {
    box.innerHTML = `<p class="muted">Sin correcciones ni advertencias registradas.</p>`;
    return;
  }

  box.innerHTML = `
    <div class="detail-list">
      <p><strong>Campos corregidos:</strong> ${campos.length ? campos.map(safeText).join(", ") : "---"}</p>
      <p><strong>Advertencias:</strong></p>
      <ul>
        ${
          advertencias.length
            ? advertencias.map(a => `<li>${safeText(a)}</li>`).join("")
            : "<li>Sin advertencias</li>"
        }
      </ul>
    </div>
  `;
}

function pintarResultadoValidacion(t) {
  document.getElementById("motivoRechazo").textContent = t.motivoRechazo || "---";
  document.getElementById("mensajeCliente").textContent = t.mensajeCliente || "---";
  document.getElementById("fechaValidacion").textContent = formatDateTime(t.validatedAt);
  document.getElementById("horaApertura").textContent = t.horaApertura || "---";
  document.getElementById("horaCierre").textContent = t.horaCierre || "---";
}

function pintarJson(t) {
  document.getElementById("ticketJson").textContent = JSON.stringify(t, null, 2);
}