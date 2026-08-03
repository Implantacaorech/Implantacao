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

    # A assinatura do dublê acompanha a real (transcritor.transcrever_isolado), inclusive
    # `vocabulario` — o serviço a passa por KEYWORD, então um fake sem o parâmetro estoura
    # em TypeError dentro da thread e o job termina em 'erro' em vez de 'concluido'.
    def fake_transcrever_isolado(caminho, timeout=3 * 3600, progress_file=None, vocabulario=None):
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

    def fake_falha(caminho, timeout=3 * 3600, progress_file=None, vocabulario=None):
        raise RuntimeError("modelo indisponível")

    monkeypatch.setattr(transcricao_servico.transcritor, "transcrever_isolado", fake_falha)

    client.post("/transcrever", json={"protocoloId": 9004, "caminhoVideo": str(video)})
    job = _aguardar(9004, "erro")
    assert "modelo indisponível" in job["mensagem"]


def test_vocabulario_do_pedido_chega_ao_transcritor(tmp_path, monkeypatch):
    """O `vocabulario` do POST tem de atravessar rota → serviço → transcritor.

    Sem este teste, o parâmetro podia ser acrescentado (ou removido) sem que nada acusasse:
    foi exatamente assim que os três testes acima passaram a falhar — a assinatura real
    ganhou `vocabulario` e os dublês ficaram para trás, sem nenhuma cobertura apontando o
    contrato entre as camadas.
    """
    video = tmp_path / "video4.mp4"
    video.write_bytes(b"fake")
    recebido = {}

    def fake(caminho, timeout=3 * 3600, progress_file=None, vocabulario=None):
        recebido["vocabulario"] = vocabulario
        return {"texto": "ok", "duracao": 1, "idioma": "pt"}

    monkeypatch.setattr(transcricao_servico.transcritor, "transcrever_isolado", fake)

    r = client.post(
        "/transcrever",
        json={
            "protocoloId": 9006,
            "caminhoVideo": str(video),
            "vocabulario": "SIGER, Rech, nota fiscal",
        },
    )
    assert r.status_code == 202
    _aguardar(9006, "concluido")
    assert recebido["vocabulario"] == "SIGER, Rech, nota fiscal"


def test_sem_vocabulario_o_transcritor_recebe_string_vazia(tmp_path, monkeypatch):
    """Omitir o campo não pode virar erro: o default do DTO é "" e é isso que desce."""
    video = tmp_path / "video5.mp4"
    video.write_bytes(b"fake")
    recebido = {}

    def fake(caminho, timeout=3 * 3600, progress_file=None, vocabulario=None):
        recebido["vocabulario"] = vocabulario
        return {"texto": "ok", "duracao": 1, "idioma": "pt"}

    monkeypatch.setattr(transcricao_servico.transcritor, "transcrever_isolado", fake)

    client.post("/transcrever", json={"protocoloId": 9007, "caminhoVideo": str(video)})
    _aguardar(9007, "concluido")
    assert recebido["vocabulario"] == ""


def test_nao_permite_dois_jobs_concorrentes_do_mesmo_protocolo(tmp_path, monkeypatch):
    video = tmp_path / "video3.mp4"
    video.write_bytes(b"fake")
    liberar = {"ok": False}

    def fake_lenta(caminho, timeout=3 * 3600, progress_file=None, vocabulario=None):
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
