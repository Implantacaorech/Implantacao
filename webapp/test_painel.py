# -*- coding: utf-8 -*-
"""Suíte de testes do painel web (pytest + Flask test_client).
Roda com SQLite temporário, independente do Postgres. Uso:  pytest webapp/test_painel.py
"""
import os
import re
import sys
import tempfile

os.environ.pop("PAINEL_DB_URL", None)
os.environ.pop("PAINEL_SENHA", None)   # ignora a senha mestra do ambiente (login desativado nos testes)
os.environ["PAINEL_DB"] = os.path.join(tempfile.gettempdir(), "painel_pytest.db")

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "tools"))

import pytest          # noqa: E402
import app as A        # noqa: E402
import db              # noqa: E402
import fluxo           # noqa: E402


@pytest.fixture
def client():
    A.app.config["TESTING"] = True
    with A.app.test_client() as c:
        yield c


def _novo(client, **dados):
    r = client.post("/projetos/novo", data=dados)
    return re.search(r"/projetos/(\d+)", r.headers["Location"]).group(1)


def test_health(client):
    j = client.get("/health").get_json()
    assert j["status"] in ("ok", "degraded")


def test_paginas_principais(client):
    for url in ("/", "/projetos", "/coordenacao", "/atividade", "/fluxo"):
        assert client.get(url).status_code == 200


def test_crud_projeto(client):
    pid = _novo(client, cliente="Teste Pytest", situacao="Em andamento")
    assert "Teste Pytest" in client.get("/projetos/%s" % pid).get_data(as_text=True)
    client.post("/projetos/%s/excluir" % pid)
    with db.Session() as s:
        assert s.get(db.Projeto, int(pid)) is None


def test_gate_bloqueia_avanco(client):
    pid = _novo(client, cliente="Gate PT", etapa="Levantamento", modulos="FAT")
    client.post("/projetos/%s/avancar" % pid)   # sem documento -> bloqueia
    with db.Session() as s:
        assert s.get(db.Projeto, int(pid)).etapa == "Levantamento"
    client.post("/projetos/%s/excluir" % pid)


def test_defaults_nao_zeram(client):
    pid = _novo(client, cliente="Defaults PT")   # sem etapa/situacao no form
    with db.Session() as s:
        p = s.get(db.Projeto, int(pid))
        assert p.etapa == "Levantamento" and p.situacao == "Em andamento"
    client.post("/projetos/%s/excluir" % pid)


def test_fluxo_parser():
    d = fluxo.parse_fechamento(
        "Cliente (Razão Social): ACME\nCNPJ: 1\nMódulos contratados (siglas): FAT, CTB\nHoras cobradas: 40\n")
    assert d["cliente"] == "ACME" and d["modulos"] == "FAT, CTB" and d["horas_cobradas"] == "40"


def test_metricas_alertas():
    proj = [{"id": 1, "etapa": "Projeto", "situacao": "Em risco", "horas_cobradas": "10"}]
    assert db.metricas(proj, {})["n_risco"] == 1
    assert any(a["tipo"] == "risco" for a in db.alertas(proj, {}))


def test_d_etapa_bloqueia_geracao():
    # D: a geração só é liberada na etapa do documento (ou depois)
    assert A._etapa_permite_gerar("levantamento", "Levantamento")
    assert not A._etapa_permite_gerar("projeto", "Levantamento")
    assert not A._etapa_permite_gerar("termo", "Levantamento")
    assert A._etapa_permite_gerar("projeto", "Projeto")
    assert A._etapa_permite_gerar("cronograma", "Cronograma e Check-list")
    assert A._etapa_permite_gerar("levantamento", "Encerramento")  # docs anteriores sempre ok


def test_c_auto_avanca_com_gate(client):
    pid = int(_novo(client, cliente="Auto Avanca", etapa="Projeto", modulos="FAT"))
    with db.Session() as s:
        for t in ("levantamento", "projeto"):   # satisfaz o gate de Cronograma e Check-list
            s.add(db.Documento(projeto_id=pid, tipo=t, arquivo=t + ".docx", caminho=t + ".docx"))
        s.commit()
    A._auto_avancar(pid)
    with db.Session() as s:
        assert s.get(db.Projeto, pid).etapa == "Cronograma e Check-list"
    client.post("/projetos/%s/excluir" % pid)


def test_c_nao_avanca_no_levantamento(client):
    pid = int(_novo(client, cliente="Fica Levant", etapa="Levantamento", modulos="FAT"))
    with db.Session() as s:
        s.add(db.Documento(projeto_id=pid, tipo="levantamento", arquivo="l.docx", caminho="l.docx"))
        s.commit()
    A._auto_avancar(pid)   # Levantamento é confirmado pelo humano -> não avança sozinho
    with db.Session() as s:
        assert s.get(db.Projeto, pid).etapa == "Levantamento"
    client.post("/projetos/%s/excluir" % pid)


def test_a_cria_projeto_de_fechamento():
    corpo = ("Cliente (Razão Social): ROBO LTDA\nCNPJ: 99\n"
             "Módulos contratados (siglas): FAT\nHoras cobradas: 20\n")
    pid = A._criar_projeto_de_fechamento(corpo, "[IMPLANTACAO] ROBO")
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        assert p and "ROBO" in p.cliente
        s.delete(p)
        s.commit()


def test_e_docview_docx(tmp_path):
    from docx import Document
    import docview
    f = tmp_path / "amostra.docx"
    doc = Document()
    doc.add_heading("Projeto de Implantação", level=0)
    doc.add_paragraph("Cliente: ACME")
    t = doc.add_table(rows=2, cols=2)
    t.rows[0].cells[0].text = "Etapa"; t.rows[0].cells[1].text = "Horas"
    t.rows[1].cells[0].text = "Abertura"; t.rows[1].cells[1].text = "2"
    doc.save(str(f))
    h = docview.to_html(str(f))
    assert "Projeto de Implantação" in h
    assert "<table" in h and "Abertura" in h


def test_f_cronograma_seed_edita_e_historia(client):
    pid = int(_novo(client, cliente="Plano PT", modulos="FAT, CTB", horas_cobradas="20"))
    client.post("/projetos/%s/cronograma/seed" % pid)
    itens = db.cronograma_do_projeto(pid)
    assert len(itens) >= 3
    data = {("r_" + c): [(("Concluído" if (c == "status" and i == 0) else it[c]))
                         for i, it in enumerate(itens)] for c in db.CRONO_CAMPOS}
    client.post("/projetos/%s/cronograma" % pid, data=data)
    hist = db.modificacoes_do_projeto(pid, "cronograma")
    assert any("status" in h["campo"] for h in hist)
    assert db.cronograma_do_projeto(pid)[0]["status"] == "Concluído"
    client.post("/projetos/%s/excluir" % pid)


def test_f_checklist_salva(client):
    pid = int(_novo(client, cliente="Check PT", modulos="FAT"))
    data = {"r_modulo": ["FAT", "FAT"], "r_item": ["Cadastro", "Pedido"],
            "r_responsavel": ["Ana", "Bia"], "r_status": ["Pendente", "Concluído"],
            "r_obs": ["", "ok"]}
    client.post("/projetos/%s/checklist" % pid, data=data)
    itens = db.checklist_do_projeto(pid)
    assert len(itens) == 2 and itens[1]["status"] == "Concluído"
    client.post("/projetos/%s/excluir" % pid)
