# Pulmón del Oriente — Visualización de Inversión Pública

Dashboard web estático que visualiza la inversión pública del Plan de Desarrollo Distrital 2024–2027 en Santiago de Cali, Colombia. Incluye dos módulos de datos complementarios: proyectos geolocalizados del área Pulmón del Oriente e intervenciones distritales de ciudad completa.

> Sin frameworks ni herramientas de build. Archivos estáticos servidos directamente desde GitHub Pages.

---

## Vistas disponibles

| Vista | Archivo | Descripción |
|-------|---------|-------------|
| Inicio | `index.html` | Landing con KPIs globales y acceso a todas las vistas |
| Informe Pulmón | `paginas/pulmon_oriente_informe-v2.html` | Dashboard analítico con gráficas Chart.js y modal de detalle |
| Mapa Pulmón | `paginas/pulmon_oriente_mapa_v2.html` | Mapa Leaflet con clusters, geofiltro y popups |
| Intervenciones Distritales | `paginas/intervenciones_v1.html` | Dashboard ciudad completa con filtros dinámicos y Curva S |
| Análisis de Impacto | `paginas/pulmon_oriente_impacto_v2.html` | En construcción |

---

## Estructura del proyecto

```
pulmonoriente/
├── index.html
├── assets/
│   ├── css/
│   │   ├── index.css              ← Landing page
│   │   ├── informe.css            ← Informe analítico Pulmón del Oriente
│   │   ├── intervenciones.css     ← Dashboard intervenciones distritales
│   │   └── mapa.css               ← Mapa interactivo Leaflet
│   └── js/
│       ├── services/
│       │   └── dataService.js     ← Capa de datos centralizada (IIFE, GeoJSON)
│       ├── index.js
│       ├── informe.js             ← Dashboard analítico Pulmón (Chart.js)
│       ├── mapa.js                ← Mapa Leaflet + Turf.js
│       └── intervenciones.js     ← Dashboard intervenciones (standalone)
├── data/
│   ├── Total_secretarias.geojson  ← Puntos con propiedades de proyectos
│   ├── poligonos.geojson          ← Polígonos de perímetro y zonas
│   ├── tramos_oriente.geojson     ← Tramos de vía
│   ├── intervenciones.json        ← Generado por script Python (~1 MB)
│   ├── intervenciones_meta.json   ← Metadatos del corte (generado por script)
│   └── excel/                     ← Archivos fuente Excel (el más reciente se procesa)
├── scripts/
│   └── excel_to_json.py
├── imag/
├── paginas/
└── .github/
    └── workflows/
        └── convert_excel.yml
```

---

## Stack tecnológico

| Librería | Versión | Uso |
|----------|---------|-----|
| [Leaflet.js](https://leafletjs.com/) | 1.9.4 | Mapa interactivo |
| [Leaflet.MarkerCluster](https://github.com/Leaflet/Leaflet.markercluster) | 1.5.3 | Agrupación de marcadores |
| [Turf.js](https://turfjs.org/) | 6.0 | Análisis geoespacial — punto en polígono |
| [Chart.js](https://www.chartjs.org/) | 4.4.0 | Gráficas (barra, dona, línea, stacked, dual-eje) |
| [openpyxl](https://openpyxl.readthedocs.io/) | — | Lectura de Excel en script Python |
| Google Fonts | — | Inter, Montserrat, JetBrains Mono |

---

## Módulo 1 — Pulmón del Oriente

### DataService (`assets/js/services/dataService.js`)

IIFE global que centraliza la carga, caché y procesamiento de los tres GeoJSON. Expone la API pública:

```javascript
DataService.load(basePath)
  // basePath: './data/'   desde index.html
  //           '../data/'  desde paginas/
  // Caché triple: memoria → sessionStorage + ETag → fetch completo

DataService.getPerimetro(polyData)
  // → Feature GeoJSON del polígono de perímetro

DataService.getProyectos({ pts, perimetro, mode, año })
  // mode: 'ups'       → frentes únicos deduplicados por huella espacial
  // mode: 'contratos' → contratos brutos sin deduplicar
  // año:  '2024'–'2027' | 'all'

DataService.getKPIs(proyectos)
  // → { total, inversion, porEstado }

DataService.secGroup(nombreCen)   // secretaría → categoría normalizada
DataService.getColor(nombreCen)   // categoría → color hex
DataService.SEC_COLORS            // mapa completo { secretaría: '#hex' }
```

#### Caché triple nivel

| Nivel | Almacenamiento | Costo |
|-------|---------------|-------|
| 1 | Variable `_cache` en memoria | 0 requests — válido durante la misma página |
| 2 | `sessionStorage` + ETag | 1 HEAD request (~200 B) — válido entre páginas |
| 3 | `fetch()` completo | 3 GET requests — primera carga o datos actualizados |

La clave `pulmon_data_v2` en `sessionStorage` almacena `{ etag, data }`. Se invalida si el ETag del servidor cambia (nueva subida de datos).

#### Lógica de deduplicación UPS

Los contratos fuente pueden financiar distintas fases del mismo punto físico. La deduplicación colapsa contratos por huella espacial:

```
Clave única = direccion + latitud + longitud + tipo_equipamiento
```

Al duplicar: se conserva el **presupuesto máximo** y el **avance más alto**.

#### Rutas relativas a `data/`

| Archivo JS | `basePath` |
|---|---|
| `assets/js/index.js` | `'./data/'` |
| `assets/js/informe.js` | `'../data/'` |
| `assets/js/mapa.js` | `'../data/'` |
| `assets/js/intervenciones.js` | `'../data/'` |

---

### Dashboard Informe (`assets/js/informe.js`)

Gráficas Chart.js renderizadas con `renderDashboard()`. Se destruyen y recrean en cada cambio de filtro (`currentMode`, `currentAnio`).

#### Filtros

| Control | ID | Variable | Valores |
|---------|-----|----------|---------|
| Modo de análisis | `#filter-modo` | `currentMode` | `'ups'` \| `'contratos'` |
| Año | `#select-anio` | `currentAnio` | `'2024'`–`'2027'` \| `'all'` |

#### Gráficas

| Canvas | Tipo Chart.js | Métrica |
|--------|--------------|---------|
| `chartSecretaria` | `bar` horizontal | Inversión por secretaría (millones COP) |
| `chartEstado` | `doughnut` | Distribución de frentes por estado |
| `chartTipo` | `bar` horizontal | Top 8 tipos de obra por inversión |
| `chartAnio` | `bar` vertical | Inversión por año de ejecución |
| `chartSecEstado` | `bar` horizontal stacked | Frentes por estado desglosado por secretaría |
| `chartBarrios` | `bar` horizontal dual-eje | Top 12 barrios: inversión (eje inferior) + cantidad (eje superior) |
| `chartAvance` | `bar` vertical | Distribución de avance físico en rangos 0–25%, 25–50%, 50–75%, 75–99%, 100% |

Cada gráfica incluye un bloque `.chart-insight` con el dato más relevante calculado dinámicamente.

#### Tabla y modal

- Tabla completa de proyectos ordenada por presupuesto descendente con scroll vertical (`max-height: 560px`, headers sticky)
- Click en fila abre modal de detalle (`showModal(p)`)
- Modal cierra con botón ×, click en overlay o tecla `Escape`
- Estado del modal: clase `.open` en `#modal-overlay`; `body.overflow = 'hidden'` mientras está abierto

---

## Módulo 2 — Intervenciones Distritales

### Pipeline de datos

```
data/excel/intervenciones_filtradas_YYYY-MM-DD.xlsx
        ↓  scripts/excel_to_json.py
data/intervenciones.json          ← array JSON (~1 MB, UTF-8, sin BOM)
data/intervenciones_meta.json     ← { corte, registros, sin_ubicacion, archivo }
        ↓  GitHub Actions (convert_excel.yml) → commit [skip ci] → push
        ↓  GitHub Pages
paginas/intervenciones_v1.html    ← fetch() directo al JSON
```

### Script `scripts/excel_to_json.py`

```bash
py scripts/excel_to_json.py                               # más reciente en data/excel/
py scripts/excel_to_json.py data/excel/mi_archivo.xlsx   # archivo específico

pip install openpyxl   # única dependencia
```

**Comportamiento:**
- Selecciona el `.xlsx` más reciente por `st_mtime`
- Extrae la fecha de corte del nombre del archivo vía regex `(\d{4}-\d{2}-\d{2})`
- Normaliza fechas a `YYYY-MM-DD` (soporta ISO, DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD)
- Normaliza valores numéricos (maneja separadores de miles en formato COP)
- Escribe `intervenciones.json` (array plano, `ensure_ascii=False`)
- Escribe `intervenciones_meta.json` con corte, conteos y nombre del archivo fuente

### Automatización CI/CD

`.github/workflows/convert_excel.yml` se dispara al hacer push de cualquier `.xlsx` o `.xls` en `data/excel/`:

```yaml
on:
  push:
    paths:
      - 'data/excel/*.xlsx'
      - 'data/excel/*.xls'
```

Pasos: checkout → Python 3.11 + openpyxl → script → commit `[skip ci]` → push.

> **Para actualizar los datos:** subir un nuevo Excel a `data/excel/` con nombre `intervenciones_filtradas_YYYY-MM-DD.xlsx`. El resto es automático.

### Dashboard `intervenciones.js`

JS standalone (sin DataService). Carga paralela con validación HTTP:

```javascript
const [resData, resMeta] = await Promise.all([
  fetch('../data/intervenciones.json'),
  fetch('../data/intervenciones_meta.json').catch(() => null)
]);
if (!resData.ok) throw new Error(`HTTP ${resData.status}: no se pudo cargar intervenciones.json`);
```

Filtros globales reactivos: `currentSec`, `currentEst`, `currentTipo` — cualquier cambio llama a `renderDashboard()` completo.

#### Campos del JSON (`intervenciones.json`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `tipo_intervencion` | string | Categoría de la obra |
| `fecha_inicio` | `YYYY-MM-DD` | Inicio planificado |
| `fecha_fin` | `YYYY-MM-DD` | Fin planificado |
| `estado` | string | Terminado / En ejecución / En alistamiento / Suspendido / Proyectado / Inaugurado |
| `presupuesto_base` | number | Valor en COP |
| `nombre_centro_gestor` | string | Nombre completo de la secretaría |
| `clase_up` | string | Clasificación de la unidad de proyecto |
| `fuente_financiacion` | string | Fuente de recursos |
| `comuna_corregimiento` | string | Unidad territorial |
| `barrio_vereda` | string | Barrio o vereda |
| `descripcion_intervencion` | string | Texto descriptivo |
| `fecha_inauguracion` | `YYYY-MM-DD` \| null | Fecha de entrega oficial |
| `intervencion_id` | string | Identificador único |
| `upid` | string | ID de unidad de proyecto |
| `updated_at` | string | Fecha de última actualización del registro |

#### Gráficas

| Canvas | Tipo Chart.js | Métrica |
|--------|--------------|---------|
| `chartSecretaria` | `bar` horizontal | Inversión por secretaría (miles de millones COP) |
| `chartEstado` | `doughnut` | Distribución por estado |
| `chartComunas` | `bar` horizontal dual-eje | Top 12 comunas: inversión (eje inferior) + cantidad (eje superior) |
| `chartTipo` | `bar` horizontal | Top 10 tipos de intervención por cantidad |
| `chartFuente` | `bar` horizontal | Inversión por fuente de financiación |
| `chartAnio` | `bar` vertical | Intervenciones por año de inicio |
| `chartSecEstado` | `bar` horizontal stacked | Intervenciones por estado desglosado por secretaría |
| `chartTendencia` | `line` multi-serie | Tendencia anual de intervenciones — top 6 secretarías |
| `chartCurvaS` | `line` dual-serie | Curva S: % acumulado planeado vs real ejecutado por trimestre |

#### Curva S — lógica de cálculo

La Curva S usa únicamente `fecha_fin` y `estado`, sin datos de seguimiento mensual:

```
Universo:   registros con fecha_fin registrada (formato YYYY-MM-DD)
Trimestres: 2021-Q1 → 2027-Q4  (28 puntos)

Planeado(t) = count(fecha_fin ≤ fin_trimestre_t) / total × 100
Real(t)     = count(estado ∈ {Terminado, Inaugurado} AND fecha_fin ≤ fin_trimestre_t) / total × 100
Gap(t)      = Planeado(t) − Real(t)
```

Coloración de la línea real: verde si `Gap ≤ 8%`, rojo si `Gap > 8%` (usando `segment.borderColor` de Chart.js 4.x).

El tooltip muestra los tres valores en modo `interaction: { mode: 'index' }`. El insight calcula la brecha en el trimestre más cercano a `new Date()`.

#### Textos dinámicos desde `intervenciones_meta.json`

| ID elemento | Contenido |
|-------------|-----------|
| `#hero-date` | Fuente · corte · total registros |
| `#footer-corte-badge` | Período · corte |
| `#footer-registros` | Conteo total y sin ubicación |

#### Tabla y modal

- Tabla completa ordenada por `presupuesto_base` descendente con scroll vertical (`max-height` en `.table-wrap`)
- Headers sticky (`position: sticky; top: 0; z-index: 2`)
- Click en fila → `showModal(p)` con todos los campos, incluyendo `fecha_inauguracion`, `updated_at` y `descripcion_intervencion` (visibles solo si tienen valor)
- Función `shortSec()` acorta los nombres completos de secretarías para visualización

---

## Patrones comunes entre dashboards

### Destrucción y recreación de gráficas

```javascript
Object.values(myCharts).forEach(c => c && c.destroy());
myCharts = {};
// ... new Chart(...)
```

Previene el error "Canvas already in use" al refiltrar.

### Dual-eje en Chart.js 4.x

```javascript
datasets: [
  { ..., xAxisID: 'x'  },   // eje inferior
  { ..., xAxisID: 'x2' }    // eje superior
],
scales: {
  x:  { position: 'bottom' },
  x2: { position: 'top', grid: { drawOnChartArea: false } }
}
```

### Modal overlay

```css
.modal-overlay { display: none; }
.modal-overlay.open { display: flex; }
```

```javascript
overlay.classList.add('open');      // abrir
document.body.style.overflow = 'hidden';

overlay.classList.remove('open');   // cerrar
document.body.style.overflow = '';
```

Cierre por: botón ×, click en fondo del overlay, tecla `Escape`.

---

## Despliegue

**GitHub Pages:** Settings → Pages → `Deploy from a branch` → `main` / `/ (root)`

Si el deploy queda en "Queued":
```bash
git commit --allow-empty -m "trigger: redeploy pages"
git push
```
