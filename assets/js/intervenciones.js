Chart.defaults.font.family = "'Inter', sans-serif";

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
let _allData    = null;
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

// ── RENDER PRINCIPAL ─────────────────────────────────────────────────────────
function renderDashboard() {
  const data = applyFilters(_allData);

  // ── Agregaciones ────────────────────────────────────────────────────────────
  const porEstado  = {};
  const porSec     = {};
  const porClase   = {};
  const porTipo    = {};
  const porComuna  = {};
  const porFuente  = {};
  let   inversion  = 0;

  data.forEach(r => {
    const ppto = r.presupuesto_base || 0;
    inversion += ppto;

    porEstado[r.estado]                = (porEstado[r.estado]                || 0) + 1;
    porSec[r.nombre_centro_gestor]     = (porSec[r.nombre_centro_gestor]     || 0) + ppto;
    porClase[r.clase_up]               = (porClase[r.clase_up]               || 0) + ppto;
    porTipo[r.tipo_intervencion]       = (porTipo[r.tipo_intervencion]       || 0) + 1;

    if (r.comuna_corregimiento) {
      porComuna[r.comuna_corregimiento] = (porComuna[r.comuna_corregimiento] || 0) + ppto;
    }
    if (r.fuente_financiacion) {
      porFuente[r.fuente_financiacion]  = (porFuente[r.fuente_financiacion]  || 0) + ppto;
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
  }

  // ── Comunas: barras HTML ─────────────────────────────────────────────────────
  const cComuna = Object.entries(porComuna).sort((a, b) => b[1] - a[1]).slice(0, 14);
  const maxC    = cComuna[0]?.[1] || 1;
  document.getElementById('comunasBars').innerHTML = cComuna.length
    ? cComuna.map(([nom, val]) => `
        <div class="barrio-bar-item">
          <div class="barrio-bar-top">
            <span class="barrio-bar-name">${nom}</span>
            <span class="barrio-bar-val">${fmtMM(val)}</span>
          </div>
          <div class="barrio-bar-track">
            <div class="barrio-bar-fill" style="width:${val / maxC * 100}%"></div>
          </div>
        </div>`).join('')
    : '<p class="no-data-text">Sin datos de ubicación disponibles para esta selección.</p>';

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
  }

  // ── Gráfica: Inversión por Clase UP ─────────────────────────────────────────
  const cClase = Object.entries(porClase).sort((a, b) => b[1] - a[1]);
  if (cClase.length) {
    myCharts.clase = new Chart(document.getElementById('chartClase'), {
      type: 'doughnut',
      data: {
        labels: cClase.map(s => s[0]),
        datasets: [{
          data: cClase.map(s => +(s[1] / 1e9).toFixed(2)),
          backgroundColor: COLORES_SEC.slice(0, cClase.length)
        }]
      },
      options: { cutout: '60%', plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } } }
    });
  }

  // ── Gráfica: Fuente de Financiación ─────────────────────────────────────────
  const cFuente = Object.entries(porFuente).sort((a, b) => b[1] - a[1]);
  if (cFuente.length) {
    myCharts.fuente = new Chart(document.getElementById('chartFuente'), {
      type: 'bar',
      data: {
        labels: cFuente.map(s => s[0]),
        datasets: [{
          data: cFuente.map(s => +(s[1] / 1e9).toFixed(2)),
          backgroundColor: ['#003087', '#1565C0', '#C1272D', '#E6A800', '#9B59B6'],
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

  // ── Tabla ────────────────────────────────────────────────────────────────────
  const top = [...data].sort((a, b) => b.presupuesto_base - a.presupuesto_base).slice(0, 15);
  const tb  = document.getElementById('intervencionesTable');

  tb.innerHTML = top.length
    ? top.map(p => {
        const est  = p.estado || '';
        const cls  = est === 'En ejecución' ? 'pill-ej'
                   : est === 'Terminado'    ? 'pill-term'
                   : est === 'Suspendido'   ? 'pill-susp'
                   : est === 'Inaugurado'   ? 'pill-inag'
                   :                          'pill-alist';
        return `<tr>
          <td><strong>${shortSec(p.nombre_centro_gestor)}</strong></td>
          <td class="col-opt">${p.clase_up || '-'}</td>
          <td>${p.tipo_intervencion || '-'}</td>
          <td>${p.comuna_corregimiento || '<span style="color:#90A4AE">Sin dato</span>'}</td>
          <td class="col-opt">${p.barrio_vereda || '<span style="color:#90A4AE">Sin dato</span>'}</td>
          <td class="col-opt">${p.fecha_inicio || '-'}</td>
          <td class="col-opt">${p.fecha_fin || '-'}</td>
          <td><strong>${fmtM(p.presupuesto_base)}</strong></td>
          <td><span class="pill ${cls}">${est}</span></td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="9" class="empty-td">No hay intervenciones para la selección actual.</td></tr>`;
}

// ── FORMATO FECHA CORTE ───────────────────────────────────────────────────────
function fmtCorte(iso) {
  if (!iso) return '';
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const [y, m] = iso.split('-');
  return `${meses[parseInt(m, 10) - 1]} ${y}`;
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
