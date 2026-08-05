# -*- coding: utf-8 -*-
"""Separação de locutores ("quem falou quando") com sherpa-onnx, em CPU.

O Whisper transcreve O QUE foi dito, não QUEM disse — não há parâmetro de locutor nele
(conferido na assinatura em 2026-07-31). Isso exige um segundo modelo, de outra família:
segmentação de fala + embedding de voz + agrupamento.

**Por que sherpa-onnx e não pyannote**: o pyannote é o padrão do mercado, mas arrasta o
PyTorch (~2,5 GB) e os modelos são restritos no HuggingFace (conta + token + aceite de
termos). Aqui são **44 MB de ONNX** sem download restrito, rodando no `onnxruntime` que a
máquina já tinha. Medido nesta CPU (i7-1255U) sobre 3 min de uma reunião real:

    1 thread  -> 1,3x tempo real
    8 threads -> 3,3x tempo real   (uma reunião de 1 h leva ~18 min)

**Número de pessoas é INFORMADO, não descoberto.** Testado no mesmo áudio: no modo
automático o agrupamento inventou de 7 a 10 vozes onde havia 2; fixando em 2, o corte saiu
limpo (99 s e 58 s de fala). Microfone de sala, fala sobreposta e voz distante não dão ao
agrupamento o contraste que ele precisa para adivinhar sozinho — e quem convocou a reunião
sabe quantas pessoas vão falar.
"""
import os

_DIR_MODELOS = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "modelos", "diarizacao"
)
SEGMENTACAO = os.path.join(_DIR_MODELOS, "segmentacao.onnx")
EMBEDDING = os.path.join(_DIR_MODELOS, "embedding.onnx")

TAXA = 16000
# Sem isto o onnxruntime usa 1 thread e a diarização fica 2,5x mais lenta (medido).
THREADS = int(os.environ.get("PROTOCOLOS_THREADS_DIAR", "8") or 8)


def disponivel():
    """Os modelos foram baixados e a biblioteca está instalada? A separação de locutores é
    opcional — sem isso o pipeline segue normalmente, só sem os rótulos."""
    if not (os.path.exists(SEGMENTACAO) and os.path.exists(EMBEDDING)):
        return False
    try:
        import sherpa_onnx  # noqa: F401
        import numpy  # noqa: F401
    except ImportError:
        return False
    return True


def _amostras(caminho):
    """Áudio do arquivo como float32 mono 16 kHz. Usa PyAV (que já vem com o
    faster-whisper), então serve tanto para o .wav das gravações quanto para o .mp4/.opus
    de um upload — sem depender do ffmpeg de linha de comando."""
    import av
    import numpy as np

    with av.open(caminho) as container:
        fluxo = next((s for s in container.streams if s.type == "audio"), None)
        if fluxo is None:
            raise RuntimeError("arquivo sem faixa de áudio")
        reamostrador = av.audio.resampler.AudioResampler(
            format="s16", layout="mono", rate=TAXA
        )
        pedacos = []
        for quadro in container.decode(fluxo):
            for saida in reamostrador.resample(quadro):
                pedacos.append(saida.to_ndarray().reshape(-1))
        # Drena o que ficou no reamostrador (senão o último trecho do áudio some).
        for saida in reamostrador.resample(None):
            pedacos.append(saida.to_ndarray().reshape(-1))
    if not pedacos:
        raise RuntimeError("não foi possível decodificar o áudio")
    return np.concatenate(pedacos).astype(np.float32) / 32768.0


def separar(caminho, pessoas):
    """Devolve [{'inicio', 'fim', 'locutor'}] ordenado por tempo. `pessoas` é quantas vozes
    esperar (>= 2); com 0 ou 1 não há o que separar e devolve lista vazia."""
    if not pessoas or pessoas < 2 or not disponivel():
        return []
    import sherpa_onnx

    cfg = sherpa_onnx.OfflineSpeakerDiarizationConfig(
        segmentation=sherpa_onnx.OfflineSpeakerSegmentationModelConfig(
            pyannote=sherpa_onnx.OfflineSpeakerSegmentationPyannoteModelConfig(
                model=SEGMENTACAO
            ),
            num_threads=THREADS,
        ),
        embedding=sherpa_onnx.SpeakerEmbeddingExtractorConfig(
            model=EMBEDDING, num_threads=THREADS
        ),
        clustering=sherpa_onnx.FastClusteringConfig(num_clusters=int(pessoas)),
        # Trecho de fala mais curto que 0,3 s é ruído/interjeição, não turno.
        min_duration_on=0.3,
        min_duration_off=0.5,
    )
    if not cfg.validate():
        raise RuntimeError("configuração de diarização inválida (modelo faltando?)")

    sd = sherpa_onnx.OfflineSpeakerDiarization(cfg)
    resultado = sd.process(_amostras(caminho)).sort_by_start_time()
    return [
        {"inicio": float(s.start), "fim": float(s.end), "locutor": int(s.speaker)}
        for s in resultado
    ]


def quem_falou(trechos, inicio, fim, anterior=None):
    """Locutor de uma palavra: o de MAIOR sobreposição com ela.

    Palavra que cai num vazio da diarização (um "né?", um "que" entre turnos) herda o
    locutor anterior em vez de virar desconhecida — sem isso o diálogo se esfarela em
    turnos de uma palavra só (medido: 27 turnos picotados contra 12 turnos reais nos mesmos
    3 minutos)."""
    melhor, maior = None, 0.0
    for t in trechos:
        sobra = min(fim, t["fim"]) - max(inicio, t["inicio"])
        if sobra > maior:
            melhor, maior = t["locutor"], sobra
    return melhor if melhor is not None else anterior
