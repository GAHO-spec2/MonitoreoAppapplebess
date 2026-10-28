// ================================================
// Applebee's Loyalty Control Center
// alertas.js
// ================================================

let alertasGlobal = [];

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await esperarLogin())) return;
  pintarUsuario();

  cargarAlertas();
});

function cargarAlertas() {
  showLoader("Analizando alertas...");

  escucharDatos(rtdb.ref("tickets"), snapshot => {
      const ticketsObj = snapshot.val() || {};

      alertasGlobal = registros(ticketsObj, "ticketKey")
        .map(ticket => ({ ...ticket, riesgo: calcularRiesgo(ticket) }))
        .filter(t => t.riesgo.score > 0)
        .sort((a, b) => {
          if (b.riesgo.score !== a.riesgo.score) {
            return b.riesgo.score - a.riesgo.score;
          }

          return (b.createdAt || 0) - (a.createdAt || 0);
        });

      pintarKPIsAlertas();
      filtrarAlertas();

      hideLoader();
    }, "tickets:alertas", error => {
      console.error(error);
      hideLoader();
      showToast("No se pudieron cargar las alertas.", "error");
    });
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

        <button class="btn btn-secondary" data-ticket-key="${safeText(a.ticketKey)}">
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