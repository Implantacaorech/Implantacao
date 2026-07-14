# -*- coding: utf-8 -*-
"""Shim de webapp/db.py — implementa só as funções que gl_xlsx.py/gl_comum.py chamam,
sem nenhum banco de dados: cada requisição HTTP já chega com os dados prontos (a API
NestJS é quem lê o schema novo); este serviço nunca fala com um banco. Os dados "do
projeto atual" ficam num contextvar isolado por requisição (seguro sob concorrência do
uvicorn/asyncio — cada request roda numa cópia própria do contexto).

Isto é deliberadamente um adaptador fino, não uma reimplementação: os módulos `gl_*.py`
foram copiados de webapp/ sem alteração de lógica — só a fonte de dados muda.
"""
from contextvars import ContextVar
from typing import Any, Dict, List, Optional

_contexto: ContextVar[Dict[str, Any]] = ContextVar("contexto_geracao", default={})

TURNO_PADRAO = {"manha": ("08:00", "12:00"), "tarde": ("13:00", "17:00")}


def definir_contexto(dados: Dict[str, Any]) -> None:
    """Chamado pelo endpoint FastAPI antes de invocar o gerador — `dados` inclui
    `designacoes` (lista, mesmo formato de webapp/db.py:designacoes_do_projeto) e
    `cronograma_config` (dict, mesmo formato de webapp/db.py:cronograma_config)."""
    _contexto.set(dados or {})


def designacoes_do_projeto(_pid: Optional[int]) -> List[dict]:
    return _contexto.get().get("designacoes", [])


def cronograma_config(_pid: Optional[int]) -> dict:
    return _contexto.get().get("cronograma_config", {}) or {
        "modo_disponibilidade": "conjunta",
        "data_inicio": "",
        "dias_turnos_excluidos": "",
        "analista_padrao": "",
    }


def cronograma_horas(horarios, turno):
    """Idêntico a webapp/db.py:cronograma_horas — função pura, sem banco."""
    return horarios.get(turno, TURNO_PADRAO.get(turno, ("", "")))


# --- Não usadas por gerar_agenda_xlsx (item 3 desta fatia só converteu o cronograma de
# visitas do Agendador) — os geradores de Levantamento/Projeto/Termo (.docx) ainda
# dependem destas e ficam para a próxima fatia (ver docs/migracao/03-documento-conversao.md).
def cronograma_do_projeto(_pid: Optional[int]) -> List[dict]:
    return []


def doc_conteudo(_pid: Optional[int], _doc: str) -> dict:
    return _contexto.get().get("doc_conteudo", {})


def indice_modulos() -> List[dict]:
    return _contexto.get().get("indice_modulos", [])


def indice_listar(modulo: str = "", q: str = ""):
    linhas = _contexto.get().get("indice_topicos", [])
    if modulo:
        linhas = [l for l in linhas if l.get("modulo_sigla") == modulo]
    return linhas, len(linhas)


def levantamento_respostas(_pid: Optional[int]) -> List[dict]:
    return _contexto.get().get("levantamento_respostas", [])
