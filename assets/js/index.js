async function initLandingData() {
  try {
    const [ptsRes, polyRes] = await Promise.all([
      fetch('./Total_secretarias.geojson'),
      fetch('./poligonos.geojson')
    ]);
    const ptsData = await ptsRes.json();
    const polyData = await polyRes.json();

    const perimetro = polyData.features.find(f => f.properties.Name === 'Perimetro Proyecto') || polyData.features[0];

    // Motor de Deduplicación Espacial
    const upsMap = new Map();

    ptsData.features.forEach(f => {
      if (!f.geometry || !turf.booleanPointInPolygon(f, perimetro)) return;

      const p = f.properties;
      let pptoStr = (p.presupuest || '0').toString().trim();
      pptoStr = pptoStr.replace(/[^0-9\.,]/g, '');
      if (pptoStr.endsWith('.00') || pptoStr.endsWith(',00')) pptoStr = pptoStr.slice(0, -3);
      const ppto = parseFloat(pptoStr.replace(/[\.,]/g, '')) || 0;

      const lat = f.geometry.coordinates[1];
      const lon = f.geometry.coordinates[0];
      // Llave: Dirección + Latitud + Longitud + Tipo
      const key = `${p.direccion}_${lat}_${lon}_${p.tipo_equip}`;

      if (!upsMap.has(key)) {
        upsMap.set(key, { presupuesto: ppto });
      } else {
        const u = upsMap.get(key);
        if (ppto > u.presupuesto) {
          u.presupuesto = ppto; // Tomamos el máximo valor
        }
      }
    });

    const frentes = Array.from(upsMap.values());
    const totalFrentes = frentes.length;
    const totalInversion = frentes.reduce((sum, f) => sum + f.presupuesto, 0);

    // Actualiza los KPIs del DOM
    document.getElementById('kpi-frentes').innerText = totalFrentes;
    document.getElementById('kpi-inversion').innerText = '$' + Math.round(totalInversion / 1e6).toLocaleString('es-CO') + 'M';

    // Actualiza el texto descriptivo de la tarjeta del mapa
    const mapDesc = document.getElementById('map-desc');
    if (mapDesc) {
      mapDesc.innerText = totalFrentes + ' frentes de obra (UPS) geolocalizados dentro del área de influencia del Pulmón del Oriente. Delineación del polígono, corredor hídrico y zonas de obra.';
    }
  } catch (error) {
    console.error("Error cargando la data geoespacial:", error);
  }
}

initLandingData();
