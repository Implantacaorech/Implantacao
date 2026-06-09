# -*- coding: utf-8 -*-
"""Check List por módulo: lê tools/data/checklist_modulos.yaml e devolve as
linhas de roteiro (Tipo, Integrações, Go-Live, Menu, Item, Ação, Seq) dos
módulos contratados — usado no 'Guia do Consultor' do Levantamento."""
import _common as C


def load():
    try:
        return C.load_yaml("checklist_modulos.yaml").get("linhas", []) or []
    except Exception:
        return []


def rows_for(abbrevs):
    """Linhas cujo 'adicional' está na lista de módulos contratados (ordem da planilha)."""
    s = {str(a).strip().upper() for a in abbrevs or []}
    return [l for l in load() if str(l.get("adicional", "")).upper() in s]
