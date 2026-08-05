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

import diarizacao

MODELO = os.environ.get("PROTOCOLOS_WHISPER", "small")
THREADS = int(os.environ.get("PROTOCOLOS_THREADS", "0") or 0)   # 0 = auto (todos os núcleos)
# beam_size=1 é busca gulosa: rápido e o que estava aqui, mas erra em palavra ambígua —
# escolhe a primeira hipótese sem comparar alternativas. 5 é o padrão do Whisper.
BEAM = int(os.environ.get("PROTOCOLOS_BEAM", "5") or 5)


def _fmt_ts(seg):
    m, s = divmod(int(seg or 0), 60)
    h, m = divmod(m, 60)
    return ("%d:%02d:%02d" % (h, m, s)) if h else ("%d:%02d" % (m, s))


def transcrever(video_path, progress_cb=None, vocabulario=None, pessoas=0):
    """Transcreve o vídeo (roda NO PROCESSO ATUAL — prefira transcrever_isolado).
    `progress_cb(pos_seg, dur_seg)` é chamado conforme a transcrição avança.
    `vocabulario` são termos esperados (nomes, jargão) — ver docstring do módulo.
    `pessoas` >= 2 liga a separação de locutores: o texto sai como '[MM:SS] P1: fala'."""
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
    # Com separação de locutores o casamento é PALAVRA a palavra: uma frase do Whisper
    # atravessa a troca de turno com frequência, e cortar por frase colaria a resposta de
    # um na fala do outro.
    if pessoas and pessoas >= 2:
        opcoes["word_timestamps"] = True
    segments, info = model.transcribe(video_path, **opcoes)
    dur_total = int(getattr(info, "duration", 0) or 0)

    coletados, dur = [], 0
    for seg in segments:
        coletados.append(seg)
        dur = max(dur, int(seg.end or 0))
        if progress_cb:
            try:
                progress_cb(dur, dur_total, "transcrevendo")
            except Exception:
                pass

    trechos = []
    if pessoas and pessoas >= 2 and diarizacao.disponivel():
        # Depois da transcrição, de propósito: a barra de progresso acompanha a parte
        # longa, e a separação entra como uma fase própria — senão a tela ficaria parada
        # em 99% por vários minutos sem dizer por quê.
        if progress_cb:
            try:
                progress_cb(dur_total or dur, dur_total, "separando vozes")
            except Exception:
                pass
        try:
            trechos = diarizacao.separar(video_path, pessoas)
        except Exception as e:
            # Falhar aqui não pode custar a transcrição inteira: sai sem os rótulos.
            sys.stderr.write("diarizacao falhou: %s: %s\n" % (type(e).__name__, e))

    return {"texto": _montar_texto(coletados, trechos),
            "duracao": dur_total or dur,
            "idioma": getattr(info, "language", "pt"),
            "locutores": len({t["locutor"] for t in trechos}) if trechos else 0}


def _montar_texto(segmentos, trechos):
    """Monta o texto final. Sem diarização: '[MM:SS] fala' (como sempre foi). Com
    diarização: '[MM:SS] P1: fala', agrupando palavras seguidas do mesmo locutor num turno.
    Os rótulos são P1, P2...; os nomes reais entram depois, pelo mapa do painel, sem
    reescrever o texto."""
    if not trechos:
        return "\n".join(
            "[%s] %s" % (_fmt_ts(s.start), (s.text or "").strip())
            for s in segmentos
            if (s.text or "").strip()
        )

    turnos, anterior = [], None
    for seg in segmentos:
        for palavra in (seg.words or []):
            quem = diarizacao.quem_falou(trechos, palavra.start, palavra.end, anterior)
            anterior = quem
            if turnos and turnos[-1]["quem"] == quem:
                turnos[-1]["texto"] += palavra.word
            else:
                turnos.append({"quem": quem, "ini": palavra.start, "texto": palavra.word})

    linhas = []
    for t in turnos:
        texto = t["texto"].strip()
        if not texto:
            continue
        linhas.append(
            "[%s] P%d: %s" % (_fmt_ts(t["ini"]), (t["quem"] or 0) + 1, texto)
        )
    return "\n".join(linhas)


def transcrever_isolado(video_path, timeout=3 * 3600, progress_file=None,
                        vocabulario=None, pessoas=0):
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
    if pessoas:
        env["PROTOCOLOS_PESSOAS"] = str(int(pessoas))
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
    ultimo = [0.0, "transcrevendo"]

    def cb(pos, dur, fase="transcrevendo"):
        agora = time.time()
        # A troca de fase é sempre gravada: é ela que explica na tela por que a barra
        # parou de andar (a separação de vozes não tem progresso próprio).
        if agora - ultimo[0] < 2 and fase == ultimo[1]:
            return
        ultimo[0], ultimo[1] = agora, fase
        pct = int(round(100.0 * pos / dur)) if dur else 0
        with open(path, "w", encoding="utf-8") as f:
            json.dump(
                {"pos": int(pos), "dur": int(dur), "pct": min(pct, 99), "fase": fase}, f
            )
    return cb


if __name__ == "__main__":   # subprocesso: python transcritor.py <video> <saida.json> [progresso.json]
    if len(sys.argv) in (3, 4):
        try:
            cb = _grava_progresso(sys.argv[3]) if len(sys.argv) == 4 else None
            res = transcrever(
                sys.argv[1], progress_cb=cb,
                vocabulario=os.environ.get("PROTOCOLOS_HOTWORDS"),
                pessoas=int(os.environ.get("PROTOCOLOS_PESSOAS", "0") or 0),
            )
            with open(sys.argv[2], "w", encoding="utf-8") as f:
                json.dump(res, f, ensure_ascii=False)
        except Exception as e:
            sys.stderr.write("%s: %s\n" % (type(e).__name__, e))
            sys.exit(1)
