# -*- coding: utf-8 -*-
"""Transcrição LOCAL de vídeo OU áudio (faster-whisper, CPU int8) — o áudio não sai da rede.
Aceita vídeo (extrai o áudio) e arquivos de áudio direto (mp3/wav/m4a/ogg/opus/flac/...).

`transcrever_isolado(video)` roda a transcrição num SUBPROCESSO (isola ~1–2 GB de RAM do
modelo e protege o servidor web); devolve dict {"texto","duracao","idioma"} ou lança.
O texto sai com timestamps por bloco de fala:  [MM:SS] fala...

Modelo: env PROTOCOLOS_WHISPER (padrão 'small'). Medido nesta máquina (i7-1255U) em 2026-07-30
sobre 120 s de uma reunião real:

    base   beam=1  ->  10,7x tempo real  |  "independente, será a matéria prima ou pronto"
    base   beam=5  ->   6,6x tempo real  |  idem, ainda embolado
    small  beam=5  ->   2,4x tempo real  |  "independente se ele é matéria-prima ou produto pronto"
    medium beam=5  ->   0,9x tempo real  |  praticamente igual ao small

Por isso o padrão saiu de 'base' para 'small': o ganho de inteligibilidade é grande e 2,4x
ainda deixa a transcrição ao vivo acompanhar a reunião. 'medium' custa 4x o tempo do small
para ganho que não apareceu neste áudio — só vale em máquina bem mais forte.

Threads: env PROTOCOLOS_THREADS (padrão 0 = automático, usa todos os núcleos).

VOCABULÁRIO (env PROTOCOLOS_HOTWORDS): lista de termos que o modelo deve "esperar ouvir" —
nomes de participantes, do cliente, jargão do SIGER. É o que corrige o erro clássico de nome
próprio (o modelo escreveu "IVEA" onde a pessoa disse "IVIAN"): sem contexto, ele escolhe a
sequência de sons mais provável do português geral, não a do vocabulário desta reunião.
"""
import os
import sys
import json

MODELO = os.environ.get("PROTOCOLOS_WHISPER", "small")
THREADS = int(os.environ.get("PROTOCOLOS_THREADS", "0") or 0)   # 0 = auto (todos os núcleos)
# beam_size=1 é busca gulosa: rápido e o que estava aqui, mas erra em palavra ambígua —
# escolhe a primeira hipótese sem comparar alternativas. 5 é o padrão do Whisper.
BEAM = int(os.environ.get("PROTOCOLOS_BEAM", "5") or 5)


def _fmt_ts(seg):
    m, s = divmod(int(seg or 0), 60)
    h, m = divmod(m, 60)
    return ("%d:%02d:%02d" % (h, m, s)) if h else ("%d:%02d" % (m, s))


def transcrever(video_path, progress_cb=None, vocabulario=None):
    """Transcreve o vídeo (roda NO PROCESSO ATUAL — prefira transcrever_isolado).
    `progress_cb(pos_seg, dur_seg)` é chamado conforme a transcrição avança.
    `vocabulario` são termos esperados (nomes, jargão) — ver docstring do módulo."""
    from faster_whisper import WhisperModel
    model = WhisperModel(MODELO, device="cpu", compute_type="int8", cpu_threads=THREADS)
    opcoes = dict(
        language="pt",
        vad_filter=True,
        # Sem esse respiro, o filtro de voz corta o ataque das palavras e o modelo perde a
        # primeira sílaba — parte dos "erros de transcrição" nasce aí, não do modelo.
        vad_parameters=dict(min_silence_duration_ms=500, speech_pad_ms=400),
        beam_size=BEAM,
        # Arquivo inteiro: deixar o modelo levar o contexto adiante melhora muito termo
        # técnico repetido e nome próprio já citado. (No ao vivo isto fica desligado — lá
        # cada trecho é independente e o contexto viraria invenção.)
        condition_on_previous_text=True,
    )
    if vocabulario:
        opcoes["hotwords"] = vocabulario
    segments, info = model.transcribe(video_path, **opcoes)
    dur_total = int(getattr(info, "duration", 0) or 0)
    linhas, dur = [], 0
    for seg in segments:
        t = (seg.text or "").strip()
        if t:
            linhas.append("[%s] %s" % (_fmt_ts(seg.start), t))
        dur = max(dur, int(seg.end or 0))
        if progress_cb:
            try:
                progress_cb(dur, dur_total)
            except Exception:
                pass
    return {"texto": "\n".join(linhas),
            "duracao": dur_total or dur,
            "idioma": getattr(info, "language", "pt")}


def transcrever_isolado(video_path, timeout=3 * 3600, progress_file=None, vocabulario=None):
    """Transcreve em SUBPROCESSO isolado (memória liberada ao fim). Lança em erro/timeout.
    Com `progress_file`, o subprocesso grava ali o andamento em JSON ({pos,dur,pct}).
    `vocabulario` viaja por variável de ambiente, e não por argumento de linha de comando:
    é texto livre digitado pelo usuário (nomes, termos), que quebraria o quoting do shell."""
    import subprocess
    import tempfile
    out = tempfile.mktemp(suffix=".json")
    args = [sys.executable, os.path.abspath(__file__), os.path.abspath(video_path), out]
    if progress_file:
        args.append(os.path.abspath(progress_file))
    env = dict(os.environ)
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    if vocabulario:
        env["PROTOCOLOS_HOTWORDS"] = vocabulario
    try:
        r = subprocess.run(args, capture_output=True, text=True, timeout=timeout, env=env)
        if r.returncode != 0 or not os.path.exists(out):
            raise RuntimeError((r.stderr or r.stdout or "transcrição falhou").strip()[-400:])
        with open(out, encoding="utf-8") as f:
            return json.load(f)
    finally:
        for f in (out, progress_file):
            try:
                if f:
                    os.remove(f)
            except OSError:
                pass


def _grava_progresso(path):
    """Callback que grava {pos,dur,pct} no arquivo de progresso (com throttle de ~2s)."""
    import time
    ultimo = [0.0]

    def cb(pos, dur):
        agora = time.time()
        if agora - ultimo[0] < 2:
            return
        ultimo[0] = agora
        pct = int(round(100.0 * pos / dur)) if dur else 0
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"pos": int(pos), "dur": int(dur), "pct": min(pct, 99)}, f)
    return cb


if __name__ == "__main__":   # subprocesso: python transcritor.py <video> <saida.json> [progresso.json]
    if len(sys.argv) in (3, 4):
        try:
            cb = _grava_progresso(sys.argv[3]) if len(sys.argv) == 4 else None
            res = transcrever(sys.argv[1], progress_cb=cb,
                              vocabulario=os.environ.get("PROTOCOLOS_HOTWORDS"))
            with open(sys.argv[2], "w", encoding="utf-8") as f:
                json.dump(res, f, ensure_ascii=False)
        except Exception as e:
            sys.stderr.write("%s: %s\n" % (type(e).__name__, e))
            sys.exit(1)
