# -*- coding: utf-8 -*-
"""Defesas contra alucinação do Whisper em áudio baixo ou silencioso.

Caso real (gravação ao vivo, 2026-08-18): o microfone da máquina capta a fala baixíssima
(picos medidos em ~-43 dBFS) e, em trecho quase mudo, o Whisper entra em loop de repetição
— a tela encheu de "[0:35] polvo, [0:36] polvo, ..." (18 vezes) e "O NF-6." repetido, texto
que ninguém disse. É o comportamento conhecido do modelo com ruído/silêncio: sem evidência
acústica ele completa com a sequência mais provável e trava nela.

Três defesas, todas determinísticas e baratas (o modelo nem chega a rodar na primeira):

1. `eh_silencio`   — trecho com RMS abaixo de -60 dBFS é ruído de fundo/mudo: transcrever
                     isso só produz invenção. Devolve vazio sem chamar o modelo.
2. `normalizar`    — fala baixa (pico < 30% do fundo de escala) ganha ganho até o pico
                     chegar a ~70%, teto de 12x: o Whisper enxerga o espectro que a pessoa
                     realmente produziu, não uma sombra dele. (Só para a transcrição — o
                     arquivo gravado continua como veio.)
3. `colapsar_repeticoes` — o MESMO texto em 3+ segmentos consecutivos é loop de alucinação,
                     não fala real ("sim. sim." legítimo para em 2): mantém as 2 primeiras
                     ocorrências e descarta o resto.
"""
import re

import numpy as np

# RMS abaixo disto (dBFS) é ruído de fundo/mudo — não vale chamar o modelo.
LIMIAR_SILENCIO_DBFS = -60.0
# Pico abaixo desta fração do fundo de escala liga o ganho…
PICO_BAIXO = 0.30
# …até o pico chegar a esta fração…
PICO_ALVO = 0.70
# …limitado a este fator (ganhar mais que isso só amplifica ruído).
GANHO_MAX = 12.0
# Repetições consecutivas do MESMO texto toleradas; da 3ª em diante é loop.
MAX_REPETICOES = 2


def amostras_float(pcm_s16le):
    """Bytes PCM s16le (mono) -> np.float32 em [-1, 1] — o formato que o faster-whisper
    aceita como array, dispensando o arquivo."""
    return np.frombuffer(pcm_s16le, dtype=np.int16).astype(np.float32) / 32768.0


def rms_dbfs(amostras):
    """Nível RMS em dBFS (0 = fundo de escala). Vazio/zeros -> -120 (silêncio digital)."""
    if amostras.size == 0:
        return -120.0
    rms = float(np.sqrt(np.mean(amostras.astype(np.float64) ** 2)))
    if rms <= 0:
        return -120.0
    return 20.0 * float(np.log10(rms))


def eh_silencio(amostras):
    return rms_dbfs(amostras) < LIMIAR_SILENCIO_DBFS


def normalizar(amostras):
    """Ganho para fala gravada baixa (ver docstring do módulo). Áudio com nível saudável
    não é tocado."""
    if amostras.size == 0:
        return amostras
    pico = float(np.max(np.abs(amostras)))
    if pico <= 0 or pico >= PICO_BAIXO:
        return amostras
    ganho = min(PICO_ALVO / pico, GANHO_MAX)
    return np.clip(amostras * ganho, -1.0, 1.0).astype(np.float32)


def _chave(texto):
    """Normaliza para comparar repetição: caixa baixa, sem pontuação/espaço repetido —
    "Polvo," e "polvo." são a MESMA alucinação."""
    return re.sub(r"[\W_]+", " ", (texto or "").lower()).strip()


def colapsar_repeticoes(segmentos, texto_de=None):
    """Corta o loop de alucinação: do 3º segmento CONSECUTIVO com o mesmo texto em diante,
    descarta. `segmentos` é qualquer lista; `texto_de` extrai o texto de um item (padrão:
    item["texto"]). Devolve nova lista, ordem preservada."""
    if texto_de is None:
        texto_de = lambda s: s["texto"]  # noqa: E731 — inline é mais claro que def aqui
    saida = []
    anterior, seguidas = None, 0
    for seg in segmentos:
        chave = _chave(texto_de(seg))
        if chave and chave == anterior:
            seguidas += 1
        else:
            anterior, seguidas = chave, 1
        if seguidas <= MAX_REPETICOES:
            saida.append(seg)
    return saida
