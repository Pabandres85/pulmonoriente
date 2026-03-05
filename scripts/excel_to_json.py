"""
excel_to_json.py
================
Convierte el archivo Excel más reciente de data/excel/ a data/intervenciones.json

Uso:
    py scripts/excel_to_json.py               # toma el .xlsx más reciente
    py scripts/excel_to_json.py data/excel/mi_archivo.xlsx   # archivo específico

Dependencias:
    pip install openpyxl
"""

import json
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("ERROR: falta openpyxl. Ejecuta:  pip install openpyxl")
    sys.exit(1)

# ── RUTAS ────────────────────────────────────────────────────────────────────
REPO_ROOT   = Path(__file__).resolve().parent.parent
EXCEL_DIR   = REPO_ROOT / "data" / "excel"
OUTPUT_FILE = REPO_ROOT / "data" / "intervenciones.json"

# ── DETECTAR ARCHIVO ─────────────────────────────────────────────────────────
if len(sys.argv) > 1:
    excel_path = Path(sys.argv[1])
    if not excel_path.is_absolute():
        excel_path = REPO_ROOT / excel_path
else:
    xlsx_files = sorted(EXCEL_DIR.glob("*.xlsx"), key=lambda p: p.stat().st_mtime, reverse=True)
    xls_files  = sorted(EXCEL_DIR.glob("*.xls"),  key=lambda p: p.stat().st_mtime, reverse=True)
    all_files  = xlsx_files + xls_files
    if not all_files:
        print(f"ERROR: No se encontró ningún archivo Excel en {EXCEL_DIR}")
        sys.exit(1)
    excel_path = all_files[0]

print(f"Convirtiendo: {excel_path.name}")

# ── PARSEO DE FECHA ───────────────────────────────────────────────────────────
def parse_date(v):
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.lower() in ("none", "nat", "nan"):
        return None
    # ISO / datetime con zona horaria
    m = re.match(r"(\d{4}-\d{2}-\d{2})", s)
    if m:
        return m.group(1)
    # DD/MM/YYYY o DD-MM-YYYY
    m = re.match(r"(\d{2})[/\-](\d{2})[/\-](\d{4})", s)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    # YYYY/MM/DD
    m = re.match(r"(\d{4})/(\d{2})/(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return s[:10] if len(s) >= 10 else s

# ── PARSEO DE NÚMERO ─────────────────────────────────────────────────────────
def parse_number(v):
    if v is None:
        return 0
    try:
        return float(v)
    except (ValueError, TypeError):
        s = re.sub(r"[^0-9\.,]", "", str(v))
        try:
            return float(s.replace(",", ""))
        except ValueError:
            return 0

# ── LEER EXCEL ───────────────────────────────────────────────────────────────
wb = openpyxl.load_workbook(excel_path, data_only=True, read_only=True)
ws = wb.active

rows_iter  = ws.iter_rows(values_only=True)
header_row = next(rows_iter)
headers    = [str(h).strip() if h is not None else f"col_{i}" for i, h in enumerate(header_row)]

# Campos que son fechas / numéricos (detectados por nombre de columna)
DATE_FIELDS   = {"fecha_fin", "fecha_inicio", "fecha_inauguracion", "updated_at"}
NUMBER_FIELDS = {"presupuesto_base", "upid"}

records = []
for row in rows_iter:
    r = {}
    for h, v in zip(headers, row):
        if h in DATE_FIELDS:
            r[h] = parse_date(v)
        elif h in NUMBER_FIELDS:
            r[h] = parse_number(v) if h == "presupuesto_base" else (str(v).strip() if v is not None else None)
        else:
            if v is None:
                r[h] = None
            else:
                s = str(v).strip()
                r[h] = s if s else None
    records.append(r)

wb.close()

# ── GUARDAR JSON ─────────────────────────────────────────────────────────────
OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, separators=(",", ":"))

size_kb = OUTPUT_FILE.stat().st_size / 1024
print(f"OK  {len(records)} registros -> {OUTPUT_FILE.relative_to(REPO_ROOT)}  ({size_kb:.0f} KB)")
