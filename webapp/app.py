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
                   session, redirect, url_for, jsonify)

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
_GERA = {"levantamento": ("ADM", "Coordenador", "Administrativo", "GCI"),
         "projeto": ("ADM", "Coordenador", "Administrativo", "GCI"),
         "checklist": ("ADM", "Coordenador", "Administrativo", "Consultor"),
         "cronograma": ("ADM", "Coordenador", "Administrativo", "Consultor"),
         "termo": ("ADM", "Coordenador", "Administrativo", "Consultor")}


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
    return (not _perfil()) or _perfil() in ("ADM", "Coordenador", "Administrativo")


def pode_gerar(tipo):
    p = _perfil()
    return (not p) or p in _GERA.get(tipo, ("ADM", "Coordenador"))


# Visibilidade por área do menu (e bloqueio no backend)
#  - gestao  = Coordenação + Atividade  -> ADM, Coordenador, GCI
#  - sistema = Ferramentas + Usuários + Configurações -> só ADM
_AREA_PERFIS = {"gestao": ("ADM", "Coordenador", "Administrativo", "GCI"), "sistema": ("ADM",)}


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
    """Filtro de visão por perfil: ADM/Coordenador/Administrativo veem tudo; GCI vê
    onde é o GCI; Consultor vê onde é consultor designado."""
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
        codigo_sicla = (request.form.get("codigo_sicla") or "").strip()
        if not nome or not email or not senha or not codigo_sicla:
            erro = "Preencha nome, e-mail, senha e Código SICLA."
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
            db.salvar_pendente(nome, email, email, senha, codigo, codigo_sicla)
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


def _notificar_sync(pid, emails, assunto, corpo, autor):
    """Faz o envio (pode ser lento — ex.: SMTP com timeout) e registra na timeline.
    Roda em segundo plano; nunca propaga exceção."""
    import mailer
    ok, err = (False, "e-mail não configurado")
    try:
        if mailer.configurado():
            ok, err = mailer.enviar(emails, assunto, corpo)
    except Exception as e:                      # nunca deixa o envio derrubar nada
        ok, err = False, "%s: %s" % (type(e).__name__, e)
    try:
        with db.Session() as s:
            db.registrar_evento(s, pid, "email",
                ("Notificou %s — %s" % (", ".join(emails), assunto)) if ok
                else ("Notificação pendente (%s): %s" % (assunto, err or "?")), autor)
            s.commit()
    except Exception:
        logging.exception("Falha ao registrar evento de e-mail (pid=%s)", pid)


def _notificar(pid, emails, assunto, corpo):
    """Notifica por e-mail e registra na timeline SEM bloquear a requisição: o envio roda
    numa thread daemon (um SMTP bloqueado não atrasa mais a etapa). Em testes roda inline."""
    emails = [e for e in emails if e]
    if not emails:
        return
    autor = _autor()                            # captura o autor ainda no contexto da requisição
    if app.testing:
        _notificar_sync(pid, emails, assunto, corpo, autor)
        return
    import threading
    threading.Thread(target=_notificar_sync, args=(pid, emails, assunto, corpo, autor),
                     daemon=True, name="notificar").start()


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
_EVT_DOC = {"levantamento": "levantamento_ok", "projeto": "projeto_ok",
            "cronograma": "cronograma_ok", "checklist": "checklist_ok", "termo": "termo_ok"}


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


def _data_br(s):
    s = (s or "").strip()
    return "%s/%s/%s" % (s[8:10], s[5:7], s[0:4]) if (len(s) == 10 and s[4] == "-") else s


def _auto_avancar(pid):
    """Avança a etapa automaticamente enquanto o gate da próxima (documentos + ação)
    estiver satisfeito. PERMISSIVO de propósito quanto aos campos obrigatórios — eles
    são cobrados no avanço MANUAL e sinalizados na ficha; bloqueá-los aqui travaria o
    fluxo (ex.: Agendamento sem nº do projeto/horas ainda preenchidos)."""
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p or p.etapa == "Levantamento":
            return   # a conclusão do Levantamento é confirmada pelo GCI (botão Avançar)
        docs = [db.to_dict(x) for x in s.query(db.Documento).filter_by(projeto_id=pid).all()]
        proj = db.to_dict(p)
        prox = db.proxima_etapa(p.etapa)
        mudou = False
        while prox and db.gate_status(prox, docs)["ok"] and db.acao_entrada_ok(prox, proj):
            db.registrar_evento(s, pid, "etapa", "Avançou automaticamente: %s → %s" % (p.etapa, prox), "sistema")
            p.etapa = prox
            prox = db.proxima_etapa(p.etapa)
            mudou = True
        if mudou:
            s.commit()


# Rota / (home / visão geral): movida para routes_painel.py (registrada no fim deste arquivo).


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
        codigo_sicla = (request.form.get("codigo_sicla") or "").strip()
        if not codigo_sicla:                       # obrigatório para todos os perfis (elo com a agenda)
            with db.Session() as s:
                lista = [db.to_dict(x) for x in s.query(db.Usuario).order_by(db.Usuario.nome).all()]
            return render_template("usuarios.html", usuarios=lista, perfis=db.PERFIS,
                                   erro="Informe o Código SICLA do usuário — é obrigatório.")
        with db.Session() as s:
            uid = request.form.get("id")
            u = s.get(db.Usuario, int(uid)) if uid else db.Usuario()
            u.login = (request.form.get("login") or "").strip()
            u.nome = (request.form.get("nome") or "").strip()
            u.email = (request.form.get("email") or "").strip()
            u.perfil = request.form.get("perfil") or "Consultor"
            u.codigo_sicla = codigo_sicla
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


# ----------------------------------------------------------------------------
#  Cadastros de referência (Sistema): Checklist por módulo e Índice de Tópicos.
#  Tabelas independentes, com todas as colunas da planilha de origem.
# ----------------------------------------------------------------------------
_PAG_CHECK = 50


def _arg_int(nome, default=1):
    try:
        return max(1, int(request.args.get(nome, default)))
    except (TypeError, ValueError):
        return default


# Rotas /cadastros/*: ver routes_cadastros.py (registradas no fim).


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


# Rotas /config/*: ver routes_config.py (registradas no fim).


# ===== Envio de e-mail por projeto (usa modelos do banco) =====

# Rota /projetos/<pid>/email: movida para routes_fluxo.py (registrada no fim deste arquivo).


@app.route("/projetos")
def projetos():
    with db.Session() as s:
        itens = [db.to_dict(x) for x in
                 s.query(db.Projeto).order_by(db.Projeto.atualizado_em.desc()).all()]
    return render_template("projetos_lista.html", itens=_so_meus(itens),
                           etapas=db.ETAPAS, situacoes=db.SITUACOES)


# ---------- Painel executivo: coordenação, atividade e monitoramento ----------
# Rotas e helpers de consolidação movidos para routes_painel.py (registrados no fim).


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
        tipos_exist = {(x["tipo"] or "").strip().lower() for x in docs}
        for x in docs:                        # respeita o fluxo: só exclui se não há posterior
            x["excluivel"] = db.tipo_excluivel(x["tipo"], tipos_exist)
        gate = db.gate_status(d["etapa"], docs)
        eventos = [db.to_dict(x) for x in s.query(db.Evento)
                   .filter_by(projeto_id=pid).order_by(db.Evento.criado_em.desc()).all()]
    return render_template("projeto_ficha.html", p=d, docs=docs, etapas=db.ETAPAS,
                           situacoes=db.SITUACOES, salvo=request.args.get("salvo"),
                           erro=request.args.get("erro"), aviso=request.args.get("aviso"),
                           gate=gate, doc_tipos=db.DOC_LABELS, eventos=eventos,
                           cab=db.cabecalho(d, docs), designacoes=db.designacoes_do_projeto(pid),
                           pode_designar=pode_designar(), pode_gerar=pode_gerar)


@app.route("/projetos/<int:pid>/excluir", methods=["POST"])
def projeto_excluir(pid):
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if p:
            for M in (db.Documento, db.Evento, db.Designacao, db.CronogramaItem,
                      db.ChecklistItem, db.Modificacao, db.LevantamentoResposta, db.DocConteudo,
                      db.AtividadeCronograma, db.SlotCronograma):
                s.query(M).filter_by(projeto_id=pid).delete()
            s.delete(p)
            s.commit()
    return redirect(url_for("projetos"))


@app.route("/projetos/<int:pid>/avancar", methods=["POST"])
def projeto_avancar(pid):
    destino = None
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
        docs = [db.to_dict(x) for x in s.query(db.Documento).filter_by(projeto_id=pid).all()]
        prox = db.proxima_etapa(p.etapa)
        # Usa pode_avancar para validar campos + docs + ações
        ok, bloqueios = db.pode_avancar(p.etapa, proj, docs)
        if ok and prox:
            old = p.etapa
            p.etapa = prox
            db.registrar_evento(s, pid, "etapa", "Avançou de fase: %s → %s" % (old, prox), _autor())
            s.commit()
            return redirect(url_for("projeto_ficha", pid=pid, salvo=1))
        # Redireciona para ação obrigatória se for o único bloqueio
        if prox:
            acao_ok = db.acao_entrada_ok(prox, proj)
            if not acao_ok:
                req = (db.ACAO_ENTRADA.get(prox) or (None,))[0]
                # Para gci_e_data_levantamento, redireciona conforme o sub-estado
                if req == "gci_e_data_levantamento":
                    if not db.gci_definido(proj):
                        destino = "projeto_definir_gci"
                    else:
                        destino = "projeto_agendar"
                else:
                    destino = {"consultores_designacao": "projeto_designar",
                               "consultores": "projeto_designar"}.get(req)
    if destino:
        return redirect(url_for(destino, pid=pid))
    aviso_msg = "Não é possível avançar: " + "; ".join(bloqueios) if bloqueios else "Faltam itens obrigatórios."
    return redirect(url_for("projeto_ficha", pid=pid, aviso=aviso_msg))


# ---------- Geração de documentos, Levantamento e gate de origem ----------
# Rotas e helpers movidos para routes_geracao.py (registrados no fim deste arquivo).


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


@app.route("/projetos/<int:pid>/doc/<int:doc_id>/excluir", methods=["POST"])
def projeto_doc_excluir(pid, doc_id):
    """Exclui um documento gerado para permitir regerá-lo — respeitando o fluxo (não exclui
    um documento se já existe outro que dependa dele; ex.: Projeto antes do Levantamento)."""
    with db.Session() as s:
        d = s.get(db.Documento, doc_id)
        tipo = d.tipo if (d and d.projeto_id == pid) else None
    if tipo is None:
        abort(404)
    if not pode_gerar(tipo):              # quem pode gerar o documento pode excluí-lo p/ regerar
        abort(403)
    ok, msg = db.excluir_documento(doc_id, pid, _autor())
    return redirect(url_for("projeto_ficha", pid=pid, salvo=(1 if ok else None), aviso=msg))


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


# ---------- Fases Agendamento e Designação ----------
# Rotas movidas para routes_designacao.py (registradas no fim deste arquivo).


# ---------- Fluxo (e-mail de fechamento), Mapa e pré-visualização de documentos ----------
# Rotas movidas para routes_fluxo.py (registradas no fim deste arquivo).


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


# --- Rotas modularizadas (registradas em tempo de import) ---
import routes_agenda  # noqa: E402  (rotas /agenda/*)
routes_agenda.register(app, pode_gerar=pode_gerar, _autor=_autor,
                       _notificar_evento=_notificar_evento, _auto_avancar=_auto_avancar,
                       _EVT_DOC=_EVT_DOC)
import routes_config  # noqa: E402  (rotas /config/*)
routes_config.register(app, pode_ver=pode_ver, _e_adm=_e_adm)
import routes_cadastros  # noqa: E402  (rotas /cadastros/*)
routes_cadastros.register(app, pode_ver=pode_ver, _arg_int=_arg_int,
                          _autor=_autor, _PAG_CHECK=_PAG_CHECK)
import routes_cronograma  # noqa: E402  (rotas /projetos/<pid>/cronograma*, /checklist*)
routes_cronograma.register(app, pode_gerar=pode_gerar, _etapa_permite_gerar=_etapa_permite_gerar,
                           _autor=_autor, _notificar_evento=_notificar_evento,
                           _auto_avancar=_auto_avancar, _EVT_DOC=_EVT_DOC)
import routes_geracao  # noqa: E402  (rotas /gerar*, /projeto/origem, /levantamento, /editar)
routes_geracao.register(app, pode_gerar=pode_gerar, _etapa_permite_gerar=_etapa_permite_gerar,
                        _autor=_autor, _notificar_evento=_notificar_evento,
                        _auto_avancar=_auto_avancar, _perfil=_perfil,
                        _EVT_DOC=_EVT_DOC, _ETAPA_DOC=_ETAPA_DOC, UPLOADS=UPLOADS)
import routes_designacao  # noqa: E402  (rotas /designar, /definir_gci, /agendar, /consultores)
routes_designacao.register(app, pode_designar=pode_designar, _perfil=_perfil, _autor=_autor,
                           _notificar=_notificar, _auto_avancar=_auto_avancar, _data_br=_data_br)
import routes_fluxo  # noqa: E402  (rotas /fluxo*, /projetos/<pid>/email, /mapa, /doc/<id>/ver)
routes_fluxo.register(app, _autor=_autor, _notificar_evento=_notificar_evento,
                      pode_ver=pode_ver, ALLOWED_DIRS=ALLOWED_DIRS)
import routes_painel  # noqa: E402  (telas-painel: /, /coordenacao, /atividade, /monitoramento)
routes_painel.register(app, _so_meus=_so_meus, pode_ver=pode_ver)
import routes_protocolos  # noqa: E402  (vídeos de treinamento -> protocolos revisáveis)
routes_protocolos.register(app, _autor=_autor, _perfil=_perfil)


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
        import protocolos as _prot
        if _prot.configurado():
            threading.Thread(target=_prot.agendador, daemon=True).start()
            logging.info("Robô de protocolos ativo (PROTOCOLOS_POLL_MIN=%s).",
                         os.environ.get("PROTOCOLOS_POLL_MIN", "10"))
    except Exception:
        pass
    try:
        from waitress import serve
        logging.info("Painel no ar em http://%s:%s  (waitress)", host, port)
        serve(app, host=host, port=port, threads=8)
    except ImportError:
        logging.warning("waitress ausente — usando o servidor de desenvolvimento")
        app.run(host=host, port=port, debug=False)
