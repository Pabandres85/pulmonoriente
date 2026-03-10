Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;

const COLORES = { v1:'#1B4D2E', v2:'#2E7D52', v3:'#4CAF50', v4:'#A5D6A7', rojo:'#E74C3C', azul:'#0277BD' };

let _data        = null;
let _visibleData = [];
let currentMode  = 'ups';
let currentAnio  = 'all';
let myCharts     = {};

// ── RENDER PRINCIPAL ────────────────────────────────────────────────────────
function renderDashboard() {
  const perimetro = DataService.getPerimetro(_data.poly);
  const proyectos = DataService.getProyectos({ pts: _data.pts, perimetro, mode: currentMode, año: currentAnio });
  const kpis      = DataService.getKPIs(proyectos);

  // ── Agregaciones para gráficas ──────────────────────────────────────────
  const dataSec = {}, dataTipo = {}, dataBarrio = {}, barrioCount = {}, dataAnio = {};
  const secEstadoMap = {};
  const dataAvance = { '0-25%': 0, '25-50%': 0, '50-75%': 0, '75-99%': 0, 'Completado': 0 };

  proyectos.forEach(p => {
    dataSec[p.secretaria]   = (dataSec[p.secretaria]   || 0) + p.presupuesto;
    dataTipo[p.tipo]        = (dataTipo[p.tipo]         || 0) + p.presupuesto;
    dataBarrio[p.barrio]    = (dataBarrio[p.barrio]     || 0) + p.presupuesto;
    barrioCount[p.barrio]   = (barrioCount[p.barrio]    || 0) + 1;
    dataAnio[p.año]         = (dataAnio[p.año]          || 0) + p.presupuesto;

    const sec = p.secretaria || 'Otras';
    const est = p.estado     || 'Sin dato';
    if (!secEstadoMap[sec]) secEstadoMap[sec] = {};
    secEstadoMap[sec][est] = (secEstadoMap[sec][est] || 0) + 1;

    const av = p.avance || 0;
    if (av >= 100)      dataAvance['Completado']++;
    else if (av >= 75)  dataAvance['75-99%']++;
    else if (av >= 50)  dataAvance['50-75%']++;
    else if (av >= 25)  dataAvance['25-50%']++;
    else                dataAvance['0-25%']++;
  });

  // ── KPIs y stats cards ─────────────────────────────────────────────────
  document.getElementById('kpi-count').innerText     = kpis.total;
  document.getElementById('kpi-count-lbl').innerText = currentMode === 'ups' ? 'Frentes Únicos' : 'Contratos Totales';
  document.getElementById('kpi-budget').innerText    = '$' + Math.round(kpis.inversion / 1e6).toLocaleString('es-CO') + 'M';
  document.getElementById('stat-total').innerText    = kpis.total;
  document.getElementById('stat-total-lbl').innerText= currentMode === 'ups' ? 'Frentes' : 'Contratos';
  document.getElementById('stat-alistamiento').innerText = kpis.porEstado['En alistamiento'];
  document.getElementById('stat-ejecucion').innerText    = kpis.porEstado['En ejecución'];
  document.getElementById('stat-terminado').innerText    = kpis.porEstado['Terminado'];
  document.getElementById('stat-suspendido').innerText   = kpis.porEstado['Suspendido'];

  // ── Banner de alerta ───────────────────────────────────────────────────
  const alertStrip = document.getElementById('alert-banner');
  const pctAlist   = kpis.total ? ((kpis.porEstado['En alistamiento'] / kpis.total) * 100).toFixed(1) : 0;
  const txtAño     = currentAnio === 'all' ? 'todos los años' : `el año ${currentAnio}`;

  if (kpis.porEstado['Suspendido'] > 0) {
    alertStrip.innerHTML = `⚠️ ALERTA: ${kpis.porEstado['Suspendido']} obras SUSPENDIDAS en ${txtAño} · ${kpis.porEstado['En alistamiento']} en alistamiento (${pctAlist}%).`;
    alertStrip.style.background = '#7B3535';
  } else {
    alertStrip.innerHTML = `✅ ${kpis.total} ${currentMode === 'ups' ? 'frentes' : 'contratos'} filtrados para ${txtAño} · ${pctAlist}% en alistamiento. No hay suspensiones.`;
    alertStrip.style.background = '#1B4D2E';
  }

  // ── Destruir gráficos anteriores ───────────────────────────────────────
  Object.values(myCharts).forEach(c => c && c.destroy());
  myCharts = {};

  // ── Gráficas ───────────────────────────────────────────────────────────
  // ── Gráfica: Inversión por Secretaría ───────────────────────────────────
  const cSec = Object.entries(dataSec).sort((a, b) => b[1] - a[1]);
  if (cSec.length) {
    myCharts.sec = new Chart(document.getElementById('chartSecretaria'), {
      type: 'bar',
      data: { labels: cSec.map(s => s[0]), datasets: [{ data: cSec.map(s => s[1] / 1e6), backgroundColor: [COLORES.v1, COLORES.v2, COLORES.azul, COLORES.v3, COLORES.v4, COLORES.rojo], borderRadius: 4 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: v => `$${v}M` } } } }
    });
    const totalInv = cSec.reduce((s, [, v]) => s + v, 0);
    const pctTop   = totalInv ? (cSec[0][1] / totalInv * 100).toFixed(0) : 0;
    document.getElementById('insight-sec').innerHTML =
      `<span class="ci-label">Mayor inversión:</span> <strong>${cSec[0][0]}</strong> · <strong>$${Math.round(cSec[0][1] / 1e6).toLocaleString('es-CO')}M</strong> · <em>${pctTop}% del total</em>`;
  }

  // ── Gráfica: Estado Físico (Donut) ──────────────────────────────────────
  if (kpis.total) {
    myCharts.est = new Chart(document.getElementById('chartEstado'), {
      type: 'doughnut',
      data: { labels: Object.keys(kpis.porEstado), datasets: [{ data: Object.values(kpis.porEstado), backgroundColor: [COLORES.v3, COLORES.azul, COLORES.v1, COLORES.rojo] }] },
      options: { cutout: '65%', plugins: { legend: { position: 'bottom' } } }
    });
    const topEst    = Object.entries(kpis.porEstado).sort((a, b) => b[1] - a[1])[0];
    const pctTopEst = kpis.total ? (topEst[1] / kpis.total * 100).toFixed(0) : 0;
    document.getElementById('insight-estado').innerHTML =
      `<span class="ci-label">Estado predominante:</span> <strong>${topEst[0]}</strong> · <strong>${topEst[1]}</strong> frentes · <em>${pctTopEst}% del total</em>`;
  }

  // ── Gráfica: Inversión por Tipo ──────────────────────────────────────────
  const cTipo = Object.entries(dataTipo).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (cTipo.length) {
    myCharts.tipo = new Chart(document.getElementById('chartTipo'), {
      type: 'bar',
      data: { labels: cTipo.map(s => s[0]), datasets: [{ data: cTipo.map(s => s[1] / 1e6), backgroundColor: COLORES.v4, borderRadius: 4 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: v => `$${v}M` } } } }
    });
    const totalTipo = cTipo.reduce((s, [, v]) => s + v, 0);
    const pctTipo   = totalTipo ? (cTipo[0][1] / totalTipo * 100).toFixed(0) : 0;
    document.getElementById('insight-tipo').innerHTML =
      `<span class="ci-label">Dominante:</span> <strong>${cTipo[0][0]}</strong> · <strong>$${Math.round(cTipo[0][1] / 1e6).toLocaleString('es-CO')}M</strong> · <em>${pctTipo}% de la inversión por tipo</em>`;
  }

  // ── Gráfica: Inversión por Año ───────────────────────────────────────────
  const cAnio = Object.entries(dataAnio).sort((a, b) => a[0].localeCompare(b[0]));
  if (cAnio.length) {
    document.getElementById('card-anio').style.display = 'block';
    myCharts.anio = new Chart(document.getElementById('chartAnio'), {
      type: 'bar',
      data: { labels: cAnio.map(s => s[0]), datasets: [{ data: cAnio.map(s => s[1] / 1e6), backgroundColor: COLORES.v2, borderRadius: 6 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => `$${v}M` } } } }
    });
    const peakAnio = cAnio.reduce((max, cur) => cur[1] > max[1] ? cur : max, cAnio[0]);
    document.getElementById('insight-anio').innerHTML =
      `<span class="ci-label">Año pico:</span> <strong>${peakAnio[0]}</strong> · <strong>$${Math.round(peakAnio[1] / 1e6).toLocaleString('es-CO')}M</strong> invertidos`;
  } else {
    document.getElementById('card-anio').style.display = 'none';
  }

  // ── Gráfica: Estado por Secretaría (stacked) ─────────────────────────────
  const secLabels = Object.keys(secEstadoMap).sort((a, b) => {
    const totA = Object.values(secEstadoMap[a]).reduce((s, v) => s + v, 0);
    const totB = Object.values(secEstadoMap[b]).reduce((s, v) => s + v, 0);
    return totB - totA;
  });
  const estadosOrden = ['Terminado', 'En ejecución', 'En alistamiento', 'Suspendido'];
  const ESTADO_COLORS = { 'Terminado': COLORES.v3, 'En ejecución': COLORES.azul, 'En alistamiento': COLORES.v2, 'Suspendido': COLORES.rojo };
  if (secLabels.length) {
    myCharts.secEst = new Chart(document.getElementById('chartSecEstado'), {
      type: 'bar',
      data: {
        labels: secLabels,
        datasets: estadosOrden.map(est => ({
          label: est,
          data: secLabels.map(sec => (secEstadoMap[sec] && secEstadoMap[sec][est]) || 0),
          backgroundColor: ESTADO_COLORS[est] || '#90A4AE',
          borderRadius: 2
        }))
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 14, padding: 16 } } },
        scales: { x: { stacked: true, grid: { color: 'rgba(0,0,0,0.04)' } }, y: { stacked: true } }
      }
    });
    const topSec    = secLabels[0];
    const topSecTot = Object.values(secEstadoMap[topSec]).reduce((s, v) => s + v, 0);
    const topSecTerm= secEstadoMap[topSec]['Terminado'] || 0;
    const pctTerm   = topSecTot ? (topSecTerm / topSecTot * 100).toFixed(0) : 0;
    document.getElementById('insight-secest').innerHTML =
      `<span class="ci-label">Más proyectos:</span> <strong>${topSec}</strong> · <strong>${topSecTot}</strong> frentes · <em>${pctTerm}% terminados</em>`;
  }

  // ── Gráfica: Top Barrios dual-axis (inversión + conteo) ─────────────────
  const cBarrioTop = Object.entries(dataBarrio).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (cBarrioTop.length) {
    myCharts.bCount = new Chart(document.getElementById('chartBarrios'), {
      type: 'bar',
      data: {
        labels: cBarrioTop.map(s => s[0]),
        datasets: [
          { label: 'Inversión (millones COP)', data: cBarrioTop.map(([, v]) => Math.round(v / 1e6)), backgroundColor: COLORES.v1, borderRadius: 4, xAxisID: 'x' },
          { label: 'N° Proyectos', data: cBarrioTop.map(([nom]) => barrioCount[nom] || 0), backgroundColor: 'rgba(230,168,0,0.85)', borderRadius: 4, xAxisID: 'x2' }
        ]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
        scales: {
          x:  { position: 'bottom', ticks: { callback: v => `$${v}M` }, grid: { color: 'rgba(0,0,0,0.04)' } },
          x2: { position: 'top', grid: { drawOnChartArea: false }, ticks: { color: '#B8860B' } }
        }
      }
    });
    const topBarrio    = cBarrioTop[0];
    const totalBarrios = cBarrioTop.reduce((s, [, v]) => s + v, 0);
    const pctBarrio    = totalBarrios ? (topBarrio[1] / totalBarrios * 100).toFixed(0) : 0;
    document.getElementById('insight-barrios').innerHTML =
      `<span class="ci-label">Mayor inversión:</span> <strong>${topBarrio[0]}</strong> · <strong>$${Math.round(topBarrio[1] / 1e6).toLocaleString('es-CO')}M</strong> · <strong>${barrioCount[topBarrio[0]] || 0}</strong> proyectos · <em>${pctBarrio}% de la inversión territorial</em>`;
  }

  // ── Gráfica: Distribución de Avance de Obra ─────────────────────────────
  const avanceLabels = Object.keys(dataAvance);
  const avanceVals   = Object.values(dataAvance);
  const avanceColors = ['#E74C3C', '#E67E22', '#F1C40F', '#2E7D52', '#4CAF50'];
  myCharts.avance = new Chart(document.getElementById('chartAvance'), {
    type: 'bar',
    data: {
      labels: avanceLabels,
      datasets: [{ data: avanceVals, backgroundColor: avanceColors, borderRadius: 6 }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { ticks: { stepSize: 1 } } }
    }
  });
  const totalAvance  = avanceVals.reduce((s, v) => s + v, 0);
  const pctCompleto  = totalAvance ? (dataAvance['Completado'] / totalAvance * 100).toFixed(0) : 0;
  const avgAvance    = proyectos.length ? (proyectos.reduce((s, p) => s + (p.avance || 0), 0) / proyectos.length).toFixed(1) : 0;
  document.getElementById('insight-avance').innerHTML =
    `<span class="ci-label">Avance promedio:</span> <strong>${avgAvance}%</strong> · <strong>${dataAvance['Completado']}</strong> proyectos al 100% · <em>${pctCompleto}% del total completados</em>`;

  // ── Tabla completa de proyectos ────────────────────────────────────────
  const tb     = document.getElementById('proyectosTable');
  const sorted = [...proyectos].sort((a, b) => b.presupuesto - a.presupuesto);
  _visibleData = sorted;
  const countEl = document.getElementById('tabla-count');
  if (countEl) countEl.textContent = sorted.length.toLocaleString('es-CO');

  tb.innerHTML = sorted.length
    ? sorted.map((p, i) => {
        const est = p.estado || '';
        const cls = est.toLowerCase().includes('ejecuc')    ? 'pill-ej'
                  : est.toLowerCase().includes('terminad')  ? 'pill-term'
                  : est.toLowerCase().includes('suspendid') ? 'pill-susp'
                  : 'pill-alist';
        return `<tr data-idx="${i}">
          <td><strong>${p.secretaria}</strong></td>
          <td>${p.tipo}</td>
          <td>${p.nombre}</td>
          <td class="col-opt">${p.barrio}</td>
          <td class="col-opt">${p.año}</td>
          <td><strong>$${Math.round(p.presupuesto / 1e6).toLocaleString('es-CO')}M</strong></td>
          <td><span class="avance-val">${p.avance}%</span></td>
          <td><span class="pill ${cls}">${est}</span></td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="8" class="empty-td">No hay proyectos para esta selección.</td></tr>`;
}

// ── INICIALIZACIÓN ──────────────────────────────────────────────────────────
async function initData() {
  _data = await DataService.load('../data/');
  renderDashboard();
}

// ── LISTENERS ──────────────────────────────────────────────────────────────
document.querySelectorAll('.toggle-btn[data-modo]').forEach(btn => {
  btn.addEventListener('click', e => {
    document.querySelectorAll('.toggle-btn[data-modo]').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentMode = e.target.dataset.modo;
    renderDashboard();
  });
});

document.getElementById('select-anio').addEventListener('change', e => {
  currentAnio = e.target.value;
  renderDashboard();
});

initData();

// ── MODAL ───────────────────────────────────────────────────────────────────
function badgeClass(estado) {
  if (!estado) return 'est-otro';
  const e = estado.toLowerCase();
  if (e.includes('ejecuc'))      return 'est-ejecucion';
  if (e.includes('terminad'))    return 'est-terminado';
  if (e.includes('alistamiento'))return 'est-alistamiento';
  if (e.includes('suspendid'))   return 'est-suspendido';
  return 'est-otro';
}

function showModal(p) {
  document.getElementById('modal-estado-badge').textContent = p.estado || 'Sin estado';
  document.getElementById('modal-estado-badge').className   = `modal-badge ${badgeClass(p.estado)}`;
  document.getElementById('modal-title').textContent        = p.nombre || 'Proyecto';
  document.getElementById('modal-secretaria').textContent   = p.secretaria || '-';
  document.getElementById('md-secretaria').textContent      = p.secretaria || '-';
  document.getElementById('md-tipo').textContent            = p.tipo || '-';
  document.getElementById('md-presupuesto').textContent     = p.presupuesto
    ? '$' + p.presupuesto.toLocaleString('es-CO')
    : '-';
  document.getElementById('md-estado').textContent          = p.estado || '-';
  document.getElementById('md-barrio').textContent          = p.barrio || 'Sin dato';
  document.getElementById('md-direccion').textContent       = p.direccion || 'Sin dato';
  document.getElementById('md-anio').textContent            = p.año || '-';
  document.getElementById('md-avance').textContent          = `${p.avance || 0}%`;
  document.getElementById('md-avance-bar').style.width      = `${Math.min(p.avance || 0, 100)}%`;

  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('proyectosTable').addEventListener('click', e => {
  const tr = e.target.closest('tr[data-idx]');
  if (!tr) return;
  showModal(_visibleData[+tr.dataset.idx]);
});

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});
