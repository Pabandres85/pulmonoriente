# Pulmón del Oriente — Visualización de Inversión Pública

Dashboard web estático que visualiza la inversión pública del Plan de Desarrollo Distrital 2024–2027 en el **Área de Influencia del Pulmón del Oriente** (Comunas 13 y 14 de Santiago de Cali, Colombia).

> Corte de datos: **21 de febrero de 2026** · Fuente: Unidad de Proyectos (UP) · Secretarías Distritales

---

## Vistas disponibles

| Vista | Archivo | Descripción |
|-------|---------|-------------|
| Inicio | `index.html` | Landing con KPIs globales y acceso a las demás vistas |
| Informe | `paginas/pulmon_oriente_informe-v2.html` | Dashboard analítico con gráficas y estadísticas |
| Mapa | `paginas/pulmon_oriente_mapa_v2.html` | Mapa interactivo con proyectos geolocalizados |
| Análisis de Impacto | `paginas/pulmon_oriente_impacto_v2.html` | Línea base, control comparable y atribución causal (DiD) |

---

## Estructura del proyecto

```
page/
├── index.html                              ← Landing page (KPIs + navegación)
├── README.md
│
├── assets/
│   ├── css/
│   │   ├── index.css                       ← Estilos del landing
│   │   ├── informe.css                     ← Estilos del dashboard analítico
│   │   └── mapa.css                        ← Estilos del mapa interactivo
│   └── js/
│       ├── services/
│       │   └── dataService.js              ← Capa de datos centralizada (API interna)
│       ├── index.js                        ← Lógica del landing
│       ├── informe.js                      ← Lógica del dashboard analítico
│       └── mapa.js                         ← Lógica del mapa interactivo
│
├── data/
│   ├── Total_secretarias.geojson           ← Datos principales (190 contratos, ~1.5 MB)
│   ├── poligonos.geojson                   ← Polígono de perímetro y áreas de obra
│   ├── tramos_oriente.geojson              ← Corredor hídrico (LineString)
│   ├── Total_secretarias.qmd               ← Metadatos QGIS
│   ├── poligonos.qmd
│   └── tramos_oriente.qmd
│
├── imag/
│   └── logo_alcaldia.png                   ← Escudo Alcaldía de Santiago de Cali
│
└── paginas/
    ├── pulmon_oriente_informe-v2.html
    ├── pulmon_oriente_mapa_v2.html
    └── pulmon_oriente_impacto_v2.html
```

---

## Tecnologías

| Librería | Versión | Uso |
|----------|---------|-----|
| [Leaflet.js](https://leafletjs.com/) | 1.9.4 | Motor de mapa interactivo |
| [Leaflet.MarkerCluster](https://github.com/Leaflet/Leaflet.markercluster) | 1.5.3 | Agrupación dinámica de marcadores |
| [Turf.js](https://turfjs.org/) | 6.0 | Análisis geoespacial (punto en polígono) |
| [Chart.js](https://www.chartjs.org/) | 4.4.0 | Gráficas interactivas (barra, dona) |
| Google Fonts | — | IBM Plex Sans, Playfair Display, Inter, Montserrat, JetBrains Mono |

Sin frameworks ni herramientas de build. Todo el proyecto se sirve como archivos estáticos.

---

## Capa de datos: `DataService`

El archivo `assets/js/services/dataService.js` centraliza toda la lógica de datos del proyecto. Es un objeto global que expone:

```javascript
// Carga y cachea los 3 GeoJSON (solo un fetch por sesión de página)
DataService.load(basePath)
  // basePath: './data/'  desde index.html
  //           '../data/' desde paginas/

// Extrae el polígono de perímetro del archivo poligonos.geojson
DataService.getPerimetro(polyData)

// Devuelve array de proyectos filtrados y deduplicados
DataService.getProyectos({ pts, perimetro, mode, año })
  // mode: 'ups' (144 frentes únicos) | 'contratos' (190 contratos brutos)
  // año:  '2024'–'2027' | 'all'

// Calcula totales: { total, inversion, porEstado }
DataService.getKPIs(proyectos)

// Normaliza nombre de secretaría a categoría estandarizada
DataService.secGroup(nombreCen)

// Devuelve color hex de la secretaría
DataService.getColor(nombreCen)

// Mapa de colores por secretaría
DataService.SEC_COLORS
```

### Objeto `proyecto` (salida de `getProyectos`)

```javascript
{
  nombre:      string,   // Nombre del proyecto / frente de obra
  secretaria:  string,   // Categoría normalizada (Vivienda, Educación, Salud, ...)
  estado:      string,   // Estado reportado (En ejecución, En alistamiento, ...)
  tipo:        string,   // Tipo de equipamiento
  barrio:      string,   // Barrio o vereda
  direccion:   string,   // Dirección
  avance:      number,   // Porcentaje de avance (0–100)
  presupuesto: number,   // Presupuesto en pesos colombianos
  año:         string,   // Año del plan (2024–2027)
  lat:         number,   // Latitud WGS84
  lon:         number    // Longitud WGS84
}
```

---

## Lógica de deduplicación UPS

Los datos fuente contienen **190 contratos** que pueden financiar distintas fases de un mismo punto físico. Para mostrar **144 Frentes de Obra únicos** (Unidades de Proyecto Sectorial) se aplica una deduplicación por huella espacial:

```
Clave única = direccion + latitud + longitud + tipo_equipamiento
```

Cuando hay duplicados:
- Se conserva el **presupuesto máximo** (evita doble conteo)
- Se conserva el **avance más alto** reportado

---

## Categorías de secretaría

| Categoría | Color | Palabras clave en los datos |
|-----------|-------|---------------------------|
| Vivienda | `#E67E22` | Vivienda, Hábitat |
| Educación | `#3498DB` | Educación, Educacion |
| Salud | `#E74C3C` | Salud |
| Deporte | `#9B59B6` | Deporte, Recreación |
| Cultura | `#F1C40F` | Cultura |
| Bienestar | `#E91E63` | Bienestar |
| Seguridad | `#34495E` | Seguridad |
| Otras | `#1ABC9C` | (cualquier otro valor) |

---

## Datos geoespaciales

| Archivo | Tipo | Contenido |
|---------|------|-----------|
| `Total_secretarias.geojson` | FeatureCollection (Points) | 190 contratos con propiedades de proyecto |
| `poligonos.geojson` | FeatureCollection (Polygons) | Perímetro del proyecto (`Perimetro Proyecto`) y polígonos de áreas de obra |
| `tramos_oriente.geojson` | FeatureCollection (LineStrings) | Corredor hídrico del Pulmón del Oriente |

Sistema de referencia: **WGS84 (EPSG:4326)**

### Propiedades principales de `Total_secretarias.geojson`

| Campo | Descripción |
|-------|-------------|
| `nombre_up` | Nombre del proyecto / frente de obra |
| `nombre_cen` | Nombre de la secretaría ejecutora |
| `tipo_equip` | Tipo de equipamiento |
| `estado` | Estado de la obra |
| `presupuest` | Presupuesto (string, múltiples formatos numéricos) |
| `avance_obr` | Porcentaje de avance físico (0–100) |
| `año` | Año del plan de desarrollo |
| `barrio_ver` | Barrio o vereda |
| `direccion` | Dirección de la obra |
| `lat` / `lon` | Coordenadas (también en `geometry.coordinates`) |
| `url_proces` | Enlace al proceso en SECOP II |

---

## Rutas relativas a `data/`

Cada JS usa la ruta correcta según su ubicación en el árbol de carpetas:

| Archivo JS | `basePath` en `DataService.load()` |
|---|---|
| `assets/js/index.js` | `'./data/'` |
| `assets/js/informe.js` | `'../data/'` |
| `assets/js/mapa.js` | `'../data/'` |

---

## Despliegue con GitHub Pages

1. Ve a **Settings → Pages** en el repositorio
2. Fuente: `Deploy from a branch`
3. Branch: `main` / carpeta: `/ (root)`
4. URL pública: `https://<usuario>.github.io/<repositorio>/`

No se requiere ningún paso de build. Los archivos se sirven directamente.

---

## Fuente de datos

- **Fuente:** Unidad de Proyectos (UP) — Secretarías Distritales del Municipio de Santiago de Cali
- **Área:** Comunas 13 y 14 — Pulmón del Oriente (~5.4 km²)
- **Período:** Plan de Desarrollo 2024–2027
- **Corte:** 21 de febrero de 2026
- **Portal de contratos:** [SECOP II](https://www.colombiacompra.gov.co/secop/secop-ii)
