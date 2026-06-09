# -*- coding: utf-8 -*-
"""Extrai o conteúdo do Levantamento (.docx) e gera um 'seed' por área
(tools/data/projeto_seed.yaml) para alimentar o Projeto de Implantação.

É a ponte Levantamento -> Projeto: o agente (IA) lê este seed e redige as
descrições no formato do Projeto (Detalhamento / Particularidade / Não previsto),
para o Gerente de Projeto revisar antes de gerar o documento.

Uso:
    python extrair_levantamento.py "caminho/Levantamento.docx"
"""
import os
import re
import sys
import glob
import yaml
import _common as C

# Mapa: área do levantamento -> (grupo, sub) do Projeto
MAPA_AREAS = {
    "VENDAS E FATURAMENTO": ("Gestão Comercial", "Vendas e Faturamento"),
    "COMPRAS/ESTOQUE": ("Gestão de Materiais", "Controle de Estoque/Compras"),
    "PRODUÇÃO": ("Gestão da Produção", "Gestão Industrial"),
    "GESTÃO FINANCEIRA": ("Gestão Financeira", "Controle Financeiro"),
    "GESTÃO FISCAL, CONTÁBIL E PATRIMONIAL": ("Gestão de Controladoria", "Livros Fiscais"),
    "FOLHA DE PAGAMENTO": ("Gestão de Pessoas", "Folha de Pagamento"),
    "CLIENTE/FORNECEDOR": ("Cadastros", "Clientes e Fornecedores"),
    "PRODUTO": ("Cadastros", "Produtos/Serviços"),
}

IGNORAR = {"aspectos identificados", "dúvidas e observações", "módulos previstos:",
           "visão geral", "módulos previsto:"}


def is_instr(text):
    t = text.strip().lower()
    return (t.startswith("<colar aqui") or t.startswith("<explicar") or
            t.startswith("<detalhar") or t in IGNORAR or not t)


def _iter_blocks(doc):
    from docx.oxml.table import CT_Tbl
    from docx.oxml.text.paragraph import CT_P
    from docx.table import Table
    from docx.text.paragraph import Paragraph
    for child in doc.element.body.iterchildren():
        if isinstance(child, CT_P):
            yield "p", Paragraph(child, doc)
        elif isinstance(child, CT_Tbl):
            yield "t", Table(child, doc)


def _placeholder(t):
    return t.strip("<> ").lower() in ("xxxxxxx", "xx", "")


def extrair(path):
    from docx import Document
    doc = Document(path)
    paras = [p.text.strip() for p in doc.paragraphs]

    # Nome do cliente: primeira linha não vazia após "Mapeamento de Processos"
    cliente = ""
    for i, t in enumerate(paras):
        if t and "Mapeamento de Processos" in t and i + 1 < len(paras):
            for j in range(i + 1, min(i + 6, len(paras))):
                cand = paras[j].strip("<> ").strip()
                if cand and "Data:" not in cand and "Responsáveis" not in cand:
                    cliente = cand
                    break
            break

    # Seções por área (parágrafos + tabelas em ordem do documento)
    areas = []
    atual = None
    for kind, blk in _iter_blocks(doc):
        if kind == "p":
            t = blk.text.strip()
            m = re.match(r"Mapeamento de processo\s*[–-]\s*(.+)", t, re.IGNORECASE)
            if m:
                if atual and atual["notas"]:
                    areas.append(atual)
                nome = m.group(1).strip().upper()
                grupo, sub = MAPA_AREAS.get(nome, ("(definir)", nome.title()))
                atual = {"area_levantamento": nome, "grupo": grupo, "sub": sub, "notas": []}
            elif atual is not None and t and not is_instr(t) and not _placeholder(t):
                atual["notas"].append(t)
        elif kind == "t" and atual is not None:
            # quadro de perguntas/respostas preenchido pelo consultor
            for row in blk.rows:
                cells = [c.text.strip() for c in row.cells]
                line = " | ".join(c for c in cells if c)
                if line and not is_instr(line) and not _placeholder(line):
                    atual["notas"].append(line)
    if atual and atual["notas"]:
        areas.append(atual)

    return {"cliente": cliente, "areas": areas}


def main(path=None):
    if not path:
        dl = os.path.expanduser("~/Downloads")
        cands = [p for p in glob.glob(os.path.join(dl, "Mapeamento levantamento*.docx"))
                 if "XXXX" not in p]
        if not cands:
            print("Informe o caminho do levantamento .docx"); return
        path = cands[0]

    seed = extrair(path)
    out = os.path.join(C.DATA, "projeto_seed.yaml")
    with open(out, "w", encoding="utf-8") as f:
        f.write("# Seed gerado do levantamento: " + os.path.basename(path) + "\n")
        f.write("# A IA (skill projeto-implantacao) redige 'detalhamento/particularidades/\n")
        f.write("# nao_previsto' por área a partir das 'notas'; o GP revisa antes de gerar.\n")
        yaml.safe_dump(seed, f, allow_unicode=True, sort_keys=False, width=100)
    print(f"OK: seed de {len(seed['areas'])} área(s) -> {out}")
    print(f"   Cliente detectado: {seed['cliente'] or '(não detectado)'}")
    for a in seed["areas"]:
        print(f"   - {a['area_levantamento']} -> {a['grupo']} / {a['sub']}  ({len(a['notas'])} notas)")


if __name__ == "__main__":
    args = sys.argv[1:]
    main(*args) if args else main()
