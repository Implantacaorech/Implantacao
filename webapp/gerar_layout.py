# -*- coding: utf-8 -*-
"""Geração FIEL das documentações das fases a partir dos layouts cadastrados.

Pega o arquivo VIGENTE do modelo (Cadastro → Modelos de Documentos), troca só os
placeholders conhecidos pelos dados do projeto e salva um novo arquivo, com a
mesma estrutura do anexo. Os placeholders manuais (estimativas, quadros de
perguntas, <XX> por área) permanecem como guia para o consultor.
"""
import os
import datetime

import _common as C
import db
import preencher_layout as PL

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


# ---- mapas de preenchimento por modelo (literal -> valor) -------------------
def _repl_termo(p):
    cli = (p.get("cliente") or "").strip()
    repl, paras = [], []
    if cli:
        repl.append(("<Razão Social Longa>", cli))
    if (p.get("numero_projeto") or "").strip():
        repl.append(("<Número do projeto quando se aplicar>", p["numero_projeto"].strip()))
    d = _data_iso(p.get("data_encerramento")) or _hoje()
    paras.append(("Novo Hamburgo", "Novo Hamburgo, %s." % _por_extenso(d)))
    return repl, paras


def _repl_projeto(p):
    cli = (p.get("cliente") or "").strip()
    repl, paras = [], []
    if cli:
        # ocorrências no corpo (literais ASCII) + linha-cabeçalho via prefixo
        repl += [("<Nome do Cliente >", cli), ("<Nome do Cliente>", cli)]
        paras.append(("Nome do Cliente:", "Nome do Cliente: %s" % cli))
    if (p.get("cnpj") or "").strip():
        paras.append(("CNPJ", "CNPJ: %s" % p["cnpj"].strip()))
    if (p.get("observacoes") or "").strip():
        repl.append(("<(preencher)>", p["observacoes"].strip()))
    hb, hc = _num(p.get("horas_bonificadas")), _num(p.get("horas_cobradas"))
    if hb:
        repl.append(("<XX horas bonificadas>", "%s horas bonificadas" % hb))
    if hc:
        repl.append(("<XX horas cobradas>", "%s horas cobradas" % hc))
    paras.append(("Novo Hamburgo", "Novo Hamburgo, %s." % _por_extenso(_hoje())))
    return repl, paras


def _repl_levantamento(p):
    cli = (p.get("cliente") or "").strip()
    repl, paras = [], []
    if cli:
        repl.append(("< Nome Cliente >", cli))
        paras.append(("<Razão Social:", "Razão Social: %s" % cli))
    d = _data_iso(p.get("data_levantamento"))
    if d:
        repl.append(("<xx/xx/xxxxx>", d.strftime("%d/%m/%Y")))
    resp = " / ".join(x for x in (p.get("gci"), p.get("consultor")) if x)
    if resp:
        repl.append(("<xxxxxxxxxxxxx>", resp))
    if (p.get("ramo") or "").strip():
        paras.append(("Ramo Atividade", "Ramo Atividade: %s" % p["ramo"].strip()))
    return repl, paras


_GERADORES_DOCX = {"termo": _repl_termo, "projeto": _repl_projeto, "levantamento": _repl_levantamento}


def _saida(slug, cliente, ext):
    nome = "%s_%s.%s" % (slug, C.slug(cliente or "cliente"), ext)
    os.makedirs(C.OUT, exist_ok=True)
    return os.path.join(C.OUT, nome)


def gerar(slug, projeto):
    """Gera o documento fiel da fase `slug` para o `projeto` (dict). Devolve o caminho."""
    modelo = next((m for m in db.modelos_documento_listar() if m["slug"] == slug), None)
    if not modelo:
        raise ValueError("Modelo '%s' não cadastrado." % slug)
    base = db.modelo_documento_arquivo_path(modelo["id"])
    if not base or not os.path.exists(base):
        raise FileNotFoundError("Arquivo do modelo '%s' não encontrado." % slug)
    destino = _saida(slug, projeto.get("cliente"), modelo["tipo"])

    if modelo["tipo"] == "docx":
        repl, paras = _GERADORES_DOCX.get(slug, lambda p: ([], []))(projeto)
        doc = PL.preencher_docx(base, repl, paras)
        doc.save(destino)
    else:  # xlsx (cronograma)
        repl = []
        cli = (projeto.get("cliente") or "").strip()
        if cli:
            repl.append(("XXXX - RAZÃO SOCIAL LONGA", cli))
        wb = PL.preencher_xlsx(base, repl)
        wb.save(destino)
    return destino
