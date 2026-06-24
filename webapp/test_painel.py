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
        assert p.etapa == "Agendamento" and p.situacao == "Em andamento"
    client.post("/projetos/%s/excluir" % pid)


def test_fluxo_parser():
    d = fluxo.parse_fechamento(
        "Cliente (Razão Social): ACME\nCNPJ: 1\nMódulos contratados (siglas): FAT, CTB\nHoras cobradas: 40\n")
    assert d["cliente"] == "ACME" and d["modulos"] == "FAT, CTB" and d["horas_cobradas"] == "40"


def test_fluxo_para_projeto_contato_separado():
    txt = ("Cliente (Razão Social): ACME\nCNPJ: 1\nContato (nome): Maria\n"
           "E-mail do contato: maria@acme.com\nTelefone: (51) 99999-0000\n"
           "Módulos contratados (siglas): FAT\n")
    p = fluxo.para_projeto(fluxo.parse_fechamento(txt))
    assert p["contato_nome"] == "Maria"
    assert p["contato_email"] == "maria@acme.com"
    assert p["contato_tel"] == "(51) 99999-0000"


def test_fluxo_parse_preenche_contato_na_tela(client):
    txt = ("Cliente (Razão Social): ACME\nContato (nome): Maria\n"
           "E-mail do contato: maria@acme.com\nTelefone: 51999000\n"
           "Módulos contratados (siglas): FAT\nHoras cobradas: 40\n")
    body = client.post("/fluxo/parse", data={"texto": txt}).get_data(as_text=True)
    assert 'value="Maria"' in body
    assert 'value="maria@acme.com"' in body
    assert 'value="51999000"' in body


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
    # com docs + GCI + consultor, avança Projeto → Designação → Cronograma e Check-list
    pid = int(_novo(client, cliente="Auto Avanca", etapa="Projeto", modulos="FAT",
                    gci="Beto", consultor="Ana"))
    with db.Session() as s:
        for t in ("levantamento", "projeto"):
            s.add(db.Documento(projeto_id=pid, tipo=t, arquivo=t + ".docx", caminho=t + ".docx"))
        s.commit()
    A._auto_avancar(pid)
    with db.Session() as s:
        assert s.get(db.Projeto, pid).etapa == "Cronograma e Check-list"
    client.post("/projetos/%s/excluir" % pid)


def test_etapas_seis_e_gates_acao():
    assert db.ETAPAS[0] == "Agendamento" and "Designação" in db.ETAPAS
    assert db.proxima_etapa("Agendamento") == "Levantamento"
    assert db.proxima_etapa("Projeto") == "Designação"
    # Sem GCI e sem data: não pode avançar
    assert not db.acao_entrada_ok("Levantamento", {"gci": "", "data_levantamento": ""})
    # Só com GCI (sem data): não pode avançar
    assert not db.acao_entrada_ok("Levantamento", {"gci": "João", "data_levantamento": ""})
    # Só com data (sem GCI): não pode avançar
    assert not db.acao_entrada_ok("Levantamento", {"gci": "", "data_levantamento": "2026-07-01"})
    # Com ambos (GCI + data): pode avançar
    assert db.acao_entrada_ok("Levantamento", {"gci": "João", "data_levantamento": "2026-07-01"})
    assert not db.acao_entrada_ok("Cronograma e Check-list", {"consultor": ""})
    assert db.acao_entrada_ok("Cronograma e Check-list", {"consultor": "Ana"})
    # Sem GCI: próxima ação deve ser definir_gci
    cab = db.cabecalho({"etapa": "Agendamento", "gci": "", "data_levantamento": "", "situacao": "Em andamento"}, [])
    assert cab["proxima"] and cab["proxima"]["tipo"] == "acao:definir_gci"
    # Com GCI mas sem data: próxima ação deve ser data_levantamento
    cab2 = db.cabecalho({"etapa": "Agendamento", "gci": "João", "data_levantamento": "", "situacao": "Em andamento"}, [])
    assert cab2["proxima"] and cab2["proxima"]["tipo"] == "acao:data_levantamento"


def test_agendamento_define_gci_e_data_e_avanca(client):
    """Testa o fluxo de duas etapas: (1) definir GCI, (2) definir data, depois avança."""
    _login_como(client, "Administrativo")
    pid = int(_novo(client, cliente="Agendar Co", modulos="FAT"))   # inicia em Agendamento
    # Etapa 1: definir GCI
    r1 = client.post("/projetos/%s/definir_gci" % pid, data={"gci": "GCI Teste"})
    assert r1.status_code == 302
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        assert p.gci == "GCI Teste" and p.etapa == "Agendamento"  # ainda em Agendamento
    # Etapa 2: definir data (com GCI já definido)
    r2 = client.post("/projetos/%s/agendar" % pid, data={"data_levantamento": "2026-07-15"})
    assert r2.status_code == 302
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        assert p.data_levantamento == "2026-07-15" and p.etapa == "Levantamento"
    client.post("/projetos/%s/excluir" % pid)
    with client.session_transaction() as sess:
        sess.clear()


def test_agendamento_sem_gci_nao_acessa_data(client):
    """Testa que a rota de data redireciona para definir_gci se GCI não estiver definido."""
    _login_como(client, "Administrativo")
    pid = int(_novo(client, cliente="Sem GCI Co", modulos="FAT"))
    # Tenta acessar diretamente a rota de data sem GCI definido
    r = client.get("/projetos/%s/agendar" % pid)
    assert r.status_code == 302
    assert b"definir_gci" in r.data or "/definir_gci" in r.headers.get("Location", "")
    client.post("/projetos/%s/excluir" % pid)
    with client.session_transaction() as sess:
        sess.clear()


def test_definir_multiplos_gci(client):
    """O GCI pode ter mais de um responsável no levantamento (checkboxes)."""
    _login_como(client, "Administrativo")
    pid = int(_novo(client, cliente="Multi GCI Co", modulos="FAT"))
    r = client.post("/projetos/%s/definir_gci" % pid, data={"gci": ["GCI Um", "GCI Dois"]})
    assert r.status_code == 302
    with db.Session() as s:
        assert s.get(db.Projeto, pid).gci == "GCI Um, GCI Dois"
    client.post("/projetos/%s/excluir" % pid)
    with client.session_transaction() as sess:
        sess.clear()


def test_designacao_consultores_avanca(client):
    _login_como(client, "GCI")
    pid = int(_novo(client, cliente="Consult Co", etapa="Designação", modulos="FAT, CTB"))
    with db.Session() as s:
        for t in ("levantamento", "projeto"):
            s.add(db.Documento(projeto_id=pid, tipo=t, arquivo=t, caminho=t))
        s.commit()
    r = client.post("/projetos/%s/consultores" % pid, data={"mod_0": "Ana C", "mod_1": "Ana C"})
    assert r.status_code == 302
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        assert "Ana C" in (p.consultor or "") and p.etapa == "Cronograma e Check-list"
    client.post("/projetos/%s/excluir" % pid)
    with client.session_transaction() as sess:
        sess.clear()


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


def _achar_usuario(email):
    from sqlalchemy import func
    with db.Session() as s:
        return s.query(db.Usuario).filter(func.lower(db.Usuario.email) == email.lower()).first()


def test_cadastro_valida_codigo():
    db.salvar_pendente("Fulano", "fulano@x.com", "fulano@x.com", "segredo123", "123456")
    u, e = db.confirmar_pendente("fulano@x.com", "000000")
    assert u is None and e            # código errado
    u, e = db.confirmar_pendente("fulano@x.com", "123456")
    assert u and u["perfil"] == "Consultor"
    achado = _achar_usuario("fulano@x.com")
    assert achado and achado.email == "fulano@x.com" and achado.ativo == 1
    with db.Session() as s:
        s.delete(s.get(db.Usuario, achado.id)); s.commit()


def test_cadastro_paginas(client):
    assert client.get("/cadastro").status_code == 200
    r = client.get("/cadastro/confirmar")   # sem sessão -> volta ao cadastro
    assert r.status_code == 302 and "/cadastro" in r.headers["Location"]


def test_cadastro_fluxo_completo(client, monkeypatch):
    import mailer
    monkeypatch.setattr(mailer, "configurado", lambda: True)
    monkeypatch.setattr(mailer, "enviar", lambda dest, asn, corpo: (True, None))
    r = client.post("/cadastro", data={"nome": "Beltrano", "email": "beltrano@x.com", "senha": "segredo1"})
    assert r.status_code == 302 and "confirmar" in r.headers["Location"]
    p = db.pendente_por_email("beltrano@x.com")
    assert p and p["codigo"]
    r2 = client.post("/cadastro/confirmar", data={"codigo": p["codigo"]})
    assert r2.status_code == 302
    u = _achar_usuario("beltrano@x.com")
    assert u and u.perfil == "Consultor"
    with db.Session() as s:
        s.delete(s.get(db.Usuario, u.id)); s.commit()


def _login_como(client, perfil):
    with client.session_transaction() as sess:
        sess["auth"] = True
        sess["perfil"] = perfil
        sess["perfil_nome"] = perfil


def test_acesso_por_perfil(client):
    _login_como(client, "Consultor")          # só Operação
    assert client.get("/coordenacao").status_code == 403
    assert client.get("/atividade").status_code == 403
    assert client.get("/usuarios").status_code == 403
    h = client.get("/").get_data(as_text=True)
    assert ">Gestão<" not in h and ">Sistema<" not in h

    for papel in ("GCI", "Administrativo"):     # Operação + Gestão, sem Sistema
        _login_como(client, papel)
        assert client.get("/coordenacao").status_code == 200
        assert client.get("/usuarios").status_code == 403
        h = client.get("/").get_data(as_text=True)
        assert ">Gestão<" in h and ">Sistema<" not in h

    _login_como(client, "ADM")                 # tudo
    assert client.get("/coordenacao").status_code == 200
    assert client.get("/usuarios").status_code == 200
    assert ">Sistema<" in client.get("/").get_data(as_text=True)
    with client.session_transaction() as sess:
        sess.clear()


def test_dedup_fechamento():
    corpo = ("Cliente (Razão Social): DEDUP LTDA\nCNPJ: 11.222.333/0001-44\n"
             "Módulos contratados (siglas): FAT\n")
    pid1 = A._criar_projeto_de_fechamento(corpo, "[IMPLANTACAO] DEDUP")
    pid2 = A._criar_projeto_de_fechamento(corpo, "[IMPLANTACAO] DEDUP")   # mesmo cliente/CNPJ
    assert pid1 == pid2                                                   # não duplicou
    corpo2 = "Cliente (Razão Social): OUTRA RAZAO\nCNPJ: 11222333000144\n"  # mesmo CNPJ, sem máscara
    assert A._criar_projeto_de_fechamento(corpo2, "x") == pid1
    assert db.projeto_existe("qualquer", "11.222.333/0001-44") == pid1
    with db.Session() as s:
        s.delete(s.get(db.Projeto, pid1)); s.commit()


def test_usuarios_grava_email_e_perfil(client):
    client.post("/usuarios", data={"nome": "Coord", "email": "coord@x.com", "perfil": "Coordenador", "ativo": "on"})
    u = _achar_usuario("coord@x.com")
    assert u and u.login == "coord@x.com" and u.perfil == "Coordenador"
    with db.Session() as s:
        s.delete(s.get(db.Usuario, u.id)); s.commit()


# ---- Cadastros de referência: Checklist e Índice de Tópicos ----

def test_cadastros_seed_e_paginas(client):
    db.init_db()  # idempotente: garante o seed dos catálogos
    _, ck = db.checklist_modelo_listar()
    _, idx = db.indice_listar()
    assert ck > 100                       # checklist do modelo entregue
    assert idx >= 351                     # índice da planilha (351 tópicos)
    assert len(db.indice_modulos()) >= 23
    assert client.get("/cadastros/checklist").status_code == 200
    assert client.get("/cadastros/indice").status_code == 200


def test_cadastro_indice_crud(client):
    _, antes = db.indice_listar()
    r = client.post("/cadastros/indice/salvar", data={
        "modulo_num": "99", "modulo_sigla": "TST", "modulo": "Módulo Teste",
        "adicional": "", "topico": "Tópico PYTEST único"})
    assert r.status_code == 302
    achados, _ = db.indice_listar(q="Tópico PYTEST único")
    assert len(achados) == 1
    tid = achados[0]["id"]
    client.post("/cadastros/indice/salvar", data={"id": tid, "modulo_sigla": "TST",
        "modulo": "Módulo Teste", "topico": "Tópico PYTEST editado"})
    assert db.indice_listar(q="editado")[1] >= 1
    client.post("/cadastros/indice/%s/excluir" % tid)
    _, depois = db.indice_listar()
    assert depois == antes


def test_cadastro_checklist_crud(client):
    r = client.post("/cadastros/checklist/salvar", data={
        "modulo": "ZZZ", "adicional": "ZZZ", "tipo": "Teste",
        "item": "Item PYTEST", "menu": "9.9", "golive": "Sim", "seq": "1"})
    assert r.status_code == 302
    add, _ = db.checklist_modelo_listar(q="Item PYTEST")
    assert len(add) == 1
    client.post("/cadastros/checklist/%s/excluir" % add[0]["id"])
    assert db.checklist_modelo_listar(q="Item PYTEST")[1] == 0


def test_cadastros_bloqueio_por_perfil(client):
    _login_como(client, "Consultor")
    assert client.get("/cadastros/checklist").status_code == 403
    assert client.get("/cadastros/indice").status_code == 403
    with client.session_transaction() as sess:
        sess.clear()


# ---- Cadastro de Modelos de Documentos (layouts fiéis das fases) ----

def test_modelos_documento_seed(client):
    db.init_db()
    mods = db.modelos_documento_listar()
    assert {m["slug"] for m in mods} == {"levantamento", "projeto", "cronograma", "termo"}
    for m in mods:
        assert m["n_versoes"] >= 1 and m["n_campos"] > 0
        p = db.modelo_documento_arquivo_path(m["id"])
        assert p and os.path.exists(p)        # layout fiel copiado como v1
    assert client.get("/cadastros/modelos").status_code == 200


def test_modelo_detalhe_e_download(client):
    mid = db.modelos_documento_listar()[0]["id"]
    assert client.get("/cadastros/modelos/%s" % mid).status_code == 200
    r = client.get("/cadastros/modelos/%s/baixar" % mid)
    assert r.status_code == 200 and len(r.data) > 1000


def test_modelo_campo_crud(client):
    mid = db.modelos_documento_listar()[0]["id"]
    n0 = len(db.modelo_documento_campos(mid))
    client.post("/cadastros/modelos/%s/campo/salvar" % mid, data={
        "secao": "X", "rotulo": "Campo PYTEST", "placeholder": "<P>",
        "origem": "manual", "obrigatorio": "on"})
    novos = [c for c in db.modelo_documento_campos(mid) if c["rotulo"] == "Campo PYTEST"]
    assert len(novos) == 1 and novos[0]["obrigatorio"] == 1
    client.post("/cadastros/modelos/%s/campo/%s/excluir" % (mid, novos[0]["id"]))
    assert len(db.modelo_documento_campos(mid)) == n0


def test_modelos_bloqueio_por_perfil(client):
    _login_como(client, "Consultor")
    assert client.get("/cadastros/modelos").status_code == 403
    with client.session_transaction() as sess:
        sess.clear()


def test_gerar_layout_fiel(client):
    pid = _novo(client, cliente="Cliente Layout LTDA", cnpj="11.222.333/0001-44",
                numero_projeto="PRJ-99", horas_cobradas="80", horas_bonificadas="10")
    r = client.post("/projetos/%s/gerar-layout/termo" % pid)
    assert r.status_code == 302
    with db.Session() as s:
        docs = s.query(db.Documento).filter_by(projeto_id=int(pid), tipo="termo").all()
        assert len(docs) == 1
        path = docs[0].caminho
    assert path and os.path.exists(path)
    from docx import Document
    txt = "\n".join(x.text for x in Document(path).paragraphs)
    assert "Cliente Layout LTDA" in txt          # cliente preenchido
    assert "<Razão Social Longa>" not in txt      # placeholder trocado
    assert "PRJ-99" in txt                         # número do projeto
    try:
        os.remove(path)
    except OSError:
        pass
    client.post("/projetos/%s/excluir" % pid)


def test_gerar_layout_slug_invalido(client):
    pid = _novo(client, cliente="X LTDA")
    assert client.post("/projetos/%s/gerar-layout/inexistente" % pid).status_code == 404
    client.post("/projetos/%s/excluir" % pid)


def test_ficha_caminho_unico_andamento(client):
    """A ficha abre no 'Andamento' (caminho único) e não tem mais o painel paralelo de docs."""
    pid = _novo(client, cliente="Caminho LTDA", modulos="FAT")
    h = client.get("/projetos/%s" % pid).get_data(as_text=True)
    assert "Andamento" in h                                 # aba do fluxo
    assert "Documentos oficiais (layout fiel)" not in h      # painel paralelo removido
    assert 'id="t-execucao" class="painel-aba ativa' in h    # Andamento é a aba ativa por padrão
    client.post("/projetos/%s/excluir" % pid)


def test_home_fila_proximas_acoes(client):
    """A Home lista 'Minhas próximas ações' com link direto para a ação certa."""
    import datetime
    passado = (datetime.date.today() - datetime.timedelta(days=5)).isoformat()
    pid = _novo(client, cliente="Fila LTDA ZZZ", numero_projeto="F-1", modulos="FAT",
                cnpj="00.000.000/0001-00", horas_cobradas="10", data_uso_oficial=passado)
    h = client.get("/").get_data(as_text=True)
    assert "Fila LTDA ZZZ" in h                          # projeto aparece na fila
    assert ("/projetos/%s/definir_gci" % pid) in h        # botão leva direto à ação (Definir GCI)
    assert "Minhas próximas ações" in h
    client.post("/projetos/%s/excluir" % pid)


def test_levantamento_respostas_no_painel(client):
    """As perguntas do Índice viram campos respondíveis (seed) e as respostas persistem."""
    sig = db.indice_modulos()[0]["sigla"]
    _linhas, total_idx = db.indice_listar(modulo=sig)
    pid = _novo(client, cliente="Resp LTDA", modulos=sig)
    r = client.get("/projetos/%s/levantamento" % pid)
    assert r.status_code == 200
    rs = db.levantamento_respostas(pid)
    assert len(rs) == total_idx              # uma pergunta por tópico do módulo contratado
    rid = rs[0]["id"]
    client.post("/projetos/%s/levantamento" % pid, data={"resposta_%d" % rid: "Resposta teste X"})
    achou = [x for x in db.levantamento_respostas(pid) if x["id"] == rid][0]
    assert achou["resposta"] == "Resposta teste X"
    resp, total = db.levantamento_resumo(pid)
    assert resp == 1 and total == total_idx
    client.post("/projetos/%s/excluir" % pid)


def test_levantamento_bloqueio_perfil(client):
    pid = _novo(client, cliente="Bloq LTDA", modulos="FAT")
    _login_como(client, "Consultor")
    assert client.get("/projetos/%s/levantamento" % pid).status_code == 403
    with client.session_transaction() as sess:
        sess.clear()
    client.post("/projetos/%s/excluir" % pid)


def test_levantamento_tabelas_e_sem_marcadores(client):
    """Levantamento: tabelas de módulos e horas preenchidas e SEM marcadores <...>."""
    import gerar_layout
    import re as _re
    pid = _novo(client, cliente="Marc LTDA", numero_projeto="M-1", modulos="FAT",
                horas_cobradas="120", horas_bonificadas="20")
    with db.Session() as s:
        proj = db.to_dict(s.get(db.Projeto, int(pid)))
    path = gerar_layout.gerar("levantamento", proj)
    from docx import Document
    d = Document(path)
    txt = "\n".join(p.text for p in d.paragraphs)
    blob = " | ".join(c.text for t in d.tables for row in t.rows for c in row.cells)
    assert "120" in blob and "140" in blob       # horas: cobradas + total (120+20)
    assert "FAT" in blob                          # tabela 'Módulos/Adicionais (A)'
    assert not _re.search(r"<[^>]*>", txt + blob)  # nenhum marcador <...> restante
    try:
        os.remove(path)
    except OSError:
        pass
    client.post("/projetos/%s/excluir" % pid)


def test_doc_editar_levantamento_alimenta(client):
    """A tela de edição estruturada do Levantamento persiste e a geração consome."""
    import gerar_layout
    pid = _novo(client, cliente="Editar LTDA", numero_projeto="ED-1", cnpj="00.000.000/0001-00",
                modulos="FAT", horas_cobradas="10")
    r = client.get("/projetos/%s/editar/levantamento" % pid)
    assert r.status_code == 200 and "Identificação da empresa" in r.get_data(as_text=True)
    client.post("/projetos/%s/editar/levantamento" % pid,
                data={"ramo": "Metalurgia", "produto": "Software ERP",
                      "software_atual": "Sistema X", "filiais": "Matriz + 2 filiais",
                      "objetivos": "Modernizar", "qtd_usuarios": "30 usuários"})
    assert db.doc_conteudo(int(pid), "levantamento").get("produto") == "Software ERP"
    with db.Session() as s:
        proj = db.to_dict(s.get(db.Projeto, int(pid)))
    path = gerar_layout.gerar("levantamento", proj)
    from docx import Document
    txt = "\n".join(p.text for p in Document(path).paragraphs)
    assert "Software ERP" in txt and "Matriz + 2 filiais" in txt   # consumido no .docx
    try:
        os.remove(path)
    except OSError:
        pass
    client.post("/projetos/%s/excluir" % pid)


def test_doc_editar_projeto_alimenta(client):
    """A tela de edição estruturada do Projeto persiste e a geração consome."""
    import gerar_layout
    pid = _novo(client, cliente="Edit Proj LTDA", numero_projeto="EP-1",
                cnpj="11.111.111/0001-11", modulos="FAT", horas_cobradas="10")
    client.post("/projetos/%s/editar/projeto" % pid,
                data={"cnpj": "11.111.111/0001-11", "objetivos": "OBJETIVO EDITADO XYZ",
                      "redator": "Maria Redatora", "gerente_contas": "Beto GCI"})
    with db.Session() as s:
        proj = db.to_dict(s.get(db.Projeto, int(pid)))
    path = gerar_layout.gerar("projeto", proj)
    from docx import Document
    txt = "\n".join(p.text for p in Document(path).paragraphs)
    assert "OBJETIVO EDITADO XYZ" in txt and "Maria Redatora" in txt
    try:
        os.remove(path)
    except OSError:
        pass
    client.post("/projetos/%s/excluir" % pid)


def test_doc_editar_projeto_detalhamento_area(client):
    """O Detalhamento de Rotinas por área (edição) aparece no Projeto gerado."""
    import gerar_layout
    pid = _novo(client, cliente="Det LTDA", numero_projeto="DT-1", cnpj="00.000.000/0001-00",
                modulos="FAT", horas_cobradas="10")
    h = client.get("/projetos/%s/editar/projeto" % pid).get_data(as_text=True)
    assert "Detalhamento de Rotinas — Vendas e Faturamento" in h   # seção dinâmica (FAT->Vendas)
    client.post("/projetos/%s/editar/projeto" % pid,
                data={"det_vendas_modulos": "FAT", "det_vendas_detalhamento": "DETALHE VENDAS XYZ"})
    with db.Session() as s:
        proj = db.to_dict(s.get(db.Projeto, int(pid)))
    path = gerar_layout.gerar("projeto", proj)
    from docx import Document
    txt = "\n".join(p.text for p in Document(path).paragraphs)
    assert "DETALHE VENDAS XYZ" in txt               # consumido no bloco da área no .docx
    try:
        os.remove(path)
    except OSError:
        pass
    client.post("/projetos/%s/excluir" % pid)


def test_doc_editar_bloqueio_perfil(client):
    pid = _novo(client, cliente="Bloq Edit LTDA", modulos="FAT")
    _login_como(client, "Consultor")
    assert client.get("/projetos/%s/editar/levantamento" % pid).status_code == 403
    with client.session_transaction() as sess:
        sess.clear()
    client.post("/projetos/%s/excluir" % pid)


def test_termo_grade_com_modulos(client):
    """O Termo gerado preenche a grade Resumo Geral com os módulos contratados."""
    import gerar_layout
    pid = _novo(client, cliente="Termo Grade LTDA", numero_projeto="T-1", modulos="FAT, EST")
    with db.Session() as s:
        proj = db.to_dict(s.get(db.Projeto, int(pid)))
    path = gerar_layout.gerar("termo", proj)
    from docx import Document
    celulas = [c.text.strip() for row in Document(path).tables[0].rows for c in row.cells]
    assert "FAT" in celulas and "EST" in celulas and "Implantado" in celulas
    try:
        os.remove(path)
    except OSError:
        pass
    client.post("/projetos/%s/excluir" % pid)


def test_cronograma_xlsx_cabecalho_e_linhas(client):
    """O Cronograma .xlsx preenche cabeçalho (consultor/horas) e linhas de visita."""
    import gerar_layout
    import openpyxl
    pid = _novo(client, cliente="Crono LTDA", numero_projeto="C-1", modulos="FAT",
                consultor="Ana", horas_cobradas="40", horas_bonificadas="8")
    db.salvar_linhas(int(pid), "cronograma", [
        {"etapa": "Treinamento Vendas", "topicos": "Pedidos", "horas": "4",
         "data": "01/08/2026", "modalidade": "Presencial", "status": "Previsto"}], "tester")
    with db.Session() as s:
        proj = db.to_dict(s.get(db.Projeto, int(pid)))
    path = gerar_layout.gerar("cronograma", proj)
    wb = openpyxl.load_workbook(path)
    blob = " | ".join(str(c.value) for ws in wb.worksheets for row in ws.iter_rows()
                      for c in row if c.value is not None)
    assert "Ana" in blob                     # consultor no cabeçalho/técnico
    assert "Crono LTDA" in blob              # cliente
    assert "Treinamento Vendas" in blob      # linha de visita (O que será abordado)
    try:
        os.remove(path)
    except OSError:
        pass
    client.post("/projetos/%s/excluir" % pid)


def test_projeto_exige_levantamento_realizado(client):
    """O Projeto só é gerado a partir de um Levantamento realizado (respostas preenchidas)."""
    pid = _novo(client, cliente="Gate Lev LTDA", numero_projeto="G-1", cnpj="00.000.000/0001-00",
                horas_cobradas="10", modulos="FAT", etapa="Projeto")
    db.levantamento_seed(int(pid), "FAT")
    client.post("/projetos/%s/gerar/projeto" % pid)          # sem responder -> bloqueia
    with db.Session() as s:
        assert s.query(db.Documento).filter_by(projeto_id=int(pid), tipo="projeto").count() == 0
    rs = db.levantamento_respostas(int(pid))
    client.post("/projetos/%s/levantamento" % pid, data={"resposta_%d" % rs[0]["id"]: "ok"})
    client.post("/projetos/%s/gerar/projeto" % pid)          # com resposta -> gera
    with db.Session() as s:
        docs = s.query(db.Documento).filter_by(projeto_id=int(pid), tipo="projeto").all()
        assert len(docs) == 1
        path = docs[0].caminho
    try:
        os.remove(path)
    except OSError:
        pass
    client.post("/projetos/%s/excluir" % pid)


def test_projeto_puxa_respostas_do_levantamento(client):
    """O Projeto gerado consome as respostas do Levantamento (liga as fases)."""
    import gerar_layout
    sig = db.indice_modulos()[0]["sigla"]
    pid = _novo(client, cliente="Liga LTDA", cnpj="00.000.000/0001-00", numero_projeto="L-1",
                modulos=sig, horas_cobradas="10")
    db.levantamento_seed(int(pid), sig)
    rs = db.levantamento_respostas(int(pid))
    rid, topico = rs[0]["id"], rs[0]["topico"]
    client.post("/projetos/%s/levantamento" % pid,
                data={"resposta_%d" % rid: "RESPOSTA QUE LIGA AO PROJETO"})
    with db.Session() as s:
        proj = db.to_dict(s.get(db.Projeto, int(pid)))
    path = gerar_layout.gerar("projeto", proj)
    from docx import Document
    txt = "\n".join(p.text for p in Document(path).paragraphs)
    assert "Detalhamento do Levantamento por módulo" in txt
    assert "RESPOSTA QUE LIGA AO PROJETO" in txt        # a resposta aparece no Projeto
    assert topico[:25] in txt
    try:
        os.remove(path)
    except OSError:
        pass
    client.post("/projetos/%s/excluir" % pid)


def test_levantamento_inclui_topicos_do_indice(client):
    """O Levantamento gerado injeta as perguntas/tópicos do Índice por módulo contratado."""
    import gerar_layout
    mods = db.indice_modulos()
    assert mods, "Índice de Tópicos deve estar seedado"
    sig = mods[0]["sigla"]
    linhas, _ = db.indice_listar(modulo=sig)
    assert linhas
    topico = linhas[0]["topico"]
    pid = _novo(client, cliente="Topicos LTDA", modulos=sig, gci="Beto")
    with db.Session() as s:
        proj = db.to_dict(s.get(db.Projeto, int(pid)))
    path = gerar_layout.gerar("levantamento", proj)
    from docx import Document
    txt = "\n".join(p.text for p in Document(path).paragraphs)
    assert sig in txt                  # módulo aparece (Módulos Previstos / seção)
    assert topico[:30] in txt          # a pergunta do Índice foi injetada no documento
    try:
        os.remove(path)
    except OSError:
        pass
    client.post("/projetos/%s/excluir" % pid)


def test_levantamento_so_blocos_contratados(client):
    """O Levantamento mantém só os blocos dos módulos contratados e injeta as respostas."""
    import gerar_layout
    pid = _novo(client, cliente="Blocos LTDA", numero_projeto="B-1", modulos="FAT")
    db.levantamento_seed(int(pid), "FAT")
    rs = db.levantamento_respostas(int(pid))
    client.post("/projetos/%s/levantamento" % pid, data={"resposta_%d" % rs[0]["id"]: "RESP BLOCO"})
    with db.Session() as s:
        proj = db.to_dict(s.get(db.Projeto, int(pid)))
    import re as _re
    path = gerar_layout.gerar("levantamento", proj)
    from docx import Document
    d = Document(path)
    heads = [p.text.strip().upper() for p in d.paragraphs
             if p.text.strip().lower().startswith("mapeamento de processo")
             and _re.search(r"[-–—]", p.text)]
    # só sobram os blocos contratados (FAT) + fundacionais (CLIENTE/FORNECEDOR, PRODUTO)
    assert len(heads) == 3
    junto = " | ".join(heads)
    assert "VENDAS E FATURAMENTO" in junto and "CLIENTE" in junto and "PRODUTO" in junto
    assert "FOLHA" not in junto                  # bloco da folha removido
    txt = "\n".join(p.text for p in d.paragraphs)
    assert "RESP BLOCO" in txt                   # resposta injetada no bloco
    try:
        os.remove(path)
    except OSError:
        pass
    client.post("/projetos/%s/excluir" % pid)


def test_projeto_avanca_sem_consultor(client):
    """Fim do deadlock: sair do Projeto não exige mais 'consultor' (definido na Designação)."""
    pid = _novo(client, cliente="SemConsultor LTDA", numero_projeto="S-1", modulos="FAT",
                cnpj="00.000.000/0001-00", horas_cobradas="10", gci="Beto")
    with db.Session() as s:
        p = s.get(db.Projeto, int(pid)); p.etapa = "Projeto"; s.commit()
        s.add(db.Documento(projeto_id=int(pid), tipo="levantamento", arquivo="l", caminho="l"))
        s.add(db.Documento(projeto_id=int(pid), tipo="projeto", arquivo="p", caminho="p"))
        s.commit()
    client.post("/projetos/%s/avancar" % pid)
    with db.Session() as s:
        assert s.get(db.Projeto, int(pid)).etapa == "Designação"
    client.post("/projetos/%s/excluir" % pid)


def test_fluxo_e2e_continuidade(client):
    """Robô de fluxo ponta-a-ponta: percorre as 6 fases validando gates e avanços
    (Agendamento → Levantamento → Projeto → Designação → Cronograma/Check-list → Encerramento)."""
    import datetime
    futuro = (datetime.date.today() + datetime.timedelta(days=7)).isoformat()
    pid = _novo(client, cliente="E2E Fluxo LTDA", cnpj="00.000.000/0001-00",
                numero_projeto="E2E-1", modulos="FAT, EST", horas_cobradas="40",
                data_uso_oficial=futuro)

    def etapa():
        with db.Session() as s:
            return s.get(db.Projeto, int(pid)).etapa

    def n_doc(tipo):
        with db.Session() as s:
            return s.query(db.Documento).filter_by(projeto_id=int(pid), tipo=tipo).count()

    assert etapa() == "Agendamento"
    # Agendamento: GCI (sub-etapa 1) + Data (sub-etapa 2) -> auto-avança p/ Levantamento
    client.post("/projetos/%s/definir_gci" % pid, data={"gci": "Beto"})
    assert etapa() == "Agendamento"
    client.post("/projetos/%s/agendar" % pid, data={"data_levantamento": futuro})
    assert etapa() == "Levantamento"

    # Levantamento: responde (base do Projeto), gera Mapeamento e confirma avanço
    db.levantamento_seed(int(pid), "FAT, EST")
    _rs = db.levantamento_respostas(int(pid))
    client.post("/projetos/%s/levantamento" % pid, data={"resposta_%d" % _rs[0]["id"]: "ok"})
    client.post("/projetos/%s/gerar/levantamento" % pid)
    assert n_doc("levantamento") == 1
    client.post("/projetos/%s/avancar" % pid)
    assert etapa() == "Projeto"

    # Projeto: gerado A PARTIR do Levantamento realizado -> auto-avança p/ Designação
    client.post("/projetos/%s/gerar/projeto" % pid)
    assert n_doc("projeto") == 1
    assert etapa() == "Designação"

    # Designação: designa SÓ consultores por módulo (GCI já foi no Agendamento)
    client.post("/projetos/%s/consultores" % pid, data={"mod_0": "Ana", "mod_1": "Ana"})
    client.post("/projetos/%s/avancar" % pid)
    assert etapa() == "Cronograma e Check-list"

    # Cronograma e Check-list: gera Cronograma (fiel) + anexa Check List -> avança p/ Encerramento
    client.post("/projetos/%s/gerar/cronograma" % pid)
    assert n_doc("cronograma") == 1
    with db.Session() as s:   # não há gerador fiel de checklist; anexa p/ satisfazer o gate
        s.add(db.Documento(projeto_id=int(pid), tipo="checklist", arquivo="cl.xlsx", caminho="cl.xlsx"))
        s.commit()
    client.post("/projetos/%s/avancar" % pid)
    assert etapa() == "Encerramento"

    # Encerramento: gera Termo
    client.post("/projetos/%s/gerar/termo" % pid)
    assert n_doc("termo") == 1

    # limpeza (remove arquivos gerados + projeto)
    with db.Session() as s:
        caminhos = [d.caminho for d in s.query(db.Documento).filter_by(projeto_id=int(pid)).all()]
    for cp in caminhos:
        try:
            if cp and os.path.exists(cp):
                os.remove(cp)
        except OSError:
            pass
    client.post("/projetos/%s/excluir" % pid)


def test_projeto_gerar_usa_layout_fiel(client):
    """A rota de geração da fase (projeto_gerar) agora produz o layout FIEL preenchido."""
    pid = _novo(client, cliente="Faithful Proj LTDA", cnpj="22.333.444/0001-55",
                horas_cobradas="50", etapa="Projeto")
    r = client.post("/projetos/%s/gerar/projeto" % pid)
    assert r.status_code == 302
    with db.Session() as s:
        docs = s.query(db.Documento).filter_by(projeto_id=int(pid), tipo="projeto").all()
        assert len(docs) == 1
        path = docs[0].caminho
    from docx import Document
    txt = "\n".join(x.text for x in Document(path).paragraphs)
    assert "Faithful Proj LTDA" in txt and "22.333.444/0001-55" in txt
    try:
        os.remove(path)
    except OSError:
        pass
    client.post("/projetos/%s/excluir" % pid)


def test_rota_antiga_gerar_projeto_delega(client):
    """A rota antiga /gerar_projeto (upload do Mapeamento) foi aposentada e delega ao layout fiel."""
    pid = _novo(client, cliente="Delega LTDA", etapa="Projeto")
    r = client.post("/projetos/%s/gerar_projeto" % pid)   # sem upload
    assert r.status_code == 302
    with db.Session() as s:
        docs = s.query(db.Documento).filter_by(projeto_id=int(pid), tipo="projeto").all()
        assert len(docs) == 1
        path = docs[0].caminho
    try:
        os.remove(path)
    except OSError:
        pass
    client.post("/projetos/%s/excluir" % pid)
