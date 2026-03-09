Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;

const COLORES = { v1:'#1B4D2E', v2:'#2E7D52', v3:'#4CAF50', v4:'#A5D6A7', rojo:'#E74C3C', azul:'#0277BD' };

let _data       = null;
let currentMode = 'ups';
let currentAnio = 'all';
let myCharts    = {};

// ── RENDER PRINCIPAL ────────────────────────────────────────────────────────
function renderDashboard() {
  const perimetro = DataService.getPerimetro(_data.poly);
  const proyectos = DataService.getProyectos({ pts: _data.pts, perimetro, mode: currentMode, año: currentAnio });
  const kpis      = DataService.getKPIs(proyectos);

  // ── Agregaciones para gráficas ──────────────────────────────────────────
  const dataSec = {}, dataTipo = {}, dataBarrio = {}, barrioCount = {}, dataAnio = {};

  proyectos.forEach(p => {
    dataSec[p.secretaria]   = (dataSec[p.secretaria]   || 0) + p.presupuesto;
    dataTipo[p.tipo]        = (dataTipo[p.tipo]         || 0) + p.presupuesto;
    dataBarrio[p.barrio]    = (dataBarrio[p.barrio]     || 0) + p.presupuesto;
    barrioCount[p.barrio]   = (barrioCount[p.barrio]    || 0) + 1;
    dataAnio[p.año]         = (dataAnio[p.año]          || 0) + p.presupuesto;
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
  const cSec = Object.entries(dataSec).sort((a, b) => b[1] - a[1]);
  if (cSec.length) {
    myCharts.sec = new Chart(document.getElementById('chartSecretaria'), {
      type: 'bar',
      data: { labels: cSec.map(s => s[0]), datasets: [{ data: cSec.map(s => s[1] / 1e6), backgroundColor: [COLORES.v1, COLORES.v2, COLORES.azul, COLORES.v3], borderRadius: 4 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: v => `$${v}M` } } } }
    });
  }

  if (kpis.total) {
    myCharts.est = new Chart(document.getElementById('chartEstado'), {
      type: 'doughnut',
      data: { labels: Object.keys(kpis.porEstado), datasets: [{ data: Object.values(kpis.porEstado), backgroundColor: [COLORES.v3, COLORES.azul, COLORES.v1, COLORES.rojo] }] },
      options: { cutout: '65%', plugins: { legend: { position: 'bottom' } } }
    });
  }

  const cTipo = Object.entries(dataTipo).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (cTipo.length) {
    myCharts.tipo = new Chart(document.getElementById('chartTipo'), {
      type: 'bar',
      data: { labels: cTipo.map(s => s[0]), datasets: [{ data: cTipo.map(s => s[1] / 1e6), backgroundColor: COLORES.v4, borderRadius: 4 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: v => `$${v}M` } } } }
    });
  }

  const cAnio = Object.entries(dataAnio).sort((a, b) => a[0].localeCompare(b[0]));
  if (cAnio.length) {
    document.getElementById('card-anio').style.display = 'block';
    myCharts.anio = new Chart(document.getElementById('chartAnio'), {
      type: 'bar',
      data: { labels: cAnio.map(s => s[0]), datasets: [{ data: cAnio.map(s => s[1] / 1e6), backgroundColor: COLORES.v2, borderRadius: 6 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => `$${v}M` } } } }
    });
  } else {
    document.getElementById('card-anio').style.display = 'none';
  }

  const cBCount = Object.entries(barrioCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (cBCount.length) {
    myCharts.bCount = new Chart(document.getElementById('chartBarrios'), {
      type: 'bar',
      data: { labels: cBCount.map(s => s[0]), datasets: [{ data: cBCount.map(s => s[1]), backgroundColor: COLORES.v2, borderRadius: 4 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } } }
    });
  }

  // ── Barras de barrios (HTML) ───────────────────────────────────────────
  const bPpto  = Object.entries(dataBarrio).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxB   = bPpto[0]?.[1] || 1;
  document.getElementById('barriosBars').innerHTML = bPpto.length
    ? bPpto.map(b => `
        <div class="barrio-bar-item">
          <div class="barrio-bar-top">
            <span class="barrio-bar-name">${b[0]}</span>
            <span class="barrio-bar-val">$${Math.round(b[1] / 1e6).toLocaleString('es-CO')}M</span>
          </div>
          <div class="barrio-bar-track"><div class="barrio-bar-fill" style="width:${(b[1] / maxB * 100)}%"></div></div>
        </div>`).join('')
    : '<p class="no-data-text">No hay datos para este año</p>';

  // ── Tabla de ejecución ─────────────────────────────────────────────────
  const tb        = document.getElementById('proyectosTable');
  const ejecucion = proyectos.filter(p => p.estado.toLowerCase().includes('ejecuc') && p.presupuesto > 0);

  tb.innerHTML = ejecucion.length
    ? ejecucion.sort((a, b) => b.presupuesto - a.presupuesto).slice(0, 12).map(p => `
        <tr>
          <td><strong>${p.secretaria}</strong></td>
          <td>${p.tipo}</td><td>${p.nombre}</td><td>${p.barrio}</td><td>${p.año}</td>
          <td><strong>$${Math.round(p.presupuesto / 1e6).toLocaleString('es-CO')}M</strong></td>
          <td><span class="avance-val">${p.avance}%</span></td>
        </tr>`).join('')
    : `<tr><td colspan="7" class="empty-td">No hay proyectos en ejecución reportados para esta selección.</td></tr>`;
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
