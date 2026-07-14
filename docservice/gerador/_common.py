# -*- coding: utf-8 -*-
"""Shim mínimo de tools/_common.py — só o que gl_xlsx.py/gl_comum.py realmente usam
(`OUT`, `slug`). Este serviço é stateless: nunca lê YAML de dados nem monta caminho de
template a partir de um "DATA_WRITE" — cada requisição já chega com os dados prontos."""
import os
import re
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "saida")
os.makedirs(OUT, exist_ok=True)


def slug(text):
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode()
    text = re.sub(r"[^A-Za-z0-9]+", "_", text).strip("_")
    return text or "cliente"
