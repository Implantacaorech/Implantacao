# -*- coding: utf-8 -*-
"""Dispatcher da geração fiel de Levantamento/Projeto/Cronograma/Termo — adaptação stateless
de webapp/gerar_layout.py:gerar(). A lógica de substituição de placeholders continua
100% em gl_levantamento.py/gl_projeto.py/gl_termo.py/gl_xlsx.py/preencher_layout.py,
copiados sem alterar a lógica; só a resolução do arquivo-base muda: aqui ele já chega em
bytes (o NestJS lê do seu próprio store de ModeloDocumento e envia), em vez de buscado por
`db.modelo_documento_arquivo_path` num banco local — este serviço nunca fala com um banco.
"""
from io import BytesIO

import preencher_layout as PL
from gl_levantamento import (_repl_levantamento, _montar_blocos_levantamento,
                             _preencher_levantamento_tabelas, _preencher_levantamento_usuarios)
from gl_projeto import (_repl_projeto, _preencher_detalhamento_projeto,
                        _preencher_escopo_projeto, _preencher_projeto_tabelas)
from gl_termo import _repl_termo, _preencher_termo_grade
from gl_xlsx import _preencher_cronograma_xlsx

_GERADORES_DOCX = {"termo": _repl_termo, "projeto": _repl_projeto, "levantamento": _repl_levantamento}


def gerar_docx(slug, projeto, base_bytes, modo="auto"):
    """Gera o .docx fiel da fase `slug` para `projeto` (dict) a partir do template
    `base_bytes`. Devolve os bytes do documento gerado. `modo='modelo'` (só Projeto)
    preenche o Detalhamento pelas perguntas do Índice quando não há respostas, para
    preenchimento manual — mesmo comportamento de webapp/gerar_layout.py:gerar()."""
    if slug not in _GERADORES_DOCX:
        raise ValueError("Slug de documento desconhecido: %s" % slug)
    repl, paras = _GERADORES_DOCX[slug](projeto)
    doc = PL.preencher_docx(BytesIO(base_bytes), repl, paras)
    if slug == "levantamento":   # blocos contratados + perguntas + tabelas (módulos/horas/usuários)
        _montar_blocos_levantamento(doc, projeto)
        _preencher_levantamento_tabelas(doc, projeto)
        _preencher_levantamento_usuarios(doc, projeto)
    elif slug == "projeto":      # escopo + detalhamento por área + tabelas (usuários/cronograma)
        _preencher_escopo_projeto(doc, projeto)
        _preencher_detalhamento_projeto(doc, projeto, guia=(modo == "modelo"))
        _preencher_projeto_tabelas(doc, projeto)
    elif slug == "termo":        # preenche a grade Resumo Geral com os módulos contratados
        _preencher_termo_grade(doc, projeto.get("modulos", ""))
    PL.remover_marcadores_docx(doc)   # remove todos os marcadores <...> restantes
    out = BytesIO()
    doc.save(out)
    return out.getvalue()


def gerar_xlsx(projeto, base_bytes):
    """Gera o .xlsx fiel do Cronograma a partir do template `base_bytes` — mesmo branch
    `else: # xlsx (cronograma)` de webapp/gerar_layout.py:gerar(). Substitui a razão social
    no cabeçalho do layout e preenche Consultor/Horas + as linhas do CronogramaItem (via
    `db.cronograma_do_projeto`, alimentado pelo contexto desta requisição). Devolve os
    bytes da planilha gerada."""
    repl = []
    cliente = (projeto.get("cliente") or "").strip()
    if cliente:
        repl.append(("XXXX - RAZÃO SOCIAL LONGA", cliente))
    wb = PL.preencher_xlsx(BytesIO(base_bytes), repl)
    _preencher_cronograma_xlsx(wb, projeto)
    out = BytesIO()
    wb.save(out)
    return out.getvalue()
