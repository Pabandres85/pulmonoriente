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
  const porEstado      = {};
  const porSec         = {};
  const porTipo        = {};
  const porComuna      = {};
  const porComunaCount = {};
  const porFuente      = {};
  const porAnio        = {};
  const secEstadoMap   = {};
  let   inversion      = 0;

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
        scales: { x: { ticks: { callback: v => `$${v} MM` } } }
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
      options: { cutout: '65%', plugins: { legend: { position: 'bottom' } } }
    });
    const topEst    = estLabels.reduce((max, e) => porEstado[e] > porEstado[max] ? e : max, estLabels[0]);
    const pctTopEst = total ? (porEstado[topEst] / total * 100).toFixed(0) : 0;
    document.getElementById('insight-estado').innerHTML =
      `<span class="ci-label">Estado predominante:</span> <strong>${topEst}</strong> · <strong>${porEstado[topEst].toLocaleString('es-CO')}</strong> intervenciones · <em>${pctTopEst}% del total</em>`;
  }

  // ── Gráfica: Top Comunas (inversión + conteo agrupado) ───────────────────────
  const cComunaAll = Object.entries(porComuna).sort((a, b) => b[1] - a[1]);
  const cComunaTop = cComunaAll.slice(0, 12);
  if (cComunaTop.length) {
    myCharts.comunas = new Chart(document.getElementById('chartComunas'), {
      type: 'bar',
      data: {
        labels: cComunaTop.map(([nom]) => nom),
        datasets: [
          {
            label: 'Inversión (miles mill. COP)',
            data: cComunaTop.map(([, val]) => +(val / 1e9).toFixed(2)),
            backgroundColor: '#003087',
            borderRadius: 4,
            xAxisID: 'x'
          },
          {
            label: 'N° Intervenciones',
            data: cComunaTop.map(([nom]) => porComunaCount[nom] || 0),
            backgroundColor: 'rgba(230,168,0,0.85)',
            borderRadius: 4,
            xAxisID: 'x2'
          }
        ]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
        scales: {
          x:  { position: 'bottom', ticks: { callback: v => `$${v}MM` }, grid: { color: 'rgba(0,0,0,0.04)' } },
          x2: { position: 'top',   grid: { drawOnChartArea: false }, ticks: { color: '#B8860B' } }
        }
      }
    });
    const topCom     = cComunaTop[0];
    const totalCom   = cComunaAll.reduce((s, [, v]) => s + v, 0);
    const pctCom     = totalCom ? (topCom[1] / totalCom * 100).toFixed(0) : 0;
    const topComCnt  = porComunaCount[topCom[0]] || 0;
    document.getElementById('insight-comunas').innerHTML =
      `<span class="ci-label">Mayor inversión:</span> <strong>${topCom[0]}</strong> · <strong>${fmtMM(topCom[1])}</strong> · <strong>${topComCnt.toLocaleString('es-CO')}</strong> intervenciones · <em>${pctCom}% de la inversión territorial</em>`;
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
      options: { indexAxis: 'y', plugins: { legend: { display: false } },
        scales: { x: { grid: { color: 'rgba(0,0,0,0.04)' } } } }
    });
    const pctTipo = total ? (cTipo[0][1] / total * 100).toFixed(0) : 0;
    document.getElementById('insight-tipo').innerHTML =
      `<span class="ci-label">Dominante:</span> <strong>${cTipo[0][0]}</strong> · <strong>${cTipo[0][1].toLocaleString('es-CO')}</strong> intervenciones · <em>${pctTipo}% del total filtrado</em>`;
  }

  // ── Gráfica: Estado por Secretaría (stacked) ─────────────────────────────────
  const secLabels = Object.keys(secEstadoMap).sort((a, b) => {
    const totA = Object.values(secEstadoMap[a]).reduce((s, v) => s + v, 0);
    const totB = Object.values(secEstadoMap[b]).reduce((s, v) => s + v, 0);
    return totB - totA;
  });
  const estadosOrden = ['Terminado','En ejecución','En alistamiento','Proyectado','Inaugurado','Suspendido'];
  const estadoSet2   = new Set(data.map(r => r.estado).filter(Boolean));
  const estadosPresentes = [
    ...estadosOrden.filter(e => estadoSet2.has(e)),
    ...[...estadoSet2].filter(e => !estadosOrden.includes(e))
  ];
  if (secLabels.length) {
    myCharts.secEst = new Chart(document.getElementById('chartSecEstado'), {
      type: 'bar',
      data: {
        labels: secLabels,
        datasets: estadosPresentes.map(est => ({
          label: est,
          data: secLabels.map(sec => (secEstadoMap[sec] && secEstadoMap[sec][est]) || 0),
          backgroundColor: ESTADO_COLORS[est] || '#90A4AE',
          borderRadius: 2
        }))
      },
      options: {
        indexAxis: 'y',
        layout: { padding: { right: 8 } },
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 14, padding: 16 } } },
        scales: {
          x: { stacked: true, grid: { color: 'rgba(0,0,0,0.04)' } },
          y: { stacked: true, ticks: { font: { size: 12 } } }
        }
      }
    });
    const topSec     = secLabels[0];
    const topSecTot  = Object.values(secEstadoMap[topSec]).reduce((s, v) => s + v, 0);
    const topSecTerm = secEstadoMap[topSec]['Terminado'] || 0;
    const pctSecTerm = topSecTot ? (topSecTerm / topSecTot * 100).toFixed(0) : 0;
    document.getElementById('insight-secest').innerHTML =
      `<span class="ci-label">Más intervenciones:</span> <strong>${topSec}</strong> · <strong>${topSecTot.toLocaleString('es-CO')}</strong> intervenciones · <em>${pctSecTerm}% terminadas</em>`;
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
  if (e.key === 'Escape') closeModal();
});
