# -*- coding: utf-8 -*-
"""Helpers e constantes compartilhados da geração fiel (usados por gerar_layout e
seus submódulos gl_levantamento / gl_projeto / gl_termo / gl_xlsx)."""
import os
import datetime

import _common as C
import db

_MESES = ["", "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
          "agosto", "setembro", "outubro", "novembro", "dezembro"]


def _data_iso(s):
    s = (s or "").strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def _por_extenso(d):
    return "%d de %s de %d" % (d.day, _MESES[d.month], d.year)


def _hoje():
    return datetime.date.today()


def _num(v):
    v = str(v or "").strip()
    return v


def _conteudo(p, doc):
    """Valores estruturados (DocConteudo) do documento; val(campo, origem_projeto)."""
    cont = db.doc_conteudo(p.get("id"), doc) if p.get("id") else {}

    def val(campo, orig=None):
        return (cont.get(campo) or (p.get(orig) if orig else "") or "").strip()
    return val


def _norm(s):
    """Normaliza rótulo: colapsa espaços, tira pontuação final e baixa caixa."""
    return " ".join(str(s or "").split()).strip().rstrip(":. ").lower()


def _inserir_textos_depois(anchor_p, textos):
    """Insere parágrafos de texto simples logo após `anchor_p` (preservando ordem)."""
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    el = anchor_p._p
    for txt in textos:
        p = OxmlElement("w:p")
        r = OxmlElement("w:r")
        t = OxmlElement("w:t")
        t.set(qn("xml:space"), "preserve")
        t.text = txt
        r.append(t)
        p.append(r)
        el.addnext(p)
        el = p


def _eh_marcador(t):
    """True se o parágrafo é um placeholder a substituir: '<...>' ou um 'XX' solto."""
    s = (t or "").strip()
    return (s.startswith("<") and s.endswith(">")) or s.upper() == "XX"


def _saida(slug, cliente, ext):
    nome = "%s_%s.%s" % (slug, C.slug(cliente or "cliente"), ext)
    os.makedirs(C.OUT, exist_ok=True)
    return os.path.join(C.OUT, nome)


# Mapa sigla -> palavras-chave dos blocos do Levantamento que ela mantém (AJUSTÁVEL).
_SIGLA_BLOCOS = {
    "FAT": ["vendas e faturamento"], "PDV": ["vendas e faturamento"],
    "OSE": ["vendas e faturamento"], "SAC": ["vendas e faturamento"],
    "GIN": ["produção"], "GCA": ["produção"],
    "EST": ["compras/estoque"], "COM": ["compras/estoque"], "TLO": ["compras/estoque"],
    "FIN": ["gestão financeira"], "GCO": ["gestão financeira"],
    "CTB": ["gestão fiscal"], "LFI": ["gestão fiscal"], "GPA": ["gestão fiscal"], "AUE": ["gestão fiscal"],
    "FPA": ["folha de pagamento"],
    "PWC": ["portal de funcion", "portal de vagas"], "PGP": ["portal de funcion", "portal de vagas"],
    "RHU": ["recrutamento", "treinamen", "saúde ocupacional", "segurança do trabalho",
            "avaliação", "cargos e sal"],
}
_BLOCOS_FIXOS = ["cliente/fornecedor", "produto"]   # blocos fundacionais, sempre mantidos

# Nome de exibição da área (bloco) p/ agrupar a tela do Levantamento.
_BLOCO_DISPLAY = {
    "vendas e faturamento": "Vendas e Faturamento", "produção": "Produção",
    "compras/estoque": "Compras / Estoque", "gestão financeira": "Gestão Financeira",
    "gestão fiscal": "Gestão Fiscal, Contábil e Patrimonial", "folha de pagamento": "Folha de Pagamento",
    "portal de funcion": "Portais", "portal de vagas": "Portais",
    "recrutamento": "RHU", "treinamen": "RHU", "saúde ocupacional": "RHU",
    "segurança do trabalho": "RHU", "avaliação": "RHU", "cargos e sal": "RHU",
}


def area_do_modulo(sigla):
    """Nome de exibição da área (bloco) de um módulo (ou '' se não tiver bloco próprio)."""
    for kw in _SIGLA_BLOCOS.get((sigla or "").upper(), []):
        if kw in _BLOCO_DISPLAY:
            return _BLOCO_DISPLAY[kw]
    return ""


# Grupos do 'Detalhamento das Rotinas' do layout do Projeto -> áreas que contêm (AJUSTÁVEL).
# Um grupo é removido quando NENHUMA das suas áreas foi contratada.
_PROJ_GRUPOS = {
    "gestão comercial": {"vendas e faturamento"},
    "gestão de materiais": {"controle de estoque", "controle de compras"},
    "gestão da produção": {"gestão industrial"},
    "gestão financeira": {"controle financeiro"},
    "gestão de controladoria": {"livros fiscais"},
}
