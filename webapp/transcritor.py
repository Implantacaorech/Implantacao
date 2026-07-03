# -*- coding: utf-8 -*-
"""Transcrição LOCAL de vídeos (faster-whisper, CPU int8) — o áudio não sai da rede.

`transcrever_isolado(video)` roda a transcrição num SUBPROCESSO (isola ~1–2 GB de RAM do
modelo e protege o servidor web); devolve dict {"texto","duracao","idioma"} ou lança.
O texto sai com timestamps por bloco de fala:  [MM:SS] fala...

Modelo: env PROTOCOLOS_WHISPER (padrão 'small' — bom pt-BR em CPU; 'medium' = mais
qualidade e mais lento). Primeiro uso baixa o modelo (~460 MB) para o cache local.
"""
import os
import sys
import json

MODELO = os.environ.get("PROTOCOLOS_WHISPER", "small")


def _fmt_ts(seg):
    m, s = divmod(int(seg or 0), 60)
    h, m = divmod(m, 60)
    return ("%d:%02d:%02d" % (h, m, s)) if h else ("%d:%02d" % (m, s))


def transcrever(video_path):
    """Transcreve o vídeo (roda NO PROCESSO ATUAL — prefira transcrever_isolado)."""
    from faster_whisper import WhisperModel
    model = WhisperModel(MODELO, device="cpu", compute_type="int8")
    segments, info = model.transcribe(video_path, language="pt", vad_filter=True)
    linhas, dur = [], 0
    for seg in segments:
        t = (seg.text or "").strip()
        if t:
            linhas.append("[%s] %s" % (_fmt_ts(seg.start), t))
        dur = max(dur, int(seg.end or 0))
    return {"texto": "\n".join(linhas),
            "duracao": int(getattr(info, "duration", 0) or dur),
            "idioma": getattr(info, "language", "pt")}


def transcrever_isolado(video_path, timeout=3 * 3600):
    """Transcreve em SUBPROCESSO isolado (memória liberada ao fim). Lança em erro/timeout."""
    import subprocess
    import tempfile
    out = tempfile.mktemp(suffix=".json")
    try:
        r = subprocess.run([sys.executable, os.path.abspath(__file__),
                            os.path.abspath(video_path), out],
                           capture_output=True, text=True, timeout=timeout)
        if r.returncode != 0 or not os.path.exists(out):
            raise RuntimeError((r.stderr or r.stdout or "transcrição falhou").strip()[-400:])
        with open(out, encoding="utf-8") as f:
            return json.load(f)
    finally:
        try:
            os.remove(out)
        except OSError:
            pass


if __name__ == "__main__":   # subprocesso: python transcritor.py <video> <saida.json>
    if len(sys.argv) == 3:
        try:
            res = transcrever(sys.argv[1])
            with open(sys.argv[2], "w", encoding="utf-8") as f:
                json.dump(res, f, ensure_ascii=False)
        except Exception as e:
            sys.stderr.write("%s: %s\n" % (type(e).__name__, e))
            sys.exit(1)
