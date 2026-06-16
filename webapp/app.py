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


VERSAO = "1.1 · jun/2026"

# Quem pode GERAR cada documento (por perfil)
_GERA = {"levantamento": ("ADM", "Coordenador", "GCI"),
         "projeto": ("ADM", "Coordenador", "GCI"),
         "checklist": ("ADM", "Coordenador", "Consultor"),
         "cronograma": ("ADM", "Coordenador", "Consultor"),
         "termo": ("ADM", "Coordenador", "Consultor")}


def _perfil():
    try:
        return session.get("perfil") or ""
    except Exception:
        return ""   # fora de um request (threads do robô/digest)


def _autor():
    try:
        return session.get("perfil_nome") or ""
    except Exception:
        return "sistema"   # ações automáticas em segundo plano


def _e_adm():
    return _perfil() == "ADM"


def pode_designar():
    return (not _perfil()) or _perfil() in ("ADM", "Coordenador")


def pode_gerar(tipo):
    p = _perfil()
    return (not p) or p in _GERA.get(tipo, ("ADM", "Coordenador"))


# Visibilidade por área do menu (e bloqueio no backend)
#  - gestao  = Coordenação + Atividade  -> ADM, Coordenador, GCI
#  - sistema = Ferramentas + Usuários + Configurações -> só ADM
_AREA_PERFIS = {"gestao": ("ADM", "Coordenador", "GCI"), "sistema": ("ADM",)}


def pode_ver(area):
    """True se o perfil atual pode ver a área. Sem login (perfil vazio) = acesso total."""
    p = _perfil()
    return (not p) or p in _AREA_PERFIS.get(area, ())


def _casa(nome, campo):
    """Casa o nome do usuário logado com o campo de responsável (tolerante)."""
    nome = (nome or "").strip().lower()
    campo = (campo or "").strip().lower()
    if not nome or not campo:
        return False
    if campo in nome or nome in campo:
        return True
    return any(w in campo for w in nome.split() if len(w) > 2)


def _so_meus(projetos):
    """Filtro de visão por perfil: ADM/Coordenador veem tudo; GCI vê onde é o GCI;
    Consultor vê onde é consultor designado."""
    p = _perfil()
    nome = session.get("perfil_nome") or ""
    if p == "GCI" and nome:
        return [x for x in projetos if _casa(nome, x.get("gci"))]
    if p == "Consultor" and nome:
        return [x for x in projetos if _casa(nome, x.get("consultor"))]
    return projetos


def _senha_acesso():
    """Senha mestra (1º acesso, antes de cadastrar usuários): env PAINEL_SENHA ou acesso.txt."""
    s = os.environ.get("PAINEL_SENHA")
    if s:
        return s
    p = os.path.join(C.DATA_WRITE, "acesso.txt")
    return open(p, encoding="utf-8").read().strip() if os.path.exists(p) else None


def _login_ativo():
    return db.ha_usuarios() or bool(_senha_acesso())


@app.before_request
def _exige_login():
    if not _login_ativo():
        return  # login desabilitado (nenhum usuário e sem senha mestra)
    if request.endpoint in ("login", "cadastro", "cadastro_confirmar", "health", "static") or session.get("auth"):
        return
    return redirect(url_for("login", next=request.path))


@app.route("/login", methods=["GET", "POST"])
def login():
    erro = None
    if request.method == "POST":
        usr = db.autenticar(request.form.get("login", ""), request.form.get("senha", ""))
        if usr:
            session.update(auth=True, user_id=usr["id"], perfil=usr["perfil"],
                           perfil_nome=usr["nome"] or usr["login"])
            return redirect(request.args.get("next") or url_for("home"))
        # senha mestra: acesso de emergência como ADM (sempre válida — evita bloqueio)
        if _senha_acesso() and request.form.get("senha", "") == _senha_acesso():
            session.update(auth=True, perfil="ADM", perfil_nome="Administrador")
            return redirect(url_for("usuarios"))
        erro = "Login ou senha incorretos."
    return render_template("login.html", erro=erro, tem_usuarios=db.ha_usuarios())


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


def _codigo_validacao():
    import random
    return "%06d" % random.randint(0, 999999)


def _enviar_codigo(nome, email, codigo):
    import mailer
    corpo = ("Olá%s!\n\nSeu código de validação para o Painel de Implantação é:\n\n"
             "        %s\n\nInforme-o na tela de cadastro para concluir o acesso. "
             "O código expira em 30 minutos.\n\nSe você não solicitou este cadastro, ignore este e-mail.\n\n"
             "— Painel de Implantação · Rech Sistemas de Gestão" % ((", " + nome) if nome else "", codigo))
    return mailer.enviar([email], "Código de validação — Painel de Implantação", corpo)


@app.route("/cadastro", methods=["GET", "POST"])
def cadastro():
    import re as _re
    import mailer
    db.limpar_pendentes()
    erro = None
    if request.method == "POST":
        nome = (request.form.get("nome") or "").strip()
        email = (request.form.get("email") or "").strip().lower()
        senha = request.form.get("senha") or ""
        if not nome or not email or not senha:
            erro = "Preencha nome, e-mail e senha."
        elif not _re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            erro = "Informe um e-mail válido."
        elif len(senha) < 6:
            erro = "A senha precisa de pelo menos 6 caracteres."
        elif db.existe_usuario(login=email, email=email):
            erro = "Este e-mail já tem acesso. Use a tela de login."
        elif not mailer.configurado():
            erro = "O envio de e-mail ainda não está configurado — avise o Administrador (Config → Gmail API)."
        else:
            codigo = _codigo_validacao()
            db.salvar_pendente(nome, email, email, senha, codigo)
            ok, err = _enviar_codigo(nome, email, codigo)
            if ok:
                session["cad_email"] = email
                return redirect(url_for("cadastro_confirmar"))
            erro = "Não foi possível enviar o e-mail: %s" % (err or "erro")
    return render_template("cadastro.html", erro=erro)


@app.route("/cadastro/confirmar", methods=["GET", "POST"])
def cadastro_confirmar():
    email = session.get("cad_email")
    if not email:
        return redirect(url_for("cadastro"))
    erro = aviso = None
    if request.method == "POST":
        if request.form.get("reenviar"):
            codigo = _codigo_validacao()
            if db.atualizar_codigo(email, codigo):
                ok, err = _enviar_codigo("", email, codigo)
                aviso = "Enviamos um novo código." if ok else ("Falha ao reenviar: %s" % (err or "erro"))
            else:
                return redirect(url_for("cadastro"))
        else:
            usr, e = db.confirmar_pendente(email, request.form.get("codigo", ""))
            if usr:
                session.pop("cad_email", None)
                session.update(auth=True, user_id=usr["id"], perfil=usr["perfil"],
                               perfil_nome=usr["nome"])
                logging.info("Novo usuário cadastrado: %s (%s)", usr["login"], usr["perfil"])
                return redirect(url_for("home"))
            erro = e
    return render_template("cadastro_confirmar.html", email=email, erro=erro, aviso=aviso)


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


def _notificar(pid, emails, assunto, corpo):
    """Notifica por e-mail (se configurado) e registra na timeline. Reutilizado no fluxo."""
    import mailer
    emails = [e for e in emails if e]
    if not emails:
        return
    ok, err = (False, "e-mail não configurado")
    if mailer.configurado():
        ok, err = mailer.enviar(emails, assunto, corpo)
    with db.Session() as s:
        db.registrar_evento(s, pid, "email",
            ("Notificou %s — %s" % (", ".join(emails), assunto)) if ok
            else ("Notificação pendente (%s): %s" % (assunto, err or "?")), _autor())
        s.commit()


def _emails_coordenacao():
    em = [u["login"] for u in db.usuarios_por_perfil("ADM") + db.usuarios_por_perfil("Coordenador") if u["login"]]
    return em or _digest_destinos()


_EVT_MSG = {
    "fechamento":      ("Novo fechamento — %s", "Novo processo de implantação recebido (%s). Designe o GCI do Levantamento."),
    "levantamento_ok": ("Levantamento concluído — %s", "O Levantamento de %s foi concluído; siga para o Projeto."),
    "projeto_ok":      ("Projeto gerado — %s", "O Projeto de %s foi gerado. Designe os Consultores da implantação."),
    "cronograma_ok":   ("Cronograma concluído — %s", "O Cronograma de %s foi concluído."),
    "checklist_ok":    ("Check-list concluído — %s", "O Check-list de %s foi concluído."),
    "termo_ok":        ("Termo de Encerramento — %s", "O Termo de Encerramento de %s foi gerado."),
    "encerrado":       ("Implantação encerrada — %s", "A implantação de %s foi encerrada."),
}
_EVT_DOC = {"levantamento": "levantamento_ok", "cronograma": "cronograma_ok",
            "checklist": "checklist_ok", "termo": "termo_ok"}


def _notificar_evento(pid, evento, proj=None):
    """Dispara a notificação padrão (à Coordenação) de um evento do fluxo."""
    if not evento or evento not in _EVT_MSG:
        return
    if proj is None:
        with db.Session() as s:
            p = s.get(db.Projeto, pid)
            proj = db.to_dict(p) if p else {}
    cli = proj.get("cliente", "")
    assunto, corpo = _EVT_MSG[evento]
    _notificar(pid, _emails_coordenacao(), assunto % cli, (corpo % cli) + "\n\n— Painel de Implantação")


def _criar_projeto_de_fechamento(corpo, assunto=""):
    """Cria a ficha do projeto a partir do corpo do e-mail de fechamento (robô da caixa)."""
    import datetime
    import fluxo as F
    pf = F.para_projeto(F.parse_fechamento(corpo))
    pf.pop("contato_email", None)
    ja = db.projeto_existe(pf.get("cliente"), pf.get("cnpj"))
    if ja:
        logging.info("Fechamento ignorado (já cadastrado, id=%s): %s | CNPJ %s",
                     ja, pf.get("cliente") or "?", pf.get("cnpj") or "-")
        return ja   # já existe: não cria de novo nem notifica
    pf["data_inicio"] = datetime.date.today().isoformat()
    with db.Session() as s:
        p = db.aplicar_form(db.Projeto(), pf)
        s.add(p)
        s.commit()
        pid = p.id
        db.registrar_evento(s, pid, "etapa", "Fechamento recebido automaticamente da caixa.", "sistema")
        s.commit()
        proj = db.to_dict(p)
    _notificar_evento(pid, "fechamento", proj)
    return pid


_ETAPA_DOC = {"levantamento": "Levantamento", "projeto": "Projeto",
              "cronograma": "Cronograma e Check-list", "checklist": "Cronograma e Check-list",
              "termo": "Encerramento"}


def _etapa_permite_gerar(tipo, etapa):
    """A geração de um documento só é liberada na etapa dele (ou depois)."""
    return db.macro_idx(etapa) >= db.macro_idx(_ETAPA_DOC.get(tipo, etapa))


def _auto_avancar(pid):
    """Avança a etapa automaticamente enquanto o gate da próxima estiver satisfeito."""
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p or p.etapa == "Levantamento":
            return   # a conclusão do Levantamento é confirmada pelo GCI (botão Avançar)
        docs = [db.to_dict(x) for x in s.query(db.Documento).filter_by(projeto_id=pid).all()]
        prox = db.proxima_etapa(p.etapa)
        mudou = False
        while prox and db.gate_status(prox, docs)["ok"]:
            db.registrar_evento(s, pid, "etapa", "Avançou automaticamente: %s → %s" % (p.etapa, prox), "sistema")
            p.etapa = prox
            prox = db.proxima_etapa(p.etapa)
            mudou = True
        if mudou:
            s.commit()


@app.route("/")
def home():
    dados = {"ativos": 0, "no_prazo": 0, "atrasados": 0, "alertas": 0, "risco": 0}
    alertas, pendencias, foco = [], [], None
    try:
        with db.Session() as s:
            projetos = [db.to_dict(x) for x in s.query(db.Projeto).all()]
            docs_map = {}
            for dcto in s.query(db.Documento).all():
                docs_map.setdefault(dcto.projeto_id, []).append({"tipo": dcto.tipo})
        meus = _so_meus(projetos)
        m = db.metricas(meus, docs_map)
        alertas = db.alertas(meus, docs_map)
        dados = {"ativos": m["ativos"], "no_prazo": m["no_prazo"], "atrasados": m["n_atrasados"],
                 "alertas": len(alertas), "risco": m["n_risco"], "total": m["total"],
                 "concluidos": m["concluidos"], "gate_pendente": m["gate_pendente"]}
        ativos = [p for p in meus if p.get("situacao") != "Concluído"]
        for p in ativos:
            cab = db.cabecalho(p, docs_map.get(p["id"], []))
            if cab.get("proxima"):
                pendencias.append({"id": p["id"], "cliente": p["cliente"],
                                   "acao": "Gerar " + cab["proxima"]["label"]})
            elif cab.get("prox_etapa") and cab.get("avancar_ok"):
                pendencias.append({"id": p["id"], "cliente": p["cliente"],
                                   "acao": "Avançar para " + cab["prox_etapa"]})
        ativos_ord = sorted(ativos, key=lambda p: (p.get("atualizado_em") is not None,
                                                   p.get("atualizado_em")), reverse=True)
        if ativos_ord:
            f = ativos_ord[0]
            foco = {"p": f, "cab": db.cabecalho(f, docs_map.get(f["id"], []))}
    except Exception:
        pass
    return render_template("home.html", roles=roles.ROLES, dados=dados,
                           alertas=alertas[:6], pendencias=pendencias[:6], foco=foco)


@app.route("/papel/<rid>")
def papel(rid):
    r = roles.get_role(rid)
    if not r:
        abort(404)
    return render_template("role.html", role=r)


@app.route("/acao/<rid>/<aid>", methods=["GET", "POST"])
def acao(rid, aid):
    if not pode_ver("sistema"):
        abort(403)
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
            "perfil_atual": session.get("perfil", ""),
            "perfil_nome_atual": session.get("perfil_nome", ""),
            "versao": VERSAO, "login_ativo": _login_ativo(), "e_adm": (_perfil() == "ADM"),
            "pode_gerar": pode_gerar, "pode_designar": pode_designar(), "pode_ver": pode_ver}


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


@app.route("/perfil")
def perfil():
    return render_template("perfil.html", perfil=session.get("perfil", ""),
                           perfil_nome=session.get("perfil_nome", ""), login_ativo=_login_ativo())


@app.route("/usuarios", methods=["GET", "POST"])
def usuarios():
    if not pode_ver("sistema"):
        abort(403)
    if request.method == "POST":
        with db.Session() as s:
            uid = request.form.get("id")
            u = s.get(db.Usuario, int(uid)) if uid else db.Usuario()
            u.login = (request.form.get("login") or "").strip()
            u.nome = (request.form.get("nome") or "").strip()
            u.email = (request.form.get("email") or "").strip()
            u.perfil = request.form.get("perfil") or "Consultor"
            u.ativo = 1 if request.form.get("ativo") else 0
            if not u.login:
                u.login = u.email
            senha = request.form.get("senha") or ""
            if senha:
                db.set_senha(u, senha)
            if not uid:
                s.add(u)
            s.commit()
        return redirect(url_for("usuarios", salvo=1))
    with db.Session() as s:
        lista = [db.to_dict(x) for x in s.query(db.Usuario).order_by(db.Usuario.nome).all()]
    return render_template("usuarios.html", usuarios=lista, perfis=db.PERFIS,
                           salvo=request.args.get("salvo"))


@app.route("/cliente", methods=["GET", "POST"])
def cliente():
    if not pode_ver("sistema"):
        abort(403)
    if request.method == "POST":
        base, nome = forms.build_cliente_yaml(request.form, runner.DATA, C.slug)
        session["cliente_yaml"] = base
        session["cliente_nome"] = nome
        return redirect(request.args.get("next") or url_for("home"))
    return render_template("cliente.html", campos=forms.CLIENTE_FIELDS,
                           atual=session.get("cliente_nome"), valores={})


@app.route("/config", methods=["GET", "POST"])
def config():
    if not pode_ver("sistema"):
        abort(403)
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
    if not pode_ver("sistema"):
        abort(403)
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
    if not pode_ver("gestao"):
        abort(403)
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
    if not pode_ver("gestao"):
        abort(403)
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
            if p.situacao == "Concluído" and sit_old != "Concluído":
                _notificar_evento(pid, "encerrado")
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
                           cab=db.cabecalho(d, docs), designacoes=db.designacoes_do_projeto(pid))


@app.route("/projetos/<int:pid>/excluir", methods=["POST"])
def projeto_excluir(pid):
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if p:
            for M in (db.Documento, db.Evento, db.Designacao,
                      db.CronogramaItem, db.ChecklistItem, db.Modificacao):
                s.query(M).filter_by(projeto_id=pid).delete()
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
        if (it["ok"] or it["tipo"] not in ("levantamento", "checklist", "cronograma", "termo")
                or not pode_gerar(it["tipo"]) or not _etapa_permite_gerar(it["tipo"], proj["etapa"])):
            continue   # respeita perfil e etapa; 'projeto' precisa do Mapeamento (upload)
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
            _notificar_evento(pid, _EVT_DOC.get(it["tipo"]), proj)
    if gerados:
        _auto_avancar(pid)
    aviso = None if gerados else "Nada a gerar automaticamente (o pendente pode ser o Projeto, que precisa do Mapeamento preenchido)."
    return redirect(url_for("projeto_ficha", pid=pid, salvo=1, aviso=aviso))


@app.route("/projetos/<int:pid>/gerar/<tipo>", methods=["POST"])
def projeto_gerar(pid, tipo):
    if not pode_gerar(tipo):
        abort(403)
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    if not _etapa_permite_gerar(tipo, proj.get("etapa")):
        return redirect(url_for("projeto_ficha", pid=pid,
            aviso="'%s' só pode ser gerado na etapa '%s' ou depois." % (db.DOC_LABELS.get(tipo, tipo), _ETAPA_DOC.get(tipo, "?"))))
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
        _notificar_evento(pid, _EVT_DOC.get(tipo), proj)
        _auto_avancar(pid)
    return redirect(url_for("projeto_ficha", pid=pid))


@app.route("/projetos/<int:pid>/gerar_projeto", methods=["POST"])
def projeto_gerar_projeto(pid):
    if not pode_gerar("projeto"):
        abort(403)
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        cliente = p.cliente
        etapa = p.etapa
    if not _etapa_permite_gerar("projeto", etapa):
        return redirect(url_for("projeto_ficha", pid=pid, erro="O Projeto só pode ser gerado na etapa 'Projeto' ou depois."))
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
        _notificar_evento(pid, "projeto_ok")
        _auto_avancar(pid)
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


@app.route("/projetos/<int:pid>/designar", methods=["GET", "POST"])
def projeto_designar(pid):
    if not pode_designar():
        abort(403)
    import re as _re
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    mods = [m.strip() for m in _re.split(r"[,;\n]+", proj.get("modulos", "") or "") if m.strip()]
    gcis = db.usuarios_por_perfil("GCI")
    consultores = db.usuarios_por_perfil("Consultor")
    email_de = {u["nome"]: u["login"] for u in gcis + consultores}
    if request.method == "POST":
        gci = (request.form.get("gci") or "").strip()
        por_consultor = {}
        with db.Session() as s:
            s.query(db.Designacao).filter_by(projeto_id=pid).delete()
            for i, m in enumerate(mods):
                cons = (request.form.get("mod_%d" % i) or "").strip()
                if cons:
                    s.add(db.Designacao(projeto_id=pid, modulo=m, consultor=cons))
                    por_consultor.setdefault(cons, []).append(m)
            p = s.get(db.Projeto, pid)
            p.gci = gci
            p.consultor = ", ".join(sorted(por_consultor.keys()))
            cliente = p.cliente
            db.registrar_evento(s, pid, "etapa",
                "Designação — GCI: %s · Consultores: %s" % (gci or "—", p.consultor or "—"), _autor())
            s.commit()
        if gci and email_de.get(gci):
            _notificar(pid, [email_de[gci]], "Levantamento designado — %s" % cliente,
                       "Você foi designado para realizar o Levantamento do projeto %s.\n"
                       "Acesse o Painel de Implantação para iniciar." % cliente)
        for cons, ms in por_consultor.items():
            if email_de.get(cons):
                _notificar(pid, [email_de[cons]], "Implantação designada — %s" % cliente,
                           "Você foi designado para a implantação do projeto %s.\n"
                           "Módulos: %s.\nAcesse o Painel de Implantação." % (cliente, ", ".join(ms)))
        # B: gera o Levantamento automaticamente ao designar o GCI (documento para o GCI preencher)
        if gci:
            with db.Session() as s:
                ja = s.query(db.Documento).filter_by(projeto_id=pid, tipo="levantamento").count()
            if not ja:
                try:
                    path, _l = runner.gerar_do_projeto({**proj, "gci": gci}, "levantamento")
                except Exception:
                    path = None
                if path:
                    with db.Session() as s:
                        s.add(db.Documento(projeto_id=pid, tipo="levantamento",
                                           arquivo=os.path.basename(path), caminho=path))
                        db.registrar_evento(s, pid, "documento",
                                            "Gerou %s (ao designar o GCI)" % os.path.basename(path), "sistema")
                        s.commit()
        return redirect(url_for("projeto_ficha", pid=pid, salvo=1))
    atuais = {d["modulo"]: d["consultor"] for d in db.designacoes_do_projeto(pid)}
    return render_template("designar.html", p=proj, mods=mods, gcis=gcis,
                           consultores=consultores, atuais=atuais, gci_atual=proj.get("gci", ""))


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

    ja = db.projeto_existe(proj_fields.get("cliente"), proj_fields.get("cnpj"))
    if ja:
        return redirect(url_for("projeto_ficha", pid=ja,
            aviso="Já existe um projeto para este cliente/CNPJ — abri o existente em vez de duplicar."))

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
    _notificar_evento(pid, "fechamento", proj)

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
    if not pode_ver("sistema"):
        abort(403)
    import imap_intake
    salvo = False
    if request.method == "POST":
        imap_intake.salvar_cfg(request.form)
        salvo = True
    return render_template("config_imap.html", cfg=imap_intake.load_cfg(), salvo=salvo,
                           configurado=imap_intake.configurado())


@app.route("/config/gmail", methods=["GET", "POST"])
def config_gmail():
    if not pode_ver("sistema"):
        abort(403)
    import gmail_api
    msg = None
    if request.method == "POST":
        f = request.files.get("client")
        if f and f.filename:
            f.save(gmail_api.CLIENT)
            msg = "Credencial salva. Agora clique em Autorizar."
        elif request.form.get("autorizar"):
            ok, err = gmail_api.autorizar()
            msg = "Autorizado com sucesso. ✅" if ok else ("Falha: " + (err or "?"))
    return render_template("config_gmail.html", autorizado=gmail_api.configurado(),
                           tem_client=gmail_api.tem_client(), msg=msg)


@app.route("/mapa")
def mapa():
    if not pode_ver("sistema"):
        abort(403)
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


# ---------- E: pré-visualização (WYSIWYG) de um documento gerado ----------
@app.route("/projetos/<int:pid>/doc/<int:doc_id>/ver")
def projeto_doc_ver(pid, doc_id):
    with db.Session() as s:
        d = s.get(db.Documento, doc_id)
        if not d or d.projeto_id != pid:
            abort(404)
        p = s.get(db.Projeto, pid)
        doc = db.to_dict(d)
        proj = db.to_dict(p) if p else {"cliente": ""}
    path = os.path.abspath(doc.get("caminho") or "")
    if not os.path.exists(path) or not any(
            path.startswith(os.path.abspath(x)) for x in ALLOWED_DIRS):
        abort(403)
    import docview
    try:
        corpo = docview.to_html(path)
    except Exception as e:
        corpo = "<p class='aviso'>Não foi possível pré-visualizar (%s). Use “Baixar”.</p>" % type(e).__name__
    return render_template("doc_view.html", p=proj, d=doc, corpo=corpo, pid=pid)


# ---------- F: cronograma e check-list editáveis no painel (+ histórico) ----------
def _linhas_do_form(campos):
    """Lê as colunas paralelas (r_<campo>) do form e devolve as linhas não-vazias."""
    listas = {c: request.form.getlist("r_" + c) for c in campos}
    n = max((len(v) for v in listas.values()), default=0)
    out = []
    for i in range(n):
        row = {c: (listas[c][i].strip() if i < len(listas[c]) else "") for c in campos}
        if any(row.values()):
            out.append(row)
    return out


def _seed_cronograma(proj):
    """Plano automático (mesma lógica do gerador) como ponto de partida editável."""
    import re as _re
    import gerar_cronograma as GC
    mods = [m for m in _re.split(r"[,;\n\s]+", proj.get("modulos", "") or "") if m]
    plano = GC._plano_automatico(mods)
    horas = GC._num(proj.get("horas_cobradas")) + GC._num(proj.get("horas_bonificadas"))
    hs = GC._distribuir(horas, [pz for _, _, pz in plano])
    dt0 = GC._prox_util(GC._parse_date(proj.get("data_inicio")))
    linhas = []
    for i, ((etapa, topicos, _), h) in enumerate(zip(plano, hs)):
        data = (dt0 if i == 0 else GC._add_uteis(dt0, 5 * i)).strftime("%d/%m/%Y")
        linhas.append({"etapa": etapa, "topicos": topicos, "horas": str(h),
                       "data": data, "modalidade": "A combinar", "status": "Previsto"})
    return linhas


def _seed_checklist(proj):
    """Roteiro dos módulos contratados como ponto de partida editável."""
    import re as _re
    import checklist as CK
    mods = [m for m in _re.split(r"[,;\n\s]+", proj.get("modulos", "") or "") if m]
    out = []
    for l in CK.rows_for(mods):
        item, acao = (l.get("item") or "").strip(), (l.get("acao") or "").strip()
        out.append({"modulo": l.get("adicional") or l.get("modulo") or "",
                    "item": (item + (" — " + acao if acao else "")).strip() or acao,
                    "responsavel": proj.get("consultor", ""),
                    "status": "Pendente", "obs": l.get("menu", "")})
    return out


def _gerar_cronograma_de_itens(proj, itens):
    import gerar_cronograma  # noqa: F401  (garante o módulo no bundle do .exe)
    cliente = (proj.get("cliente") or "Cliente").strip()
    agendas = [{"etapa": x.get("etapa", ""), "topicos": x.get("topicos", ""),
                "horas": x.get("horas", ""), "data": x.get("data", ""),
                "modalidade": x.get("modalidade", "")} for x in itens]
    crono = {"cliente": cliente, "numero_projeto": proj.get("numero_projeto", ""),
             "consultor": proj.get("consultor", ""), "agendas": agendas}
    path, _ = runner.run_generator("gerar_cronograma",
                                   runner._dump_yaml(crono, "crono_%s.yaml" % C.slug(cliente)))
    return path


@app.route("/projetos/<int:pid>/cronograma", methods=["GET", "POST"])
def projeto_cronograma(pid):
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    if request.method == "POST":
        mud = db.salvar_linhas(pid, "cronograma", _linhas_do_form(db.CRONO_CAMPOS), _autor())
        with db.Session() as s:
            db.registrar_evento(s, pid, "nota", "Cronograma editado (%d alteração(ões))." % mud, _autor())
            s.commit()
        return redirect(url_for("projeto_cronograma", pid=pid, salvo=1))
    return render_template("plano_cronograma.html", p=proj, pid=pid,
                           itens=db.cronograma_do_projeto(pid),
                           campos=db.CRONO_CAMPOS, labels=db.CRONO_LABELS, status_op=db.CRONO_STATUS,
                           hist=db.modificacoes_do_projeto(pid, "cronograma"),
                           pode_ger=pode_gerar("cronograma") and _etapa_permite_gerar("cronograma", proj.get("etapa")),
                           salvo=request.args.get("salvo"), aviso=request.args.get("aviso"))


@app.route("/projetos/<int:pid>/cronograma/seed", methods=["POST"])
def projeto_cronograma_seed(pid):
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    linhas = _seed_cronograma(proj)
    db.salvar_linhas(pid, "cronograma", linhas, _autor())
    with db.Session() as s:
        db.registrar_evento(s, pid, "nota", "Cronograma carregado do plano automático (%d agendas)." % len(linhas), _autor())
        s.commit()
    return redirect(url_for("projeto_cronograma", pid=pid, aviso="Plano automático carregado — ajuste e salve."))


@app.route("/projetos/<int:pid>/cronograma/gerar", methods=["POST"])
def projeto_cronograma_gerar(pid):
    if not pode_gerar("cronograma"):
        abort(403)
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    if not _etapa_permite_gerar("cronograma", proj.get("etapa")):
        return redirect(url_for("projeto_cronograma", pid=pid,
            aviso="O Cronograma só pode ser gerado na fase 'Cronograma e Check-list'."))
    itens = db.cronograma_do_projeto(pid)
    if not itens:
        return redirect(url_for("projeto_cronograma", pid=pid, aviso="Adicione agendas antes de gerar o documento."))
    try:
        path = _gerar_cronograma_de_itens(proj, itens)
    except Exception as e:
        return redirect(url_for("projeto_cronograma", pid=pid, aviso="Falha ao gerar: %s" % type(e).__name__))
    if path:
        with db.Session() as s:
            s.add(db.Documento(projeto_id=pid, tipo="cronograma",
                               arquivo=os.path.basename(path), caminho=path))
            db.registrar_evento(s, pid, "documento", "Gerou %s (do cronograma editado)" % os.path.basename(path), _autor())
            s.commit()
        _notificar_evento(pid, _EVT_DOC.get("cronograma"), proj)
        _auto_avancar(pid)
    return redirect(url_for("projeto_cronograma", pid=pid, aviso="Documento do Cronograma gerado e anexado à ficha."))


@app.route("/projetos/<int:pid>/checklist", methods=["GET", "POST"])
def projeto_checklist(pid):
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    if request.method == "POST":
        mud = db.salvar_linhas(pid, "checklist", _linhas_do_form(db.CHECK_CAMPOS), _autor())
        with db.Session() as s:
            db.registrar_evento(s, pid, "nota", "Check-list editado (%d alteração(ões))." % mud, _autor())
            s.commit()
        return redirect(url_for("projeto_checklist", pid=pid, salvo=1))
    return render_template("plano_checklist.html", p=proj, pid=pid,
                           itens=db.checklist_do_projeto(pid),
                           campos=db.CHECK_CAMPOS, labels=db.CHECK_LABELS, status_op=db.CHECK_STATUS,
                           hist=db.modificacoes_do_projeto(pid, "checklist"),
                           salvo=request.args.get("salvo"), aviso=request.args.get("aviso"))


@app.route("/projetos/<int:pid>/checklist/seed", methods=["POST"])
def projeto_checklist_seed(pid):
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    linhas = _seed_checklist(proj)
    db.salvar_linhas(pid, "checklist", linhas, _autor())
    with db.Session() as s:
        db.registrar_evento(s, pid, "nota", "Check-list carregado do roteiro dos módulos (%d itens)." % len(linhas), _autor())
        s.commit()
    return redirect(url_for("projeto_checklist", pid=pid, aviso="Roteiro carregado — ajuste e salve."))


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


def _agendador_caixa():
    """Robô: a cada IMAP_POLL_MIN min, cria projeto para cada novo fechamento na caixa."""
    import time
    import imap_intake
    mins = int(os.environ.get("IMAP_POLL_MIN", "10") or 10)
    while True:
        try:
            if imap_intake.configurado():
                n = imap_intake.processar_fechamentos(_criar_projeto_de_fechamento)
                if n:
                    logging.info("Robô da caixa: %d fechamento(s) criado(s).", n)
        except Exception as e:
            logging.warning("Robô da caixa falhou: %s", e)
        time.sleep(max(120, mins * 60))


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
        import imap_intake as _imap
        if _imap.configurado():
            threading.Thread(target=_agendador_caixa, daemon=True).start()
            logging.info("Robô da caixa ativo (IMAP_POLL_MIN=%s).", os.environ.get("IMAP_POLL_MIN", "10"))
    except Exception:
        pass
    try:
        from waitress import serve
        logging.info("Painel no ar em http://%s:%s  (waitress)", host, port)
        serve(app, host=host, port=port, threads=8)
    except ImportError:
        logging.warning("waitress ausente — usando o servidor de desenvolvimento")
        app.run(host=host, port=port, debug=False)
