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
from gerar_fiel import gerar_docx, gerar_xlsx  # noqa: E402

# transcricao/ usa o mesmo estilo de import "achatado" (`import transcritor`) — mesmo
# motivo do gerador/ acima.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "transcricao"))
import servico as transcricao_servico  # noqa: E402
import vivo as transcricao_vivo  # noqa: E402

import docview  # noqa: E402

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


class CronogramaItemDto(BaseModel):
    etapa: str = ""
    topicos: str = ""
    horas: str = ""
    data: str = ""
    modalidade: str = ""
    status: str = ""


class GerarDocumentoFielRequest(BaseModel):
    slug: str            # "levantamento" | "projeto" | "cronograma" | "termo"
    modo: str = "auto"    # "modelo" só se aplica ao Projeto (guia de preenchimento manual)
    modeloBase64: str     # bytes do template (.docx/.xlsx) vigente, já lido pelo NestJS
    projeto: ProjetoDocxDto
    docConteudo: Dict[str, str] = {}
    indiceModulos: List[IndiceModuloDto] = []
    indiceTopicos: List[IndiceTopicoDto] = []
    levantamentoRespostas: List[LevantamentoRespostaDto] = []
    cronogramaItens: List[CronogramaItemDto] = []


_SLUGS_DOCX = ("levantamento", "projeto", "termo")
_SLUGS_XLSX = ("cronograma",)
_TIPO_CONTEUDO = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


@app.post("/gerar/documento-fiel")
def gerar_documento_fiel(req: GerarDocumentoFielRequest):
    """Gera o Levantamento, Projeto, Cronograma ou Termo pelo layout fiel vigente —
    equivalente a webapp/routes_geracao.py:projeto_gerar_layout / gerar_layout.gerar().
    Levantamento/Projeto/Termo saem em .docx; Cronograma sai em .xlsx (preenchido a partir
    das linhas editáveis de CronogramaItem). Devolve o arquivo binário."""
    if req.slug not in _SLUGS_DOCX and req.slug not in _SLUGS_XLSX:
        raise HTTPException(
            status_code=422,
            detail="slug inválido — use levantamento, projeto, cronograma ou termo.",
        )
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
            "cronograma_itens": [i.model_dump() for i in req.cronogramaItens],
        }
    )

    tipo = "xlsx" if req.slug in _SLUGS_XLSX else "docx"
    try:
        if tipo == "xlsx":
            conteudo = gerar_xlsx(projeto, base_bytes)
        else:
            conteudo = gerar_docx(req.slug, projeto, base_bytes, modo=req.modo)
    except Exception as e:  # nunca vaza detalhe interno — só loga no servidor
        raise HTTPException(status_code=500, detail="Falha ao gerar o documento.") from e

    return Response(
        content=conteudo,
        media_type=_TIPO_CONTEUDO[tipo],
        headers={"Content-Disposition": 'attachment; filename="%s.%s"' % (req.slug, tipo)},
    )


class IniciarTranscricaoRequest(BaseModel):
    protocoloId: int
    caminhoVideo: str
    # Termos esperados (nomes dos participantes, cliente, jargão do SIGER) — ver
    # transcricao/transcritor.py, seção VOCABULÁRIO.
    vocabulario: str = ""
    # Quantas vozes separar (>= 2 liga a diarização). Informado, não descoberto — ver
    # transcricao/diarizacao.py.
    pessoas: int = 0


@app.post("/transcrever", status_code=202)
def iniciar_transcricao(req: IniciarTranscricaoRequest):
    """Dispara a transcrição (faster-whisper, local, CPU) em segundo plano — devolve na
    hora; o chamador acompanha via GET /transcrever/{id}/status. Equivalente a
    webapp/protocolos.py:processar (só a etapa de transcrição — a análise por IA e a
    máquina de estados do Protocolo continuam no NestJS, que é quem tem o banco)."""
    try:
        transcricao_servico.iniciar(
            req.protocoloId, req.caminhoVideo, req.vocabulario, req.pessoas
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail="Arquivo de vídeo não encontrado.") from e
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    return {"status": "processando"}


@app.get("/transcrever/{protocolo_id}/status")
def status_transcricao(protocolo_id: int):
    """Andamento do job: {status: 'processando'|'concluido'|'erro', pct, pos, dur} durante
    o processamento, ou o resultado final (transcricao/duracaoSeg/idioma, ou mensagem de
    erro) quando termina. 404 se a transcrição nunca foi iniciada para este id."""
    job = transcricao_servico.status(protocolo_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Nenhuma transcrição iniciada para este protocolo.")
    return job


@app.delete("/transcrever/{protocolo_id}")
def cancelar_transcricao(protocolo_id: int):
    """Desiste da transcrição do ARQUIVO: mata o subprocesso e esquece o job. Espelha o
    `DELETE /transcrever/vivo/{id}` da gravação ao vivo, que existia desde sempre — aqui
    não existia, e por isso cancelar na tela do painel deixava o transcritor moendo o vídeo
    até o fim (377% de CPU em 2026-08-06, sem ninguém para receber o resultado).

    Idempotente: cancelar o que não existe devolve `{"cancelado": false}`, não erro."""
    return {"cancelado": transcricao_servico.cancelar(protocolo_id)}


class IniciarVivoRequest(BaseModel):
    sessaoId: int
    vocabulario: str = ""


class TrechoVivoRequest(BaseModel):
    seq: int
    audioBase64: str


class FinalizarVivoRequest(BaseModel):
    caminhoDestino: str
    timeoutSeg: int = 300


@app.post("/transcrever/vivo", status_code=202)
def iniciar_vivo(req: IniciarVivoRequest):
    """Abre uma sessão de transcrição AO VIVO (reunião presencial ou remota pelo Teams) e
    sobe o worker com o modelo aquecido. O navegador manda os trechos de áudio em
    POST /transcrever/vivo/{id}/trecho enquanto a reunião acontece."""
    try:
        transcricao_vivo.iniciar(req.sessaoId, req.vocabulario)
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    return {"status": "gravando"}


@app.post("/transcrever/vivo/{sessao_id}/trecho")
def trecho_vivo(sessao_id: int, req: TrechoVivoRequest):
    """Recebe um trecho de áudio (WAV 16 kHz mono 16 bits, base64) e o enfileira para
    transcrição. Devolve na hora — o texto aparece no GET de estado."""
    try:
        audio = base64.b64decode(req.audioBase64)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Áudio em base64 inválido.") from e
    try:
        return transcricao_vivo.trecho(sessao_id, req.seq, audio)
    except KeyError as e:
        raise HTTPException(status_code=404, detail="Gravação não encontrada (sessão encerrada?).") from e
    except ValueError as e:
        # 4xx com str(e) é deliberado: a mensagem do ValueError é do domínio ("trecho fora
        # de ordem", "sessão já finalizada") e serve ao chamador.
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        # 5xx NÃO devolve str(e): falha interna do worker pode carregar caminho de arquivo
        # e detalhe de ambiente. Mesma regra já aplicada na geração de documentos (acima).
        raise HTTPException(status_code=500, detail="Falha ao processar o trecho de áudio.") from e


@app.get("/transcrever/vivo/{sessao_id}")
def estado_vivo(sessao_id: int):
    """Andamento da gravação: {pronto, duracaoSeg, trechos, pendentes, texto, erro}."""
    estado = transcricao_vivo.estado(sessao_id)
    if estado is None:
        raise HTTPException(status_code=404, detail="Nenhuma gravação em andamento para esta sessão.")
    return estado


@app.post("/transcrever/vivo/{sessao_id}/finalizar")
def finalizar_vivo(sessao_id: int, req: FinalizarVivoRequest):
    """Encerra a gravação: espera a fila drenar, junta os trechos num único .wav em
    `caminhoDestino` e devolve a transcrição completa."""
    try:
        return transcricao_vivo.finalizar(sessao_id, req.caminhoDestino, req.timeoutSeg)
    except KeyError as e:
        raise HTTPException(status_code=404, detail="Nenhuma gravação em andamento para esta sessão.") from e


@app.delete("/transcrever/vivo/{sessao_id}")
def cancelar_vivo(sessao_id: int):
    """Descarta a gravação (mata o worker e apaga os trechos)."""
    return {"cancelado": transcricao_vivo.cancelar(sessao_id)}


class PreviewRequest(BaseModel):
    caminho: str


@app.post("/preview")
def preview(req: PreviewRequest):
    """Pré-visualização WYSIWYG de um documento gerado/anexado — equivalente a
    webapp/routes_fluxo.py:projeto_doc_ver. .docx tenta PDF fiel via Word COM (com cache);
    sem Word ou para .xlsx, cai no HTML. A validação de que `caminho` está numa pasta
    permitida é responsabilidade do NestJS (docservice nunca é exposto publicamente)."""
    if not os.path.exists(req.caminho):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    pdf = docview.to_pdf(req.caminho)
    if pdf:
        with open(pdf, "rb") as f:
            conteudo = f.read()
        return {"tipo": "pdf", "conteudoBase64": base64.b64encode(conteudo).decode("ascii")}
    return {"tipo": "html", "html": docview.to_html(req.caminho)}
