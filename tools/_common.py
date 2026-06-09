# -*- coding: utf-8 -*-
"""Helpers compartilhados pelos geradores Office (.xlsx/.docx)."""
import os
import re
import unicodedata
import datetime
import yaml
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, "exemplos")

# Estilos
HEADER_FILL = PatternFill("solid", fgColor="1F4E78")
HEADER_FONT = Font(bold=True, color="FFFFFF", size=11)
TITLE_FONT = Font(bold=True, size=16, color="1F4E78")
SUB_FONT = Font(italic=True, color="595959")
_THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=_THIN, right=_THIN, top=_THIN, bottom=_THIN)
WRAP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)


def load_yaml(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def ensure_out():
    os.makedirs(OUT, exist_ok=True)
    return OUT


def today():
    return datetime.date.today().strftime("%d/%m/%Y")


def slug(text):
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode()
    text = re.sub(r"[^A-Za-z0-9]+", "_", text).strip("_")
    return text or "cliente"


def safe_sheet(name):
    """Sanitiza nome de aba do Excel (proíbe \\ / ? * [ ] : e máx. 31 chars)."""
    name = re.sub(r"[\\/?*\[\]:]", "-", str(name))
    return name[:31]


def header_row(ws, headers, row=1):
    for col, text in enumerate(headers, start=1):
        c = ws.cell(row=row, column=col, value=text)
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = CENTER
        c.border = BORDER
    ws.row_dimensions[row].height = 28
    ws.freeze_panes = ws.cell(row=row + 1, column=1)


def set_widths(ws, widths):
    from openpyxl.utils import get_column_letter
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w


def write_rows(ws, rows, start=2):
    for r, row in enumerate(rows, start=start):
        for c, val in enumerate(row, start=1):
            cell = ws.cell(row=r, column=c, value=val)
            cell.alignment = WRAP
            cell.border = BORDER


def title_block(ws, title, subtitle=None, span=6):
    from openpyxl.utils import get_column_letter
    ws.merge_cells(f"A1:{get_column_letter(span)}1")
    t = ws.cell(row=1, column=1, value=title)
    t.font = TITLE_FONT
    if subtitle:
        ws.merge_cells(f"A2:{get_column_letter(span)}2")
        s = ws.cell(row=2, column=1, value=subtitle)
        s.font = SUB_FONT
