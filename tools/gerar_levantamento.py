# -*- coding: utf-8 -*-
"""Gera o Levantamento (Mapeamento de Processos) (.docx) PREENCHENDO O MODELO REAL
da Rech (tools/templates/base_levantamento_modelo.docx). O layout, as seções, as
áreas, a formatação e o espaçamento vêm do PRÓPRIO modelo — só os campos dinâmicos
são preenchidos. Não reconstrói nada do zero.

Uso:
    python gerar_levantamento.py [data/levantamento.yaml]
"""
import os
import re
import sys
import unicodedata
from docx import Document
import _common as C
import catalogo as CAT

MODELO = os.path.join(C.TEMPLATES, "base_levantamento_modelo.docx")


def _set_text(p, text):
    """Substitui o texto do parágrafo preservando o estilo do 1º run."""
    if p.runs:
        p.runs[0].text = text
        for r in p.runs[1:]:
            r.text = ""
    else:
        p.add_run(text)


def _norm_area(s):
    s = re.sub(r"\(rhu\)", "", (s or "").lower())
    s = "".join(ch for ch in unicodedata.normalize("NFKD", s) if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def _h(v):
    """Acrescenta ' horas' quando o valor é só número (informar apenas os números)."""
    v = (str(v) if v is not None else "").strip()
    return (v + " horas") if v and v.replace(".", "").replace(",", "").isdigit() else v


def _fill_table(tbl, rows_data, start=1):
    """Preenche as linhas a partir de 'start' (reaproveita linhas vazias; acrescenta o resto)."""
    for i, row in enumerate(rows_data):
        r = start + i
        cells = tbl.rows[r].cells if r < len(tbl.rows) else tbl.add_row().cells
        for j, v in enumerate(row):
            if j < len(cells):
                cells[j].text = str(v) if v is not None else ""


def main(lev_path="data/levantamento.yaml"):
    d = C.load_yaml(os.path.basename(lev_path))
    idf = d.get("identificacao", {})
    contratados, _ = CAT.resolve(d.get("modulos_contratados"))
    por_area = {}
    for area, mods in (CAT.por_area(contratados) if contratados else []):
        por_area[_norm_area(area)] = "; ".join(m["descricao"] for m in mods if m.get("descricao"))
    conv = d.get("conversoes", {})
    e = conv.get("estimativas", {}) if isinstance(conv.get("estimativas"), dict) else {}

    if not os.path.exists(MODELO):
        sys.exit("ERRO: modelo 'tools/templates/base_levantamento_modelo.docx' não encontrado.")
    doc = Document(MODELO)

    EST = {
        "Imp. Cad. clientes e fornecedores – Estimativa:": _h(e.get("clientes_fornecedores", "")),
        "Imp. Cad. produtos – Estimativa:": _h(e.get("produtos", "")),
        "Imp. Mov. Financeiro doc. em aberto – Estimativa:": _h(e.get("financeiro", "")),
        "Imp. Notas Fiscais já emitidas – Estimativa:": _h(e.get("notas_fiscais", "")),
        "Importação de movimentos da Folha de Pagamento:": _h(e.get("folha", "")),
    }

    area_atual = None
    for p in doc.paragraphs:
        t = p.text.replace("\xa0", " ").strip()   # normaliza espaço não-quebrável
        if not t:
            continue
        if t.startswith("Mapeamento de processo"):
            area_atual = _norm_area(re.split(r"[–-]", t, 1)[-1])
            continue
        if t == "< Nome Cliente >":
            _set_text(p, d.get("cliente", ""))
        elif t.startswith("Data:"):
            _set_text(p, "Data: " + str(d.get("data", "")))
        elif t.startswith("Responsáveis:"):
            _set_text(p, "Responsáveis: " + str(d.get("responsaveis", "")))
        elif t.startswith("<Razão Social"):
            _set_text(p, "Razão Social: " + (idf.get("razao_social") or d.get("cliente", "")))
        elif t.startswith("Ramo Atividade:"):
            _set_text(p, "Ramo Atividade: " + idf.get("ramo", ""))
        elif t.startswith("Produto:"):
            _set_text(p, "Produto: " + idf.get("produto", ""))
        elif t.startswith("Fornecedor Atual Software:"):
            _set_text(p, "Fornecedor Atual Software: " + idf.get("fornecedor_atual", ""))
        elif t.startswith("<Localização"):
            _set_text(p, "Localização / Filiais: " + idf.get("localizacao", ""))
        elif t.startswith("Observações / Objetivos:"):
            _set_text(p, "Observações / Objetivos: " + idf.get("observacoes_objetivos", ""))
        elif t.startswith("<Quantidade usuários"):
            tot = d.get("total_usuarios") or (len(d.get("usuarios", [])) or "")
            _set_text(p, "Quantidade usuários e identificação: " + (str(tot) + " usuários" if tot else ""))
        elif t.startswith("CONVERSÕES"):
            _set_text(p, "CONVERSÕES (%s horas)" % conv.get("horas", ""))
        elif any(t.startswith(pref) for pref in EST):
            pref = next(pr for pr in EST if t.startswith(pr))
            _set_text(p, pref + " " + EST[pref])
        elif re.fullmatch(r"<x+\s*>", t) or t == "XX":
            _set_text(p, por_area.get(area_atual, ""))
        # "<Colar aqui...>" e demais textos: mantidos como no modelo

    for tbl in doc.tables:
        h0 = tbl.rows[0].cells[0].text.strip() if tbl.rows else ""
        if h0 == "Nome":
            _fill_table(tbl, [[u.get("nome", ""), u.get("email", ""), u.get("atribuicoes", "")]
                              for u in d.get("usuarios", [])], start=1)
        elif h0.startswith("Módulos/Adicionais (A)"):
            rows = [[f"{m['abrev']} — {m['descricao']}", "X", "", ""] for m in contratados]
            for m in (d.get("modulos_previstos_antes") or []) if not rows else []:
                nec = (m.get("necessidade", "") or "").strip().lower()
                rows.append([m.get("modulo", ""), "X" if nec == "sim" else "",
                             "X" if nec in ("não", "nao") else "", m.get("obs", "")])
            _fill_table(tbl, rows, start=2)
        elif h0.startswith("Módulos/Adicionais (B)"):
            _fill_table(tbl, [[m.get("modulo", ""), m.get("necessidade", ""), m.get("obs", "")]
                              for m in (d.get("modulos_identificados") or [])], start=2)
        elif h0.startswith("Quantidade de horas"):
            h = d.get("horas", {})
            _fill_table(tbl, [[_h(h.get("cobradas", "")), _h(h.get("bonificadas", "")), _h(h.get("total", ""))]], start=1)

    C.ensure_out()
    fname = f"Levantamento_{C.slug(d.get('cliente'))}.docx"
    path = os.path.join(C.OUT, fname)
    doc.save(path)
    print(f"OK: {fname} -> {path}")


if __name__ == "__main__":
    args = sys.argv[1:]
    main(*args) if args else main()
