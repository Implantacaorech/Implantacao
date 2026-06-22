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


def _topicos_por_modulo(modulos_str):
    """Para cada módulo contratado (sigla em projeto.modulos), busca os tópicos do
    cadastro Índice de Tópicos. Devolve [{sigla, nome, topicos:[linhas]}] na ordem informada."""
    import re as _re
    sigs = [m.strip().upper() for m in _re.split(r"[,;\n]+", modulos_str or "") if m.strip()]
    nomes = {m["sigla"].upper(): m["nome"] for m in db.indice_modulos()}
    out, vistos = [], set()
    for sig in sigs:
        if sig in vistos:
            continue
        vistos.add(sig)
        linhas, _ = db.indice_listar(modulo=sig)
        if linhas:
            out.append({"sigla": sig, "nome": nomes.get(sig, ""), "topicos": linhas})
    return out


def _anexar_topicos_levantamento(doc, modulos_str):
    """Acrescenta ao Levantamento, por módulo contratado, as perguntas/tópicos do Índice
    de Tópicos a serem respondidas. Não depende de estilos do template (robusto)."""
    grupos = _topicos_por_modulo(modulos_str)
    if not grupos:
        return 0

    def linha(txt="", bold=False):
        p = doc.add_paragraph()
        if txt:
            p.add_run(txt).bold = bold
        return p

    linha()
    linha("Tópicos a levantar por módulo contratado", bold=True)
    linha("Itens do Índice de Tópicos a responder no Levantamento, por módulo contratado.")
    total = 0
    for g in grupos:
        linha()
        linha("%s — %s" % (g["sigla"], g["nome"] or ""), bold=True)
        atual = None
        for l in g["topicos"]:
            adic = (l.get("adicional") or "").strip()
            if adic and adic != atual:
                linha(adic, bold=True)
                atual = adic
            doc.add_paragraph("•  " + (l.get("topico") or "").strip())
            total += 1
    return total


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
        if slug == "levantamento":   # injeta as perguntas do Índice de Tópicos por módulo contratado
            _anexar_topicos_levantamento(doc, projeto.get("modulos", ""))
        doc.save(destino)
    else:  # xlsx (cronograma)
        repl = []
        cli = (projeto.get("cliente") or "").strip()
        if cli:
            repl.append(("XXXX - RAZÃO SOCIAL LONGA", cli))
        wb = PL.preencher_xlsx(base, repl)
        wb.save(destino)
    return destino
