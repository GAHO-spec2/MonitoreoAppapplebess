// ================================================
// Applebee's Loyalty Control Center
// ticket-detalle.js
// ================================================

let ticketKeyActual = null;

document.addEventListener("DOMContentLoaded", async () => {
  await esperarLogin();
  pintarUsuario();

  const params = new URLSearchParams(window.location.search);
  ticketKeyActual = params.get("ticketKey");

  if (!ticketKeyActual) {
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

  try {
    const snap = await rtdb.ref(`tickets/${ticketKey}`).once("value");
    const ticket = snap.val();

    if (!ticket) {
      hideLoader();
      showToast("Ticket no encontrado.", "error");
      return;
    }

    pintarResumenTicket(ticket);
    pintarDatosConfirmados(ticket);
    pintarDatosOCR(ticket);
    pintarCorrecciones(ticket);
    pintarResultadoValidacion(ticket);
    pintarJson(ticket);

    hideLoader();

  } catch (error) {
    console.error(error);
    hideLoader();
    showToast("No se pudo cargar el ticket.", "error");
  }
}

function calcularRiesgoTicketDetalle(t) {
  let score = 0;
  const motivos = [];

  if (t.status === "rechazado_corregible") {
    score += 35;
    motivos.push("Requiere corrección");
  }

  if (t.status === "anulado") {
    score += 70;
    motivos.push("Anulado");
  }

  if (t.status === "error_validacion") {
    score += 40;
    motivos.push("Error de validación");
  }

  if (Number(t.intentosValidacion || 0) >= 1) {
    score += 20;
    motivos.push("Intentos fallidos");
  }

  if (t.ticketVision?.camposCorregidos?.length) {
    score += 25;
    motivos.push("Datos corregidos manualmente");
  }

  if (t.ticketVision?.modoManual) {
    score += 20;
    motivos.push("Registro manual");
  }

  if (t.motivoRechazo) {
    score += 25;
    motivos.push(t.motivoRechazo);
  }

  let nivel = "bajo";
  if (score >= 70) nivel = "alto";
  else if (score >= 35) nivel = "medio";

  return { score, nivel, motivos };
}

function pintarResumenTicket(t) {
  const riesgo = calcularRiesgoTicketDetalle(t);

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
  document.getElementById("detalleTotalValidado").textContent = money(t.totalValidado || 0);
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
    `${Number(t.intentosValidacion || 0)} / ${Number(t.maxIntentos || 2)}`;
}

function pintarDatosOCR(t) {
  const vision = t.ticketVision || {};
  const detectado = vision.detectado || {};

  document.getElementById("ocrFolio").textContent = detectado.folio || "---";
  document.getElementById("ocrFecha").textContent = detectado.fecha || "---";
  document.getElementById("ocrTotal").textContent = detectado.total ? money(detectado.total) : "---";
  document.getElementById("ocrMesero").textContent = detectado.mesero || "---";
  document.getElementById("ocrManual").textContent = vision.modoManual ? "Sí" : "No";
  document.getElementById("ocrFingerprint").textContent = vision.fingerprint || "---";
}

function pintarCorrecciones(t) {
  const box = document.getElementById("bloqueCorrecciones");
  const vision = t.ticketVision || {};

  const campos = vision.camposCorregidos || [];
  const advertencias = vision.advertencias || [];

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