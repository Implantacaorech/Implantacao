# -*- coding: utf-8 -*-
"""Orquestração da transcrição — expõe a `transcritor.transcrever_isolado` (copiada sem
alterar de webapp/transcritor.py) como um job assíncrono em memória, já que uma
transcrição pode levar até 3h e o docservice nunca deve bloquear a resposta HTTP por tanto
tempo. Um `threading.Lock` global serializa as transcrições (CPU pesado) — mesmo padrão de
webapp/protocolos.py:_BUSY, só que aqui cada `POST /transcrever` dispara uma thread de
fundo e devolve na hora; quem chama consulta o andamento em `GET /transcrever/{id}/status`.

O NestJS é quem decide QUANDO chamar (ele possui o Protocolo e a máquina de estados) —
este serviço só executa e reporta; nunca fala com um banco."""
import json
import os
import threading

import transcritor

_BUSY = threading.Lock()
_jobs = {}          # protocoloId -> {"status": "processando"|"concluido"|"erro", ...}
_lock_jobs = threading.Lock()

_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dados", "progresso")


def _progresso_path(protocolo_id):
    os.makedirs(_DIR, exist_ok=True)
    return os.path.join(_DIR, "protocolo_%d.json" % int(protocolo_id))


def _rodar(protocolo_id, caminho_video):
    with _BUSY:
        try:
            t = transcritor.transcrever_isolado(
                caminho_video, progress_file=_progresso_path(protocolo_id)
            )
            texto = (t.get("texto") or "").strip()
            if not texto:
                raise RuntimeError("Transcrição vazia (vídeo sem fala reconhecível?).")
            resultado = {
                "status": "concluido",
                "transcricao": t.get("texto") or "",
                "duracaoSeg": int(t.get("duracao") or 0),
                "idioma": t.get("idioma") or "pt",
            }
        except Exception as e:
            resultado = {"status": "erro", "mensagem": "%s: %s" % (type(e).__name__, e)}
        with _lock_jobs:
            _jobs[protocolo_id] = resultado


def iniciar(protocolo_id, caminho_video):
    """Dispara a transcrição em segundo plano. Lança FileNotFoundError se o vídeo não
    existir; lança RuntimeError se já houver um job em andamento para este id."""
    if not os.path.exists(caminho_video):
        raise FileNotFoundError(caminho_video)
    with _lock_jobs:
        atual = _jobs.get(protocolo_id)
        if atual and atual.get("status") == "processando":
            raise RuntimeError("Já há uma transcrição em andamento para este protocolo.")
        _jobs[protocolo_id] = {"status": "processando"}
    threading.Thread(
        target=_rodar, args=(protocolo_id, caminho_video),
        daemon=True, name="transcricao-%s" % protocolo_id,
    ).start()


def status(protocolo_id):
    """Devolve o estado atual do job, ou None se nunca foi iniciado. Durante
    'processando', mescla pct/pos/dur lidos do arquivo de progresso (gravado pelo
    subprocesso, com throttle de ~2s — pode não existir ainda no início)."""
    with _lock_jobs:
        job = _jobs.get(protocolo_id)
    if job is None:
        return None
    out = dict(job)
    if out.get("status") == "processando":
        out.update(pct=None, pos=0, dur=0)
        try:
            with open(_progresso_path(protocolo_id), encoding="utf-8") as f:
                j = json.load(f)
            out.update(pct=j.get("pct"), pos=j.get("pos") or 0, dur=j.get("dur") or 0)
        except Exception:
            pass
    return out
