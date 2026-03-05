/**
 * DataService — Capa de datos centralizada para Pulmón del Oriente
 *
 * Expone el objeto global `DataService` con:
 *   - load(basePath)           → carga y cachea los 3 GeoJSON
 *   - getPerimetro(polyData)   → extrae el polígono de perímetro
 *   - getProyectos(opts)       → filtra + deduplica proyectos
 *   - getKPIs(proyectos)       → calcula totales por estado e inversión
 *   - secGroup(nombre)         → normaliza nombre de secretaría
 *   - getColor(nombre)         → color hex de la secretaría
 *   - SEC_COLORS               → mapa de colores por secretaría
 */
const DataService = (() => {

  // ── COLORES POR SECRETARÍA ──────────────────────────────────────────────
  const SEC_COLORS = {
    "Vivienda":   "#E67E22",
    "Educación":  "#3498DB",
    "Salud":      "#E74C3C",
    "Deporte":    "#9B59B6",
    "Cultura":    "#F1C40F",
    "Bienestar":  "#E91E63",
    "Seguridad":  "#34495E",
    "Otras":      "#1ABC9C"
  };

  // ── CACHÉ INTERNA ───────────────────────────────────────────────────────
  let _cache = null;

  // ── NORMALIZACIÓN DE SECRETARÍA ─────────────────────────────────────────
  function secGroup(s) {
    if (!s) return "Otras";
    if (s.includes("Vivienda")  || s.includes("Hábitat"))    return "Vivienda";
    if (s.includes("Educación") || s.includes("Educacion"))  return "Educación";
    if (s.includes("Salud"))                                  return "Salud";
    if (s.includes("Deporte")   || s.includes("Recreación")) return "Deporte";
    if (s.includes("Cultura"))                                return "Cultura";
    if (s.includes("Bienestar"))                              return "Bienestar";
    if (s.includes("Seguridad"))                              return "Seguridad";
    return "Otras";
  }

  function getColor(nombre) {
    return SEC_COLORS[secGroup(nombre)] || SEC_COLORS["Otras"];
  }

  // ── PARSEO DE PRESUPUESTO ───────────────────────────────────────────────
  function parseBudget(str) {
    let s = (str || '0').toString().replace(/[^0-9\.,]/g, '');
    if (s.endsWith('.00') || s.endsWith(',00')) s = s.slice(0, -3);
    return parseFloat(s.replace(/[\.,]/g, '')) || 0;
  }

  // ── NORMALIZACIÓN DE AÑO ────────────────────────────────────────────────
  function _parseAnio(val) {
    const s = (val || '2025').toString().trim();
    return (s === 'null' || s === '') ? '2025' : s;
  }

  // ── CONSTRUCCIÓN DE OBJETO PROYECTO ────────────────────────────────────
  function _buildProject(props, lat, lon, ppto) {
    return {
      nombre:     props.nombre_up   || 'Sin Nombre',
      secretaria: secGroup(props.nombre_cen),
      estado:     props.estado      || 'Alistamiento',
      tipo:       props.tipo_equip  || 'Otro',
      barrio:     props.barrio_ver  || 'Sin dato',
      direccion:  props.direccion   || 'No registrada',
      avance:     parseFloat(props.avance_obr) || 0,
      presupuesto: ppto,
      año:        _parseAnio(props.año),
      lat, lon
    };
  }

  // ── CARGA DE DATOS (con caché) ──────────────────────────────────────────
  /**
   * @param {string} basePath  Ruta relativa al directorio data/ desde la página.
   *                           Ej: './data/' desde index.html, '../data/' desde paginas/
   */
  async function load(basePath) {
    if (_cache) return _cache;
    const [ptsRes, polyRes, tramosRes] = await Promise.all([
      fetch(basePath + 'Total_secretarias.geojson'),
      fetch(basePath + 'poligonos.geojson'),
      fetch(basePath + 'tramos_oriente.geojson')
    ]);
    _cache = {
      pts:    await ptsRes.json(),
      poly:   await polyRes.json(),
      tramos: await tramosRes.json()
    };
    return _cache;
  }

  // ── PERÍMETRO ───────────────────────────────────────────────────────────
  function getPerimetro(polyData) {
    return polyData.features.find(f => f.properties.Name === 'Perimetro Proyecto')
      || polyData.features[0];
  }

  // ── PROYECTOS FILTRADOS Y DEDUPLICADOS ──────────────────────────────────
  /**
   * @param {object} opts
   * @param {object} opts.pts       GeoJSON de puntos (Total_secretarias)
   * @param {object} opts.perimetro Feature del polígono perímetro
   * @param {string} [opts.mode]    'ups' (deduplicado) | 'contratos' (bruto)
   * @param {string} [opts.año]     '2024'–'2027' | 'all'
   * @returns {Array} Array de objetos proyecto normalizados
   */
  function getProyectos({ pts, perimetro, mode = 'ups', año = 'all' }) {
    // 1. Filtrar por perímetro (y opcionalmente por año)
    const dentro = pts.features.filter(f => {
      if (!f.geometry || !turf.booleanPointInPolygon(f, perimetro)) return false;
      if (año === 'all') return true;
      return _parseAnio(f.properties.año) === año;
    });

    // 2. Modo contratos: sin deduplicación
    if (mode === 'contratos') {
      return dentro.map(f => {
        const p = f.properties;
        const ppto = parseBudget(p.presupuest);
        return _buildProject(p, f.geometry.coordinates[1], f.geometry.coordinates[0], ppto);
      });
    }

    // 3. Modo UPS: deduplicar por huella espacial
    const upsMap = new Map();
    dentro.forEach(f => {
      const p   = f.properties;
      const lat = f.geometry.coordinates[1];
      const lon = f.geometry.coordinates[0];
      const ppto = parseBudget(p.presupuest);
      const key  = `${p.direccion}_${lat}_${lon}_${p.tipo_equip}`;

      if (!upsMap.has(key)) {
        upsMap.set(key, _buildProject(p, lat, lon, ppto));
      } else {
        const u = upsMap.get(key);
        if (ppto > u.presupuesto) {
          u.presupuesto = ppto;
          u.año = _parseAnio(p.año);
        }
        u.avance = Math.max(u.avance, parseFloat(p.avance_obr) || 0);
      }
    });
    return Array.from(upsMap.values());
  }

  // ── KPIs ────────────────────────────────────────────────────────────────
  /**
   * @param {Array} proyectos  Resultado de getProyectos()
   * @returns {{ total, inversion, porEstado }}
   */
  function getKPIs(proyectos) {
    const porEstado = { 'En ejecución': 0, 'En alistamiento': 0, 'Terminado': 0, 'Suspendido': 0 };
    let inversion = 0;
    proyectos.forEach(p => {
      inversion += p.presupuesto;
      const est = p.estado.toLowerCase();
      if      (est.includes('ejecuc'))   porEstado['En ejecución']++;
      else if (est.includes('terminad')) porEstado['Terminado']++;
      else if (est.includes('suspendid'))porEstado['Suspendido']++;
      else                               porEstado['En alistamiento']++;
    });
    return { total: proyectos.length, inversion, porEstado };
  }

  // ── API PÚBLICA ─────────────────────────────────────────────────────────
  return { SEC_COLORS, secGroup, getColor, parseBudget, load, getPerimetro, getProyectos, getKPIs };

})();
