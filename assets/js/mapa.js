// ── CONFIGURACIÓN DEL MAPA ──────────────────────────────────────────────────
const map = L.map('map', { zoomControl: true, attributionControl: false }).setView([3.430, -76.488], 14);

const baseLayers = {
  streets:   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, subdomains: 'abc' }),
  satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
  hybrid:    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
};
const labelsLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', pane: 'shadowPane' });
baseLayers.streets.addTo(map);

window.setLayer = function(type) {
  map.eachLayer(layer => { if (layer !== clusters && !layer.feature) map.removeLayer(layer); });
  if (type === 'streets')   baseLayers.streets.addTo(map);
  if (type === 'satellite') baseLayers.satellite.addTo(map);
  if (type === 'hybrid')    { baseLayers.hybrid.addTo(map); labelsLayer.addTo(map); }
  document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + type).classList.add('active');
};

const clusters = L.markerClusterGroup({
  maxClusterRadius: 45, showCoverageOnHover: false,
  iconCreateFunction: c => {
    const n  = c.getChildCount();
    const sz = n < 10 ? 36 : n < 50 ? 44 : 52;
    return L.divIcon({
      html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:rgba(27,77,46,0.95);border:3px solid #4CAF77;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;box-shadow:0 3px 10px rgba(0,0,0,0.4);">${n}</div>`,
      className: '', iconSize: [sz, sz]
    });
  }
});

let globalPerimetro = null;
let allMarkers      = [];
let activeFilter    = 'all';
let activeEstado    = 'all';
let currentMode     = 'ups';
let _data           = null;

// ── FILTRO ──────────────────────────────────────────────────────────────────
function applyFilters() {
  clusters.clearLayers();
  allMarkers.forEach(m => {
    const secOk = activeFilter === 'all' || m._secGroup === activeFilter;
    const estOk = activeEstado === 'all' || m._estado  === activeEstado;
    if (secOk && estOk) clusters.addLayer(m);
  });
}

// ── RENDER DE MARCADORES ────────────────────────────────────────────────────
function renderMapData() {
  clusters.clearLayers();
  allMarkers = [];

  const proyectos = DataService.getProyectos({ pts: _data.pts, perimetro: globalPerimetro, mode: currentMode });
  const kpis      = DataService.getKPIs(proyectos);

  // ── Filtros dinámicos de secretaría ──────────────────────────────────────
  const secContainer      = document.getElementById('filter-sec');
  const secretariasActivas = [...new Set(proyectos.map(p => p.secretaria))].sort();

  if (activeFilter !== 'all' && !secretariasActivas.includes(activeFilter)) activeFilter = 'all';

  secContainer.innerHTML =
    `<span class="filter-label">Secretaría:</span>` +
    `<button class="filter-btn ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">Todas</button>` +
    secretariasActivas.map(sec => {
      const color = DataService.SEC_COLORS[sec] || DataService.SEC_COLORS["Otras"];
      return `<button class="filter-btn ${activeFilter === sec ? 'active' : ''}" data-filter="${sec}" style="border-color:${color};">${sec}</button>`;
    }).join('');

  secContainer.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      secContainer.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
      e.target.classList.add('active');
      activeFilter = e.target.dataset.filter;
      applyFilters();
    });
  });

  // ── Leyenda dinámica ──────────────────────────────────────────────────────
  document.getElementById('legend-dynamic').innerHTML = secretariasActivas.map(sec => {
    const color = DataService.SEC_COLORS[sec] || DataService.SEC_COLORS["Otras"];
    return `<div class="legend-item"><div class="legend-dot" style="background:${color};"></div> ${sec}</div>`;
  }).join('');

  // ── KPIs ──────────────────────────────────────────────────────────────────
  document.getElementById('kpi-frentes').innerText     = kpis.total;
  document.getElementById('kpi-frentes-lbl').innerText = currentMode === 'ups' ? 'Frentes de Obra' : 'Contratos Totales';
  document.getElementById('kpi-inversion').innerText   = '$' + (kpis.inversion / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 0 }) + 'M';

  // ── Marcadores ────────────────────────────────────────────────────────────
  proyectos.forEach(p => {
    const color     = DataService.getColor(p.secretaria);
    const icon      = L.divIcon({
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>`,
      className: '', iconSize: [14, 14], iconAnchor: [7, 7]
    });
    const estLower  = p.estado.toLowerCase();
    const badgeClass = estLower.includes('ejecuc') ? 'badge-ejecucion' : estLower.includes('terminad') ? 'badge-terminado' : 'badge-alistamiento';
    const presStr   = p.presupuesto > 0 ? `$${Math.round(p.presupuesto / 1e6).toLocaleString('es-CO')}M` : '<span style="color:#E74C3C;">No reportado</span>';

    const marker = L.marker([p.lat, p.lon], { icon }).bindPopup(`
      <div style="min-width:240px;">
        <div class="popup-title">${p.nombre}</div>
        <div class="popup-row"><span class="popup-label">Secretaría</span><span class="popup-val" style="color:${color};">${p.secretaria}</span></div>
        <div class="popup-row"><span class="popup-label">Tipo</span><span class="popup-val">${p.tipo}</span></div>
        <div class="popup-row"><span class="popup-label">Dirección</span><span class="popup-val" style="white-space:normal;max-width:140px;">${p.direccion}</span></div>
        <div class="popup-row"><span class="popup-label">Presupuesto</span><span class="popup-val">${presStr}</span></div>
        <span class="popup-badge ${badgeClass}">${p.estado}</span>
      </div>`, { maxWidth: 320 });

    marker._secGroup = p.secretaria;
    marker._estado   = estLower.includes('ejecuc') ? 'En ejecución' : estLower.includes('terminad') ? 'Terminado' : 'En alistamiento';
    allMarkers.push(marker);
  });

  applyFilters();
}

// ── CARGA INICIAL ───────────────────────────────────────────────────────────
async function initDynamicMap() {
  _data = await DataService.load('../data/');

  // Perímetro
  globalPerimetro = DataService.getPerimetro(_data.poly);
  const perimeterLayer = L.geoJSON(globalPerimetro, { style: { color: '#E91E8C', weight: 4, fill: false } }).addTo(map);
  map.fitBounds(perimeterLayer.getBounds(), { padding: [20, 20] });

  // Polígonos extra
  const areasLayer  = L.layerGroup().addTo(map);
  const polyColors  = ['#F1C40F', '#E67E22', '#4CAF77', '#9B59B6'];
  let cIdx = 0;
  _data.poly.features.forEach(f => {
    if (f.properties.Name !== 'Perimetro Proyecto') {
      L.geoJSON(f, { style: { color: polyColors[cIdx % polyColors.length], weight: 2, fillOpacity: 0.3 } })
        .bindTooltip(`<b>Polígono de Obra:</b><br>${f.properties.Name}`)
        .addTo(areasLayer);
      cIdx++;
    }
  });

  // Corredor hídrico
  const tramosLayer = L.geoJSON(_data.tramos, { style: { color: '#00BCD4', weight: 4, opacity: 0.9 } })
    .bindTooltip('<b>Corredor Hídrico</b>').addTo(map);

  map.addLayer(clusters);
  L.control.layers(null, {
    "📍 Puntos de Obra":    clusters,
    "🟣 Límite del Pulmón": perimeterLayer,
    "💧 Corredor Hídrico":  tramosLayer,
    "🟩 Áreas de Proyecto": areasLayer
  }, { position: 'topright' }).addTo(map);

  renderMapData();
}

// ── LISTENERS ───────────────────────────────────────────────────────────────
document.querySelectorAll('#filter-modo .filter-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    document.querySelectorAll('#filter-modo .filter-btn').forEach(x => x.classList.remove('active'));
    e.target.classList.add('active');
    currentMode = e.target.dataset.modo;
    renderMapData();
  });
});

document.querySelectorAll('#filter-estado .filter-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    document.querySelectorAll('#filter-estado .filter-btn').forEach(x => x.classList.remove('active'));
    e.target.classList.add('active');
    activeEstado = e.target.dataset.estado;
    applyFilters();
  });
});

document.getElementById('btn-reset').addEventListener('click', () => {
  activeFilter = 'all'; activeEstado = 'all';
  document.querySelectorAll('.filter-btn[data-estado], .filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.filter-btn[data-estado="all"], .filter-btn[data-filter="all"]').forEach(b => b.classList.add('active'));
  applyFilters();
});

initDynamicMap();
