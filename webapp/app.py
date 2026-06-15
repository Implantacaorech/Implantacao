# -*- coding: utf-8 -*-
"""
Painel de Implantação — app web local (Flask), organizado por setor/função.
Abre no navegador; cada papel vê e executa suas ações (gerar documentos,
importar levantamento, conversor verbal, saúde do sistema).

Uso:
    python webapp/app.py        (ou dê 2 cliques em Iniciar_Painel.bat)
"""
import os
import sys

from flask import (Flask, render_template, request, send_file, abort,
                   session, redirect, url_for)

HERE = os.path.dirname(os.path.abspath(__file__))
FROZEN = getattr(sys, "frozen", False)
if FROZEN:
    WEBBASE = os.path.join(sys._MEIPASS, "webapp")        # noqa
else:
    WEBBASE = HERE
    sys.path.insert(0, HERE)
    sys.path.insert(0, os.path.join(os.path.dirname(HERE), "tools"))

import roles            # noqa: E402
import runner           # noqa: E402
import forms            # noqa: E402
import db               # noqa: E402
import _common as C     # noqa: E402

app = Flask(__name__,
            template_folder=os.path.join(WEBBASE, "templates"),
            static_folder=os.path.join(WEBBASE, "static"))

import logging       # noqa: E402
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.FileHandler(os.path.join(C.DATA_WRITE, "painel.log"), encoding="utf-8"),
              logging.StreamHandler()])


def _carrega_secret():
    """Chave de sessão: env PAINEL_SECRET, senão um token aleatório persistido localmente."""
    s = os.environ.get("PAINEL_SECRET")
    if s:
        return s
    p = os.path.join(C.DATA_WRITE, "secret.key")
    try:
        if os.path.exists(p):
            return open(p, encoding="utf-8").read().strip()
        import secrets
        s = secrets.token_hex(32)
        with open(p, "w", encoding="utf-8") as f:
            f.write(s)
        return s
    except Exception:
        return "painel-implantacao-rech"


app.secret_key = _carrega_secret()

UPLOADS = os.path.join(C.DATA_WRITE if FROZEN else HERE, "_uploads")
os.makedirs(UPLOADS, exist_ok=True)
ALLOWED_DIRS = [C.OUT, C.DATA_WRITE, C.DATA, UPLOADS]
db.init_db()   # cria o banco do hub (Projetos por Cliente) se não existir


PERFIS = ["Coordenação", "Consultor"]
VERSAO = "1.0 · jun/2026"


def _autor():
    return session.get("perfil_nome") or ""


def _so_meus(projetos):
    """Filtro de visão: Consultor vê só os projetos em que seu nome está no campo
    'Consultor'; Coordenação vê todos."""
    if session.get("perfil") == "Consultor":
        nome = (session.get("perfil_nome") or "").strip().lower()
        if nome:
            return [p for p in projetos if nome in (p.get("consultor") or "").lower()]
    return projetos


def _senha_acesso():
    """Senha de acesso ao painel: env PAINEL_SENHA ou arquivo acesso.txt. None = sem login."""
    s = os.environ.get("PAINEL_SENHA")
    if s:
        return s
    p = os.path.join(C.DATA_WRITE, "acesso.txt")
    return open(p, encoding="utf-8").read().strip() if os.path.exists(p) else None


@app.before_request
def _exige_login():
    if not _senha_acesso():
        return  # login desabilitado (comportamento padrão)
    if request.endpoint in ("login", "health", "static") or session.get("auth"):
        return
    return redirect(url_for("login", next=request.path))


@app.route("/login", methods=["GET", "POST"])
def login():
    erro = None
    if request.method == "POST":
        if request.form.get("senha", "") == _senha_acesso():
            session["auth"] = True
            return redirect(request.args.get("next") or url_for("home"))
        erro = "Senha incorreta."
    return render_template("login.html", erro=erro)


@app.route("/logout")
def logout():
    session.pop("auth", None)
    return redirect(url_for("login"))


def _digest_destinos():
    import re as _re
    v = os.environ.get("DIGEST_PARA")
    if not v:
        p = os.path.join(C.DATA_WRITE, "digest_para.txt")
        v = open(p, encoding="utf-8").read() if os.path.exists(p) else ""
    return [e.strip() for e in _re.split(r"[;,\n]", v or "") if e.strip()]


def _montar_digest():
    import datetime
    with db.Session() as s:
        projetos = [db.to_dict(x) for x in s.query(db.Projeto).all()]
        docs_map = {}
        for dcto in s.query(db.Documento).all():
            docs_map.setdefault(dcto.projeto_id, []).append({"tipo": dcto.tipo})
    m = db.metricas(projetos, docs_map)
    al = db.alertas(projetos, docs_map)
    L = ["Resumo diário — Implantação", "=" * 30, "",
         "Ativos: %d  ·  No prazo: %d  ·  Atrasados: %d  ·  Em risco: %d"
         % (m["ativos"], m["no_prazo"], m["n_atrasados"], m["n_risco"]),
         "Documentos obrigatórios pendentes: %d" % m["gate_pendente"], ""]
    if al:
        L.append("Alertas (%d):" % len(al))
        L += ["  [%s] %s — %s" % (a["nivel"].upper(), a["cliente"], a["msg"]) for a in al[:30]]
    else:
        L.append("Sem alertas no momento.")
    L += ["", "— Painel de Implantação · Rech"]
    return ("Resumo diário da Implantação — %s" % datetime.date.today().strftime("%d/%m/%Y"),
            "\n".join(L))


def enviar_digest():
    import mailer
    destinos = _digest_destinos()
    if not destinos:
        return False, "Sem destinatários (defina DIGEST_PARA ou digest_para.txt)."
    if not mailer.configurado():
        return False, "SMTP não configurado."
    assunto, corpo = _montar_digest()
    return mailer.enviar(destinos, assunto, corpo)


@app.route("/digest/enviar", methods=["POST"])
def digest_enviar():
    ok, err = enviar_digest()
    return redirect(url_for("coordenacao", digest=("ok" if ok else (err or "erro"))))


@app.route("/")
def home():
    try:
        with db.Session() as s:
            projetos = [db.to_dict(x) for x in s.query(db.Projeto).all()]
            docs_map = {}
            for dcto in s.query(db.Documento).all():
                docs_map.setdefault(dcto.projeto_id, []).append({"tipo": dcto.tipo})
        meus = _so_meus(projetos)
        m = db.metricas(meus, docs_map)
        stats = {"ativos": m["ativos"], "atrasados": m["n_atrasados"],
                 "alertas": len(db.alertas(meus, docs_map))}
    except Exception:
        stats = {"ativos": 0, "atrasados": 0, "alertas": 0}
    return render_template("home.html", roles=roles.ROLES, stats=stats)


@app.route("/papel/<rid>")
def papel(rid):
    r = roles.get_role(rid)
    if not r:
        abort(404)
    return render_template("role.html", role=r)


@app.route("/acao/<rid>/<aid>", methods=["GET", "POST"])
def acao(rid, aid):
    r, a = roles.get_role(rid), roles.get_action(rid, aid)
    if not r or not a:
        abort(404)
    res = None

    if a["tipo"] == "form_modulos":
        if request.method == "POST":
            mods = request.form.getlist("modulos")
            if a.get("gera") == "checklist":
                xls, _ = runner.gerar_checklist_form(request.form, mods)
                res = {"ok": bool(xls), "xls": xls, "erro": None if xls else "Não foi possível gerar."}
            else:
                doc, _ = runner.gerar_levantamento_form(request.form, mods)
                res = {"ok": bool(doc), "doc": doc, "erro": None if doc else "Não foi possível gerar."}
        return render_template("selecao_modulos.html", role=r, acao=a,
                               grupos=runner.catalogo_por_area(), res=res,
                               cliente_nome=session.get("cliente_nome"))

    if a["tipo"] == "criar_templates":
        res = runner.criar_templates(request.form) if request.method == "POST" else None
        import datetime
        hoje = datetime.date.today()
        meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
                 "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
        return render_template("criar_templates.html", role=r, acao=a, res=res,
                               cliente_nome=session.get("cliente_nome"), meses=meses,
                               grupos=runner.catalogo_por_area(),
                               hoje_dia=hoje.day, hoje_mes=hoje.month, hoje_ano=hoje.year)

    if a["tipo"] == "verbal":
        if request.method == "POST":
            f = request.files.get("arquivo")
            if f and f.filename and f.filename.lower().endswith(".docx"):
                res = {"arquivo": runner.converter_docx(f)}
            else:
                texto = request.form.get("texto", "")
                novo, mudancas = runner.converter_verbal(texto)
                res = {"antes": texto, "depois": novo, "mudancas": mudancas}
        try:
            import ia
            ia_ativa, ia_modelo = ia.disponivel(), ia.MODELO
        except Exception:
            ia_ativa, ia_modelo = False, ""
        return render_template("verbal.html", role=r, acao=a, res=res,
                               ia_ativa=ia_ativa, ia_modelo=ia_modelo)

    if a["tipo"] == "saude":
        code, relatorio = runner.run_saude()
        return render_template("saude.html", role=r, acao=a, relatorio=relatorio, code=code)

    if a["tipo"] == "import":
        if request.method == "POST":
            f = request.files.get("arquivo")
            if f and f.filename.lower().endswith(".docx"):
                path = os.path.join(UPLOADS, "lev_" + C.slug(f.filename) + ".docx")
                f.save(path)
                try:
                    res = {"ok": True, "seq": runner.run_sequencia(path)}
                except Exception as e:
                    res = {"ok": False, "erro": "%s: %s" % (type(e).__name__, e)}
            else:
                res = {"ok": False, "erro": "Envie um arquivo .docx do levantamento."}
        return render_template("action.html", role=r, acao=a, res=res, modo="import")

    # tipo "gerar"
    if request.method == "POST":
        yaml_base = None
        f = request.files.get("yaml")
        if f and f.filename and f.filename.lower().endswith((".yaml", ".yml")):
            yaml_base = runner.save_upload_yaml(f, C.slug)
        elif roles.usa_cliente(a) and session.get("cliente_yaml"):
            yaml_base = session["cliente_yaml"]
        try:
            path, log = runner.run_generator(a["mod"], yaml_base)
            res = {"ok": bool(path), "arquivo": path, "log": log,
                   "erro": None if path else "Não foi possível localizar o arquivo gerado."}
        except SystemExit as e:
            res = {"ok": False, "erro": str(e)}
        except Exception as e:
            res = {"ok": False, "erro": "%s: %s" % (type(e).__name__, e)}
    return render_template("action.html", role=r, acao=a, res=res, modo="gerar",
                           usa_cliente=roles.usa_cliente(a),
                           cliente_nome=session.get("cliente_nome"))


@app.context_processor
def inject_cliente():
    return {"cliente_atual": session.get("cliente_nome"),
            "perfil_atual": session.get("perfil", "Coordenação"),
            "perfil_nome_atual": session.get("perfil_nome", ""),
            "versao": VERSAO, "login_ativo": bool(_senha_acesso())}


@app.context_processor
def inject_alertas():
    try:
        with db.Session() as s:
            projetos = [db.to_dict(x) for x in s.query(db.Projeto).all()]
            docs_map = {}
            for dcto in s.query(db.Documento).all():
                docs_map.setdefault(dcto.projeto_id, []).append({"tipo": dcto.tipo})
        n = len(db.alertas(_so_meus(projetos), docs_map))
    except Exception:
        n = 0
    return {"n_alertas": n}


@app.route("/perfil", methods=["GET", "POST"])
def perfil():
    if request.method == "POST":
        session["perfil"] = request.form.get("perfil") or "Coordenação"
        session["perfil_nome"] = (request.form.get("perfil_nome") or "").strip()
        return redirect(request.args.get("next") or url_for("projetos"))
    return render_template("perfil.html", perfis=PERFIS,
                           perfil=session.get("perfil", "Coordenação"),
                           perfil_nome=session.get("perfil_nome", ""))


@app.route("/cliente", methods=["GET", "POST"])
def cliente():
    if request.method == "POST":
        base, nome = forms.build_cliente_yaml(request.form, runner.DATA, C.slug)
        session["cliente_yaml"] = base
        session["cliente_nome"] = nome
        return redirect(request.args.get("next") or url_for("home"))
    return render_template("cliente.html", campos=forms.CLIENTE_FIELDS,
                           atual=session.get("cliente_nome"), valores={})


@app.route("/config", methods=["GET", "POST"])
def config():
    import ia
    salvo = False
    if request.method == "POST":
        ia.salvar_key(request.form.get("api_key", ""))
        salvo = True
    via_env = bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("CONVERSOR_API_KEY"))
    try:
        import anthropic  # noqa: F401
        sdk_ok = True
    except Exception:
        sdk_ok = False
    return render_template("config.html", ativa=ia.disponivel(), modelo=ia.MODELO,
                           salvo=salvo, via_env=via_env, sdk_ok=sdk_ok)


@app.route("/config/email", methods=["GET", "POST"])
def config_email():
    import mailer
    salvo = False
    if request.method == "POST":
        mailer.salvar_cfg(request.form)
        salvo = True
    return render_template("config_email.html", cfg=mailer.load_cfg(), salvo=salvo,
                           configurado=mailer.configurado())


@app.route("/projetos/<int:pid>/email", methods=["GET", "POST"])
def projeto_email(pid):
    import mailer
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    tpls = mailer.templates(proj)
    if request.method == "POST":
        destino = (request.form.get("destino") or "").strip()
        assunto = (request.form.get("assunto") or "").strip()
        corpo = request.form.get("corpo") or ""
        if not mailer.configurado():
            erro = "SMTP não configurado."
        elif not destino:
            erro = "Informe o destinatário."
        else:
            ok, err = mailer.enviar(destino, assunto, corpo)
            with db.Session() as s:
                db.registrar_evento(s, pid, "email",
                    ("E-mail enviado a %s — %s" % (destino, assunto)) if ok
                    else ("Falha ao enviar e-mail a %s: %s" % (destino, err)), _autor())
                s.commit()
            if ok:
                return redirect(url_for("projeto_ficha", pid=pid, salvo=1))
            erro = err
        return render_template("projeto_email.html", p=proj, tpls=tpls,
                               configurado=mailer.configurado(), erro=erro,
                               destino=destino, assunto=assunto, corpo=corpo)
    return render_template("projeto_email.html", p=proj, tpls=tpls,
                           configurado=mailer.configurado())


@app.route("/projetos")
def projetos():
    with db.Session() as s:
        itens = [db.to_dict(x) for x in
                 s.query(db.Projeto).order_by(db.Projeto.atualizado_em.desc()).all()]
    return render_template("projetos_lista.html", itens=_so_meus(itens),
                           etapas=db.ETAPAS, situacoes=db.SITUACOES)


@app.route("/coordenacao")
def coordenacao():
    with db.Session() as s:
        projetos = [db.to_dict(x) for x in s.query(db.Projeto).all()]
        docs_map = {}
        for dcto in s.query(db.Documento).all():
            docs_map.setdefault(dcto.projeto_id, []).append({"tipo": dcto.tipo})
    meus = _so_meus(projetos)
    m = db.metricas(meus, docs_map)
    return render_template("painel_coordenacao.html", m=m, alertas=db.alertas(meus, docs_map),
                           etapas=db.ETAPAS, situacoes=db.SITUACOES,
                           digest=request.args.get("digest"))


@app.route("/atividade")
def atividade():
    with db.Session() as s:
        projetos = [db.to_dict(x) for x in s.query(db.Projeto).all()]
        meus = _so_meus(projetos)
        ids = {p["id"] for p in meus}
        cli = {p["id"]: p["cliente"] for p in meus}
        if ids:
            eventos = [db.to_dict(x) for x in s.query(db.Evento)
                       .filter(db.Evento.projeto_id.in_(ids))
                       .order_by(db.Evento.criado_em.desc()).all()]
        else:
            eventos = []
    feed = [{**e, "cliente": cli.get(e["projeto_id"], "?")} for e in eventos[:60]]
    return render_template("atividade.html", feed=feed,
                           uso=db.metricas_uso(eventos, meus), funil=db.funil_macro(meus))


@app.route("/projetos/novo", methods=["GET", "POST"])
def projeto_novo():
    if request.method == "POST":
        with db.Session() as s:
            p = db.aplicar_form(db.Projeto(), request.form)
            s.add(p)
            s.commit()
            pid = p.id
        return redirect(url_for("projeto_ficha", pid=pid, salvo=1))
    return render_template("projeto_ficha.html", p=None, etapas=db.ETAPAS, situacoes=db.SITUACOES)


@app.route("/projetos/<int:pid>", methods=["GET", "POST"])
def projeto_ficha(pid):
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        if request.method == "POST":
            etapa_old, sit_old = p.etapa, p.situacao
            db.aplicar_form(p, request.form)
            if p.etapa != etapa_old:
                db.registrar_evento(s, pid, "etapa", "Etapa: %s → %s" % (etapa_old, p.etapa), _autor())
            if p.situacao != sit_old:
                db.registrar_evento(s, pid, "etapa", "Situação: %s → %s" % (sit_old, p.situacao), _autor())
            s.commit()
            docs = [db.to_dict(x) for x in s.query(db.Documento).filter_by(projeto_id=pid).all()]
            g = db.gate_status(p.etapa, docs)
            if not g["ok"]:
                return redirect(url_for("projeto_ficha", pid=pid, salvo=1,
                    aviso="Etapa “%s” salva, mas faltam documentos obrigatórios: %s." % (p.etapa, ", ".join(g["faltam"]))))
            return redirect(url_for("projeto_ficha", pid=pid, salvo=1))
        d = db.to_dict(p)
        docs = [db.to_dict(x) for x in s.query(db.Documento)
                .filter_by(projeto_id=pid).order_by(db.Documento.criado_em.desc()).all()]
        gate = db.gate_status(d["etapa"], docs)
        eventos = [db.to_dict(x) for x in s.query(db.Evento)
                   .filter_by(projeto_id=pid).order_by(db.Evento.criado_em.desc()).all()]
    return render_template("projeto_ficha.html", p=d, docs=docs, etapas=db.ETAPAS,
                           situacoes=db.SITUACOES, salvo=request.args.get("salvo"),
                           erro=request.args.get("erro"), aviso=request.args.get("aviso"),
                           gate=gate, doc_tipos=db.DOC_LABELS, eventos=eventos,
                           cab=db.cabecalho(d, docs))


@app.route("/projetos/<int:pid>/excluir", methods=["POST"])
def projeto_excluir(pid):
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if p:
            s.query(db.Documento).filter_by(projeto_id=pid).delete()
            s.query(db.Evento).filter_by(projeto_id=pid).delete()
            s.delete(p)
            s.commit()
    return redirect(url_for("projetos"))


@app.route("/projetos/<int:pid>/avancar", methods=["POST"])
def projeto_avancar(pid):
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        docs = [db.to_dict(x) for x in s.query(db.Documento).filter_by(projeto_id=pid).all()]
        prox = db.proxima_etapa(p.etapa)
        if prox and db.gate_status(prox, docs)["ok"]:
            old = p.etapa
            p.etapa = prox
            db.registrar_evento(s, pid, "etapa", "Avançou de fase: %s → %s" % (old, prox), _autor())
            s.commit()
            return redirect(url_for("projeto_ficha", pid=pid, salvo=1))
    return redirect(url_for("projeto_ficha", pid=pid,
                            aviso="Não dá para avançar: faltam documentos obrigatórios da próxima etapa."))


@app.route("/projetos/<int:pid>/gerar_pendentes", methods=["POST"])
def projeto_gerar_pendentes(pid):
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
        docs = [db.to_dict(x) for x in s.query(db.Documento).filter_by(projeto_id=pid).all()]
    prox = db.proxima_etapa(proj["etapa"])
    gate = db.gate_status(prox or proj["etapa"], docs)
    gerados = 0
    for it in gate["itens"]:
        if it["ok"] or it["tipo"] not in ("levantamento", "checklist", "cronograma", "termo"):
            continue   # 'projeto' precisa do Mapeamento preenchido (upload)
        try:
            path, _log = runner.gerar_do_projeto(proj, it["tipo"])
        except Exception:
            path = None
        if path:
            with db.Session() as s:
                s.add(db.Documento(projeto_id=pid, tipo=it["tipo"],
                                   arquivo=os.path.basename(path), caminho=path))
                db.registrar_evento(s, pid, "documento",
                                    "Gerou %s (%s)" % (os.path.basename(path), it["tipo"]), _autor())
                s.commit()
            gerados += 1
    aviso = None if gerados else "Nada a gerar automaticamente (o pendente pode ser o Projeto, que precisa do Mapeamento preenchido)."
    return redirect(url_for("projeto_ficha", pid=pid, salvo=1, aviso=aviso))


@app.route("/projetos/<int:pid>/gerar/<tipo>", methods=["POST"])
def projeto_gerar(pid, tipo):
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    try:
        path, _log = runner.gerar_do_projeto(proj, tipo)
    except Exception:
        path = None
    if path:
        with db.Session() as s:
            s.add(db.Documento(projeto_id=pid, tipo=tipo,
                               arquivo=os.path.basename(path), caminho=path))
            db.registrar_evento(s, pid, "documento",
                                "Gerou %s (%s)" % (os.path.basename(path), tipo), _autor())
            s.commit()
    return redirect(url_for("projeto_ficha", pid=pid))


@app.route("/projetos/<int:pid>/gerar_projeto", methods=["POST"])
def projeto_gerar_projeto(pid):
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        cliente = p.cliente
    f = request.files.get("arquivo")
    if not (f and f.filename and f.filename.lower().endswith(".docx")):
        return redirect(url_for("projeto_ficha", pid=pid, erro="Envie o Mapeamento (.docx) preenchido."))
    path = os.path.join(UPLOADS, "map_" + C.slug(f.filename) + ".docx")
    f.save(path)
    try:
        proj_path, _yaml = runner.gerar_projeto_de_docx(path, cliente=cliente)
    except Exception as e:
        return redirect(url_for("projeto_ficha", pid=pid, erro="Falha ao gerar o Projeto: %s" % type(e).__name__))
    if proj_path:
        with db.Session() as s:
            s.add(db.Documento(projeto_id=pid, tipo="projeto",
                               arquivo=os.path.basename(proj_path), caminho=proj_path))
            db.registrar_evento(s, pid, "documento",
                                "Gerou %s (projeto, pelo Mapeamento)" % os.path.basename(proj_path), _autor())
            s.commit()
    return redirect(url_for("projeto_ficha", pid=pid))


@app.route("/projetos/<int:pid>/anexar", methods=["POST"])
def projeto_anexar(pid):
    """Anexa um documento manualmente ao projeto (ex.: Cronograma) para satisfazer o gate."""
    with db.Session() as s:
        if not s.get(db.Projeto, pid):
            abort(404)
    f = request.files.get("arquivo")
    tipo = (request.form.get("tipo") or "outro").strip().lower()
    if not (f and f.filename):
        return redirect(url_for("projeto_ficha", pid=pid, erro="Selecione um arquivo para anexar."))
    base, ext = os.path.splitext(f.filename)
    nome = "anexo_%d_%s_%s%s" % (pid, tipo, C.slug(base), ext.lower())
    path = os.path.join(UPLOADS, nome)
    f.save(path)
    with db.Session() as s:
        s.add(db.Documento(projeto_id=pid, tipo=tipo,
                           arquivo=os.path.basename(path), caminho=path))
        db.registrar_evento(s, pid, "documento",
                            "Anexou %s (%s)" % (os.path.basename(path), tipo), _autor())
        s.commit()
    return redirect(url_for("projeto_ficha", pid=pid, salvo=1))


@app.route("/projetos/<int:pid>/nota", methods=["POST"])
def projeto_nota(pid):
    texto = (request.form.get("nota") or "").strip()
    if texto:
        with db.Session() as s:
            if not s.get(db.Projeto, pid):
                abort(404)
            db.registrar_evento(s, pid, "nota", texto, _autor())
            s.commit()
    return redirect(url_for("projeto_ficha", pid=pid))


@app.route("/fluxo")
def fluxo_inicio():
    import fluxo as F, imap_intake, mailer
    return render_template("fluxo.html", modelo=F.MODELO_FECHAMENTO,
                           imap_ok=imap_intake.configurado(), smtp_ok=mailer.configurado(),
                           erro=request.args.get("erro"))


def _fluxo_confirmar(texto, assunto=None, fonte=""):
    import fluxo as F
    proj = F.para_projeto(F.parse_fechamento(texto))
    return render_template("fluxo_confirmar.html", proj=proj, fonte=fonte,
                           assunto=assunto, bruto=texto)


@app.route("/fluxo/parse", methods=["POST"])
def fluxo_parse():
    return _fluxo_confirmar(request.form.get("texto", ""), fonte="e-mail colado")


@app.route("/fluxo/inbox", methods=["POST"])
def fluxo_inbox():
    import imap_intake
    corpo, assunto, erro = imap_intake.buscar_fechamento()
    if erro:
        return redirect(url_for("fluxo_inicio", erro=erro))
    return _fluxo_confirmar(corpo, assunto=assunto, fonte="caixa de entrada")


@app.route("/fluxo/criar", methods=["POST"])
def fluxo_criar():
    import re as _re
    import datetime
    import fluxo as F
    import mailer
    f = request.form
    proj_fields = {k: (f.get(k) or "").strip() for k in
                   ("cliente", "cnpj", "ramo", "numero_projeto", "modulos",
                    "horas_cobradas", "horas_bonificadas", "contatos", "observacoes")}
    gci = (f.get("consultor") or "").strip()
    tecnicos = (f.get("tecnicos") or "").strip()
    gerar = f.getlist("gerar") or ["levantamento", "checklist", "cronograma"]
    proj_fields["consultor"] = gci
    if tecnicos:
        proj_fields["observacoes"] = (proj_fields["observacoes"]
                                      + (" · " if proj_fields["observacoes"] else "")
                                      + "Técnicos: " + tecnicos)
    proj_fields["data_inicio"] = datetime.date.today().isoformat()

    with db.Session() as s:
        p = db.aplicar_form(db.Projeto(), proj_fields)
        s.add(p)
        s.commit()
        pid = p.id
        db.registrar_evento(s, pid, "etapa", "Fluxo iniciado pelo e-mail de fechamento (Comercial).", _autor())
        if gci:
            db.registrar_evento(s, pid, "nota", "GCI designado p/ Levantamento: %s" % gci, _autor())
        if tecnicos:
            db.registrar_evento(s, pid, "nota", "Técnico(s) da implantação: %s" % tecnicos, _autor())
        s.commit()
        proj = db.to_dict(p)

    caminhos, nomes = [], []
    for tipo in gerar:
        try:
            path, _log = runner.gerar_do_projeto(proj, tipo)
        except Exception:
            path = None
        if path:
            with db.Session() as s:
                s.add(db.Documento(projeto_id=pid, tipo=tipo,
                                   arquivo=os.path.basename(path), caminho=path))
                db.registrar_evento(s, pid, "documento",
                                    "Gerou %s (%s)" % (os.path.basename(path), tipo), _autor())
                s.commit()
            caminhos.append(path)
            nomes.append(os.path.basename(path))

    destinos = [e.strip() for e in _re.split(r"[;,]", f.get("emails_responsaveis") or "") if e.strip()]
    enviado, erro_mail = False, None
    if destinos and mailer.configurado():
        resumo = F.resumo_projeto(proj, nomes, gci, tecnicos)
        enviado, erro_mail = mailer.enviar(destinos, "Implantação iniciada — %s" % proj.get("cliente"),
                                           resumo, anexos=caminhos)
        with db.Session() as s:
            db.registrar_evento(s, pid, "email",
                ("Pacote inicial enviado a %s" % ", ".join(destinos)) if enviado
                else ("Falha ao enviar o pacote: %s" % erro_mail), _autor())
            s.commit()
    aviso = None
    if destinos and not enviado:
        aviso = "Fluxo criado, mas o e-mail não saiu: %s" % (erro_mail or "configure o SMTP.")
    elif not destinos:
        aviso = "Fluxo criado. Nenhum destinatário informado — pacote não enviado por e-mail."
    return redirect(url_for("projeto_ficha", pid=pid, salvo=1, aviso=aviso))


@app.route("/config/imap", methods=["GET", "POST"])
def config_imap():
    import imap_intake
    salvo = False
    if request.method == "POST":
        imap_intake.salvar_cfg(request.form)
        salvo = True
    return render_template("config_imap.html", cfg=imap_intake.load_cfg(), salvo=salvo,
                           configurado=imap_intake.configurado())


@app.route("/mapa")
def mapa():
    MAPA = {"nome": "Implantação SIGER®", "filhos": [
        {"nome": "👥 Papéis (Agentes)", "filhos": [
            {"nome": "Coordenação da Implantação"}, {"nome": "Setor Adm"},
            {"nome": "Consultor de Implantação (GCI)"}, {"nome": "Gerente do Projeto"},
            {"nome": "Equipe de Conversão"}, {"nome": "Gestão da Mudança (OCM)"}]},
        {"nome": "🔎 Pré-implantação", "filhos": [
            {"nome": "Levantamento de processos (apoio comercial)"},
            {"nome": "Apoio comercial / Demonstração"}]},
        {"nome": "🛠️ Implantação", "filhos": [
            {"nome": "Abertura da implantação"}, {"nome": "Manutenção da RNS(I)"},
            {"nome": "Registros no SICLA (12/13)"}, {"nome": "Levantamento micro"},
            {"nome": "Aderência ao SIGER"}, {"nome": "Encaminhar conversões (ORC/COB)"},
            {"nome": "Encaminhar desenvolvimentos"}, {"nome": "Projeto de Implantação"},
            {"nome": "Cronograma (até 5 dias úteis)"}, {"nome": "Parametrizações (1.1.P / 1.2.A / 1.2.M)"},
            {"nome": "Treinamento de rotinas"}, {"nome": "Simulações (micro e macro)"},
            {"nome": "Virada oficial"}, {"nome": "Acompanhamento de produção"},
            {"nome": "Encerramento (Termo + e-mail final)"}]},
        {"nome": "✅ Qualidade e Robustez", "filhos": [
            {"nome": "P0 — Gestão da Mudança (OCM/ADKAR)"}, {"nome": "P0 — Testes SIT/UAT (gate da virada)"},
            {"nome": "P1 — Validação de conversão"}, {"nome": "P1 — Hypercare"}, {"nome": "P1 — Fit/Gap"},
            {"nome": "P2 — KPIs"}, {"nome": "P2 — RAID"}, {"nome": "P2 — Dossiê do cliente"}]},
        {"nome": "📑 Convenções", "filhos": [
            {"nome": "SICLA: 12=apoio comercial · 13=implantação · 84=agenda interna"},
            {"nome": "RNS: RNS(I) · ORC · COB"},
            {"nome": "Projeto + Cronograma: até 5 dias úteis após o levantamento"},
            {"nome": "Documentos obrigatórios: Projeto · Cronograma · Termo"}]},
    ]}
    return render_template("mapa.html", mapa=MAPA)


@app.route("/download")
def download():
    path = os.path.abspath(request.args.get("path", ""))
    if not os.path.exists(path) or not any(
            path.startswith(os.path.abspath(d)) for d in ALLOWED_DIRS):
        abort(403)
    return send_file(path, as_attachment=True)


@app.route("/health")
def health():
    """Verificação de saúde (para monitoração): testa o banco."""
    try:
        with db.Session() as s:
            s.query(db.Projeto).count()
        return {"status": "ok", "db": db.engine.dialect.name}, 200
    except Exception as e:
        return {"status": "degraded", "erro": type(e).__name__}, 503


def _agendador_digest():
    """Thread diária: envia o resumo por e-mail na hora DIGEST_HORA (default 8h)."""
    import time
    import datetime
    hora = int(os.environ.get("DIGEST_HORA", "8") or 8)
    ultimo = None
    while True:
        try:
            ag = datetime.datetime.now()
            if ag.hour == hora and ultimo != ag.date() and _digest_destinos():
                ok, _e = enviar_digest()
                ultimo = ag.date()
                logging.info("Digest diário: enviado=%s", ok)
        except Exception as e:
            logging.warning("Digest falhou: %s", e)
        time.sleep(1800)   # checa a cada 30 min


def _abrir_navegador():
    import webbrowser
    webbrowser.open("http://127.0.0.1:5000")


if __name__ == "__main__":
    import threading
    host = os.environ.get("PAINEL_HOST", "127.0.0.1")   # 0.0.0.0 = servir para a rede interna
    port = int(os.environ.get("PAINEL_PORT", "5000"))
    if os.environ.get("WERKZEUG_RUN_MAIN") != "true" and host in ("127.0.0.1", "localhost"):
        threading.Timer(1.3, _abrir_navegador).start()
    if _digest_destinos():
        threading.Thread(target=_agendador_digest, daemon=True).start()
        logging.info("Agendador de digest diário ativo (DIGEST_HORA=%s).", os.environ.get("DIGEST_HORA", "8"))
    try:
        from waitress import serve
        logging.info("Painel no ar em http://%s:%s  (waitress)", host, port)
        serve(app, host=host, port=port, threads=8)
    except ImportError:
        logging.warning("waitress ausente — usando o servidor de desenvolvimento")
        app.run(host=host, port=port, debug=False)
