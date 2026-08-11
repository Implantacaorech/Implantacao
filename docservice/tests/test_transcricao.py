# -*- coding: utf-8 -*-
"""Testes do job assíncrono de transcrição (/transcrever, /transcrever/{id}/status,
DELETE /transcrever/{id}) — espelha webapp/test_painel.py:test_protocolo_pipeline_mock
(mocka o faster-whisper: o modelo real não é baixado/rodado em teste, só a orquestração do
job é verificada).

⚠️ Os dublês abaixo declaram a assinatura INTEIRA de `transcritor.transcrever_isolado`, e
isso não é preciosismo: o serviço passa tudo por KEYWORD, então um parâmetro novo na função
real estoura em TypeError dentro da thread e o job termina em 'erro' silenciosamente, sem
nada apontar para a causa. Aconteceu duas vezes — com `vocabulario` e com `pessoas`, esta
última deixando 5 dos 7 testes vermelhos por dias, porque este arquivo não rodava no CI.
Agora roda (job `docservice-transcricao` em .github/workflows/ci.yml)."""
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from main import app
import servico as transcricao_servico

client = TestClient(app)


def _aguardar(protocolo_id, alvo, timeout=2.0):
    fim = time.time() + timeout
    job = None
    while time.time() < fim:
        job = transcricao_servico.status(protocolo_id)
        if job and job["status"] == alvo:
            return job
        time.sleep(0.02)
    raise AssertionError("job não chegou a '%s' a tempo: %r" % (alvo, job))


def _aguardar_sumir(protocolo_id, timeout=2.0):
    fim = time.time() + timeout
    while time.time() < fim:
        if transcricao_servico.status(protocolo_id) is None:
            return
        time.sleep(0.02)
    raise AssertionError("job %s continua no registro" % protocolo_id)


def _fake(texto="ok", duracao=1, antes=None):
    """Dublê com a assinatura completa da função real (ver o aviso no topo do arquivo)."""

    def falso(caminho, timeout=3 * 3600, progress_file=None, vocabulario=None,
              pessoas=0, ao_iniciar=None):
        if antes:
            antes(caminho=caminho, vocabulario=vocabulario, pessoas=pessoas,
                  ao_iniciar=ao_iniciar)
        return {"texto": texto, "duracao": duracao, "idioma": "pt"}

    return falso


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

    visto = {}
    monkeypatch.setattr(
        transcricao_servico.transcritor,
        "transcrever_isolado",
        _fake("[00:01] fala de teste", 42, antes=lambda **kw: visto.update(kw)),
    )

    r = client.post("/transcrever", json={"protocoloId": 9003, "caminhoVideo": str(video)})
    assert r.status_code == 202
    assert r.json() == {"status": "processando"}

    job = _aguardar(9003, "concluido")
    assert visto["caminho"] == str(video)
    assert job["transcricao"] == "[00:01] fala de teste"
    assert job["duracaoSeg"] == 42
    assert job["idioma"] == "pt"

    r = client.get("/transcrever/9003/status")
    assert r.status_code == 200
    assert r.json()["status"] == "concluido"
    # `terminado_em` é controle interno da poda — não pode vazar para o contrato da API,
    # que o NestJS tipa em StatusTranscricao.
    assert "terminado_em" not in r.json()


def test_transcricao_com_falha_reporta_erro(tmp_path, monkeypatch):
    video = tmp_path / "video2.mp4"
    video.write_bytes(b"fake")

    def fake_falha(caminho, timeout=3 * 3600, progress_file=None, vocabulario=None,
                   pessoas=0, ao_iniciar=None):
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

    monkeypatch.setattr(
        transcricao_servico.transcritor,
        "transcrever_isolado",
        _fake(antes=lambda **kw: recebido.update(kw)),
    )

    r = client.post(
        "/transcrever",
        json={
            "protocoloId": 9006,
            "caminhoVideo": str(video),
            "vocabulario": "SIGER, Rech, nota fiscal",
            "pessoas": 3,
        },
    )
    assert r.status_code == 202
    _aguardar(9006, "concluido")
    assert recebido["vocabulario"] == "SIGER, Rech, nota fiscal"
    assert recebido["pessoas"] == 3


def test_sem_vocabulario_o_transcritor_recebe_string_vazia(tmp_path, monkeypatch):
    """Omitir o campo não pode virar erro: o default do DTO é "" e é isso que desce."""
    video = tmp_path / "video5.mp4"
    video.write_bytes(b"fake")
    recebido = {}

    monkeypatch.setattr(
        transcricao_servico.transcritor,
        "transcrever_isolado",
        _fake(antes=lambda **kw: recebido.update(kw)),
    )

    client.post("/transcrever", json={"protocoloId": 9007, "caminhoVideo": str(video)})
    _aguardar(9007, "concluido")
    assert recebido["vocabulario"] == ""
    assert recebido["pessoas"] == 0


def test_nao_permite_dois_jobs_concorrentes_do_mesmo_protocolo(tmp_path, monkeypatch):
    video = tmp_path / "video3.mp4"
    video.write_bytes(b"fake")
    liberar = {"ok": False}

    def fake_lenta(caminho, timeout=3 * 3600, progress_file=None, vocabulario=None,
                   pessoas=0, ao_iniciar=None):
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


# --------------------------------------------------------------------------- cancelamento


class _ProcFalso(object):
    """Dublê do subprocesso: registra que foi morto e libera o dublê do transcritor."""

    def __init__(self):
        self.morto = threading.Event()

    def kill(self):
        self.morto.set()


def test_cancelar_mata_o_subprocesso_e_esquece_o_job(tmp_path, monkeypatch):
    """O caso que motivou tudo: cancelar precisa MATAR o transcritor, não só esquecer dele.

    Antes daqui não havia `DELETE /transcrever/{id}` nenhum — só o equivalente da gravação
    ao vivo —, então o subprocesso seguia consumindo a CPU da máquina inteira depois de o
    protocolo já ter sido cancelado (377% observados em 2026-08-06)."""
    video = tmp_path / "video6.mp4"
    video.write_bytes(b"fake")
    proc = _ProcFalso()

    def fake_travada(caminho, timeout=3 * 3600, progress_file=None, vocabulario=None,
                     pessoas=0, ao_iniciar=None):
        ao_iniciar(proc)
        if not proc.morto.wait(timeout=3):
            raise AssertionError("o subprocesso não foi morto pelo cancelamento")
        raise RuntimeError("processo terminado por sinal")   # é o que o kill provoca

    monkeypatch.setattr(transcricao_servico.transcritor, "transcrever_isolado", fake_travada)

    client.post("/transcrever", json={"protocoloId": 9008, "caminhoVideo": str(video)})
    _aguardar(9008, "processando")

    r = client.delete("/transcrever/9008")
    assert r.status_code == 200
    assert r.json() == {"cancelado": True}
    assert proc.morto.is_set()

    # O job some do registro em vez de virar 'erro': quem matou o processo fomos nós, e um
    # 'erro' apareceria na tela como falha do transcritor. Some NA HORA (para quem consulta
    # em seguida) e continua sumido depois que a thread termina.
    assert transcricao_servico.status(9008) is None
    _aguardar_sumir(9008)
    assert client.get("/transcrever/9008/status").status_code == 404


def test_cancelar_job_na_fila_impede_o_subprocesso_de_nascer(tmp_path, monkeypatch):
    """Cancelar tem de valer também para quem ainda ESPERA a vez.

    O docservice transcreve um job por vez (lock `_BUSY`), e essa espera passa de hora com
    um vídeo grande na frente — cancelar só o que já está rodando deixaria o trabalho
    descartado começar mesmo assim, quando chegasse a vez dele."""
    video = tmp_path / "video7.mp4"
    video.write_bytes(b"fake")
    liberar = {"ok": False}
    comecou = {"segundo": False}

    def fake(caminho, timeout=3 * 3600, progress_file=None, vocabulario=None,
             pessoas=0, ao_iniciar=None):
        if "video8" in caminho:
            comecou["segundo"] = True
            return {"texto": "não deveria ter rodado", "duracao": 1, "idioma": "pt"}
        while not liberar["ok"]:
            time.sleep(0.01)
        return {"texto": "ok", "duracao": 1, "idioma": "pt"}

    monkeypatch.setattr(transcricao_servico.transcritor, "transcrever_isolado", fake)

    video2 = tmp_path / "video8.mp4"
    video2.write_bytes(b"fake")
    client.post("/transcrever", json={"protocoloId": 9009, "caminhoVideo": str(video)})
    client.post("/transcrever", json={"protocoloId": 9010, "caminhoVideo": str(video2)})

    assert client.delete("/transcrever/9010").json() == {"cancelado": True}
    liberar["ok"] = True
    _aguardar(9009, "concluido")
    time.sleep(0.1)   # janela para a thread cancelada rodar, se fosse rodar

    assert comecou["segundo"] is False
    assert transcricao_servico.status(9010) is None


def test_cancelar_o_que_nao_existe_nao_e_erro():
    r = client.delete("/transcrever/9099")
    assert r.status_code == 200
    assert r.json() == {"cancelado": False}


def test_cancelar_descarta_resultado_pronto(tmp_path, monkeypatch):
    """É o que o painel faz ao EXCLUIR o protocolo: sem isso, a transcrição inteira de um
    registro que não existe mais ficaria ocupando memória até o docservice reiniciar."""
    video = tmp_path / "video9.mp4"
    video.write_bytes(b"fake")
    monkeypatch.setattr(
        transcricao_servico.transcritor, "transcrever_isolado", _fake("texto pronto")
    )

    client.post("/transcrever", json={"protocoloId": 9011, "caminhoVideo": str(video)})
    _aguardar(9011, "concluido")

    assert client.delete("/transcrever/9011").json() == {"cancelado": True}
    assert transcricao_servico.status(9011) is None


# ---------------------------------------------------------------------- poda do registro


def test_poda_descarta_resultado_vencido_mas_nunca_o_que_esta_rodando(monkeypatch):
    """`_jobs` era memória pura e sem teto: cada resultado guarda a transcrição INTEIRA e
    nada limpava o registro. O que está EM ANDAMENTO nunca pode ser podado — uma
    transcrição de 3 h passaria por qualquer critério de idade."""
    monkeypatch.setattr(transcricao_servico, "_jobs", {}, raising=True)
    velho = time.time() - transcricao_servico._VALIDADE_JOB_SEG - 60
    transcricao_servico._jobs.update({
        1: {"status": "concluido", "transcricao": "antiga", "terminado_em": velho},
        2: {"status": "concluido", "transcricao": "nova", "terminado_em": time.time()},
        3: {"status": "processando"},
    })

    with transcricao_servico._lock_jobs:
        transcricao_servico._podar()

    assert set(transcricao_servico._jobs) == {2, 3}


def test_poda_respeita_o_teto_de_resultados_guardados(monkeypatch):
    monkeypatch.setattr(transcricao_servico, "_jobs", {}, raising=True)
    agora = time.time()
    for i in range(transcricao_servico._TETO_JOBS + 5):
        # `terminado_em` crescente: os 5 primeiros são os mais velhos e devem cair.
        transcricao_servico._jobs[i] = {"status": "concluido", "terminado_em": agora + i}

    with transcricao_servico._lock_jobs:
        transcricao_servico._podar()

    assert len(transcricao_servico._jobs) == transcricao_servico._TETO_JOBS
    assert 4 not in transcricao_servico._jobs
    assert 5 in transcricao_servico._jobs
