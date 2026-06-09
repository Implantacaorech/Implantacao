# -*- coding: utf-8 -*-
"""Gera o Levantamento (Mapeamento de Processos) (.docx) fiel ao template Rech.

Uso:
    python gerar_levantamento.py [data/levantamento.yaml]
"""
import os
import sys
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import _common as C

NAVY = RGBColor(0x1F, 0x4E, 0x78)


def shade_header(row, fill="1F4E78"):
    for cell in row.cells:
        tcPr = cell._tc.get_or_add_tcPr()
        shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:fill"), fill)
        tcPr.append(shd)
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF); r.font.bold = True


def main(lev_path="data/levantamento.yaml"):
    d = C.load_yaml(os.path.basename(lev_path))
    doc, based = C.style_base("levantamento")
    if not based:
        doc.styles["Normal"].font.name = "Calibri"
        doc.styles["Normal"].font.size = Pt(11)

    _HS = {1: 13, 2: 12, 3: 11}

    def H(txt, level=1):
        return C.docx_heading(doc, txt, size=_HS.get(level, 12))

    def P(txt="", bold=False):
        p = doc.add_paragraph(); p.add_run(txt).bold = bold
        return p

    def B(items):
        for it in items or []:
            C.docx_bullet(doc, it)

    def table(headers, rows, empty=0):
        t = doc.add_table(rows=1, cols=len(headers)); t.style = "Table Grid"
        for i, h in enumerate(headers):
            t.rows[0].cells[i].paragraphs[0].add_run(h)
        shade_header(t.rows[0])
        for row in rows:
            cells = t.add_row().cells
            for i, v in enumerate(row): cells[i].text = str(v) if v is not None else ""
        for _ in range(empty):
            t.add_row()
        return t

    # Título
    C.docx_heading(doc, "Mapeamento de Processos", size=16, center=True)
    P("").add_run(d.get("cliente", "")).bold = True
    P(f"Data: {d.get('data','')}")
    P(f"Responsáveis: {d.get('responsaveis','')}")

    H("Revisões", 2)
    table(["Data", "Revisão", "Redator", "Motivo da Alteração"], [], empty=5)

    # Identificação
    H("Informações da empresa", 1)
    H("Identificação da Empresa", 2)
    idf = d.get("identificacao", {})
    for label, key in [("Razão Social", "razao_social"), ("Ramo Atividade", "ramo"),
                       ("Produto", "produto"), ("Fornecedor Atual Software", "fornecedor_atual"),
                       ("Localização / Filiais", "localizacao"),
                       ("Observações / Objetivos", "observacoes_objetivos")]:
        P(f"{label}: {idf.get(key,'')}")

    P("Quantidade usuários e identificação:", bold=True)
    table(["Nome", "E-mail", "Atribuições"],
          [[u.get("nome",""), u.get("email",""), u.get("atribuicoes","")] for u in d.get("usuarios", [])],
          empty=2)

    # Módulos A e B
    P("Resumo dos Módulos e Adicionais Contratados", bold=True)
    table(["Módulos/Adicionais (A) — Previstos antes do Levantamento", "Necessidade", "Observações"],
          [[m.get("modulo",""), m.get("necessidade",""), m.get("obs","")] for m in d.get("modulos_previstos_antes", [])])
    table(["Módulos/Adicionais (B) — Identificados no Levantamento", "Necessidade", "Observações"],
          [[m.get("modulo",""), m.get("necessidade",""), m.get("obs","")] for m in d.get("modulos_identificados", [])])

    # Horas
    H("Implantação/Treinamento", 2)
    h = d.get("horas", {})
    table(["Quantidade de horas Cobradas", "Quantidade de horas Bonificadas", "Total de Horas previstas"],
          [[h.get("cobradas",""), h.get("bonificadas",""), h.get("total","")]])

    # Conversões
    conv = d.get("conversoes", {})
    H(f"Conversões ({conv.get('horas','')} horas)", 2)
    P("Detalhamento e considerações levantadas:", bold=True)
    B([f"{it.get('item','')} – Estimativa: {it.get('estimativa','')}" for it in conv.get("itens", [])])

    H("Desenvolvimentos Específicos", 2)
    P(d.get("desenvolvimentos", "A definir"))

    # Mapeamento por área
    for a in d.get("areas", []):
        H(f"Mapeamento de processo – {a.get('nome','')}", 2)
        P("Módulos Previstos:", bold=True)
        P(a.get("modulos_previstos", ""))
        P("Aspectos identificados", bold=True)
        B(a.get("aspectos"))
        P("Dúvidas e Observações", bold=True)
        B(a.get("duvidas"))

    C.ensure_out()
    fname = f"Levantamento_{C.slug(d.get('cliente'))}.docx"
    path = os.path.join(C.OUT, fname)
    doc.save(path)
    print(f"OK: {fname} ({len(d.get('areas', []))} áreas) -> {path}")


if __name__ == "__main__":
    args = sys.argv[1:]
    main(*args) if args else main()
