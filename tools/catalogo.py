# -*- coding: utf-8 -*-
"""Catálogo de módulos: lê tools/data/catalogo_modulos.yaml e resolve/agrupa
módulos por código ou abreviação (usado pelo gerador de Levantamento)."""
import _common as C

# Ordem canônica das áreas no Levantamento.
AREA_ORDER = [
    "Cliente/Fornecedor", "Produto",
    "Vendas e Faturamento", "Produção", "Compras/Estoque",
    "Gestão Financeira", "Gestão Fiscal, Contábil e Patrimonial",
    "Folha de Pagamento", "Recursos Humanos", "Recrutamento e Seleção",
    "Treinamentos", "Saúde Ocupacional", "Segurança do Trabalho",
    "Cargos e Salários", "Avaliação e Feedback",
    "Portal de Funcionários", "Portal de Vagas",
    "Comércio Exterior", "BI e Integrações", "Outros",
]


def load():
    try:
        return C.load_yaml("catalogo_modulos.yaml").get("modulos", []) or []
    except Exception:
        return []


def _index():
    by_cod, by_ab = {}, {}
    for m in load():
        by_cod[str(m.get("codigo"))] = m
        by_ab[str(m.get("abrev", "")).upper()] = m
    return by_cod, by_ab


def resolve(tokens):
    """tokens = lista de códigos ou abreviações. Retorna (encontrados, faltantes)."""
    by_cod, by_ab = _index()
    achados, faltam, vistos = [], [], set()
    for t in tokens or []:
        key = str(t).strip()
        m = by_cod.get(key) or by_ab.get(key.upper())
        if m and m["abrev"] not in vistos:
            achados.append(m); vistos.add(m["abrev"])
        elif not m:
            faltam.append(t)
    return achados, faltam


def por_area(modulos):
    """Agrupa módulos por área, na ordem canônica. Retorna [(area, [modulos])]."""
    grupos = {}
    for m in modulos:
        grupos.setdefault(m.get("area", "Outros"), []).append(m)
    saida = [(a, grupos.pop(a)) for a in AREA_ORDER if a in grupos]
    saida += list(grupos.items())   # áreas fora da ordem canônica, se houver
    return saida
