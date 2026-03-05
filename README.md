# Pulmón del Oriente — Visualización de Inversión Pública

Dashboard web estático que visualiza la inversión pública del Plan de Desarrollo Distrital 2024–2027 en Santiago de Cali, Colombia. Incluye dos módulos de datos complementarios:

- **Pulmón del Oriente** — Comunas 13 y 14 (~5.4 km²), 190 contratos geolocalizados
- **Intervenciones Distritales** — Ciudad completa, 2357 intervenciones de todas las secretarías

> Sin frameworks ni herramientas de build. Todo el proyecto se sirve como archivos estáticos.

---

## Vistas disponibles

| Vista | Archivo | Descripción |
|-------|---------|-------------|
| Inicio | `index.html` | Landing con KPIs globales y acceso a todas las vistas |
| Informe Pulmón | `paginas/pulmon_oriente_informe-v2.html` | Dashboard analítico con gráficas Chart.js y estadísticas del área de influencia |
| Mapa Pulmón | `paginas/pulmon_oriente_mapa_v2.html` | Mapa Leaflet interactivo con proyectos geolocalizados y clusters |
| Intervenciones Distritales | `paginas/intervenciones_v1.html` | Dashboard ciudad completa: 2357 intervenciones filtradas por secretaría, estado y tipo |
| Análisis de Impacto | `paginas/pulmon_oriente_impacto_v2.html` | En construcción — análisis DiD |

---

## Estructura del proyecto

```
pulmonoriente/
├── index.html                              ← Landing page (KPIs + 4 cards de navegación)
├── README.md
│
├── assets/
│   ├── css/
│   │   ├── index.css                       ← Estilos del landing
│   │   ├── informe.css                     ← Estilos compartidos: informe + intervenciones
│   │   └── mapa.css                        ← Estilos del mapa interactivo
│   └── js/
│       ├── services/
│       │   └── dataService.js              ← Capa de datos centralizada (IIFE global, GeoJSON)
│       ├── index.js                        ← KPIs del landing
│       ├── informe.js                      ← Dashboard analítico Pulmón del Oriente
│       ├── mapa.js                         ← Mapa interactivo Leaflet
│       └── intervenciones.js              ← Dashboard Intervenciones Distritales (standalone)
│
├── data/
│   ├── Total_secretarias.geojson           ← 190 contratos geolocalizados (Pulmón del Oriente)
│   ├── poligonos.geojson                   ← Perímetro + polígonos de áreas de obra
│   ├── tramos_oriente.geojson              ← Corredor hídrico (LineStrings)
│   ├── intervenciones.json                 ← 2357 registros ciudad completa (generado por script)
│   ├── intervenciones_meta.json            ← Metadatos del corte: fecha, conteos (generado por script)
│   └── excel/
│       └── intervenciones_filtradas_YYYY-MM-DD.xlsx  ← Fuente Excel (la más reciente se procesa automáticamente)
│
├── scripts/
│   └── excel_to_json.py                    ← Convierte Excel → JSON + meta
│
├── imag/
│   └── logo_alcaldia.png
│
├── paginas/
│   ├── pulmon_oriente_informe-v2.html
│   ├── pulmon_oriente_mapa_v2.html
│   ├── intervenciones_v1.html
│   └── pulmon_oriente_impacto_v2.html      ← Pendiente
│
└── .github/
    └── workflows/
        └── convert_excel.yml               ← CI: convierte Excel y hace commit del JSON automáticamente
```

---

## Tecnologías

| Librería | Versión | Uso |
|----------|---------|-----|
| [Leaflet.js](https://leafletjs.com/) | 1.9.4 | Motor de mapa interactivo |
| [Leaflet.MarkerCluster](https://github.com/Leaflet/Leaflet.markercluster) | 1.5.3 | Agrupación dinámica de marcadores |
| [Turf.js](https://turfjs.org/) | 6.0 | Análisis geoespacial (punto en polígono) |
| [Chart.js](https://www.chartjs.org/) | 4.4.0 | Gráficas interactivas (barra horizontal, dona) |
| [openpyxl](https://openpyxl.readthedocs.io/) | — | Lectura de Excel en el script Python |
| Google Fonts | — | IBM Plex Sans, Playfair Display, Inter, Montserrat, JetBrains Mono |

---

## Módulo 1 — Pulmón del Oriente (GeoJSON)

### Capa de datos: `DataService`

`assets/js/services/dataService.js` es una IIFE global que centraliza toda la lógica de datos geoespaciales:

```javascript
DataService.load(basePath)
  // basePath: './data/'  desde index.html
  //           '../data/' desde paginas/
  // Carga 3 GeoJSON con caché en memoria + sessionStorage con ETag

DataService.getPerimetro(polyData)
  // Extrae el Feature con Name='Perimetro Proyecto' de poligonos.geojson

DataService.getProyectos({ pts, perimetro, mode, año })
  // mode: 'ups' → 144 frentes únicos (deduplicados)
  // mode: 'contratos' → 190 contratos brutos
  // año: '2024'–'2027' | 'all'

DataService.getKPIs(proyectos)
  // Retorna { total, inversion, porEstado }

DataService.secGroup(nombreCen)   // Normaliza secretaría → categoría
DataService.getColor(nombreCen)   // Color hex de la categoría
DataService.SEC_COLORS            // Mapa completo de colores
```

### Objeto `proyecto` (salida de `getProyectos`)

```javascript
{
  nombre:      string,   // Nombre del proyecto / frente de obra
  secretaria:  string,   // Categoría normalizada
  estado:      string,   // En ejecución | En alistamiento | Terminado | ...
  tipo:        string,   // Tipo de equipamiento
  barrio:      string,
  direccion:   string,
  avance:      number,   // 0–100
  presupuesto: number,   // COP
  año:         string,   // 2024–2027
  lat:         number,
  lon:         number
}
```

### Lógica de deduplicación UPS

190 contratos → **144 Frentes de Obra únicos**:

```
Clave única = direccion + latitud + longitud + tipo_equipamiento
```

Al duplicar: se conserva el **presupuesto máximo** y el **avance más alto**.

### Datos geoespaciales

| Archivo | Tipo | Contenido |
|---------|------|-----------|
| `Total_secretarias.geojson` | FeatureCollection (Points) | 190 contratos con propiedades |
| `poligonos.geojson` | FeatureCollection (Polygons) | Perímetro del proyecto + áreas de obra |
| `tramos_oriente.geojson` | FeatureCollection (LineStrings) | Corredor hídrico |

Sistema de referencia: **WGS84 (EPSG:4326)**

### Campos principales de `Total_secretarias.geojson`

| Campo | Descripción |
|-------|-------------|
| `nombre_up` | Nombre del proyecto |
| `nombre_cen` | Secretaría ejecutora |
| `tipo_equip` | Tipo de equipamiento |
| `estado` | Estado de la obra |
| `presupuest` | Presupuesto (string, múltiples formatos) |
| `avance_obr` | Avance físico (0–100) |
| `año` | Año del plan |
| `barrio_ver` | Barrio o vereda |
| `direccion` | Dirección |
| `lat` / `lon` | Coordenadas WGS84 |
| `url_proces` | Enlace SECOP II |

### Categorías de secretaría y colores

| Categoría | Color | Palabras clave |
|-----------|-------|----------------|
| Vivienda | `#E67E22` | Vivienda, Hábitat |
| Educación | `#3498DB` | Educación |
| Salud | `#E74C3C` | Salud |
| Deporte | `#9B59B6` | Deporte, Recreación |
| Cultura | `#F1C40F` | Cultura |
| Bienestar | `#E91E63` | Bienestar |
| Seguridad | `#34495E` | Seguridad |
| Otras | `#1ABC9C` | (cualquier otro) |

---

## Módulo 2 — Intervenciones Distritales (Excel → JSON)

Dashboard independiente que consume datos de toda la ciudad sin coordenadas geoespaciales.

### Fuente de datos

- **Origen:** Secretarías Distritales del Municipio de Santiago de Cali
- **Alcance:** Ciudad completa — 22 comunas + corregimientos
- **Corte:** Marzo 2026 (dinámico, se actualiza automáticamente)
- **Registros:** 2357 intervenciones, 777 sin dato de ubicación
- **Inversión total:** ~$684.9 miles de millones COP

### Campos del dataset (`intervenciones.json`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nombre_centro_gestor` | string | Secretaría ejecutora |
| `clase_up` | string | Clase de unidad de proyecto (Obra, Subsidio, Dotación, …) |
| `upid` | string | Identificador de la UP |
| `intervencion_id` | string | ID de la intervención |
| `tipo_intervencion` | string | Tipo (Mejoramiento, Construcción, Mantenimiento, …) |
| `descripcion_intervencion` | string | Descripción textual |
| `estado` | string | En ejecución · Terminado · En alistamiento · Suspendido · Proyectado · Inaugurado |
| `presupuesto_base` | float | Presupuesto en COP |
| `fuente_financiacion` | string | Fuente (SGP, Recursos Propios, …) |
| `fecha_inicio` | string | YYYY-MM-DD |
| `fecha_fin` | string | YYYY-MM-DD |
| `fecha_inauguracion` | string | YYYY-MM-DD (si aplica) |
| `comuna_corregimiento` | string | Ubicación (null en 777 registros) |
| `barrio_vereda` | string | Barrio o vereda |
| `updated_at` | string | YYYY-MM-DD |

### Arquitectura del pipeline Excel → Web

```
data/excel/intervenciones_filtradas_YYYY-MM-DD.xlsx
        ↓  scripts/excel_to_json.py
data/intervenciones.json          ← array JSON (2357 registros, ~1 MB)
data/intervenciones_meta.json     ← {"corte":"2026-03-04","registros":2357,"sin_ubicacion":777,"archivo":"..."}
        ↓  GitHub Actions (convert_excel.yml)
        ↓  git commit + push [skip ci]
        ↓  GitHub Pages
paginas/intervenciones_v1.html    ← consume JSON vía fetch()
```

### Script: `scripts/excel_to_json.py`

```bash
# Uso local
py scripts/excel_to_json.py                          # toma el .xlsx más reciente en data/excel/
py scripts/excel_to_json.py data/excel/mi_archivo.xlsx  # archivo específico

# Dependencia
pip install openpyxl
```

**Lógica interna:**
- Detecta el `.xlsx` más reciente por fecha de modificación (`st_mtime`)
- Extrae la fecha de corte del nombre del archivo con regex `(\d{4}-\d{2}-\d{2})`
- Normaliza fechas (ISO, DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD → YYYY-MM-DD)
- Normaliza números (maneja separadores de miles en COP)
- Genera `intervenciones.json` (array plano, UTF-8, `ensure_ascii=False`)
- Genera `intervenciones_meta.json` con corte, conteos y nombre del archivo fuente

### Automatización CI/CD: `.github/workflows/convert_excel.yml`

El workflow se dispara automáticamente cuando se sube un archivo Excel al repositorio:

```yaml
on:
  push:
    paths:
      - 'data/excel/*.xlsx'
      - 'data/excel/*.xls'
```

Pasos:
1. Checkout del repo
2. Setup Python 3.11 + `pip install openpyxl`
3. Ejecuta `python scripts/excel_to_json.py`
4. Commit automático de `intervenciones.json` + `intervenciones_meta.json` con mensaje `[skip ci]`
5. Push al branch `main`

> Para actualizar los datos: basta con subir un nuevo Excel a `data/excel/` con el nombre `intervenciones_filtradas_YYYY-MM-DD.xlsx`. Todo lo demás es automático.

### Dashboard `intervenciones.js` — lógica principal

JS standalone (sin DataService). Patrón:

```javascript
// Carga paralela de datos y meta
const [resData, resMeta] = await Promise.all([
  fetch('../data/intervenciones.json'),
  fetch('../data/intervenciones_meta.json')
]);

// Filtros activos
currentSec   // secretaría seleccionada
currentEst   // estado seleccionado
currentTipo  // tipo de intervención seleccionado

// Render completo al cambiar cualquier filtro
renderDashboard()
```

**Gráficas generadas:**

| ID Canvas | Tipo | Métrica |
|-----------|------|---------|
| `chartSecretaria` | Barra horizontal | Inversión por secretaría (miles de millones COP) |
| `chartEstado` | Dona | Distribución de intervenciones por estado |
| `chartTipo` | Barra horizontal | Top 10 tipos de intervención (conteo) |
| `chartClase` | Dona | Inversión por clase de proyecto (UP) |
| `chartFuente` | Barra horizontal | Inversión por fuente de financiación |
| `comunasBars` | HTML bars | Top 14 comunas/corregimientos por inversión |

**Textos dinámicos actualizados desde `intervenciones_meta.json`:**

| ID elemento | Contenido |
|-------------|-----------|
| `hero-date` | `// FUENTE: ... · CORTE: MES AÑO · N REGISTROS` |
| `footer-corte-badge` | `2024–2027 · Corte: Mes Año` |
| `footer-registros` | `N registros de intervenciones. N sin dato de ubicación.` |

---

## Rutas relativas a `data/`

| Archivo JS | Ruta usada |
|---|---|
| `assets/js/index.js` | `'./data/'` |
| `assets/js/informe.js` | `'../data/'` |
| `assets/js/mapa.js` | `'../data/'` |
| `assets/js/intervenciones.js` | `'../data/'` |

---

## Despliegue con GitHub Pages

1. **Settings → Pages** → `Deploy from a branch` → `main` / `/ (root)`
2. URL pública: `https://Pabandres85.github.io/pulmonoriente/`
3. No requiere build. Los archivos se sirven directamente.

Si el deploy queda en estado "Queued", hacer un push vacío para re-dispararlo:
```bash
git commit --allow-empty -m "trigger: redeploy pages"
git push
```

---

## Fuente de datos

| Módulo | Fuente | Área | Corte |
|--------|--------|------|-------|
| Pulmón del Oriente | Unidad de Proyectos (UP) — Secretarías Distritales | Comunas 13 y 14 (~5.4 km²) | 21 feb 2026 |
| Intervenciones Distritales | Secretarías Distritales | Ciudad completa — 22 comunas + corregimientos | Marzo 2026 (dinámico) |

- **Período:** Plan de Desarrollo 2024–2027
- **Portal de contratos:** [SECOP II](https://www.colombiacompra.gov.co/secop/secop-ii)
- **Portal municipal:** [cali.gov.co](https://www.cali.gov.co)
