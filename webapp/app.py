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
app.secret_key = "painel-implantacao-rech"

UPLOADS = os.path.join(C.DATA_WRITE if FROZEN else HERE, "_uploads")
os.makedirs(UPLOADS, exist_ok=True)
ALLOWED_DIRS = [C.OUT, C.DATA_WRITE, C.DATA, UPLOADS]
db.init_db()   # cria o banco do hub (Projetos por Cliente) se não existir


PERFIS = ["Coordenação", "Consultor"]


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


@app.route("/")
def home():
    return render_template("home.html", roles=roles.ROLES)


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
            "perfil_nome_atual": session.get("perfil_nome", "")}


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
    return render_template("projetos_lista.html", itens=_so_meus(itens))


@app.route("/coordenacao")
def coordenacao():
    with db.Session() as s:
        projetos = [db.to_dict(x) for x in s.query(db.Projeto).all()]
        docs_map = {}
        for dcto in s.query(db.Documento).all():
            docs_map.setdefault(dcto.projeto_id, []).append({"tipo": dcto.tipo})
    m = db.metricas(_so_meus(projetos), docs_map)
    return render_template("painel_coordenacao.html", m=m,
                           etapas=db.ETAPAS, situacoes=db.SITUACOES)


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
                           gate=gate, doc_tipos=db.DOC_LABELS, eventos=eventos)


@app.route("/projetos/<int:pid>/excluir", methods=["POST"])
def projeto_excluir(pid):
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if p:
            s.delete(p)
            s.commit()
    return redirect(url_for("projetos"))


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


def _abrir_navegador():
    import webbrowser
    webbrowser.open("http://127.0.0.1:5000")


if __name__ == "__main__":
    import threading
    host = os.environ.get("PAINEL_HOST", "127.0.0.1")   # 0.0.0.0 = servir para a rede interna
    port = int(os.environ.get("PAINEL_PORT", "5000"))
    if os.environ.get("WERKZEUG_RUN_MAIN") != "true" and host in ("127.0.0.1", "localhost"):
        threading.Timer(1.3, _abrir_navegador).start()
    app.run(host=host, port=port, debug=False)
