async function initLandingData() {
  try {
    const data      = await DataService.load('./data/');
    const perimetro = DataService.getPerimetro(data.poly);
    const proyectos = DataService.getProyectos({ pts: data.pts, perimetro, mode: 'ups' });
    const kpis      = DataService.getKPIs(proyectos);

    document.getElementById('kpi-frentes').innerText  = kpis.total;
    document.getElementById('kpi-inversion').innerText = '$' + Math.round(kpis.inversion / 1e6).toLocaleString('es-CO') + 'M';

    const mapDesc = document.getElementById('map-desc');
    if (mapDesc) {
      mapDesc.innerText = kpis.total + ' frentes de obra (UPS) geolocalizados dentro del área de influencia del Pulmón del Oriente. Delineación del polígono, corredor hídrico y zonas de obra.';
    }
  } catch (error) {
    console.error("Error cargando la data geoespacial:", error);
  }
}

initLandingData();
