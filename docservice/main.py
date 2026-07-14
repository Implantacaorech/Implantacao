# -*- coding: utf-8 -*-
"""Serviço interno de geração de documentos — nunca exposto publicamente, chamado só
pela API NestJS via HTTP (localhost). Reaproveita a lógica de preenchimento fiel já
existente em webapp/gl_*.py (copiada para gerador/, não importada — ver
docs/migracao/02-decisao-arquitetura.md, "Arquitetura híbrida").

Cobre o cronograma de visitas do Agendador (`gerar_agenda_xlsx`) e os três documentos
.docx fiéis (Levantamento, Projeto, Termo — `gerar_docx`), com blocos condicionais por
módulo contratado.
"""
import base64
import os
import sys
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response
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
from gerar_fiel import gerar_docx  # noqa: E402

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


class ProjetoDocxDto(BaseModel):
    id: int
    cliente: str = ""
    cnpj: str = ""
    ramo: str = ""
    gci: str = ""
    consultor: str = ""
    modulos: str = ""
    numeroProjeto: str = ""
    dataLevantamento: str = ""
    dataEncerramento: str = ""
    horasCobradas: str = ""
    horasBonificadas: str = ""
    observacoes: str = ""


class IndiceModuloDto(BaseModel):
    sigla: str
    nome: str = ""


class IndiceTopicoDto(BaseModel):
    moduloSigla: str = ""
    topico: str = ""
    adicional: str = ""


class LevantamentoRespostaDto(BaseModel):
    moduloSigla: str = ""
    topico: str = ""
    resposta: str = ""


class GerarDocumentoFielRequest(BaseModel):
    slug: str            # "levantamento" | "projeto" | "termo"
    modo: str = "auto"    # "modelo" só se aplica ao Projeto (guia de preenchimento manual)
    modeloBase64: str     # bytes do template (.docx) vigente, já lido pelo NestJS
    projeto: ProjetoDocxDto
    docConteudo: Dict[str, str] = {}
    indiceModulos: List[IndiceModuloDto] = []
    indiceTopicos: List[IndiceTopicoDto] = []
    levantamentoRespostas: List[LevantamentoRespostaDto] = []


_SLUGS_DOCX = ("levantamento", "projeto", "termo")


@app.post("/gerar/documento-fiel")
def gerar_documento_fiel(req: GerarDocumentoFielRequest):
    """Gera o Levantamento, Projeto ou Termo (.docx) pelo layout fiel vigente — equivalente
    a webapp/routes_geracao.py:projeto_gerar_layout / gerar_layout.gerar(). Devolve o
    arquivo binário."""
    if req.slug not in _SLUGS_DOCX:
        raise HTTPException(status_code=422, detail="slug inválido — use levantamento, projeto ou termo.")
    try:
        base_bytes = base64.b64decode(req.modeloBase64)
    except Exception as e:
        raise HTTPException(status_code=422, detail="modeloBase64 inválido.") from e

    projeto = {
        "id": req.projeto.id,
        "cliente": req.projeto.cliente,
        "cnpj": req.projeto.cnpj,
        "ramo": req.projeto.ramo,
        "gci": req.projeto.gci,
        "consultor": req.projeto.consultor,
        "modulos": req.projeto.modulos,
        "numero_projeto": req.projeto.numeroProjeto,
        "data_levantamento": req.projeto.dataLevantamento,
        "data_encerramento": req.projeto.dataEncerramento,
        "horas_cobradas": req.projeto.horasCobradas,
        "horas_bonificadas": req.projeto.horasBonificadas,
        "observacoes": req.projeto.observacoes,
    }
    db_shim.definir_contexto(
        {
            "doc_conteudo": req.docConteudo,
            "indice_modulos": [{"sigla": m.sigla, "nome": m.nome} for m in req.indiceModulos],
            "indice_topicos": [
                {"modulo_sigla": t.moduloSigla, "topico": t.topico, "adicional": t.adicional}
                for t in req.indiceTopicos
            ],
            "levantamento_respostas": [
                {"modulo_sigla": r.moduloSigla, "topico": r.topico, "resposta": r.resposta}
                for r in req.levantamentoRespostas
            ],
        }
    )

    try:
        conteudo = gerar_docx(req.slug, projeto, base_bytes, modo=req.modo)
    except Exception as e:  # nunca vaza detalhe interno — só loga no servidor
        raise HTTPException(status_code=500, detail="Falha ao gerar o documento.") from e

    return Response(
        content=conteudo,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": 'attachment; filename="%s.docx"' % req.slug},
    )
