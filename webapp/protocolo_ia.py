# -*- coding: utf-8 -*-
"""Análise IA da transcrição do vídeo -> registro de protocolo estruturado.

Usa a mesma chave/config de IA do painel (tools/ia.py — Config → IA). Regras duras:
NUNCA inventar; módulo sem evidência = 'Módulo a validar'; menu incerto =
'Menu não identificado - revisar manualmente'; faltou detalhe = 'Informação não
detalhada no vídeo'. O que for irrelevante é removido e LISTADO para auditoria.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "tools"))
import ia  # noqa: E402  (chave + modelo + _extrai_json)

import db  # noqa: E402

SISTEMA = (
    "Você transforma a TRANSCRIÇÃO de um vídeo de treinamento do ERP SIGER (Rech) em um "
    "REGISTRO DE PROTOCOLO estruturado, em português do Brasil.\n\n"
    "REGRAS OBRIGATÓRIAS:\n"
    "1. NUNCA invente informação que não esteja na transcrição.\n"
    "2. Se faltar detalhe, escreva exatamente: 'Informação não detalhada no vídeo'.\n"
    "3. 'modulo' deve ser UM destes: %s. Sem evidência clara -> 'Módulo a validar'.\n"
    "4. 'menu' = o menu do SIGER citado (ex.: '1.4-I', '2.6-R', 'Cadastro de Produtos'). "
    "Sem certeza -> 'Menu não identificado - revisar manualmente'.\n"
    "5. REMOVA da versão final: conversas paralelas, comentários pessoais, dúvidas sem "
    "relação, assuntos de passagem, problemas técnicos alheios, interrupções e repetições. "
    "Liste resumidamente o que foi removido em 'assuntos_removidos' (auditoria).\n"
    "6. Em 'pendencias', liste o que precisa de revisão humana (menu/módulo ambíguo, "
    "configuração citada mas não demonstrada, trecho inaudível...).\n"
    "7. 'passo_a_passo' numerado (1., 2., ...), prático, na ordem executada no vídeo.\n"
    "8. Quando útil, referencie o tempo do vídeo entre colchetes, ex.: [12:35].\n"
    "9. Listas (pre_requisitos, configuracoes, dependencias, regras_negocio, "
    "pontos_atencao, exemplos, assuntos_removidos, pendencias): um item por linha, "
    "prefixado com '- '.\n\n"
    "Responda APENAS com um objeto JSON (sem texto antes/depois) com EXATAMENTE estas "
    "chaves, todas strings: titulo, modulo, menu, assunto, resumo, objetivo, "
    "quando_utilizar, pre_requisitos, passo_a_passo, configuracoes, dependencias, "
    "regras_negocio, pontos_atencao, exemplos, assuntos_removidos, pendencias."
) % ", ".join("'%s'" % m for m in db.PROTO_MODULOS)


def disponivel():
    return ia.disponivel()


def analisar(transcricao, video_nome=""):
    """Analisa a transcrição e devolve (campos: dict, bruto: str). Lança em erro."""
    import anthropic
    key = ia.get_key()
    if not key:
        raise RuntimeError("Chave de IA não configurada (Config → IA).")
    client = anthropic.Anthropic(api_key=key)
    user = ("Vídeo: %s\n\nTRANSCRIÇÃO (com timestamps):\n%s" % (video_nome, transcricao))
    resp = client.messages.create(
        model=ia.MODELO, max_tokens=8000, system=SISTEMA,
        messages=[{"role": "user", "content": user}])
    bruto = "".join(getattr(b, "text", "") for b in resp.content
                    if getattr(b, "type", "") == "text")
    data = ia._extrai_json(bruto)
    if not isinstance(data, dict):
        raise RuntimeError("A IA não devolveu o JSON esperado.")
    campos = {}
    for c in db.PROTO_CAMPOS_TEXTO:
        campos[c] = str(data.get(c) or "").strip()
    if campos.get("modulo") not in db.PROTO_MODULOS:
        campos["modulo"] = "Módulo a validar"
    if not campos.get("menu"):
        campos["menu"] = "Menu não identificado - revisar manualmente"
    if not campos.get("titulo"):
        campos["titulo"] = "Protocolo de treinamento — %s" % (video_nome or "vídeo")
    return campos, bruto
