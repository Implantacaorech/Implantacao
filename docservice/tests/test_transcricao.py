# -*- coding: utf-8 -*-
"""Testes do job assíncrono de transcrição (/transcrever, /transcrever/{id}/status) —
espelha webapp/test_painel.py:test_protocolo_pipeline_mock (mocka o faster-whisper: o
modelo real não é baixado/rodado em teste, só a orquestração do job é verificada)."""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from main import app
import servico as transcricao_servico

client = TestClient(app)


def _aguardar(protocolo_id, alvo, timeout=2.0):
    fim = time.time() + timeout
    while time.time() < fim:
        job = transcricao_servico.status(protocolo_id)
        if job and job["status"] == alvo:
            return job
        time.sleep(0.02)
    raise AssertionError("job não chegou a '%s' a tempo: %r" % (alvo, job))


def test_video_inexistente_devolve_404(tmp_path):
    r = client.post(
        "/transcrever",
        json={"protocoloId": 9001, "caminhoVideo": str(tmp_path / "nao-existe.mp4")},
    )
    assert r.status_code == 404


def test_status_sem_job_devolve_404():
    r = client.get("/transcrever/9002/status")
    assert r.status_code == 404


def test_transcricao_completa_com_sucesso(tmp_path, monkeypatch):
    video = tmp_path / "video.mp4"
    video.write_bytes(b"fake")

    def fake_transcrever_isolado(caminho, timeout=3 * 3600, progress_file=None):
        assert caminho == str(video)
        return {"texto": "[00:01] fala de teste", "duracao": 42, "idioma": "pt"}

    monkeypatch.setattr(
        transcricao_servico.transcritor, "transcrever_isolado", fake_transcrever_isolado
    )

    r = client.post("/transcrever", json={"protocoloId": 9003, "caminhoVideo": str(video)})
    assert r.status_code == 202
    assert r.json() == {"status": "processando"}

    job = _aguardar(9003, "concluido")
    assert job["transcricao"] == "[00:01] fala de teste"
    assert job["duracaoSeg"] == 42
    assert job["idioma"] == "pt"

    r = client.get("/transcrever/9003/status")
    assert r.status_code == 200
    assert r.json()["status"] == "concluido"


def test_transcricao_com_falha_reporta_erro(tmp_path, monkeypatch):
    video = tmp_path / "video2.mp4"
    video.write_bytes(b"fake")

    def fake_falha(caminho, timeout=3 * 3600, progress_file=None):
        raise RuntimeError("modelo indisponível")

    monkeypatch.setattr(transcricao_servico.transcritor, "transcrever_isolado", fake_falha)

    client.post("/transcrever", json={"protocoloId": 9004, "caminhoVideo": str(video)})
    job = _aguardar(9004, "erro")
    assert "modelo indisponível" in job["mensagem"]


def test_nao_permite_dois_jobs_concorrentes_do_mesmo_protocolo(tmp_path, monkeypatch):
    video = tmp_path / "video3.mp4"
    video.write_bytes(b"fake")
    liberar = {"ok": False}

    def fake_lenta(caminho, timeout=3 * 3600, progress_file=None):
        while not liberar["ok"]:
            time.sleep(0.01)
        return {"texto": "ok", "duracao": 1, "idioma": "pt"}

    monkeypatch.setattr(transcricao_servico.transcritor, "transcrever_isolado", fake_lenta)

    r1 = client.post("/transcrever", json={"protocoloId": 9005, "caminhoVideo": str(video)})
    assert r1.status_code == 202
    r2 = client.post("/transcrever", json={"protocoloId": 9005, "caminhoVideo": str(video)})
    assert r2.status_code == 409

    liberar["ok"] = True
    _aguardar(9005, "concluido")
