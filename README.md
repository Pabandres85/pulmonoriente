# Pulmón del Oriente — Visualización de Inversión Pública

Dashboard web estático que visualiza la inversión pública del Plan de Desarrollo Distrital 2024–2027 en Santiago de Cali, Colombia. Incluye dos módulos de datos complementarios: proyectos geolocalizados del área Pulmón del Oriente e intervenciones distritales de ciudad completa.

> Sin frameworks ni herramientas de build. Archivos estáticos servidos directamente desde GitHub Pages.

---

## Vistas disponibles

| Vista | Archivo | Descripción |
|-------|---------|-------------|
| Inicio | `index.html` | Landing con KPIs globales y acceso a todas las vistas |
| Informe Pulmón | `paginas/pulmon_oriente_informe-v2.html` | Dashboard analítico con gráficas Chart.js |
| Mapa Pulmón | `paginas/pulmon_oriente_mapa_v2.html` | Mapa Leaflet con clusters y filtros |
| Intervenciones Distritales | `paginas/intervenciones_v1.html` | Dashboard ciudad completa con filtros dinámicos |
| Análisis de Impacto | `paginas/pulmon_oriente_impacto_v2.html` | En construcción |

---

## Estructura del proyecto

```
pulmonoriente/
├── index.html
├── assets/
│   ├── css/
│   │   ├── index.css
│   │   ├── informe.css          ← Estilos compartidos: informe + intervenciones
│   │   └── mapa.css
│   └── js/
│       ├── services/
│       │   └── dataService.js   ← Capa de datos centralizada (IIFE global, GeoJSON)
│       ├── index.js
│       ├── informe.js
│       ├── mapa.js
│       └── intervenciones.js    ← Dashboard intervenciones (standalone, sin DataService)
├── data/
│   ├── Total_secretarias.geojson
│   ├── poligonos.geojson
│   ├── tramos_oriente.geojson
│   ├── intervenciones.json      ← Generado automáticamente por script
│   ├── intervenciones_meta.json ← Metadatos del corte (generado por script)
│   └── excel/                   ← Archivos fuente Excel (el más reciente se procesa)
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
| [Turf.js](https://turfjs.org/) | 6.0 | Análisis geoespacial (punto en polígono) |
| [Chart.js](https://www.chartjs.org/) | 4.4.0 | Gráficas (barra horizontal, dona) |
| [openpyxl](https://openpyxl.readthedocs.io/) | — | Lectura de Excel en script Python |
| Google Fonts | — | Inter, Montserrat, JetBrains Mono, IBM Plex Sans, Playfair Display |

---

## Módulo 1 — Pulmón del Oriente

### DataService (`assets/js/services/dataService.js`)

IIFE global que centraliza la carga, caché y procesamiento de los tres GeoJSON:

```javascript
DataService.load(basePath)
  // basePath: './data/'   desde index.html
  //           '../data/'  desde paginas/
  // Caché en memoria + sessionStorage con ETag (un solo fetch por sesión)

DataService.getPerimetro(polyData)      // Feature del perímetro del proyecto
DataService.getProyectos({ pts, perimetro, mode, año })
  // mode: 'ups'       → frentes únicos deduplicados
  // mode: 'contratos' → contratos brutos sin deduplicar
DataService.getKPIs(proyectos)          // { total, inversion, porEstado }
DataService.secGroup(nombreCen)         // secretaría → categoría normalizada
DataService.getColor(nombreCen)         // categoría → color hex
DataService.SEC_COLORS                  // mapa completo de colores
```

### Lógica de deduplicación UPS

Los contratos fuente pueden financiar distintas fases del mismo punto físico. La deduplicación colapsa contratos por huella espacial:

```
Clave única = direccion + latitud + longitud + tipo_equipamiento
```

Al duplicar: se conserva el **presupuesto máximo** y el **avance más alto**.

### Rutas relativas a `data/`

| Archivo JS | `basePath` |
|---|---|
| `assets/js/index.js` | `'./data/'` |
| `assets/js/informe.js` | `'../data/'` |
| `assets/js/mapa.js` | `'../data/'` |
| `assets/js/intervenciones.js` | `'../data/'` |

---

## Módulo 2 — Intervenciones Distritales

### Pipeline de datos

```
data/excel/intervenciones_filtradas_YYYY-MM-DD.xlsx
        ↓  scripts/excel_to_json.py
data/intervenciones.json          ← array JSON (~1 MB, UTF-8)
data/intervenciones_meta.json     ← { corte, registros, sin_ubicacion, archivo }
        ↓  GitHub Actions (convert_excel.yml)  →  git commit [skip ci]  →  push
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

JS standalone (sin DataService). Patrón de inicialización:

```javascript
// Carga paralela de datos y metadatos
const [resData, resMeta] = await Promise.all([
  fetch('../data/intervenciones.json'),
  fetch('../data/intervenciones_meta.json').catch(() => null)
]);
```

Filtros globales: `currentSec`, `currentEst`, `currentTipo` — cualquier cambio llama a `renderDashboard()` completo.

**Gráficas:**

| Canvas | Tipo | Métrica |
|--------|------|---------|
| `chartSecretaria` | Barra horizontal | Inversión por secretaría |
| `chartEstado` | Dona | Distribución por estado |
| `chartTipo` | Barra horizontal | Top 10 tipos de intervención |
| `chartClase` | Dona | Inversión por clase de proyecto |
| `chartFuente` | Barra horizontal | Inversión por fuente de financiación |
| `comunasBars` | HTML bars | Top 14 comunas por inversión |

**Textos dinámicos** actualizados desde `intervenciones_meta.json`:

| ID elemento | Contenido |
|-------------|-----------|
| `#hero-date` | Fuente · corte · total registros |
| `#footer-corte-badge` | Período · corte |
| `#footer-registros` | Conteo total y sin ubicación |

---

## Despliegue

**GitHub Pages:** Settings → Pages → `Deploy from a branch` → `main` / `/ (root)`

Si el deploy queda en "Queued":
```bash
git commit --allow-empty -m "trigger: redeploy pages"
git push
```
