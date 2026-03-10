Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;

// ── COLORES ──────────────────────────────────────────────────────────────────
const COLORES_SEC = [
  '#003087','#1565C0','#C1272D','#E6A800','#9B59B6',
  '#0277BD','#E67E22','#E74C3C','#F1C40F','#1ABC9C','#34495E','#FF7043','#7986CB'
];

const ESTADO_COLORS = {
  'Terminado':        '#4CAF50',
  'En alistamiento':  '#0277BD',
  'En ejecución':     '#E67E22',
  'Proyectado':       '#9B59B6',
  'Suspendido':       '#E74C3C',
  'Inaugurado':       '#F1C40F'
};

// ── ESTADO GLOBAL ────────────────────────────────────────────────────────────
let _allData      = null;
let _visibleData  = [];   // todas las filas visibles en tabla (para modal)
let currentSec  = 'all';
let currentEst  = 'all';
let currentTipo = 'all';
let myCharts    = {};

// ── DRILL-DOWN Y EXPANSIÓN ────────────────────────────────────────────────────
function applyDrillFilter(type, value) {
  if (type === 'sec') {
    currentSec = value;
    document.getElementById('select-sec').value = value;
  } else if (type === 'estado') {
    currentEst = value;
    document.querySelectorAll('.toggle-btn[data-estado]').forEach(b =>
      b.classList.toggle('active', b.dataset.estado === value)
    );
  } else if (type === 'tipo') {
    currentTipo = value;
    document.getElementById('select-tipo').value = value;
  }
  const label   = type === 'sec' ? shortSec(value) : value;
  const typeStr = type === 'sec' ? 'Secretaría' : type === 'estado' ? 'Estado' : 'Tipo';
  document.getElementById('filtro-drill-texto').innerHTML =
    `<strong>${typeStr}:</strong> ${esc(label)}`;
  document.getElementById('filtro-drill-bar').style.display = '';
  renderDashboard();
}

function openExpandChart(key, title) {
  const chart = myCharts[key];
  if (!chart) return;
  document.getElementById('expand-chart-title').textContent = title;
  document.getElementById('expand-chart-img').src = chart.toBase64Image();
  document.getElementById('chart-expand-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeExpandChart() {
  document.getElementById('chart-expand-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ── UTILIDADES ───────────────────────────────────────────────────────────────
function shortSec(s) {
  if (!s) return '-';
  return s
    .replace('Secretaría de ', '')
    .replace('Secretaría del ', '')
    .replace('Departamento Administrativo de Gestión del Medio Ambiente', 'DAGMA')
    .replace('Unidad Administrativa Especial de Gestión de Bienes y Servicios', 'U.A.E. Bienes');
}

function fmtM(val) {
  return '$' + Math.round(val / 1e6).toLocaleString('es-CO') + 'M';
}

function fmtMM(val) {
  const mm = val / 1e9;
  return '$' + (mm >= 100 ? Math.round(mm) : mm.toFixed(1)).toLocaleString('es-CO') + ' mil mill.';
}

// ── FILTRADO ─────────────────────────────────────────────────────────────────
function applyFilters(data) {
  return data.filter(r => {
    if (currentSec  !== 'all' && r.nombre_centro_gestor !== currentSec)  return false;
    if (currentEst  !== 'all' && r.estado               !== currentEst)  return false;
    if (currentTipo !== 'all' && r.tipo_intervencion     !== currentTipo) return false;
    return true;
  });
}

// ── UTILIDAD ANTI-XSS ────────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── RENDER PRINCIPAL ─────────────────────────────────────────────────────────
function renderDashboard() {
  if (!_allData) return;
  const data = applyFilters(_allData);

  // ── Agregaciones ────────────────────────────────────────────────────────────
  const porEstado          = {};
  const porSec             = {};
  const porTipo            = {};
  const porComuna          = {};
  const porComunaCount     = {};
  const porFuente          = {};
  const porAnio            = {};
  const secEstadoMap       = {};
  const secAnioMap         = {};
  const secBudgetEstadoMap = {};   // presupuesto por secretaría × estado (para 100% stacked)
  const comunaAlertaMap    = {};   // { total, alerta } por comuna (para tasa de riesgo)
  let   inversion          = 0;

  data.forEach(r => {
    const ppto = r.presupuesto_base || 0;
    inversion += ppto;

    porEstado[r.estado]            = (porEstado[r.estado]            || 0) + 1;
    porSec[r.nombre_centro_gestor] = (porSec[r.nombre_centro_gestor] || 0) + ppto;
    porTipo[r.tipo_intervencion]   = (porTipo[r.tipo_intervencion]   || 0) + 1;

    if (r.comuna_corregimiento) {
      porComuna[r.comuna_corregimiento]      = (porComuna[r.comuna_corregimiento]      || 0) + ppto;
      porComunaCount[r.comuna_corregimiento] = (porComunaCount[r.comuna_corregimiento] || 0) + 1;
    }
    if (r.fuente_financiacion) {
      porFuente[r.fuente_financiacion] = (porFuente[r.fuente_financiacion] || 0) + ppto;
    }

    const anio = r.fecha_inicio ? r.fecha_inicio.substring(0, 4) : null;
    const anioNum = anio ? parseInt(anio, 10) : null;
    if (anioNum && anioNum >= 2020 && anioNum <= 2030) porAnio[anio] = (porAnio[anio] || 0) + 1;

    const sec = shortSec(r.nombre_centro_gestor) || 'Sin dato';
    const est = r.estado || 'Sin dato';
    if (!secEstadoMap[sec]) secEstadoMap[sec] = {};
    secEstadoMap[sec][est] = (secEstadoMap[sec][est] || 0) + 1;

    if (anioNum && anioNum >= 2020 && anioNum <= 2030) {
      if (!secAnioMap[sec]) secAnioMap[sec] = {};
      secAnioMap[sec][anio] = (secAnioMap[sec][anio] || 0) + 1;
    }

    // Salud presupuestal por secretaría × estado
    if (!secBudgetEstadoMap[sec]) secBudgetEstadoMap[sec] = {};
    secBudgetEstadoMap[sec][est] = (secBudgetEstadoMap[sec][est] || 0) + ppto;

    // Tasa de alerta por comuna
    if (r.comuna_corregimiento) {
      if (!comunaAlertaMap[r.comuna_corregimiento]) comunaAlertaMap[r.comuna_corregimiento] = { total: 0, alerta: 0 };
      comunaAlertaMap[r.comuna_corregimiento].total++;
      if (est === 'Suspendido' || est === 'En alistamiento') comunaAlertaMap[r.comuna_corregimiento].alerta++;
    }
  });

  const total       = data.length;
  const terminados  = porEstado['Terminado']       || 0;
  const ejecucion   = porEstado['En ejecución']    || 0;
  const alistam     = porEstado['En alistamiento'] || 0;
  const suspendidos = (porEstado['Suspendido'] || 0) + (porEstado['Proyectado'] || 0) + (porEstado['Inaugurado'] || 0);
  const pctTerm     = total ? (terminados / total * 100).toFixed(1) : 0;

  // ── KPIs ────────────────────────────────────────────────────────────────────
  document.getElementById('kpi-total').textContent    = total.toLocaleString('es-CO');
  document.getElementById('kpi-inversion').textContent = fmtMM(inversion);
  document.getElementById('stat-total').textContent   = total.toLocaleString('es-CO');
  document.getElementById('stat-alistamiento').textContent = alistam;
  document.getElementById('stat-ejecucion').textContent   = ejecucion;
  document.getElementById('stat-terminado').textContent   = terminados;
  document.getElementById('stat-otros').textContent       = suspendidos;

  // ── Banner ──────────────────────────────────────────────────────────────────
  const banner = document.getElementById('alert-banner');
  if ((porEstado['Suspendido'] || 0) > 0) {
    banner.innerHTML = `⚠️ ALERTA: ${porEstado['Suspendido']} intervenciones SUSPENDIDAS · ${pctTerm}% terminadas de ${total.toLocaleString('es-CO')} registros`;
    banner.style.background = '#8B0000';
  } else {
    banner.innerHTML = `✅ ${total.toLocaleString('es-CO')} intervenciones filtradas · ${pctTerm}% terminadas · Inversión total: ${fmtMM(inversion)} COP`;
    banner.style.background = '#003087';
  }

  // ── Top 5: Proyectos Críticos Suspendidos ───────────────────────────────────
  const top5Susp = [...data]
    .filter(r => r.estado === 'Suspendido')
    .sort((a, b) => b.presupuesto_base - a.presupuesto_base)
    .slice(0, 5);
  const alertasEl = document.getElementById('alertas-criticas');
  if (alertasEl) {
    alertasEl.innerHTML = top5Susp.length
      ? top5Susp.map(r => `
          <div class="alerta-card">
            <div class="alerta-card-header">
              <span class="pill pill-susp">Suspendido</span>
              <span class="alerta-card-sec">${esc(shortSec(r.nombre_centro_gestor))}</span>
            </div>
            <div class="alerta-card-tipo">${esc(r.tipo_intervencion) || '-'}</div>
            <div class="alerta-card-meta">${esc(r.comuna_corregimiento) || 'Sin dato'}</div>
            <div class="alerta-card-presupuesto">${fmtM(r.presupuesto_base)}</div>
          </div>`).join('')
      : `<p style="color:var(--gris-light);font-size:13px;padding:8px 0">No hay intervenciones suspendidas en la selección actual.</p>`;
  }

  // ── Destruir gráficos anteriores ────────────────────────────────────────────
  Object.values(myCharts).forEach(c => c && c.destroy());
  myCharts = {};

  // ── Gráfica: Inversión por Secretaría ───────────────────────────────────────
  const cSec = Object.entries(porSec).sort((a, b) => b[1] - a[1]);
  if (cSec.length) {
    myCharts.sec = new Chart(document.getElementById('chartSecretaria'), {
      type: 'bar',
      data: {
        labels: cSec.map(s => shortSec(s[0])),
        datasets: [{
          data: cSec.map(s => +(s[1] / 1e9).toFixed(2)),
          backgroundColor: COLORES_SEC.slice(0, cSec.length),
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { callback: v => `$${v} MM` } } },
        onClick: (_evt, elements) => {
          if (!elements.length) return;
          applyDrillFilter('sec', cSec[elements[0].index][0]);
        }
      }
    });
    const totalInv   = cSec.reduce((s, [, v]) => s + v, 0);
    const pctSecTop  = totalInv ? (cSec[0][1] / totalInv * 100).toFixed(0) : 0;
    document.getElementById('insight-sec').innerHTML =
      `<span class="ci-label">Mayor inversión:</span> <strong>${shortSec(cSec[0][0])}</strong> · <strong>${fmtMM(cSec[0][1])}</strong> · <em>${pctSecTop}% del total filtrado</em>`;
  }

  // ── Gráfica: Donut por Estado ────────────────────────────────────────────────
  const estLabels = Object.keys(porEstado);
  if (estLabels.length) {
    myCharts.est = new Chart(document.getElementById('chartEstado'), {
      type: 'doughnut',
      data: {
        labels: estLabels,
        datasets: [{
          data: estLabels.map(e => porEstado[e]),
          backgroundColor: estLabels.map(e => ESTADO_COLORS[e] || '#90A4AE')
        }]
      },
      options: {
        cutout: '65%',
        plugins: { legend: { position: 'bottom' } },
        onClick: (_evt, elements) => {
          if (!elements.length) return;
          applyDrillFilter('estado', estLabels[elements[0].index]);
        }
      }
    });
    const topEst    = estLabels.reduce((max, e) => porEstado[e] > porEstado[max] ? e : max, estLabels[0]);
    const pctTopEst = total ? (porEstado[topEst] / total * 100).toFixed(0) : 0;
    document.getElementById('insight-estado').innerHTML =
      `<span class="ci-label">Estado predominante:</span> <strong>${topEst}</strong> · <strong>${porEstado[topEst].toLocaleString('es-CO')}</strong> intervenciones · <em>${pctTopEst}% del total</em>`;
  }

  // ── Gráfica: Tasa de Alerta por Comuna ──────────────────────────────────────
  const comunaAlertaArr = Object.entries(comunaAlertaMap)
    .map(([name, d]) => ({ name, tasa: d.total >= 3 ? +(d.alerta / d.total * 100).toFixed(1) : 0, total: d.total, alerta: d.alerta }))
    .filter(d => d.total >= 3)
    .sort((a, b) => b.tasa - a.tasa)
    .slice(0, 15);
  if (comunaAlertaArr.length) {
    const alertaColors = comunaAlertaArr.map(d =>
      d.tasa > 50 ? '#E74C3C' : d.tasa > 30 ? '#E67E22' : '#2E7D52'
    );
    myCharts.comunas = new Chart(document.getElementById('chartComunas'), {
      type: 'bar',
      data: {
        labels: comunaAlertaArr.map(d => d.name),
        datasets: [{
          label: '% en Alistamiento o Suspendido',
          data: comunaAlertaArr.map(d => d.tasa),
          backgroundColor: alertaColors,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const d = comunaAlertaArr[ctx.dataIndex];
                return `${ctx.parsed.x}% en alerta (${d.alerta} de ${d.total} intervenciones)`;
              }
            }
          }
        },
        scales: {
          x: { max: 100, ticks: { callback: v => `${v}%` }, grid: { color: 'rgba(0,0,0,0.04)' } },
          y: { grid: { display: false } }
        }
      }
    });
    const topAlerta   = comunaAlertaArr[0];
    const zonasRojas  = comunaAlertaArr.filter(d => d.tasa > 50).length;
    const zonasNaranjas = comunaAlertaArr.filter(d => d.tasa > 30 && d.tasa <= 50).length;
    document.getElementById('insight-comunas').innerHTML =
      `<span class="ci-label">Mayor alerta:</span> <strong>${topAlerta.name}</strong> · <strong style="color:#E74C3C">${topAlerta.tasa}%</strong> sin ejecutar` +
      ` · <em>${zonasRojas} zona${zonasRojas !== 1 ? 's' : ''} crítica${zonasRojas !== 1 ? 's' : ''} (>50%) · ${zonasNaranjas} en vigilancia (30–50%)</em>`;
  }

  // ── Gráfica: Conteo por Tipo de Intervención ─────────────────────────────────
  const cTipo = Object.entries(porTipo).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (cTipo.length) {
    myCharts.tipo = new Chart(document.getElementById('chartTipo'), {
      type: 'bar',
      data: {
        labels: cTipo.map(s => s[0]),
        datasets: [{ data: cTipo.map(s => s[1]), backgroundColor: '#E6A800', borderRadius: 4 }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { grid: { color: 'rgba(0,0,0,0.04)' } } },
        onClick: (_evt, elements) => {
          if (!elements.length) return;
          applyDrillFilter('tipo', cTipo[elements[0].index][0]);
        }
      }
    });
    const pctTipo = total ? (cTipo[0][1] / total * 100).toFixed(0) : 0;
    document.getElementById('insight-tipo').innerHTML =
      `<span class="ci-label">Dominante:</span> <strong>${cTipo[0][0]}</strong> · <strong>${cTipo[0][1].toLocaleString('es-CO')}</strong> intervenciones · <em>${pctTipo}% del total filtrado</em>`;
  }

  // ── Gráfica: Salud de la Cartera por Secretaría (100% budget stacked) ──────────
  const secBudgetLabels = Object.keys(secBudgetEstadoMap).sort((a, b) => {
    const totA = Object.values(secBudgetEstadoMap[a]).reduce((s, v) => s + v, 0);
    const totB = Object.values(secBudgetEstadoMap[b]).reduce((s, v) => s + v, 0);
    return totB - totA;
  });
  const estadosOrden = ['Terminado','Inaugurado','En ejecución','En alistamiento','Proyectado','Suspendido'];
  const ESTADO_COLORS_PCT = {
    'Terminado': '#4CAF50', 'Inaugurado': '#F1C40F',
    'En ejecución': '#0277BD', 'En alistamiento': '#9B59B6',
    'Proyectado': '#90A4AE', 'Suspendido': '#E74C3C'
  };
  const estadoSet2 = new Set(data.map(r => r.estado).filter(Boolean));
  const estadosPresentes = [
    ...estadosOrden.filter(e => estadoSet2.has(e)),
    ...[...estadoSet2].filter(e => !estadosOrden.includes(e))
  ];
  if (secBudgetLabels.length) {
    myCharts.secEst = new Chart(document.getElementById('chartSecEstado'), {
      type: 'bar',
      data: {
        labels: secBudgetLabels,
        datasets: estadosPresentes.map(est => ({
          label: est,
          data: secBudgetLabels.map(sec => {
            const tot = Object.values(secBudgetEstadoMap[sec]).reduce((s, v) => s + v, 0);
            return tot ? +((secBudgetEstadoMap[sec][est] || 0) / tot * 100).toFixed(1) : 0;
          }),
          backgroundColor: ESTADO_COLORS_PCT[est] || '#90A4AE',
          borderRadius: 2
        }))
      },
      options: {
        indexAxis: 'y',
        layout: { padding: { right: 8 } },
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 14, padding: 16 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const sec = secBudgetLabels[ctx.dataIndex];
                const est = ctx.dataset.label;
                const val = secBudgetEstadoMap[sec]?.[est] || 0;
                const tot = Object.values(secBudgetEstadoMap[sec]).reduce((s, v) => s + v, 0);
                return `${est}: ${ctx.parsed.x}%  (${fmtM(val)} de ${fmtM(tot)})`;
              }
            }
          }
        },
        scales: {
          x: { stacked: true, max: 100, ticks: { callback: v => `${v}%` }, grid: { color: 'rgba(0,0,0,0.04)' } },
          y: { stacked: true, ticks: { font: { size: 12 } } }
        }
      }
    });
    // Insight: mayor riesgo por presupuesto suspendido
    const riesgos = secBudgetLabels.map(sec => {
      const tot  = Object.values(secBudgetEstadoMap[sec]).reduce((s, v) => s + v, 0);
      const susp = secBudgetEstadoMap[sec]['Suspendido'] || 0;
      const term = (secBudgetEstadoMap[sec]['Terminado'] || 0) + (secBudgetEstadoMap[sec]['Inaugurado'] || 0);
      return { sec, pctSusp: tot ? +(susp / tot * 100).toFixed(0) : 0, pctTerm: tot ? +(term / tot * 100).toFixed(0) : 0 };
    });
    const topRiesgo = riesgos.sort((a, b) => b.pctSusp - a.pctSusp)[0];
    const topTerm   = [...riesgos].sort((a, b) => b.pctTerm - a.pctTerm)[0];
    document.getElementById('insight-secest').innerHTML =
      `<span class="ci-label">Mayor avance:</span> <strong>${topTerm.sec}</strong> · <strong>${topTerm.pctTerm}%</strong> del presupuesto terminado/inaugurado` +
      (topRiesgo.pctSusp > 5
        ? ` · <strong style="color:#E74C3C">⚠ ${topRiesgo.sec}: ${topRiesgo.pctSusp}% suspendido</strong>`
        : '');
  }

  // ── Gráfica: Fuente de Financiación ─────────────────────────────────────────
  const cFuente = Object.entries(porFuente).sort((a, b) => b[1] - a[1]);
  if (cFuente.length) {
    const totalFuente = cFuente.reduce((s, [, v]) => s + v, 0);
    const pctFuente   = totalFuente ? (cFuente[0][1] / totalFuente * 100).toFixed(0) : 0;
    document.getElementById('insight-fuente').innerHTML =
      `<span class="ci-label">Principal:</span> <strong>${cFuente[0][0]}</strong> · <strong>${fmtMM(cFuente[0][1])}</strong> · <em>${pctFuente}% de la inversión con fuente registrada</em>`;
    myCharts.fuente = new Chart(document.getElementById('chartFuente'), {
      type: 'bar',
      data: {
        labels: cFuente.map(s => s[0]),
        datasets: [{
          data: cFuente.map(s => +(s[1] / 1e9).toFixed(2)),
          backgroundColor: COLORES_SEC.slice(0, cFuente.length),
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { callback: v => `$${v} MM` } } }
      }
    });
  }

  // ── Gráfica: Intervenciones por Año de Inicio ─────────────────────────────────
  const cAnio = Object.entries(porAnio).sort((a, b) => a[0].localeCompare(b[0]));
  if (cAnio.length) {
    myCharts.anio = new Chart(document.getElementById('chartAnio'), {
      type: 'bar',
      data: {
        labels: cAnio.map(s => s[0]),
        datasets: [{
          data: cAnio.map(s => s[1]),
          backgroundColor: COLORES_SEC.slice(0, cAnio.length),
          borderRadius: 6
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
          x: { grid: { display: false } }
        }
      }
    });
    const topAnio    = cAnio.reduce((max, cur) => cur[1] > max[1] ? cur : max, cAnio[0]);
    const totalAnio  = cAnio.reduce((s, [, v]) => s + v, 0);
    const pctAnio    = totalAnio ? (topAnio[1] / totalAnio * 100).toFixed(0) : 0;
    document.getElementById('insight-anio').innerHTML =
      `<span class="ci-label">Año pico:</span> <strong>${topAnio[0]}</strong> · <strong>${topAnio[1].toLocaleString('es-CO')}</strong> intervenciones · <em>${pctAnio}% de las fechas registradas</em>`;
  }

  // ── Gráfica: Tendencia por Secretaría (línea multi-serie) ───────────────────
  const LINE_COLORS = ['#003087','#C1272D','#E6A800','#9B59B6','#1ABC9C','#E67E22'];
  const aniosDisp   = [...new Set(Object.values(secAnioMap).flatMap(m => Object.keys(m)))].sort();
  const top6Secs    = Object.entries(secAnioMap)
    .map(([sec, anios]) => [sec, Object.values(anios).reduce((s, v) => s + v, 0)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([sec]) => sec);

  if (aniosDisp.length && top6Secs.length) {
    myCharts.tendencia = new Chart(document.getElementById('chartTendencia'), {
      type: 'line',
      data: {
        labels: aniosDisp,
        datasets: top6Secs.map((sec, i) => ({
          label: sec,
          data: aniosDisp.map(a => (secAnioMap[sec] && secAnioMap[sec][a]) || 0),
          borderColor: LINE_COLORS[i],
          backgroundColor: LINE_COLORS[i] + '18',
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.4,
          fill: false
        }))
      },
      options: {
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 14, padding: 16 } }
        },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,0.04)' } },
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.04)' } }
        },
        interaction: { mode: 'index', intersect: false }
      }
    });
    const topTend   = top6Secs[0];
    const totalTend = Object.values(secAnioMap[topTend] || {}).reduce((s, v) => s + v, 0);
    const peakYear  = Object.entries(secAnioMap[topTend] || {}).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('insight-tendencia').innerHTML =
      `<span class="ci-label">Mayor actividad:</span> <strong>${topTend}</strong> · pico en <strong>${peakYear?.[0] || '-'}</strong> con <strong>${peakYear?.[1] || 0}</strong> intervenciones · <em>${totalTend} en total</em>`;
  }

  // ── Curva S: Planeado vs Real (macro distrital por trimestre) ────────────────
  const conFechas = data.filter(r => r.fecha_fin && /^\d{4}-\d{2}/.test(r.fecha_fin));
  if (conFechas.length > 10) {
    // Generar etiquetas trimestrales 2021-Q1 → 2027-Q4
    const quarters = [];
    for (let y = 2021; y <= 2027; y++) {
      for (let q = 1; q <= 4; q++) {
        quarters.push({ label: `${y}-Q${q}`, date: new Date(y, q * 3, 0) });
      }
    }

    const totalFin = conFechas.length;
    const planeadoData = quarters.map(({ date }) =>
      +(conFechas.filter(r => new Date(r.fecha_fin) <= date).length / totalFin * 100).toFixed(1)
    );
    const realData = quarters.map(({ date }) =>
      +(conFechas.filter(r =>
        (r.estado === 'Terminado' || r.estado === 'Inaugurado') && new Date(r.fecha_fin) <= date
      ).length / totalFin * 100).toFixed(1)
    );

    myCharts.curvaS = new Chart(document.getElementById('chartCurvaS'), {
      type: 'line',
      data: {
        labels: quarters.map(q => q.label),
        datasets: [
          {
            label: 'Planeado (%)',
            data: planeadoData,
            borderColor: '#003087',
            backgroundColor: 'rgba(0,48,135,0.07)',
            borderWidth: 2.5,
            pointRadius: 2,
            tension: 0.4,
            fill: true
          },
          {
            label: 'Real Ejecutado (%)',
            data: realData,
            borderColor: '#2E7D52',
            backgroundColor: 'rgba(46,125,82,0.07)',
            borderWidth: 2.5,
            pointRadius: 2,
            tension: 0.4,
            fill: false,
            segment: {
              borderColor: ctx => {
                const i = ctx.p0DataIndex;
                const gap = planeadoData[i] - realData[i];
                return gap > 8 ? '#E74C3C' : '#2E7D52';
              }
            }
          }
        ]
      },
      options: {
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 14, padding: 16 } },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              afterBody: items => {
                const plan = items.find(i => i.datasetIndex === 0);
                const real = items.find(i => i.datasetIndex === 1);
                if (plan && real) {
                  const gap = (plan.parsed.y - real.parsed.y).toFixed(1);
                  return [`Gap: ${gap > 0 ? '+' : ''}${gap}%`];
                }
                return [];
              }
            }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { maxTicksLimit: 14 } },
          y: { beginAtZero: true, max: 100, ticks: { callback: v => `${v}%` }, grid: { color: 'rgba(0,0,0,0.04)' } }
        },
        interaction: { mode: 'index', intersect: false }
      }
    });

    // Brecha en el trimestre más cercano a hoy
    const today = new Date();
    const nowIdx = quarters.findIndex(q => q.date >= today);
    const refIdx = nowIdx >= 0 ? nowIdx : quarters.length - 1;
    const gapNum = +(planeadoData[refIdx] - realData[refIdx]).toFixed(1);
    document.getElementById('insight-curvaS').innerHTML =
      `<span class="ci-label">Brecha actual (${quarters[refIdx].label}):</span> Planeado <strong>${planeadoData[refIdx]}%</strong> · Real <strong>${realData[refIdx]}%</strong> · Gap <strong style="color:${gapNum > 8 ? '#E74C3C' : gapNum > 0 ? '#E67E22' : '#2E7D52'}">${gapNum > 0 ? '+' : ''}${gapNum}%</strong> · <em>${totalFin} registros con fecha fin registrada</em>`;
  }

  // ── Tabla ────────────────────────────────────────────────────────────────────
  const sorted = [...data].sort((a, b) => b.presupuesto_base - a.presupuesto_base);
  _visibleData = sorted;
  const tb  = document.getElementById('intervencionesTable');
  const countEl = document.getElementById('tabla-count');
  if (countEl) countEl.textContent = sorted.length.toLocaleString('es-CO');

  tb.innerHTML = sorted.length
    ? sorted.map((p, i) => {
        const est = p.estado || '';
        const cls = est === 'En ejecución' ? 'pill-ej'
                  : est === 'Terminado'    ? 'pill-term'
                  : est === 'Suspendido'   ? 'pill-susp'
                  : est === 'Inaugurado'   ? 'pill-inag'
                  :                          'pill-alist';
        const nodat = '<span style="color:#90A4AE">Sin dato</span>';
        return `<tr data-idx="${i}">
          <td><strong>${esc(shortSec(p.nombre_centro_gestor))}</strong></td>
          <td class="col-opt">${esc(p.clase_up) || '-'}</td>
          <td>${esc(p.tipo_intervencion) || '-'}</td>
          <td>${esc(p.comuna_corregimiento) || nodat}</td>
          <td class="col-opt">${esc(p.barrio_vereda) || nodat}</td>
          <td class="col-opt">${esc(p.fecha_inicio) || '-'}</td>
          <td class="col-opt">${esc(p.fecha_fin) || '-'}</td>
          <td><strong>${fmtM(p.presupuesto_base)}</strong></td>
          <td><span class="pill ${cls}">${esc(est)}</span></td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="9" class="empty-td">No hay intervenciones para la selección actual.</td></tr>`;
}

// ── FORMATO FECHA CORTE ───────────────────────────────────────────────────────
function fmtCorte(iso) {
  if (!iso) return '';
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const parts = iso.split('-');
  if (parts.length < 2) return iso;
  const [y, m] = parts;
  const idx = parseInt(m, 10) - 1;
  return (idx >= 0 && idx < 12) ? `${meses[idx]} ${y}` : iso;
}

// ── INICIALIZACIÓN ───────────────────────────────────────────────────────────
async function initData() {
  try {
    const [resData, resMeta] = await Promise.all([
      fetch('../data/intervenciones.json'),
      fetch('../data/intervenciones_meta.json').catch(() => null)
    ]);
    if (!resData.ok) throw new Error(`HTTP ${resData.status}: no se pudo cargar intervenciones.json`);
    _allData = await resData.json();

    // Actualizar textos dinámicos con meta
    if (resMeta && resMeta.ok) {
      const meta = await resMeta.json();
      const corteStr = fmtCorte(meta.corte);
      const el = document.getElementById('hero-date');
      if (el) el.textContent = `// FUENTE: SECRETARÍAS DISTRITALES · CORTE: ${corteStr.toUpperCase()} · ${meta.registros.toLocaleString('es-CO')} REGISTROS`;
      const badge = document.getElementById('footer-corte-badge');
      if (badge) badge.textContent = `2024–2027 · Corte: ${corteStr}`;
      const reg = document.getElementById('footer-registros');
      if (reg) reg.textContent = `${meta.registros.toLocaleString('es-CO')} registros de intervenciones. ${meta.sin_ubicacion.toLocaleString('es-CO')} sin dato de ubicación.`;
    }

    // Poblar selects con opciones dinámicas
    const secs  = [...new Set(_allData.map(r => r.nombre_centro_gestor))].filter(Boolean).sort();
    const tipos = [...new Set(_allData.map(r => r.tipo_intervencion))].filter(Boolean).sort();

    const selSec  = document.getElementById('select-sec');
    const selTipo = document.getElementById('select-tipo');

    secs.forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = shortSec(s);
      selSec.appendChild(o);
    });

    tipos.forEach(t => {
      const o = document.createElement('option');
      o.value = t; o.textContent = t;
      selTipo.appendChild(o);
    });

    renderDashboard();
  } catch (err) {
    console.error('Error cargando intervenciones.json:', err);
    document.getElementById('alert-banner').textContent = '❌ Error cargando datos. Verifique la ruta del archivo.';
  }
}

// ── LISTENERS ────────────────────────────────────────────────────────────────
document.getElementById('select-sec').addEventListener('change', e => {
  currentSec = e.target.value;
  renderDashboard();
});

document.getElementById('select-tipo').addEventListener('change', e => {
  currentTipo = e.target.value;
  renderDashboard();
});

document.querySelectorAll('.toggle-btn[data-estado]').forEach(btn => {
  btn.addEventListener('click', e => {
    document.querySelectorAll('.toggle-btn[data-estado]').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentEst = e.target.dataset.estado;
    renderDashboard();
  });
});

initData();

// ── MODAL ─────────────────────────────────────────────────────────────────────
function badgeClass(estado) {
  if (!estado) return 'est-otro';
  const e = estado.toLowerCase();
  if (e.includes('ejecución') || e.includes('ejecucion')) return 'est-ejecucion';
  if (e.includes('terminado'))    return 'est-terminado';
  if (e.includes('alistamiento')) return 'est-alistamiento';
  if (e.includes('suspendido'))   return 'est-suspendido';
  if (e.includes('inaugurado'))   return 'est-inaugurado';
  return 'est-otro';
}

function showModal(p) {
  const overlay = document.getElementById('modal-overlay');

  document.getElementById('modal-estado-badge').textContent = p.estado || 'Sin estado';
  document.getElementById('modal-estado-badge').className   = `modal-badge ${badgeClass(p.estado)}`;
  document.getElementById('modal-title').textContent        = p.tipo_intervencion || 'Intervención';
  document.getElementById('modal-secretaria').textContent   = p.nombre_centro_gestor || '-';

  document.getElementById('md-id').textContent         = p.intervencion_id || '-';
  document.getElementById('md-upid').textContent       = p.upid || '-';
  document.getElementById('md-clase').textContent      = p.clase_up || '-';
  document.getElementById('md-tipo').textContent       = p.tipo_intervencion || '-';
  document.getElementById('md-fuente').textContent     = p.fuente_financiacion || '-';
  document.getElementById('md-presupuesto').textContent = p.presupuesto_base
    ? '$' + p.presupuesto_base.toLocaleString('es-CO')
    : '-';
  document.getElementById('md-comuna').textContent     = p.comuna_corregimiento || 'Sin dato';
  document.getElementById('md-barrio').textContent     = p.barrio_vereda || 'Sin dato';
  document.getElementById('md-inicio').textContent     = p.fecha_inicio || '-';
  document.getElementById('md-fin').textContent        = p.fecha_fin || '-';

  // ── Línea de Tiempo del Plazo ─────────────────────────────────────────────
  const tlWrap    = document.getElementById('md-timeline-wrap');
  const tlElapsed = document.getElementById('md-tl-elapsed');
  const tlMarker  = document.getElementById('md-tl-marker');
  const tlStart   = document.getElementById('md-tl-start');
  const tlEnd     = document.getElementById('md-tl-end');
  const tlHoy     = document.getElementById('md-tl-hoy');
  const tlInfo    = document.getElementById('md-tl-info');

  if (p.fecha_inicio && p.fecha_fin) {
    tlWrap.style.display = '';
    const inicio     = new Date(p.fecha_inicio);
    const fin        = new Date(p.fecha_fin);
    const hoy        = new Date();
    const totalMs    = fin - inicio;
    const elapsedMs  = hoy - inicio;
    const pctRaw     = totalMs > 0 ? elapsedMs / totalMs * 100 : 0;
    const pct        = Math.max(0, Math.min(100, pctRaw));
    const diasRest   = Math.round((fin - hoy) / 86400000);
    const terminado  = p.estado === 'Terminado' || p.estado === 'Inaugurado';
    const suspendido = p.estado === 'Suspendido';

    // Colores según situación
    let barColor, markerBorder, infoHtml;
    if (terminado) {
      barColor     = '#4CAF50';
      markerBorder = '#4CAF50';
      infoHtml     = `<span class="tl-ok">✓ Intervención completada</span>`;
      if (p.fecha_inauguracion) infoHtml += ` · Inaugurada: <strong>${p.fecha_inauguracion}</strong>`;
    } else if (hoy < inicio) {
      barColor     = '#90A4AE';
      markerBorder = '#90A4AE';
      const diasInicio = Math.round((inicio - hoy) / 86400000);
      infoHtml = `<span style="color:var(--gris-light)">Plazo aún no iniciado · comienza en <strong>${diasInicio}</strong> día${diasInicio !== 1 ? 's' : ''}</span>`;
    } else if (pctRaw > 100 && !terminado) {
      barColor     = '#C1272D';
      markerBorder = '#C1272D';
      const diasVenc = Math.abs(diasRest);
      infoHtml = `<span class="tl-bad">⚠ Plazo vencido hace ${diasVenc} día${diasVenc !== 1 ? 's' : ''}</span>` +
                 (suspendido ? ` · <em>Intervención suspendida</em>` : '');
    } else if (pct > 80 || suspendido) {
      barColor     = '#E67E22';
      markerBorder = '#E67E22';
      infoHtml = `<span class="tl-warn">${pct.toFixed(0)}% del plazo transcurrido</span>` +
                 ` · <strong>${Math.max(0, diasRest)}</strong> día${diasRest !== 1 ? 's' : ''} restantes` +
                 (suspendido ? ` · <em style="color:var(--rojo)">Suspendida</em>` : '');
    } else {
      barColor     = '#0277BD';
      markerBorder = '#0277BD';
      infoHtml = `<span class="tl-ok">${pct.toFixed(0)}% del plazo transcurrido</span>` +
                 ` · <strong>${diasRest}</strong> día${diasRest !== 1 ? 's' : ''} restantes`;
    }

    tlElapsed.style.width            = `${pct}%`;
    tlElapsed.style.background       = barColor;
    tlMarker.style.left              = `${pct}%`;
    tlMarker.style.borderColor       = markerBorder;
    tlStart.textContent              = p.fecha_inicio;
    tlEnd.textContent                = p.fecha_fin;
    tlHoy.style.left                 = `${pct}%`;
    tlHoy.style.display              = (hoy >= inicio && hoy <= fin) ? '' : 'none';
    tlInfo.innerHTML                 = infoHtml;
  } else {
    tlWrap.style.display = 'none';
  }

  const inagWrap = document.getElementById('md-inauguracion-wrap');
  if (p.fecha_inauguracion) {
    document.getElementById('md-inauguracion').textContent = p.fecha_inauguracion;
    inagWrap.style.display = '';
  } else {
    inagWrap.style.display = 'none';
  }

  const updWrap = document.getElementById('md-updated-wrap');
  if (p.updated_at) {
    document.getElementById('md-updated').textContent = p.updated_at;
    updWrap.style.display = '';
  } else {
    updWrap.style.display = 'none';
  }

  const descWrap = document.getElementById('md-desc-wrap');
  if (p.descripcion_intervencion) {
    document.getElementById('md-desc').textContent = p.descripcion_intervencion;
    descWrap.style.display = '';
  } else {
    descWrap.style.display = 'none';
  }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// Click en fila de tabla
document.getElementById('intervencionesTable').addEventListener('click', e => {
  const tr = e.target.closest('tr[data-idx]');
  if (!tr) return;
  showModal(_visibleData[+tr.dataset.idx]);
});

// Cerrar modal
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeExpandChart();
    closeModal();
  }
});

// ── EXPAND CHART ─────────────────────────────────────────────────────────────
document.querySelectorAll('.chart-expand-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    openExpandChart(btn.dataset.chart, btn.dataset.title || '');
  });
});

document.getElementById('expand-chart-close').addEventListener('click', closeExpandChart);

document.getElementById('chart-expand-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeExpandChart();
});

// ── LIMPIAR FILTRO DRILL-DOWN ─────────────────────────────────────────────────
document.getElementById('filtro-drill-clear').addEventListener('click', () => {
  currentSec  = 'all'; document.getElementById('select-sec').value = 'all';
  currentEst  = 'all';
  document.querySelectorAll('.toggle-btn[data-estado]').forEach(b =>
    b.classList.toggle('active', b.dataset.estado === 'all')
  );
  currentTipo = 'all'; document.getElementById('select-tipo').value = 'all';
  document.getElementById('filtro-drill-bar').style.display = 'none';
  renderDashboard();
});
