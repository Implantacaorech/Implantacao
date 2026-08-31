# -*- coding: utf-8 -*-
"""Testes das defesas contra alucinação do Whisper em áudio baixo/silencioso
(antialucinacao.py) — funções puras, sem modelo. O caso que motivou tudo: gravação ao vivo
de 2026-08-18 com microfone baixíssimo enchendo a tela de "polvo, polvo, polvo..."."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "transcricao"))

import antialucinacao  # noqa: E402


def _seno(freq=440.0, dur=1.0, amplitude=0.5, taxa=16000):
    t = np.arange(int(dur * taxa)) / taxa
    return (amplitude * np.sin(2 * np.pi * freq * t)).astype(np.float32)


# ------------------------------------------------------------------ silêncio e nível
def test_silencio_digital_absoluto_e_silencio():
    assert antialucinacao.eh_silencio(np.zeros(16000, dtype=np.float32))


def test_ruido_de_fundo_minusculo_e_silencio():
    # RMS ~-72 dBFS — abaixo do limiar de -60.
    assert antialucinacao.eh_silencio(_seno(amplitude=0.00035))


def test_fala_baixa_do_microfone_desta_maquina_nao_e_silencio():
    # ~-43 dBFS de RMS foi o nível real medido nas gravações — TEM de passar do gate.
    assert not antialucinacao.eh_silencio(_seno(amplitude=0.01))


def test_amostras_float_converte_s16le():
    pcm = np.array([0, 16384, -16384, 32767], dtype=np.int16).tobytes()
    a = antialucinacao.amostras_float(pcm)
    assert a.dtype == np.float32
    assert abs(a[1] - 0.5) < 1e-3 and abs(a[2] + 0.5) < 1e-3


# ------------------------------------------------------------------------ normalização
def test_audio_baixo_ganha_ganho_ate_o_pico_alvo():
    alto = antialucinacao.normalizar(_seno(amplitude=0.1))
    assert abs(float(np.max(np.abs(alto))) - antialucinacao.PICO_ALVO) < 0.01


def test_ganho_respeita_o_teto():
    quase_mudo = antialucinacao.normalizar(_seno(amplitude=0.001))
    # 0.001 * GANHO_MAX — bem abaixo do alvo, porque o teto de 12x manda.
    assert float(np.max(np.abs(quase_mudo))) < 0.02


def test_audio_com_nivel_saudavel_nao_e_tocado():
    som = _seno(amplitude=0.6)
    assert antialucinacao.normalizar(som) is som


# ------------------------------------------------------------------------- repetições
def test_loop_de_alucinacao_e_cortado_na_terceira():
    """O caso real: 18 segmentos "polvo," seguidos — sobram 2."""
    segs = [{"inicio": i * 0.5, "texto": "polvo,"} for i in range(18)]
    sobra = antialucinacao.colapsar_repeticoes(segs)
    assert len(sobra) == 2


def test_pontuacao_e_caixa_nao_disfarcam_a_repeticao():
    segs = [
        {"inicio": 0, "texto": "O NF-6."},
        {"inicio": 1, "texto": "o NF-6"},
        {"inicio": 2, "texto": "O NF-6,"},
    ]
    assert len(antialucinacao.colapsar_repeticoes(segs)) == 2


def test_fala_real_intercalada_nao_e_cortada():
    segs = [
        {"inicio": 0, "texto": "sim."},
        {"inicio": 1, "texto": "sim."},
        {"inicio": 2, "texto": "então vamos ao cadastro"},
        {"inicio": 3, "texto": "sim."},
    ]
    assert len(antialucinacao.colapsar_repeticoes(segs)) == 4


def test_extrator_de_texto_customizado():
    pares = [(0.0, "ok"), (0.5, "ok"), (1.0, "ok"), (1.5, "ok")]
    sobra = antialucinacao.colapsar_repeticoes(pares, texto_de=lambda p: p[1])
    assert sobra == [(0.0, "ok"), (0.5, "ok")]
