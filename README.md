# 🌿 Pulmón del Oriente — Visualización de Inversión Pública

Dashboard interactivo de los proyectos del Plan de Desarrollo Distrital 2024–2027 en las **Comunas 13 y 14** de Santiago de Cali, Colombia.

> Corte de datos: **21 de febrero de 2026** · Fuente: Unidad de Proyectos (UP) · Secretarías Distritales

---

## Vistas disponibles

| Vista | Descripción |
|-------|-------------|
| [Inicio](index.html) | Landing page con acceso a ambas vistas |
| [Informe](paginas/pulmon_oriente_informe-v2.html) | Dashboard analítico con gráficas y estadísticas |
| [Mapa](paginas/pulmon_oriente_mapa_v2.html) | Mapa interactivo con los 325 proyectos geolocalizados |

---

## Datos principales

- **325** proyectos en Comunas 13 y 14
- **$81.7B COP** de inversión total
- **9** secretarías distritales
- **86.5%** de proyectos en fase de alistamiento

### Distribución por secretaría

| Secretaría | Proyectos | Inversión |
|---|---|---|
| Vivienda y Hábitat | 262 | $45.1B |
| Educación | 18 | $24.2B |
| Salud Pública | 13 | $6.5B |
| DAGMA | 4 | $0.5B |
| Otras | 28 | $5.4B |

---

## Estructura del repositorio

```
pulmon-oriente/
├── index.html                          ← Landing page
├── README.md
└── paginas/
    ├── pulmon_oriente_informe-v2.html  ← Dashboard analítico
    └── pulmon_oriente_mapa_v2.html     ← Mapa interactivo
```

---

## Características técnicas

### Informe
- Charts interactivos con [Chart.js 4.4](https://www.chartjs.org/)
- Distribución por secretaría, estado, tipo de inversión, año y barrio
- Tabla de proyectos con búsqueda en tiempo real
- Diseño responsive (desktop / tablet / móvil)

### Mapa
- Mapa interactivo con [Leaflet.js 1.9](https://leafletjs.com/)
- Clustering dinámico con [MarkerCluster](https://github.com/Leaflet/Leaflet.markercluster)
- 325 puntos geolocalizados en GeoJSON embebido
- Filtros por estado (Ejecución / Alistamiento / Terminado / Suspendido) y secretaría
- Panel lateral con detalle completo de cada proyecto
- 3 capas base: OpenStreetMap, Esri Satélite, OpenTopoMap
- Sidebar como *bottom sheet* en móvil

### Navegación
Ambas vistas incluyen un **switcher flotante** en la parte inferior para navegar entre el informe, el mapa y el inicio sin perder el contexto.

---

## Despliegue con GitHub Pages

1. Ve a **Settings → Pages**
2. Fuente: `Deploy from a branch`
3. Branch: `main` / `root`
4. La URL pública será: `https://<usuario>.github.io/<repositorio>/`

---

## Tecnologías

- HTML5 + CSS3 (sin frameworks)
- JavaScript vanilla
- [Chart.js](https://www.chartjs.org/) — gráficas
- [Leaflet.js](https://leafletjs.com/) — mapa
- [Leaflet.MarkerCluster](https://github.com/Leaflet/Leaflet.markercluster) — agrupación de marcadores
- [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans) + [Playfair Display](https://fonts.google.com/specimen/Playfair+Display) — tipografías
- Datos: Unidad de Proyectos (UP) — Municipio de Santiago de Cali

---

*Municipio de Santiago de Cali · Secretaría de Planeación · Plan de Desarrollo 2024–2027*
