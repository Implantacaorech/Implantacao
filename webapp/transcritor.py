# -*- coding: utf-8 -*-
"""Transcrição LOCAL de vídeos (faster-whisper, CPU int8) — o áudio não sai da rede.

`transcrever_isolado(video)` roda a transcrição num SUBPROCESSO (isola ~1–2 GB de RAM do
modelo e protege o servidor web); devolve dict {"texto","duracao","idioma"} ou lança.
O texto sai com timestamps por bloco de fala:  [MM:SS] fala...

Modelo: env PROTOCOLOS_WHISPER (padrão 'base' — rápido e bom o suficiente em pt-BR;
'small'/'medium' = mais precisão e mais lentos). Primeiro uso baixa o modelo para o cache.
Threads: env PROTOCOLOS_THREADS (padrão 0 = automático, usa todos os núcleos — o mais
rápido nesta CPU, medido em benchmark; só reduza se quiser deixar a máquina mais livre).
"""
import os
import sys
import json

MODELO = os.environ.get("PROTOCOLOS_WHISPER", "base")
THREADS = int(os.environ.get("PROTOCOLOS_THREADS", "0") or 0)   # 0 = auto (todos os núcleos)


def _fmt_ts(seg):
    m, s = divmod(int(seg or 0), 60)
    h, m = divmod(m, 60)
    return ("%d:%02d:%02d" % (h, m, s)) if h else ("%d:%02d" % (m, s))


def transcrever(video_path, progress_cb=None):
    """Transcreve o vídeo (roda NO PROCESSO ATUAL — prefira transcrever_isolado).
    `progress_cb(pos_seg, dur_seg)` é chamado conforme a transcrição avança."""
    from faster_whisper import WhisperModel
    model = WhisperModel(MODELO, device="cpu", compute_type="int8", cpu_threads=THREADS)
    segments, info = model.transcribe(video_path, language="pt", vad_filter=True,
                                      beam_size=1, condition_on_previous_text=False)
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


def transcrever_isolado(video_path, timeout=3 * 3600, progress_file=None):
    """Transcreve em SUBPROCESSO isolado (memória liberada ao fim). Lança em erro/timeout.
    Com `progress_file`, o subprocesso grava ali o andamento em JSON ({pos,dur,pct})."""
    import subprocess
    import tempfile
    out = tempfile.mktemp(suffix=".json")
    args = [sys.executable, os.path.abspath(__file__), os.path.abspath(video_path), out]
    if progress_file:
        args.append(os.path.abspath(progress_file))
    try:
        r = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
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
            res = transcrever(sys.argv[1], progress_cb=cb)
            with open(sys.argv[2], "w", encoding="utf-8") as f:
                json.dump(res, f, ensure_ascii=False)
        except Exception as e:
            sys.stderr.write("%s: %s\n" % (type(e).__name__, e))
            sys.exit(1)
