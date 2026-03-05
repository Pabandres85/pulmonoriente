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

  // ── CACHÉ ───────────────────────────────────────────────────────────────
  // Dos niveles:
  //   1. _cache: variable en memoria (instantáneo, mismo contexto de página)
  //   2. sessionStorage: persiste entre páginas de la misma sesión del navegador
  //      Formato guardado: { etag: string|null, data: { pts, poly, tramos } }
  //      Se invalida automáticamente si el ETag del servidor cambia (datos nuevos)
  //      Para forzar re-descarga manual: cambiar el sufijo de CACHE_KEY (ej: v2 → v3)
  const CACHE_KEY = 'pulmon_data_v2';  // v2: incluye etag en el objeto guardado
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

  // ── CARGA DE DATOS (memoria → sessionStorage → red) ────────────────────
  /**
   * Orden de prioridad:
   *   1. _cache en memoria          → misma página, instantáneo, 0 requests
   *   2. sessionStorage + ETag      → entre páginas, 1 HEAD request de ~200 B
   *      Si el ETag del servidor coincide con el guardado → usar caché sin descargar
   *      Si el ETag cambió (datos actualizados)           → re-fetchear todo
   *   3. fetch() completo           → primera carga de la sesión
   *
   * @param {string} basePath  Ruta relativa al directorio data/ desde la página.
   *                           Ej: './data/' desde index.html, '../data/' desde paginas/
   */
  async function load(basePath) {
    // Nivel 1: memoria (misma página)
    if (_cache) return _cache;

    // Nivel 2: verificar ETag del servidor antes de usar sessionStorage
    let currentEtag = null;
    try {
      const headRes = await fetch(basePath + 'Total_secretarias.geojson', { method: 'HEAD' });
      // Preferimos ETag; si no existe usamos Last-Modified como alternativa
      currentEtag = headRes.headers.get('etag') || headRes.headers.get('last-modified');
    } catch (_) {
      // Sin red o servidor no soporta HEAD → continuar (usaremos caché si existe)
    }

    try {
      const stored = sessionStorage.getItem(CACHE_KEY);
      if (stored) {
        const { etag, data } = JSON.parse(stored);
        // Usar caché si:
        //   a) el servidor no devolvió ETag (no podemos comparar → confiar en caché)
        //   b) el ETag coincide (datos sin cambios)
        if (!currentEtag || etag === currentEtag) {
          _cache = data;
          return _cache;
        }
        // ETag cambió → limpiar caché y continuar al fetch completo
        sessionStorage.removeItem(CACHE_KEY);
      }
    } catch (_) {
      // sessionStorage no disponible → continuar
    }

    // Nivel 3: fetch completo (primera carga o datos actualizados)
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

    // Guardar datos + ETag en sessionStorage
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ etag: currentEtag, data: _cache }));
    } catch (_) {
      // Si excede la cuota simplemente no se cachea
    }

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
