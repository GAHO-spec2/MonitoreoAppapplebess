// ================================================
// Applebee's Loyalty Control Center
// estadisticas.js
// ================================================

let ticketsStats = [];
let canjesStats = [];

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await esperarLogin())) return;
  pintarUsuario();

  cargarEstadisticas();
});

function cargarEstadisticas() {
  showLoader("Calculando estadísticas...");

  escucharGrupo(['tickets', 'redemptions'], ([ticketsSnap, canjesSnap]) => {
      ticketsStats = registros(ticketsSnap.val());
      canjesStats = registros(canjesSnap.val());

      pintarResumenGeneral();
      pintarTicketsPorSucursal();
      pintarCanjesPorBeneficio();
      pintarTicketsPorEstado();
      pintarCanjesPorSucursal();
      pintarActividadDiaria();

      hideLoader();

  });
}

function pintarResumenGeneral() {
  const aprobados = ticketsStats.filter(t => t.status === "aprobado");

  const ventaAprobada = aprobados.reduce((sum, t) => {
    return sum + totalTicket(t);
  }, 0);

  const monederoGenerado = aprobados.reduce((sum, t) => {
    return sum + numeroSeguro(t.monederoGenerado);
  }, 0);

  const promedioTicket = aprobados.length
    ? ventaAprobada / aprobados.length
    : 0;

  const tasaAprobacion = ticketsStats.length
    ? (aprobados.length / ticketsStats.length) * 100
    : 0;

  document.getElementById("statVentaAprobada").textContent = money(ventaAprobada);
  document.getElementById("statMonederoGenerado").textContent = money(monederoGenerado);
  document.getElementById("statPromedioTicket").textContent = money(promedioTicket);
  document.getElementById("statTasaAprobacion").textContent = `${tasaAprobacion.toFixed(1)}%`;
}

function agruparPor(lista, campo) {
  return lista.reduce((acc, item) => {
    const key = item[campo] || "Sin dato";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, Object.create(null));
}

function agruparMontoPor(lista, campo, campoMonto) {
  return lista.reduce((acc, item) => {
    const key = item[campo] || "Sin dato";
    acc[key] = (acc[key] || 0) + numeroSeguro(item[campoMonto]);
    return acc;
  }, Object.create(null));
}

function pintarListaStats(contenedorId, data, tipo = "cantidad") {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;

  const entries = Object.entries(data)
    .sort((a, b) => Number(b[1]) - Number(a[1]));

  if (!entries.length) {
    contenedor.innerHTML = `<p class="muted">Sin información disponible.</p>`;
    return;
  }

  const max = Math.max(...entries.map(([, value]) => Number(value || 0)), 1);

  contenedor.innerHTML = entries.map(([label, value]) => {
    const pct = (Number(value || 0) / max) * 100;

    return `
      <div class="stat-row">
        <div class="stat-row-head">
          <strong>${safeText(label)}</strong>
          <span>${tipo === "money" ? money(value) : value}</span>
        </div>
        <div class="stat-bar">
          <i style="width:${pct}%"></i>
        </div>
      </div>
    `;
  }).join("");
}

function pintarTicketsPorSucursal() {
  pintarListaStats("ticketsPorSucursal", agruparPor(ticketsStats, "sucursal"));
}

function pintarCanjesPorBeneficio() {
  pintarListaStats("canjesPorBeneficio", agruparPor(canjesStats, "beneficio"));
}

function pintarTicketsPorEstado() {
  const estados = ticketsStats.reduce((acc, t) => {
    const label = getStatusLabel(t.status);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, Object.create(null));

  pintarListaStats("ticketsPorEstado", estados);
}

function pintarCanjesPorSucursal() {
  const canjeados = canjesStats.filter(c => c.status === "canjeado");

  const data = canjeados.reduce((acc, c) => {
    const key = c.sucursalCanjeNombre || c.sucursalCanje || "Sin dato";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, Object.create(null));

  pintarListaStats("canjesPorSucursal", data);
}

function fechaDeTimestamp(ts) {
  if (!ts) return "Sin fecha";
  return fechaLocal(ts);
}

function pintarActividadDiaria() {
  const tbody = document.getElementById("tablaActividadDiaria");
  if (!tbody) return;

  const dias = Object.create(null);

  ticketsStats.forEach(t => {
    const fecha = fechaDeTimestamp(t.createdAt);

    if (!dias[fecha]) {
      dias[fecha] = {
        fecha,
        tickets: 0,
        aprobados: 0,
        alertas: 0,
        venta: 0,
        canjesCreados: 0,
        canjesValidados: 0
      };
    }

    dias[fecha].tickets += 1;

    if (t.status === "aprobado") {
      dias[fecha].aprobados += 1;
      dias[fecha].venta += totalTicket(t);
    }

    if (calcularRiesgo(t).score > 0) {
      dias[fecha].alertas += 1;
    }
  });

  canjesStats.forEach(c => {
    const fechaCreado = fechaDeTimestamp(c.createdAt);

    if (!dias[fechaCreado]) {
      dias[fechaCreado] = {
        fecha: fechaCreado,
        tickets: 0,
        aprobados: 0,
        alertas: 0,
        venta: 0,
        canjesCreados: 0,
        canjesValidados: 0
      };
    }

    dias[fechaCreado].canjesCreados += 1;

    if (c.status === "canjeado" && c.redeemedAt) {
      const fechaValidado = fechaDeTimestamp(c.redeemedAt);

      if (!dias[fechaValidado]) {
        dias[fechaValidado] = {
          fecha: fechaValidado,
          tickets: 0,
          aprobados: 0,
          alertas: 0,
          venta: 0,
          canjesCreados: 0,
          canjesValidados: 0
        };
      }

      dias[fechaValidado].canjesValidados += 1;
    }
  });

  const rows = Object.values(dias)
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
    .slice(0, 30);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7">Sin actividad registrada.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(d => `
    <tr>
      <td>${safeText(d.fecha)}</td>
      <td>${d.tickets}</td>
      <td>${d.aprobados}</td>
      <td>${d.alertas}</td>
      <td>${money(d.venta)}</td>
      <td>${d.canjesCreados}</td>
      <td>${d.canjesValidados}</td>
    </tr>
  `).join("");
}