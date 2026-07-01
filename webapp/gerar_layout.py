# -*- coding: utf-8 -*-
"""Geração FIEL das documentações das fases a partir dos layouts cadastrados (fachada).

Pega o arquivo VIGENTE do modelo (Cadastro → Modelos de Documentos), troca só os
placeholders conhecidos pelos dados do projeto e salva um novo arquivo, com a mesma
estrutura do anexo. A lógica vive em submódulos por documento; esta fachada apenas
despacha e re-exporta a interface pública (gerar, gerar_agenda_xlsx, area_do_modulo).
"""
import os

import db
import preencher_layout as PL
from gl_comum import area_do_modulo, _saida   # noqa: F401  (area_do_modulo é interface pública)
from gl_levantamento import (_repl_levantamento, _montar_blocos_levantamento,
                             _preencher_levantamento_tabelas, _preencher_levantamento_usuarios)
from gl_projeto import _repl_projeto, _preencher_detalhamento_projeto, _preencher_projeto_tabelas
from gl_termo import _repl_termo, _preencher_termo_grade
from gl_xlsx import gerar_agenda_xlsx, _preencher_cronograma_xlsx   # noqa: F401  (gerar_agenda_xlsx é interface pública)

_GERADORES_DOCX = {"termo": _repl_termo, "projeto": _repl_projeto, "levantamento": _repl_levantamento}


def gerar(slug, projeto, modo="auto"):
    """Gera o documento fiel da fase `slug` para o `projeto` (dict). Devolve o caminho.
    `modo='modelo'` (só Projeto) preenche o Detalhamento pelas perguntas do Índice
    quando não há respostas, para preenchimento manual."""
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
        if slug == "levantamento":   # blocos contratados + perguntas + tabelas (módulos/horas/usuários)
            _montar_blocos_levantamento(doc, projeto)
            _preencher_levantamento_tabelas(doc, projeto)
            _preencher_levantamento_usuarios(doc, projeto)
        elif slug == "projeto":      # detalhamento por área + tabelas (usuários/cronograma)
            _preencher_detalhamento_projeto(doc, projeto, guia=(modo == "modelo"))
            _preencher_projeto_tabelas(doc, projeto)
        elif slug == "termo":        # preenche a grade Resumo Geral com os módulos contratados
            _preencher_termo_grade(doc, projeto.get("modulos", ""))
        PL.remover_marcadores_docx(doc)   # remove todos os marcadores <...> restantes
        doc.save(destino)
    else:  # xlsx (cronograma)
        repl = []
        cli = (projeto.get("cliente") or "").strip()
        if cli:
            repl.append(("XXXX - RAZÃO SOCIAL LONGA", cli))
        wb = PL.preencher_xlsx(base, repl)
        _preencher_cronograma_xlsx(wb, projeto)   # cabeçalho (consultor/horas) + linhas de visita
        wb.save(destino)
    return destino
