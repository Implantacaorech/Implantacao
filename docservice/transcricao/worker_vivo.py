# -*- coding: utf-8 -*-
"""Worker da transcrição AO VIVO — subprocesso que mantém o modelo faster-whisper
CARREGADO entre um trecho e outro.

Por que um subprocesso dedicado (e não `transcritor.transcrever_isolado`, usado no
pipeline de vídeo): lá cada transcrição roda um subprocesso novo, que carrega o modelo do
zero (~1-2 s + 1-2 GB de RAM) — aceitável quando se transcreve um vídeo inteiro de uma
vez, inviável quando chega um trecho de ~20 s a cada ~20 s. Aqui o modelo é carregado UMA
vez, no início da reunião, e fica quente até o fim; ao encerrar, o processo morre e a
memória é devolvida ao sistema (mesma motivação de isolamento do transcritor original — o
modelo nunca vive dentro do processo web).

Protocolo (uma linha JSON por mensagem, UTF-8):
  entrada (stdin):  {"seq": 3, "caminho": "...\\trecho_0003.wav"}   |  {"evento": "encerrar"}
  saída  (stdout):  {"evento": "pronto"}                            (modelo carregado)
                    {"evento": "trecho", "seq": 3, "segmentos": [{"inicio": 1.2, "texto": "..."}]}
                    {"evento": "trecho", "seq": 3, "segmentos": [], "erro": "..."}

`inicio` é relativo ao começo DO TRECHO — quem soma o deslocamento da reunião é o
`vivo.py`, que sabe a duração de cada trecho já recebido.
"""
import json
import os
import sys


def _responder(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main():
    # Modelo próprio para o ao vivo: por padrão o mesmo do pipeline de vídeo ('base'), mas
    # separável por env — no ao vivo o que importa é acompanhar a fala em tempo real, e um
    # modelo mais leve ('tiny') pode ser preferível em máquina disputada.
    modelo = (
        os.environ.get("PROTOCOLOS_WHISPER_VIVO")
        or os.environ.get("PROTOCOLOS_WHISPER")
        or "small"
    )
    threads = int(os.environ.get("PROTOCOLOS_THREADS_VIVO", "0") or 0)
    beam = int(os.environ.get("PROTOCOLOS_BEAM", "5") or 5)
    # Termos esperados nesta reunião (nomes dos participantes, cliente, jargão do SIGER),
    # enviados pelo painel ao abrir a gravação. É o que impede o modelo de trocar nome
    # próprio pela sequência de sons mais comum do português.
    hotwords = os.environ.get("PROTOCOLOS_HOTWORDS") or None

    from faster_whisper import WhisperModel

    model = WhisperModel(modelo, device="cpu", compute_type="int8", cpu_threads=threads)
    _responder({"evento": "pronto", "modelo": modelo})

    for linha in sys.stdin:
        linha = linha.strip()
        if not linha:
            continue
        try:
            pedido = json.loads(linha)
        except ValueError:
            continue
        if pedido.get("evento") == "encerrar":
            break
        seq = pedido.get("seq")
        caminho = pedido.get("caminho") or ""
        try:
            opcoes = dict(
                language="pt",
                vad_filter=True,
                # Respiro no corte do VAD: sem ele o filtro come o ataque da palavra.
                vad_parameters=dict(min_silence_duration_ms=500, speech_pad_ms=400),
                beam_size=beam,
                # DESLIGADO de propósito aqui (ao contrário do arquivo inteiro): cada trecho
                # chega isolado, então "contexto anterior" seria texto de outra chamada — o
                # modelo passaria a completar o que não ouviu.
                condition_on_previous_text=False,
            )
            if hotwords:
                opcoes["hotwords"] = hotwords
            segmentos, _info = model.transcribe(caminho, **opcoes)
            itens = []
            for seg in segmentos:
                texto = (seg.text or "").strip()
                if texto:
                    itens.append({"inicio": float(seg.start or 0), "texto": texto})
            _responder({"evento": "trecho", "seq": seq, "segmentos": itens})
        except Exception as e:  # noqa: BLE001 — qualquer falha vira erro DO TRECHO, não da sessão
            _responder({
                "evento": "trecho", "seq": seq, "segmentos": [],
                "erro": "%s: %s" % (type(e).__name__, e),
            })


if __name__ == "__main__":
    main()
