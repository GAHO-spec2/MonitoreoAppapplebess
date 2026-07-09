// ================================================
// Applebee's Loyalty Control Center
// alertas.js
// ================================================

let alertasGlobal = [];

document.addEventListener("DOMContentLoaded", async () => {
  await esperarLogin();
  pintarUsuario();

  cargarAlertas();
});

function cargarAlertas() {
  showLoader("Analizando alertas...");

  rtdb.ref("tickets")
    .on("value", snapshot => {
      const ticketsObj = snapshot.val() || {};

      alertasGlobal = Object.entries(ticketsObj)
        .map(([key, ticket]) => {
          const riesgo = calcularRiesgo(ticket);

          return {
            ticketKey: ticket.ticketKey || key,
            ...ticket,
            riesgo
          };
        })
        .filter(t => t.riesgo.score > 0)
        .sort((a, b) => {
          if (b.riesgo.score !== a.riesgo.score) {
            return b.riesgo.score - a.riesgo.score;
          }

          return (b.createdAt || 0) - (a.createdAt || 0);
        });

      pintarKPIsAlertas();
      pintarAlertas(alertasGlobal);

      hideLoader();
    }, error => {
      console.error(error);
      hideLoader();
      showToast("No se pudieron cargar las alertas.", "error");
    });
}

function calcularRiesgo(t) {
  let score = 0;
  const motivos = [];

  const status = String(t.status || "").toLowerCase().trim();

  if (status === "anulado") {
    score += 80;
    motivos.push("Ticket anulado por intentos agotados");
  }

  if (status === "rechazado_corregible") {
    score += 45;
    motivos.push("Datos no coinciden y requiere corrección");
  }

  if (status === "error_validacion") {
    score += 45;
    motivos.push("Error durante validación automática");
  }

  if (status === "pendiente_revision_manual") {
    score += 35;
    motivos.push("OCR/API falló y pasó a revisión manual");
  }

  if (Number(t.intentosValidacion || 0) > 0) {
    score += Number(t.intentosValidacion || 0) * 20;
    motivos.push(`Intentos de validación: ${t.intentosValidacion}`);
  }

  const camposCorregidos = t.ticketVision?.camposCorregidos || [];

  if (camposCorregidos.length) {
    score += camposCorregidos.length * 18;
    motivos.push(`Campos corregidos: ${camposCorregidos.join(", ")}`);
  }

  if (t.ticketVision?.modoManual) {
    score += 25;
    motivos.push("Registro manual activado");
  }

  if (t.motivoRechazo) {
    score += 30;
    motivos.push(t.motivoRechazo);
  }

  if (String(t.mensajeCliente || "").toLowerCase().includes("agotaron")) {
    score += 35;
    motivos.push("Se agotaron intentos disponibles");
  }

  let nivel = "bajo";

  if (score >= 80) {
    nivel = "alto";
  } else if (score >= 40) {
    nivel = "medio";
  }

  return {
    score,
    nivel,
    motivos
  };
}

function pintarKPIsAlertas() {
  const total = alertasGlobal.length;
  const alto = alertasGlobal.filter(a => a.riesgo.nivel === "alto").length;
  const revisionManual = alertasGlobal.filter(a => a.status === "pendiente_revision_manual").length;
  const anulados = alertasGlobal.filter(a => a.status === "anulado").length;

  document.getElementById("kpiAlertasTotal").textContent = total;
  document.getElementById("kpiRiesgoAlto").textContent = alto;
  document.getElementById("kpiRevisionManual").textContent = revisionManual;
  document.getElementById("kpiTicketsAnulados").textContent = anulados;
}

function pintarAlertas(alertas) {
  const lista = document.getElementById("listaAlertas");

  if (!lista) return;

  if (!alertas.length) {
    lista.innerHTML = `<p class="muted">No hay alertas activas.</p>`;
    return;
  }

  lista.innerHTML = alertas.map(a => `
    <div class="alert-card alert-${a.riesgo.nivel}">
      <div class="alert-main">
        <div>
          <span class="risk risk-${a.riesgo.nivel}">
            ${a.riesgo.nivel.toUpperCase()} · ${a.riesgo.score}
          </span>

          <h3>Ticket ${safeText(a.folio || "---")}</h3>

          <p class="muted">
            ${safeText(a.clienteEmail || a.userId || "---")} ·
            ${safeText(a.sucursal || "---")} ·
            ${safeText(a.fechaTicket || "---")}
          </p>
        </div>

        <button class="btn btn-secondary" onclick="abrirTicketAlerta('${safeText(a.ticketKey)}')">
          Ver ticket
        </button>
      </div>

      <div class="alert-reasons">
        ${
          a.riesgo.motivos.length
            ? a.riesgo.motivos.map(m => `<span>${safeText(m)}</span>`).join("")
            : "<span>Sin motivo específico</span>"
        }
      </div>

      <small class="muted">Registrado: ${formatDateTime(a.createdAt)}</small>
    </div>
  `).join("");
}

function filtrarAlertas() {
  const q = String(document.getElementById("buscarAlerta")?.value || "")
    .toLowerCase()
    .trim();

  const nivel = String(document.getElementById("filtroNivelAlerta")?.value || "")
    .toLowerCase()
    .trim();

  let filtradas = alertasGlobal;

  if (nivel) {
    filtradas = filtradas.filter(a => a.riesgo.nivel === nivel);
  }

  if (q) {
    filtradas = filtradas.filter(a => {
      return (
        String(a.folio || "").toLowerCase().includes(q) ||
        String(a.clienteEmail || "").toLowerCase().includes(q) ||
        String(a.userId || "").toLowerCase().includes(q) ||
        String(a.sucursal || "").toLowerCase().includes(q) ||
        String(a.status || "").toLowerCase().includes(q) ||
        String(a.motivoRechazo || "").toLowerCase().includes(q) ||
        String(a.mensajeCliente || "").toLowerCase().includes(q) ||
        a.riesgo.motivos.join(" ").toLowerCase().includes(q)
      );
    });
  }

  pintarAlertas(filtradas);
}

function abrirTicketAlerta(ticketKey) {
  window.location.href = `ticket-detalle.html?ticketKey=${encodeURIComponent(ticketKey)}`;
}