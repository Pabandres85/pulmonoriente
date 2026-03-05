Chart.defaults.font.family = "'Inter', sans-serif";
const COLORES = { v1:'#1B4D2E', v2:'#2E7D52', v3:'#4CAF50', v4:'#A5D6A7', ocre:'#F57F17', rojo:'#E74C3C', azul:'#0277BD', lila:'#6A1B9A' };

let globalPts = null;
let globalPoly = null;
let currentMode = 'ups';
let currentAnio = 'all';
let myCharts = {};

function secGroup(s) {
  if (!s) return "Otras";
  if (s.includes("Vivienda") || s.includes("Hábitat")) return "Vivienda";
  if (s.includes("Educación") || s.includes("Educacion")) return "Educación";
  if (s.includes("Salud")) return "Salud";
  if (s.includes("Deporte") || s.includes("Recreación")) return "Deporte";
  if (s.includes("Cultura")) return "Cultura";
  return "Otras";
}

function renderDashboard() {
  const perimetro = globalPoly.features.find(f => f.properties.Name === 'Perimetro Proyecto') || globalPoly.features[0];
  let proyectos = [];
  let totalInversion = 0;

  const dataSec = {}; const dataEst = {'En ejecución':0, 'En alistamiento':0, 'Terminado':0, 'Suspendido':0};
  const dataTipo = {}; const dataBarrio = {}; const barrioCount = {}; const dataAnio = {};

  if (currentMode === 'contratos') {
    globalPts.features.forEach(f => {
      if (!f.geometry || !turf.booleanPointInPolygon(f, perimetro)) return;
      const p = f.properties;
      let yr = (p.año || '2025').toString().trim();
      if(yr === 'null' || yr === '') yr = '2025';

      if(currentAnio !== 'all' && yr !== currentAnio) return;

      let ppto = parseFloat((p.presupuest||'0').toString().replace(/[^0-9\.,]/g, '').replace(/\.00$|,00$/, '').replace(/[\.,]/g, '')) || 0;
      proyectos.push({
        nombre: p.nombre_up, secretaria: secGroup(p.nombre_cen), estado: p.estado || 'Alistamiento',
        tipo: p.tipo_equip || 'Otro', barrio: p.barrio_ver || 'Sin dato', avance: parseFloat(p.avance_obr)||0, presupuesto: ppto, año: yr
      });
    });
  } else {
    const upsMap = new Map();
    globalPts.features.forEach(f => {
      if (!f.geometry || !turf.booleanPointInPolygon(f, perimetro)) return;
      const p = f.properties;
      let yr = (p.año || '2025').toString().trim();
      if(yr === 'null' || yr === '') yr = '2025';

      if(currentAnio !== 'all' && yr !== currentAnio) return;

      let ppto = parseFloat((p.presupuest||'0').toString().replace(/[^0-9\.,]/g, '').replace(/\.00$|,00$/, '').replace(/[\.,]/g, '')) || 0;

      const key = `${p.direccion}_${f.geometry.coordinates[1]}_${f.geometry.coordinates[0]}_${p.tipo_equip}`;

      if (!upsMap.has(key)) {
        upsMap.set(key, {
          nombre: p.nombre_up, secretaria: secGroup(p.nombre_cen), estado: p.estado || 'Alistamiento',
          tipo: p.tipo_equip || 'Otro', barrio: p.barrio_ver || 'Sin dato', avance: parseFloat(p.avance_obr)||0,
          presupuesto: ppto, año: yr
        });
      } else {
        const u = upsMap.get(key);
        if (ppto > u.presupuesto) {
          u.presupuesto = ppto;
          u.año = yr;
        }
        u.avance = Math.max(u.avance, parseFloat(p.avance_obr)||0);
      }
    });
    proyectos = Array.from(upsMap.values());
  }

  // Poblar sumadores
  proyectos.forEach(p => {
    totalInversion += p.presupuesto;
    dataSec[p.secretaria] = (dataSec[p.secretaria] || 0) + p.presupuesto;
    dataTipo[p.tipo] = (dataTipo[p.tipo] || 0) + p.presupuesto;
    dataBarrio[p.barrio] = (dataBarrio[p.barrio] || 0) + p.presupuesto;
    barrioCount[p.barrio] = (barrioCount[p.barrio] || 0) + 1;
    dataAnio[p.año] = (dataAnio[p.año] || 0) + p.presupuesto;

    let est = p.estado.toLowerCase();
    if(est.includes('ejecuc')) dataEst['En ejecución']++;
    else if(est.includes('terminad')) dataEst['Terminado']++;
    else if(est.includes('suspendid')) dataEst['Suspendido']++;
    else dataEst['En alistamiento']++;
  });

  // Actualizar KPIs y stats
  document.getElementById('kpi-count').innerText = proyectos.length;
  document.getElementById('kpi-count-lbl').innerText = currentMode === 'ups' ? 'Frentes Únicos' : 'Contratos Totales';
  document.getElementById('kpi-budget').innerText = '$' + Math.round(totalInversion/1e6).toLocaleString('es-CO') + 'M';
  document.getElementById('stat-total').innerText = proyectos.length;
  document.getElementById('stat-total-lbl').innerText = currentMode === 'ups' ? 'Frentes' : 'Contratos';
  document.getElementById('stat-alistamiento').innerText = dataEst['En alistamiento'];
  document.getElementById('stat-ejecucion').innerText = dataEst['En ejecución'];
  document.getElementById('stat-terminado').innerText = dataEst['Terminado'];
  document.getElementById('stat-suspendido').innerText = dataEst['Suspendido'];

  // Alerta Dinámica
  const alertStrip = document.getElementById('alert-banner');
  const pctAlist = proyectos.length ? ((dataEst['En alistamiento'] / proyectos.length) * 100).toFixed(1) : 0;
  let txtAño = currentAnio === 'all' ? 'todos los años' : `el año ${currentAnio}`;

  if(dataEst['Suspendido'] > 0) {
    alertStrip.innerHTML = `⚠️ ALERTA: ${dataEst['Suspendido']} obras SUSPENDIDAS en ${txtAño} · ${dataEst['En alistamiento']} en alistamiento (${pctAlist}%).`;
    alertStrip.style.background = '#7B3535';
  } else {
    alertStrip.innerHTML = `✅ ${proyectos.length} ${currentMode === 'ups' ? 'frentes' : 'contratos'} filtrados para ${txtAño} · ${pctAlist}% en alistamiento. No hay suspensiones.`;
    alertStrip.style.background = '#1B4D2E';
  }

  // Destruir gráficos anteriores
  Object.keys(myCharts).forEach(k => { if(myCharts[k]) myCharts[k].destroy(); });

  // Crear gráficos
  const cSec = Object.entries(dataSec).sort((a,b)=>b[1]-a[1]);
  if(cSec.length > 0) {
    myCharts.sec = new Chart(document.getElementById('chartSecretaria'), { type: 'bar', data: { labels: cSec.map(s=>s[0]), datasets: [{ data: cSec.map(s=>s[1]/1e6), backgroundColor: [COLORES.v1, COLORES.v2, COLORES.azul, COLORES.v3, COLORES.tierra], borderRadius: 4 }] }, options: { indexAxis: 'y', plugins:{legend:{display:false}}, scales:{x:{ticks:{callback:v=>`$${v}M`}}} } });
  }

  if(proyectos.length > 0) {
    myCharts.est = new Chart(document.getElementById('chartEstado'), { type: 'doughnut', data: { labels: Object.keys(dataEst), datasets: [{ data: Object.values(dataEst), backgroundColor: [COLORES.v3, COLORES.azul, COLORES.v1, COLORES.rojo] }] }, options: { cutout:'65%', plugins:{legend:{position:'bottom'}} } });
  }

  const cTipo = Object.entries(dataTipo).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if(cTipo.length > 0) {
    myCharts.tipo = new Chart(document.getElementById('chartTipo'), { type: 'bar', data: { labels: cTipo.map(s=>s[0]), datasets: [{ data: cTipo.map(s=>s[1]/1e6), backgroundColor: COLORES.v4, borderRadius: 4 }] }, options: { indexAxis: 'y', plugins:{legend:{display:false}}, scales:{x:{ticks:{callback:v=>`$${v}M`}}} } });
  }

  const cAnio = Object.entries(dataAnio).sort((a,b)=>a[0].localeCompare(b[0]));
  if(cAnio.length > 0) {
    document.getElementById('card-anio').style.display = 'block';
    myCharts.anio = new Chart(document.getElementById('chartAnio'), { type: 'bar', data: { labels: cAnio.map(s=>s[0]), datasets: [{ data: cAnio.map(s=>s[1]/1e6), backgroundColor: COLORES.v2, borderRadius: 6 }] }, options: { plugins:{legend:{display:false}}, scales:{y:{ticks:{callback:v=>`$${v}M`}}} } });
  } else {
    document.getElementById('card-anio').style.display = 'none';
  }

  const cBCount = Object.entries(barrioCount).sort((a,b)=>b[1]-a[1]).slice(0,10);
  if(cBCount.length > 0) {
    myCharts.bCount = new Chart(document.getElementById('chartBarrios'), { type: 'bar', data: { labels: cBCount.map(s=>s[0]), datasets: [{ data: cBCount.map(s=>s[1]), backgroundColor: COLORES.v2, borderRadius: 4 }] }, options: { indexAxis: 'y', plugins:{legend:{display:false}} } });
  }

  // Barras de barrios (HTML personalizado)
  const bPpto = Object.entries(dataBarrio).sort((a,b)=>b[1]-a[1]).slice(0,10);
  let htmlB = '';
  if(bPpto.length){
    const maxB = bPpto[0][1];
    bPpto.forEach(b => {
      htmlB += `<div class="barrio-bar-item"><div class="barrio-bar-top"><span class="barrio-bar-name">${b[0]}</span><span class="barrio-bar-val">$${Math.round(b[1]/1e6).toLocaleString('es-CO')}M</span></div><div class="barrio-bar-track"><div class="barrio-bar-fill" style="width:${(b[1]/maxB*100)}%"></div></div></div>`;
    });
  } else {
    htmlB = '<p class="no-data-text">No hay datos para este año</p>';
  }
  document.getElementById('barriosBars').innerHTML = htmlB;

  // Tabla de ejecución
  const tb = document.getElementById('proyectosTable');
  tb.innerHTML = '';
  const ejecucion = proyectos.filter(p=>p.estado.toLowerCase().includes('ejecuc') && p.presupuesto>0);
  if(ejecucion.length > 0) {
    ejecucion.sort((a,b)=>b.presupuesto-a.presupuesto).slice(0,12).forEach(p => {
      tb.innerHTML += `<tr><td><strong>${p.secretaria}</strong></td><td>${p.tipo}</td><td>${p.nombre}</td><td>${p.barrio}</td><td>${p.año}</td><td><strong>$${Math.round(p.presupuesto/1e6).toLocaleString('es-CO')}M</strong></td><td><span class="avance-val">${p.avance}%</span></td></tr>`;
    });
  } else {
    tb.innerHTML = `<tr><td colspan="7" class="empty-td">No hay proyectos en ejecución reportados para esta selección.</td></tr>`;
  }
}

// Inicialización
async function initData() {
  const [resPts, resPoly] = await Promise.all([fetch('../Total_secretarias.geojson'), fetch('../poligonos.geojson')]);
  globalPts = await resPts.json();
  globalPoly = await resPoly.json();
  renderDashboard();
}

// Listeners Toggle Modo
document.querySelectorAll('.toggle-btn[data-modo]').forEach(btn => {
  btn.addEventListener('click', e => {
    document.querySelectorAll('.toggle-btn[data-modo]').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentMode = e.target.dataset.modo;
    renderDashboard();
  });
});

// Listener Selector Año
document.getElementById('select-anio').addEventListener('change', (e) => {
  currentAnio = e.target.value;
  renderDashboard();
});

initData();
