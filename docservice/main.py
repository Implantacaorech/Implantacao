# -*- coding: utf-8 -*-
"""Serviço interno de geração de documentos — nunca exposto publicamente, chamado só
pela API NestJS via HTTP (localhost). Reaproveita a lógica de preenchimento fiel já
existente em webapp/gl_*.py (copiada para gerador/, não importada — ver
docs/migracao/02-decisao-arquitetura.md, "Arquitetura híbrida").

Escopo desta fatia (item 3 da migração): só o cronograma de visitas do Agendador
(`gerar_agenda_xlsx`). Levantamento/Projeto/Termo (.docx, com blocos condicionais por
módulo contratado) ficam para a próxima fatia — são substancialmente mais complexos e
não bloqueiam o Agendador de Visitas já convertido.
"""
import os
import sys
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

if not sys.flags.utf8_mode:
    # Achado real desta migração: sem UTF-8 mode neste Windows, o interpretador decodifica
    # os .py copiados de webapp/gl_*.py com a codepage do sistema (ex.: cp1252) em vez de
    # UTF-8, corrompendo (silenciosamente!) toda string com acento/travessão desses módulos
    # — os documentos gerados saem com "Cronograma de Visitas ? Cliente X" em vez de "—".
    # Falha rápido em vez de gerar documento corrompido sem avisar. Use iniciar.bat (que já
    # define PYTHONUTF8=1) ou rode com `python -X utf8`.
    raise RuntimeError(
        "Este serviço precisa rodar em UTF-8 mode (PYTHONUTF8=1) — sem isso, os módulos "
        "copiados de webapp/gl_*.py são decodificados com a codepage do sistema e todo "
        "texto acentuado sai corrompido nos documentos gerados. Use docservice/iniciar.bat "
        "ou defina a variável de ambiente PYTHONUTF8=1 antes de iniciar o uvicorn."
    )

# Os módulos em gerador/ (copiados de webapp/) usam imports "achatados" (`import db`,
# `from gl_comum import ...`) — mesmo estilo do Flask original, onde webapp/ é a raiz do
# sys.path. Aqui, gerador/ precisa estar na raiz do sys.path pelo mesmo motivo (em vez de
# importado como pacote de fora).
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "gerador"))
import db as db_shim  # noqa: E402
from gl_xlsx import gerar_agenda_xlsx  # noqa: E402

app = FastAPI(
    title="Painel de Implantação — Serviço de Geração de Documentos",
    description="Serviço interno (não público) chamado pela API NestJS.",
    version="1.0.0",
)


class AtividadeDto(BaseModel):
    id: int
    modulo: str
    seq: int
    descricao: str = ""
    tipo: str = ""
    data: str = ""
    turno: str = ""
    tecnico: str = ""
    status: str = ""


class HorarioTurnoDto(BaseModel):
    inicio: str = ""
    fim: str = ""


class HorariosDto(BaseModel):
    manha: HorarioTurnoDto = HorarioTurnoDto()
    tarde: HorarioTurnoDto = HorarioTurnoDto()


class ProjetoDto(BaseModel):
    id: int
    cliente: str = ""
    cnpj: str = ""
    numeroProjeto: str = ""
    consultor: str = ""
    horasCobradas: str = ""
    horasBonificadas: str = ""


class DesignacaoDto(BaseModel):
    modulo: str
    consultor: str = ""
    analista: str = ""


class CronogramaConfigDto(BaseModel):
    analistaPadrao: str = ""


class GerarCronogramaVisitasRequest(BaseModel):
    projeto: ProjetoDto
    atividades: List[AtividadeDto]
    horarios: HorariosDto
    designacoes: List[DesignacaoDto] = []
    cronogramaConfig: Optional[CronogramaConfigDto] = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/gerar/cronograma-visitas")
def gerar_cronograma_visitas(req: GerarCronogramaVisitasRequest):
    """Gera o cronograma de visitas (.xlsx) do Agendador — equivalente a
    webapp/routes_agenda.py:projeto_agenda_gerar. Devolve o arquivo binário."""
    projeto = {
        "id": req.projeto.id,
        "cliente": req.projeto.cliente,
        "cnpj": req.projeto.cnpj,
        "numero_projeto": req.projeto.numeroProjeto,
        "consultor": req.projeto.consultor,
        "horas_cobradas": req.projeto.horasCobradas,
        "horas_bonificadas": req.projeto.horasBonificadas,
    }
    atividades = [a.model_dump() for a in req.atividades]
    horarios = {
        "manha": (req.horarios.manha.inicio, req.horarios.manha.fim),
        "tarde": (req.horarios.tarde.inicio, req.horarios.tarde.fim),
    }
    db_shim.definir_contexto(
        {
            "designacoes": [
                {"modulo": d.modulo, "consultor": d.consultor, "analista": d.analista}
                for d in req.designacoes
            ],
            "cronograma_config": {"analista_padrao": (req.cronogramaConfig.analistaPadrao if req.cronogramaConfig else "")},
        }
    )

    if not any(a["data"] and a["turno"] for a in atividades):
        raise HTTPException(status_code=422, detail="Nenhuma atividade alocada para gerar o cronograma.")

    try:
        caminho = gerar_agenda_xlsx(projeto, atividades, horarios)
    except Exception as e:  # nunca vaza detalhe interno — só loga no servidor
        raise HTTPException(status_code=500, detail="Falha ao gerar o cronograma de visitas.") from e

    nome = os.path.basename(caminho)
    return FileResponse(
        caminho,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=nome,
    )
