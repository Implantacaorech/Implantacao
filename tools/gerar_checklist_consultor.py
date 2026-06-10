# -*- coding: utf-8 -*-
"""
Gera a planilha "Check List do Consultor" (.xlsx) ao final do levantamento:
- Aba "Módulos Contratados": os módulos/adicionais levantados (código, abrev,
  descrição, área).
- Aba "Roteiro e Check List": Módulo · Adicional · Tipo · Integrações · Item de
  Go-Live · Menu · Item · Ação/Observação · Sequência (+ Status/Responsável/Data
  para o Consultor acompanhar).

Lê os módulos de `modulos_contratados` (códigos/abreviações) no YAML do
levantamento. Uso:
    python gerar_checklist_consultor.py [data/levantamento.yaml]
"""
import os
import sys
from openpyxl import Workbook
from openpyxl.worksheet.datavalidation import DataValidation
import _common as C
import catalogo as CAT
import checklist as CK


def aba_modulos(wb, cliente, mods):
    ws = wb.active
    ws.title = "Módulos Contratados"
    C.title_block(ws, "Módulos e Adicionais Contratados",
                  f"{cliente} · gerado em {C.today()}", span=5)
    cols = ["Código", "Abrev.", "Descrição", "Área", "Necessidade"]
    C.header_row(ws, cols, row=4)
    C.set_widths(ws, [10, 10, 46, 34, 14])
    rows = [[m.get("codigo", ""), m.get("abrev", ""), m.get("descricao", ""),
             m.get("area", ""), "Sim"] for m in mods]
    C.write_rows(ws, rows, start=5)


def aba_checklist(wb, linhas):
    ws = wb.create_sheet("Roteiro e Check List")
    cols = ["Módulo", "Adicional", "Tipo", "Integrações", "Item de Go-Live",
            "Menu", "Item", "Ação/Observação", "Sequência",
            "Status", "Responsável", "Concluído em"]
    C.header_row(ws, cols)
    C.set_widths(ws, [10, 10, 16, 18, 14, 10, 40, 50, 10, 14, 18, 14])
    rows = [[l.get("modulo", ""), l.get("adicional", ""), l.get("tipo", ""),
             l.get("integracoes", ""), l.get("golive", ""), l.get("menu", ""),
             l.get("item", ""), l.get("acao", ""), l.get("seq", ""), "", "", ""]
            for l in linhas]
    C.write_rows(ws, rows)
    n = len(rows)
    if n:
        dv = DataValidation(type="list", formula1='"Pendente,Em andamento,Concluído,N/A"', allow_blank=True)
        ws.add_data_validation(dv)
        dv.add(f"J2:J{n + 1}")       # coluna Status


def main(yaml_path="data/levantamento.yaml"):
    d = C.load_yaml(os.path.basename(yaml_path))
    cliente = d.get("cliente") or d.get("client_name") or "Cliente"
    contratados, _ = CAT.resolve(d.get("modulos_contratados"))
    linhas = CK.rows_for(d.get("modulos_contratados"))

    wb = Workbook()
    aba_modulos(wb, cliente, contratados)
    aba_checklist(wb, linhas)

    C.ensure_out()
    fname = f"CheckList_Consultor_{C.slug(cliente)}.xlsx"
    path = os.path.join(C.OUT, fname)
    wb.save(path)
    print(f"OK: {fname} ({len(contratados)} módulos, {len(linhas)} itens de checklist) -> {path}")


if __name__ == "__main__":
    args = sys.argv[1:]
    main(*args) if args else main()
