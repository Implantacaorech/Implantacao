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
            item = {"id": p["id"], "cliente": p["cliente"], "fase": cab.get("fase"),
                    "atraso": cab.get("atraso")}
            px = cab.get("proxima")
            if px:
                tipo = px.get("tipo", "")
                item["acao"] = px["label"]
                if tipo == "acao:definir_gci":
                    item.update(url=url_for("projeto_definir_gci", pid=p["id"]), cta="Definir GCI")
                elif tipo == "acao:data_levantamento":
                    item.update(url=url_for("projeto_agendar", pid=p["id"]), cta="Definir data")
                elif tipo in ("acao:consultores_designacao", "acao:consultores"):
                    item.update(url=url_for("projeto_designar", pid=p["id"]), cta="Designar")
                else:                                   # documento da fase a gerar
                    item.update(url=url_for("projeto_ficha", pid=p["id"]), cta="Gerar")
                pendencias.append(item)
            elif cab.get("prox_etapa") and cab.get("avancar_ok"):
                item.update(acao="Avançar para " + cab["prox_etapa"],
                            url=url_for("projeto_ficha", pid=p["id"]), cta="Avançar")
                pendencias.append(item)
        # urgência: atrasados primeiro (maior atraso no topo)
        pendencias.sort(key=lambda x: (x.get("atraso") is None, -(x.get("atraso") or 0)))
        ativos_ord = sorted(ativos, key=lambda p: (p.get("atualizado_em") is not None,
                                                   p.get("atualizado_em")), reverse=True)
        if ativos_ord:
            f = ativos_ord[0]
            foco = {"p": f, "cab": db.cabecalho(f, docs_map.get(f["id"], []))}
    except Exception:
        pass
    return render_template("home.html", roles=roles.ROLES, dados=dados,
                           alertas=alertas[:6], pendencias=pendencias[:8], foco=foco)


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


@app.route("/cadastros/checklist")
def cad_checklist():
    if not pode_ver("sistema"):
        abort(403)
    mod = (request.args.get("mod") or "").strip()
    q = (request.args.get("q") or "").strip()
    pg = _arg_int("pg", 1)
    linhas, total = db.checklist_modelo_listar(mod, q, offset=(pg - 1) * _PAG_CHECK, limite=_PAG_CHECK)
    paginas = max(1, (total + _PAG_CHECK - 1) // _PAG_CHECK)
    edit = None
    if request.args.get("edit"):
        with db.Session() as s:
            o = s.get(db.ChecklistModelo, int(request.args["edit"]))
            edit = db.to_dict(o) if o else None
    return render_template("cad_checklist.html", linhas=linhas, total=total, pg=pg,
                           paginas=paginas, mod=mod, q=q, modulos=db.checklist_modelo_modulos(),
                           campos=db.CHECKMOD_CAMPOS, labels=db.CHECKMOD_LABELS,
                           edit=edit, novo=bool(request.args.get("novo")),
                           salvo=request.args.get("salvo"), aviso=request.args.get("aviso"))


@app.route("/cadastros/checklist/salvar", methods=["POST"])
def cad_checklist_salvar():
    if not pode_ver("sistema"):
        abort(403)
    db.checklist_modelo_salvar(request.form)
    return redirect(url_for("cad_checklist", mod=request.form.get("f_mod", ""),
                            q=request.form.get("f_q", ""), pg=request.form.get("f_pg", 1), salvo=1))


@app.route("/cadastros/checklist/<int:cid>/excluir", methods=["POST"])
def cad_checklist_excluir(cid):
    if not pode_ver("sistema"):
        abort(403)
    db.checklist_modelo_excluir(cid)
    return redirect(url_for("cad_checklist", mod=request.form.get("f_mod", ""),
                            q=request.form.get("f_q", ""), pg=request.form.get("f_pg", 1),
                            aviso="Linha removida."))


@app.route("/cadastros/checklist/reimportar", methods=["POST"])
def cad_checklist_reimportar():
    if not pode_ver("sistema"):
        abort(403)
    n = db._reseed_checklist_modelo()
    return redirect(url_for("cad_checklist", aviso="Catálogo reimportado do modelo (%d linhas)." % n))


@app.route("/cadastros/indice")
def cad_indice():
    if not pode_ver("sistema"):
        abort(403)
    mod = (request.args.get("mod") or "").strip()
    q = (request.args.get("q") or "").strip()
    linhas, total = db.indice_listar(mod, q)
    edit = None
    if request.args.get("edit"):
        with db.Session() as s:
            o = s.get(db.IndiceTopico, int(request.args["edit"]))
            edit = db.to_dict(o) if o else None
    return render_template("cad_indice.html", linhas=linhas, total=total, mod=mod, q=q,
                           modulos=db.indice_modulos(), campos=db.INDICE_CAMPOS,
                           labels=db.INDICE_LABELS, edit=edit,
                           novo=bool(request.args.get("novo")),
                           salvo=request.args.get("salvo"), aviso=request.args.get("aviso"))


@app.route("/cadastros/indice/salvar", methods=["POST"])
def cad_indice_salvar():
    if not pode_ver("sistema"):
        abort(403)
    db.indice_salvar(request.form)
    return redirect(url_for("cad_indice", mod=request.form.get("f_mod", ""),
                            q=request.form.get("f_q", ""), salvo=1))


@app.route("/cadastros/indice/<int:cid>/excluir", methods=["POST"])
def cad_indice_excluir(cid):
    if not pode_ver("sistema"):
        abort(403)
    db.indice_excluir(cid)
    return redirect(url_for("cad_indice", mod=request.form.get("f_mod", ""),
                            q=request.form.get("f_q", ""), aviso="Tópico removido."))


@app.route("/cadastros/indice/reimportar", methods=["POST"])
def cad_indice_reimportar():
    if not pode_ver("sistema"):
        abort(403)
    n = db._reseed_indice_topicos()
    return redirect(url_for("cad_indice", aviso="Índice reimportado da planilha (%d tópicos)." % n))


# ----------------------------------------------------------------------------
#  Cadastro de Modelos de Documentos (layouts fiéis das fases) + versões + campos.
# ----------------------------------------------------------------------------
@app.route("/cadastros/modelos")
def cad_modelos():
    if not pode_ver("sistema"):
        abort(403)
    return render_template("cad_modelos.html", modelos=db.modelos_documento_listar(),
                           salvo=request.args.get("salvo"), aviso=request.args.get("aviso"))


@app.route("/cadastros/modelos/<int:mid>")
def cad_modelo(mid):
    if not pode_ver("sistema"):
        abort(403)
    modelo = db.modelo_documento_get(mid)
    if not modelo:
        abort(404)
    edit = None
    if request.args.get("edit"):
        edit = next((c for c in db.modelo_documento_campos(mid)
                     if str(c["id"]) == request.args["edit"]), None)
    return render_template("cad_modelo.html", modelo=modelo,
                           versoes=db.modelo_documento_versoes(mid),
                           campos=db.modelo_documento_campos(mid),
                           campo_labels=db.MODELODOC_CAMPO_LABELS,
                           edit=edit, novo=bool(request.args.get("novo")),
                           salvo=request.args.get("salvo"), aviso=request.args.get("aviso"))


@app.route("/cadastros/modelos/<int:mid>/versao", methods=["POST"])
def cad_modelo_versao(mid):
    if not pode_ver("sistema"):
        abort(403)
    modelo = db.modelo_documento_get(mid)
    if not modelo:
        abort(404)
    f = request.files.get("arquivo")
    if not f or not f.filename:
        return redirect(url_for("cad_modelo", mid=mid, aviso="Selecione um arquivo para enviar."))
    ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
    if ext != modelo["tipo"]:
        return redirect(url_for("cad_modelo", mid=mid,
                                aviso="O arquivo deve ser .%s (igual ao modelo)." % modelo["tipo"]))
    n = db.modelo_documento_proxima_versao(mid)
    stored = "%s_v%d.%s" % (modelo["slug"], n, ext)
    f.save(os.path.join(db._modelos_doc_store(), stored))
    db.registrar_versao_documento(mid, stored, _autor(), request.form.get("motivo", ""))
    return redirect(url_for("cad_modelo", mid=mid, salvo=1))


@app.route("/cadastros/modelos/<int:mid>/baixar")
@app.route("/cadastros/modelos/<int:mid>/versao/<int:vid>/baixar")
def cad_modelo_baixar(mid, vid=None):
    if not pode_ver("sistema"):
        abort(403)
    modelo = db.modelo_documento_get(mid)
    path = db.modelo_documento_arquivo_path(mid, vid)
    if not modelo or not path or not os.path.exists(path):
        abort(404)
    store = os.path.abspath(db._modelos_doc_store())
    if not os.path.abspath(path).startswith(store):
        abort(403)
    nome = "%s_%s.%s" % (modelo["slug"], (("v%d" % vid) if vid else "vigente"), modelo["tipo"])
    return send_file(path, as_attachment=True, download_name=nome)


@app.route("/cadastros/modelos/<int:mid>/campo/salvar", methods=["POST"])
def cad_modelo_campo_salvar(mid):
    if not pode_ver("sistema"):
        abort(403)
    db.modelo_documento_campo_salvar(mid, request.form)
    return redirect(url_for("cad_modelo", mid=mid, salvo=1))


@app.route("/cadastros/modelos/<int:mid>/campo/<int:cid>/excluir", methods=["POST"])
def cad_modelo_campo_excluir(mid, cid):
    if not pode_ver("sistema"):
        abort(403)
    db.modelo_documento_campo_excluir(cid)
    return redirect(url_for("cad_modelo", mid=mid, aviso="Campo removido."))


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


@app.route("/config/disponibilidade", methods=["GET", "POST"])
def config_disponibilidade():
    """ADM: conexão (campos/URL) + SELECT do banco interno de disponibilidade dos
    consultores. Usado pelo agendador para liberar só dias/turnos livres."""
    if not pode_ver("sistema"):
        abort(403)
    import disponibilidade as D
    salvo, teste = False, None
    if request.method == "POST":
        D.salvar_cfg(request.form)
        salvo = True
        if request.form.get("acao") == "testar":
            ok, msg, amostra = D.testar()
            teste = {"ok": ok, "msg": msg, "amostra": amostra}
    cfg = D.load_cfg()
    cfg_view = dict(cfg)
    cfg_view.pop("senha", None)                  # nunca devolve a senha ao template
    return render_template("config_disponibilidade.html", cfg=cfg_view, salvo=salvo,
                           teste=teste, configurado=D.configurado(),
                           tem_senha=bool(cfg.get("senha")), dialetos=sorted(D.DIALETOS))


# ===== CRUD de Modelos de E-mail (apenas ADM) =====

@app.route("/config/modelos-email")
def config_modelos_email():
    if not _e_adm():
        abort(403)
    modelos = db.listar_modelos_email(apenas_ativos=False)
    return render_template("config_modelos_email.html",
                           modelos=modelos, etapas=db.ETAPAS)


@app.route("/config/modelos-email/novo", methods=["GET", "POST"])
def config_modelo_email_novo():
    if not _e_adm():
        abort(403)
    erro = None
    if request.method == "POST":
        nome = (request.form.get("nome") or "").strip()
        if not nome:
            erro = "O nome do modelo é obrigatório."
        else:
            try:
                mid = db.salvar_modelo_email(request.form)
                return redirect(url_for("config_modelos_email"))
            except Exception as e:
                erro = str(e)
    return render_template("config_modelo_email_form.html",
                           modelo=None, etapas=db.ETAPAS,
                           variaveis=db.VARIAVEIS_EMAIL, erro=erro)


@app.route("/config/modelos-email/<int:mid>/editar", methods=["GET", "POST"])
def config_modelo_email_editar(mid):
    if not _e_adm():
        abort(403)
    modelo = db.obter_modelo_email(mid)
    if not modelo:
        abort(404)
    erro = None
    if request.method == "POST":
        nome = (request.form.get("nome") or "").strip()
        if not nome:
            erro = "O nome do modelo é obrigatório."
        else:
            try:
                db.salvar_modelo_email(request.form, mid=mid)
                return redirect(url_for("config_modelos_email"))
            except Exception as e:
                erro = str(e)
        modelo = dict(modelo)
        modelo.update({k: request.form.get(k, modelo.get(k, "")) for k in ("nome", "assunto", "corpo", "etapa")})
    return render_template("config_modelo_email_form.html",
                           modelo=modelo, etapas=db.ETAPAS,
                           variaveis=db.VARIAVEIS_EMAIL, erro=erro)


@app.route("/config/modelos-email/<int:mid>/excluir", methods=["POST"])
def config_modelo_email_excluir(mid):
    if not _e_adm():
        abort(403)
    ok, err = db.excluir_modelo_email(mid)
    if not ok:
        modelos = db.listar_modelos_email(apenas_ativos=False)
        return render_template("config_modelos_email.html",
                               modelos=modelos, etapas=db.ETAPAS, erro=err)
    return redirect(url_for("config_modelos_email"))


@app.route("/config/modelos-email/<int:mid>/toggle", methods=["POST"])
def config_modelo_email_toggle(mid):
    """Ativa/desativa um modelo sem excluí-lo."""
    if not _e_adm():
        abort(403)
    modelo = db.obter_modelo_email(mid)
    if modelo:
        with db.Session() as s:
            m = s.get(db.ModeloEmail, mid)
            if m:
                m.ativo = 0 if m.ativo else 1
                s.commit()
    return redirect(url_for("config_modelos_email"))


# ===== Envio de e-mail por projeto (usa modelos do banco) =====

@app.route("/projetos/<int:pid>/email", methods=["GET", "POST"])
def projeto_email(pid):
    import mailer
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    # Carrega modelos do banco (ativos), renderizando as variáveis com os dados do projeto
    modelos_banco = db.listar_modelos_email(apenas_ativos=True)
    tpls = {}
    for m in modelos_banco:
        tpls[str(m["id"])] = {
            "nome": m["nome"],
            "assunto": db.renderizar_modelo(m["assunto"], proj),
            "corpo": db.renderizar_modelo(m["corpo"], proj),
        }
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
    destino_padrao = proj.get("contato_email") or ""
    return render_template("projeto_email.html", p=proj, tpls=tpls,
                           configurado=mailer.configurado(),
                           destino=destino_padrao)


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


def _split_nomes(valor):
    import re as _re
    out = []
    for parte in _re.split(r"[,;/\n]|\s+e\s+", valor or ""):
        nome = parte.strip()
        if nome and nome not in out:
            out.append(nome)
    return out


def _parse_data(valor):
    from datetime import datetime
    valor = str(valor or "").strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(valor, fmt).date()
        except ValueError:
            pass
    return None


def _idade_media(projetos):
    from datetime import datetime
    hoje = datetime.now()
    idades = [(hoje - p["criado_em"]).days for p in projetos
              if p.get("criado_em") and not p.get("situacao") == "Concluído"]
    return round(sum(idades) / len(idades)) if idades else None


def _estado_setor(andamento, pendentes, atrasadas, aprovacao, concluidas):
    if andamento == 0 and pendentes == 0 and atrasadas == 0 and concluidas > 0:
        return "concluido", "Processo concluído"
    if aprovacao:
        return "aprovacao", "Aguardando aprovação"
    if atrasadas >= 2 or pendentes >= 6 or andamento >= 8:
        return "sobrecarregado", "Sobrecarregado"
    if atrasadas or pendentes:
        return "pendencias", "Com pendências"
    if andamento == 0:
        return "espera", "Em espera"
    return "normal", "Trabalhando normalmente"


def _monitoramento_operacional(projetos, docs_map, eventos, cronos, checks, designacoes):
    """Consolida a operação em visão executiva, sem criar tarefas paralelas.
    Os setores são inferidos a partir das etapas, gates, cronograma, checklist e alertas."""
    from datetime import datetime
    hoje = datetime.now().date()
    ativos = [p for p in projetos if p.get("situacao") != "Concluído"]
    concluidos = [p for p in projetos if p.get("situacao") == "Concluído"]
    por_id = {p["id"]: p for p in projetos}
    m = db.metricas(projetos, docs_map)
    alertas = db.alertas(projetos, docs_map)
    alertas_por_pid = {}
    for a in alertas:
        alertas_por_pid.setdefault(a["projeto_id"], []).append(a)

    faltas_por_pid = {}
    for p in ativos:
        gate = db.gate_status(p.get("etapa"), docs_map.get(p["id"], []))
        faltas_por_pid[p["id"]] = gate["faltam"]

    crono_pend = [c for c in cronos if c.get("status") not in ("Concluído", "Cancelado")]
    crono_ok = [c for c in cronos if c.get("status") == "Concluído"]
    crono_atrasado = [c for c in crono_pend
                      if _parse_data(c.get("data")) and _parse_data(c.get("data")) < hoje]
    check_pend = [c for c in checks if c.get("status") not in ("Concluído", "N/A")]
    check_ok = [c for c in checks if c.get("status") == "Concluído"]
    dev_kw = ("desenv", "custom", "integra", "rns", "orc", "cob", "api")
    dev_checks = [c for c in checks if any(k in ("%s %s" % (c.get("item"), c.get("obs"))).lower()
                                           for k in dev_kw)]
    dev_pend = [c for c in dev_checks if c.get("status") not in ("Concluído", "N/A")]
    dev_ids = {c.get("projeto_id") for c in dev_checks}
    for p in projetos:
        texto = " ".join(str(p.get(k) or "") for k in ("modulos", "observacoes"))
        if any(k in texto.lower() for k in dev_kw):
            dev_ids.add(p["id"])

    def pessoas(*campos):
        nomes = []
        for c in campos:
            if isinstance(c, (list, tuple, set)):
                vals = c
            else:
                vals = _split_nomes(c)
            for n in vals:
                if n and n not in nomes:
                    nomes.append(n)
        return nomes[:8]

    def setor(nome, ids, andamento, concluidas_setor, pendentes, atrasadas, aprovacao=0,
              responsaveis=None, alertas_txt=None):
        rel = [por_id[i] for i in ids if i in por_id]
        estado, label = _estado_setor(andamento, pendentes, atrasadas, aprovacao, concluidas_setor)
        return {
            "nome": nome, "estado": estado, "estado_label": label,
            "andamento": andamento, "concluidas": concluidas_setor,
            "pendentes": pendentes, "atrasadas": atrasadas, "aprovacao": aprovacao,
            "responsaveis": responsaveis or [], "tempo_medio": _idade_media(rel),
            "alertas": (alertas_txt or [])[:3],
        }

    agendamento = [p for p in ativos if p.get("etapa") == "Agendamento"]
    comercial_pend = sum(len(db.campos_faltantes("Agendamento", p)) for p in agendamento)
    comercial_atraso = [p for p in agendamento if p.get("criado_em") and (datetime.now() - p["criado_em"]).days >= 2]

    admin_ids = {p["id"] for p in ativos if faltas_por_pid.get(p["id"]) or not p.get("responsavel")}
    admin_faltas = sum(len(v) for v in faltas_por_pid.values())
    admin_sla = [a for a in alertas if a["tipo"] == "sla"]

    coord_pend = [p for p in ativos if not p.get("gci") or
                  (p.get("etapa") in ("Designação", "Cronograma e Check-list", "Encerramento")
                   and not p.get("consultor"))]
    coord_aprov = [p for p in ativos if p.get("situacao") == "Em risco"]

    gci_ids = {p["id"] for p in ativos if p.get("gci") or p.get("etapa") in ("Levantamento", "Designação")}
    gci_pend = [p for p in ativos if p.get("etapa") == "Levantamento" and "Mapeamento (Levantamento)" in faltas_por_pid.get(p["id"], [])]
    gci_atraso = [p for p in ativos if p.get("etapa") in ("Agendamento", "Levantamento")
                  and _parse_data(p.get("data_levantamento")) and _parse_data(p.get("data_levantamento")) < hoje]

    consultoria_ids = {p["id"] for p in ativos if p.get("consultor") or
                       p.get("etapa") in ("Cronograma e Check-list", "Encerramento")}
    consultoria_ids.update(c.get("projeto_id") for c in crono_pend + check_pend)
    implantacao_ids = {p["id"] for p in ativos if p.get("etapa") != "Agendamento"}
    suporte_ids = {p["id"] for p in projetos if p.get("etapa") == "Encerramento" or p.get("situacao") == "Concluído"}
    suporte_pend = [p for p in ativos if p.get("etapa") == "Encerramento"]
    suporte_atraso = [a for a in alertas if a["tipo"] == "encerramento"]

    usuarios_adm = [u["nome"] for u in db.usuarios_por_perfil("Administrativo")]
    usuarios_coord = [u["nome"] for u in db.usuarios_por_perfil("Coordenador") + db.usuarios_por_perfil("ADM")]
    usuarios_gci = [u["nome"] for u in db.usuarios_por_perfil("GCI")]
    usuarios_cons = [u["nome"] for u in db.usuarios_por_perfil("Consultor")]
    designados = [d.get("consultor") for d in designacoes if d.get("consultor")]

    setores = [
        setor("Comercial", {p["id"] for p in agendamento}, len(agendamento),
              len([p for p in projetos if p.get("etapa") != "Agendamento"]), comercial_pend,
              len(comercial_atraso), responsaveis=pessoas([p.get("responsavel") for p in agendamento]),
              alertas_txt=["Fechamentos aguardando dados ou encaminhamento"] if comercial_pend else []),
        setor("Administrativo", admin_ids, len(admin_ids), len(docs_map), admin_faltas,
              len(admin_sla), responsaveis=pessoas(usuarios_adm, [p.get("responsavel") for p in ativos]),
              alertas_txt=[a["msg"] for a in admin_sla]),
        setor("Coordenação", {p["id"] for p in ativos}, len(ativos), len(concluidos),
              len(coord_pend), len([a for a in alertas if a["nivel"] == "alto"]),
              len(coord_aprov), responsaveis=pessoas(usuarios_coord),
              alertas_txt=[a["msg"] for a in alertas if a["nivel"] == "alto"]),
        setor("GCI", gci_ids, len(gci_ids), len([p for p in projetos if p.get("etapa") not in ("Agendamento", "Levantamento")]),
              len(gci_pend), len(gci_atraso), responsaveis=pessoas(usuarios_gci, [p.get("gci") for p in ativos]),
              alertas_txt=["Levantamento vencido ou mapeamento pendente"] if gci_atraso or gci_pend else []),
        setor("Consultoria", consultoria_ids, len(consultoria_ids), len(crono_ok) + len(check_ok),
              len(crono_pend) + len(check_pend), len(crono_atrasado),
              responsaveis=pessoas(usuarios_cons, [p.get("consultor") for p in ativos], designados),
              alertas_txt=["Cronograma/check-list com linhas pendentes"] if crono_pend or check_pend else []),
        setor("Implantação", implantacao_ids, len(implantacao_ids), len(concluidos),
              m["gate_pendente"], m["n_atrasados"], len(m["em_risco"]),
              responsaveis=pessoas([p.get("gci") for p in ativos], [p.get("consultor") for p in ativos]),
              alertas_txt=[a["msg"] for a in alertas[:3]]),
        setor("Suporte", suporte_ids, len(suporte_pend), len(concluidos), len(suporte_pend),
              len(suporte_atraso), responsaveis=pessoas([p.get("consultor") for p in suporte_pend], ["Suporte"]),
              alertas_txt=[a["msg"] for a in suporte_atraso]),
        setor("Desenvolvimento", dev_ids, len([i for i in dev_ids if i in {p["id"] for p in ativos}]),
              len([c for c in dev_checks if c.get("status") == "Concluído"]), len(dev_pend), 0,
              responsaveis=pessoas([c.get("responsavel") for c in dev_checks], ["Desenvolvimento"]),
              alertas_txt=["Itens técnicos/customizações pendentes"] if dev_pend else []),
    ]

    carga = {}
    for p in ativos:
        horas = db._pnum(p.get("horas_cobradas")) + db._pnum(p.get("horas_bonificadas"))
        for nome in pessoas(p.get("gci"), p.get("consultor")):
            c = carga.setdefault(nome, {"nome": nome, "projetos": set(), "horas": 0.0, "atrasos": 0})
            c["projetos"].add(p["id"]); c["horas"] += horas
            if alertas_por_pid.get(p["id"]):
                c["atrasos"] += 1
    for d in designacoes:
        nome = d.get("consultor")
        if nome:
            c = carga.setdefault(nome, {"nome": nome, "projetos": set(), "horas": 0.0, "atrasos": 0})
            c["projetos"].add(d.get("projeto_id"))
    carga_colab = []
    for c in carga.values():
        carga_colab.append({"nome": c["nome"], "projetos": len(c["projetos"]),
                            "horas": round(c["horas"]), "alertas": c["atrasos"]})
    carga_colab.sort(key=lambda x: (-x["projetos"], -x["horas"], x["nome"]))

    entregas = []
    for p in ativos:
        for campo, label in (("data_levantamento", "Levantamento"), ("data_uso_oficial", "Go-live")):
            data = _parse_data(p.get(campo))
            if data:
                entregas.append({"cliente": p.get("cliente"), "projeto_id": p["id"],
                                 "tipo": label, "data": data, "dias": (data - hoje).days,
                                 "setor": "GCI" if campo == "data_levantamento" else "Implantação"})
    for c in crono_pend:
        data = _parse_data(c.get("data"))
        if data and c.get("projeto_id") in por_id:
            entregas.append({"cliente": por_id[c["projeto_id"]].get("cliente"),
                             "projeto_id": c["projeto_id"], "tipo": c.get("etapa") or "Cronograma",
                             "data": data, "dias": (data - hoje).days, "setor": "Consultoria"})
    entregas.sort(key=lambda x: x["data"])

    mapa = []
    total_etapas = max(1, len(db.ETAPAS) - 1)
    for p in ativos:
        idx = db.macro_idx(p.get("etapa"))
        progresso = 100 if p.get("situacao") == "Concluído" else round((idx / total_etapas) * 100)
        al = alertas_por_pid.get(p["id"], [])
        mapa.append({"id": p["id"], "cliente": p.get("cliente"), "etapa": p.get("etapa"),
                     "situacao": p.get("situacao"), "progresso": progresso,
                     "consultor": p.get("consultor") or p.get("gci") or "—",
                     "alertas": len(al), "risco": p.get("situacao") == "Em risco",
                     "atrasado": any(a["tipo"] == "atraso" for a in al)})
    mapa.sort(key=lambda x: (0 if x["atrasado"] else 1, 0 if x["risco"] else 1, -x["alertas"], x["cliente"] or ""))

    saude = 100
    saude -= min(35, m["n_atrasados"] * 10)
    saude -= min(25, m["n_risco"] * 8)
    saude -= min(20, m["gate_pendente"] * 3)
    saude -= min(20, len([s for s in setores if s["estado"] == "sobrecarregado"]) * 8)
    saude = max(0, saude)

    fluxo = [{"nome": e, "n": m["por_etapa"].get(e, 0),
              "pct": round((m["por_etapa"].get(e, 0) / max(1, m["total"])) * 100)}
             for e in db.ETAPAS]

    return {
        "m": m, "alertas": alertas, "setores": setores, "saude": saude, "fluxo": fluxo,
        "mapa": mapa[:14], "entregas": entregas[:10], "carga": carga_colab[:10],
        "atualizado_em": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "chart_setores": {"labels": [s["nome"] for s in setores],
                          "pendentes": [s["pendentes"] for s in setores],
                          "atrasadas": [s["atrasadas"] for s in setores],
                          "andamento": [s["andamento"] for s in setores]},
    }


@app.route("/monitoramento")
def monitoramento():
    if not pode_ver("gestao"):
        abort(403)
    with db.Session() as s:
        projetos = [db.to_dict(x) for x in s.query(db.Projeto).all()]
        meus = _so_meus(projetos)
        ids = {p["id"] for p in meus}
        docs_map = {}
        for dcto in s.query(db.Documento).all():
            if dcto.projeto_id in ids:
                docs_map.setdefault(dcto.projeto_id, []).append({"tipo": dcto.tipo})
        eventos = [db.to_dict(x) for x in s.query(db.Evento).order_by(db.Evento.criado_em.desc()).limit(300).all()
                   if x.projeto_id in ids]
        cronos = [db.to_dict(x) for x in s.query(db.CronogramaItem).all() if x.projeto_id in ids]
        checks = [db.to_dict(x) for x in s.query(db.ChecklistItem).all() if x.projeto_id in ids]
        designacoes = [db.to_dict(x) for x in s.query(db.Designacao).all() if x.projeto_id in ids]
    dados = _monitoramento_operacional(meus, docs_map, eventos, cronos, checks, designacoes)
    return render_template("monitoramento_operacional.html", **dados)


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


# Documentos de fase gerados FIELMENTE pelos layouts cadastrados (troca só placeholders).
_LAYOUT_SLUGS = ("levantamento", "projeto", "cronograma", "termo")


def _gerar_e_anexar_fiel(pid, slug, proj, modo="auto"):
    """Gera o documento da fase pelo layout fiel vigente (Cadastro de Modelos) e anexa
    como Documento. Devolve o caminho do arquivo gerado."""
    import gerar_layout
    path = gerar_layout.gerar(slug, proj, modo=modo)
    rotulo = "Gerou %s pelo layout oficial (%s)" % (os.path.basename(path), slug)
    if modo == "modelo":
        rotulo += " — modelo p/ preenchimento manual"
    with db.Session() as s:
        s.add(db.Documento(projeto_id=pid, tipo=slug,
                           arquivo=os.path.basename(path), caminho=path))
        db.registrar_evento(s, pid, "documento", rotulo, _autor())
        s.commit()
    return path


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
    if tipo == "projeto":                       # o Projeto passa pelo GATE de origem (tela/importado/modelo)
        return redirect(url_for("projeto_origem", pid=pid))
    path = None
    try:
        if tipo in _LAYOUT_SLUGS:           # gera pelo LAYOUT FIEL (substitui os geradores antigos)
            path = _gerar_e_anexar_fiel(pid, tipo, proj)
        else:                               # demais tipos (ex.: checklist): gerador programático
            path, _log = runner.gerar_do_projeto(proj, tipo)
            if path:
                with db.Session() as s:
                    s.add(db.Documento(projeto_id=pid, tipo=tipo,
                                       arquivo=os.path.basename(path), caminho=path))
                    db.registrar_evento(s, pid, "documento",
                                        "Gerou %s (%s)" % (os.path.basename(path), tipo), _autor())
                    s.commit()
    except Exception:
        logging.exception("Falha ao gerar documento (%s)", tipo)
        return redirect(url_for("projeto_ficha", pid=pid,
                                aviso="Falha ao gerar '%s'." % db.DOC_LABELS.get(tipo, tipo)))
    if path:
        _notificar_evento(pid, _EVT_DOC.get(tipo), proj)
        _auto_avancar(pid)
    return redirect(url_for("projeto_ficha", pid=pid, salvo=1))


@app.route("/projetos/<int:pid>/gerar-layout/<slug>", methods=["POST"])
def projeto_gerar_layout(pid, slug):
    """Atalho do painel 'Documentos oficiais': gera o documento pelo layout fiel
    independentemente da fase atual (sem o gate de etapa)."""
    if slug not in _LAYOUT_SLUGS:
        abort(404)
    if not pode_gerar(slug):
        abort(403)
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    try:
        _gerar_e_anexar_fiel(pid, slug, proj)
    except Exception:
        logging.exception("Falha ao gerar pelo layout (%s)", slug)
        return redirect(url_for("projeto_ficha", pid=pid,
                                aviso="Falha ao gerar pelo layout oficial."))
    _notificar_evento(pid, _EVT_DOC.get(slug), proj)
    _auto_avancar(pid)
    return redirect(url_for("projeto_ficha", pid=pid, salvo=1))


@app.route("/projetos/<int:pid>/gerar_projeto", methods=["POST"])
def projeto_gerar_projeto(pid):
    """Aposentado: o Projeto agora é gerado FIELMENTE pelo layout oficial, com os
    dados do projeto (sem upload do Mapeamento). Mantido por compatibilidade."""
    return projeto_gerar(pid, "projeto")


def _gerar_projeto_fiel(pid, proj, modo="auto", aviso=None):
    """Gera o Projeto pelo layout fiel (modo 'auto' usa respostas; 'modelo' usa as
    perguntas do Índice como guia), anexa, notifica e tenta avançar."""
    try:
        _gerar_e_anexar_fiel(pid, "projeto", proj, modo=modo)
    except Exception:
        logging.exception("Falha ao gerar Projeto (modo=%s)", modo)
        return redirect(url_for("projeto_ficha", pid=pid, aviso="Falha ao gerar o Projeto."))
    _notificar_evento(pid, _EVT_DOC.get("projeto"), proj)
    _auto_avancar(pid)
    return redirect(url_for("projeto_ficha", pid=pid, salvo=1, aviso=aviso))


@app.route("/projetos/<int:pid>/projeto/origem", methods=["GET", "POST"])
def projeto_origem(pid):
    """GATE de origem do Projeto: o Projeto nasce do Levantamento. Conforme o estado,
    oferece usar os dados preenchidos EM TELA, um Levantamento IMPORTADO (.docx), ou
    gerar um MODELO preenchido pelos cadastros/Índice para preenchimento manual."""
    if not pode_gerar("projeto"):
        abort(403)
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    if not _etapa_permite_gerar("projeto", proj.get("etapa")):
        return redirect(url_for("projeto_ficha", pid=pid,
            aviso="O Projeto só pode ser gerado na etapa '%s' ou depois." % _ETAPA_DOC.get("projeto", "?")))
    db.levantamento_seed(pid, proj.get("modulos", ""))   # idempotente

    if request.method == "POST":
        fonte = (request.form.get("fonte") or "tela").strip()
        if fonte == "modelo":
            return _gerar_projeto_fiel(pid, proj, "modelo",
                aviso="Modelo do Projeto gerado (preenchido pelos cadastros/Índice) para preenchimento manual.")
        if fonte == "importar":
            f = request.files.get("arquivo")
            if not (f and f.filename):
                return redirect(url_for("projeto_origem", pid=pid, erro="Selecione o arquivo .docx do Levantamento."))
            base, ext = os.path.splitext(f.filename)
            if ext.lower() != ".docx":
                return redirect(url_for("projeto_origem", pid=pid, erro="O Levantamento importado deve ser um arquivo .docx."))
            nome = "levant_import_%d_%s%s" % (pid, C.slug(base), ext.lower())
            path = os.path.join(UPLOADS, nome)
            f.save(path)
            with db.Session() as s:
                s.add(db.Documento(projeto_id=pid, tipo="levantamento", origem="importado",
                                   arquivo=os.path.basename(path), caminho=path))
                db.registrar_evento(s, pid, "documento",
                                    "Importou Levantamento %s" % os.path.basename(path), _autor())
                s.commit()
            n = db.levantamento_importar_respostas(pid, path)
            return _gerar_projeto_fiel(pid, proj, "auto",
                aviso="Importadas %d respostas do Levantamento; Projeto gerado." % n)
        if fonte == "importado":
            imp = db.levantamento_importado(pid)
            if not imp:
                return redirect(url_for("projeto_origem", pid=pid, erro="Não há Levantamento importado neste projeto."))
            n = db.levantamento_importar_respostas(pid, imp.get("caminho"))
            return _gerar_projeto_fiel(pid, proj, "auto",
                aviso="Importadas %d respostas do Levantamento importado; Projeto gerado." % n)
        # fonte == "tela" (padrão): usa as respostas preenchidas no painel
        return _gerar_projeto_fiel(pid, proj, "auto")

    resp, total = db.levantamento_resumo(pid)
    importado = db.levantamento_importado(pid)
    return render_template("projeto_origem.html", p=proj, pid=pid,
                           tela_resp=resp, total=total, importado=importado,
                           erro=request.args.get("erro"))


@app.route("/projetos/<int:pid>/levantamento", methods=["GET", "POST"])
def projeto_levantamento(pid):
    """Responder o Levantamento no painel: as perguntas do Índice de Tópicos dos
    módulos contratados viram campos. Estas respostas alimentam o Projeto."""
    if _perfil() and _perfil() not in ("ADM", "Coordenador", "Administrativo", "GCI"):
        abort(403)
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    db.levantamento_seed(pid, proj.get("modulos", ""))   # idempotente
    if request.method == "POST":
        n = db.levantamento_salvar(pid, request.form)
        with db.Session() as s:
            db.registrar_evento(s, pid, "nota",
                                "Levantamento respondido (%d itens preenchidos)." % n, _autor())
            s.commit()
        return redirect(url_for("projeto_levantamento", pid=pid, salvo=1))
    resp, total = db.levantamento_resumo(pid)
    import gerar_layout
    grupos, por_area = [], {}   # agrupa por BLOCO DE ÁREA (como no documento), em abre/fecha
    for r in db.levantamento_respostas(pid):
        area = gerar_layout.area_do_modulo(r["modulo_sigla"]) or (r["modulo"] or r["modulo_sigla"] or "Outros")
        g = por_area.get(area)
        if g is None:
            g = {"area": area, "itens": [], "resp": 0}
            por_area[area] = g
            grupos.append(g)
        g["itens"].append(r)
        if (r["resposta"] or "").strip():
            g["resp"] += 1
    return render_template("levantamento.html", p=proj, pid=pid, grupos=grupos,
                           resp=resp, total=total, salvo=request.args.get("salvo"))


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


@app.route("/projetos/<int:pid>/definir_gci", methods=["GET", "POST"])
def projeto_definir_gci(pid):
    """Fase Agendamento — Etapa 1: define o GCI responsável pelo Levantamento.
    Salva imediatamente sem notificar; a notificação só ocorre após a data ser confirmada."""
    if _perfil() and _perfil() not in ("ADM", "Administrativo"):
        abort(403)
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    gcis = db.usuarios_por_perfil("GCI")
    if request.method == "POST":
        # Pode haver mais de um GCI no levantamento de um cliente
        gci_sel = [g.strip() for g in request.form.getlist("gci") if g.strip()]
        if not gci_sel:
            return redirect(url_for("projeto_definir_gci", pid=pid, erro="Selecione ao menos um GCI responsável."))
        gci = ", ".join(dict.fromkeys(gci_sel))   # remove duplicados, preserva ordem
        with db.Session() as s:
            p = s.get(db.Projeto, pid)
            p.gci = gci
            db.registrar_evento(s, pid, "etapa", "GCI(s) definido(s): %s" % gci, _autor())
            s.commit()
        # Redireciona para a etapa 2 (definir data) após salvar o GCI
        return redirect(url_for("projeto_agendar", pid=pid, salvo=1))
    return render_template("definir_gci.html", p=proj, pid=pid, gcis=gcis,
                           erro=request.args.get("erro"))


@app.route("/projetos/<int:pid>/agendar", methods=["GET", "POST"])
def projeto_agendar(pid):
    """Fase Agendamento — Etapa 2: define a Data do Levantamento (apenas após GCI definido).
    Ao salvar, notifica o GCI por e-mail e avança o projeto para Levantamento."""
    if _perfil() and _perfil() not in ("ADM", "Administrativo"):
        abort(403)
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    # Etapa 2 só pode ser acessada após o GCI estar definido
    if not db.gci_definido(proj):
        return redirect(url_for("projeto_definir_gci", pid=pid,
                                erro="Defina o GCI responsável antes de agendar a data."))
    import datetime as _dt
    hoje_iso = _dt.date.today().isoformat()
    if request.method == "POST":
        data_lev = (request.form.get("data_levantamento") or "").strip()
        if not data_lev:
            return redirect(url_for("projeto_agendar", pid=pid, erro="Informe a data do Levantamento."))
        if data_lev < hoje_iso:
            return redirect(url_for("projeto_agendar", pid=pid,
                                    erro="A data do Levantamento não pode ser anterior a hoje."))
        with db.Session() as s:
            p = s.get(db.Projeto, pid)
            p.data_levantamento = data_lev
            cliente, gci_nome = p.cliente, p.gci
            db.registrar_evento(s, pid, "etapa",
                "Data do Levantamento definida: %s (GCI: %s)" % (_data_br(data_lev), gci_nome or "—"), _autor())
            s.commit()
        # Notifica TODOS os GCIs (pode haver mais de um) após GCI + data confirmados
        gci_nomes = [g.strip() for g in (gci_nome or "").split(",") if g.strip()]
        ems = [e for e in (db.email_do_usuario(g) for g in gci_nomes) if e]
        if ems:
            _notificar(pid, ems, "Levantamento agendado — %s" % cliente,
                       "O Levantamento do projeto %s foi agendado para %s.\n"
                       "Você é GCI responsável. Acesse o Painel de Implantação para conduzir.\n\n"
                       "— Painel de Implantação" % (cliente, _data_br(data_lev)))
        _auto_avancar(pid)   # com GCI + data definidos, avança Agendamento → Levantamento
        return redirect(url_for("projeto_ficha", pid=pid, salvo=1))
    return render_template("agendar.html", p=proj, pid=pid, hoje=hoje_iso,
                           salvo=request.args.get("salvo"), erro=request.args.get("erro"))


@app.route("/projetos/<int:pid>/consultores", methods=["GET", "POST"])
def projeto_consultores(pid):
    """Fase Designação (GCI): designa os Consultores da implantação e os avisa por e-mail
    (não envia se o projeto já estiver Concluído)."""
    if _perfil() and _perfil() not in ("ADM", "GCI"):
        abort(403)
    import re as _re
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    mods = [m.strip() for m in _re.split(r"[,;\n]+", proj.get("modulos", "") or "") if m.strip()]
    consultores = db.usuarios_por_perfil("Consultor")
    atuais = {d["modulo"]: d["consultor"] for d in db.designacoes_do_projeto(pid)}
    if request.method == "POST":
        por_consultor = {}
        for i, m in enumerate(mods):
            cons = (request.form.get("mod_%d" % i) or "").strip()
            if cons:
                por_consultor.setdefault(cons, []).append(m)
        if not por_consultor:
            return redirect(url_for("projeto_consultores", pid=pid, erro="Designe ao menos um consultor."))
        with db.Session() as s:
            s.query(db.Designacao).filter_by(projeto_id=pid).delete()
            for cons, ms in por_consultor.items():
                for m in ms:
                    s.add(db.Designacao(projeto_id=pid, modulo=m, consultor=cons))
            p = s.get(db.Projeto, pid)
            p.consultor = ", ".join(sorted(por_consultor.keys()))
            cliente, concluido = p.cliente, (p.situacao == "Concluído")
            db.registrar_evento(s, pid, "etapa", "Consultores designados: %s" % (p.consultor or "—"), _autor())
            s.commit()
        if not concluido:   # após a conclusão do projeto não é mais necessário enviar e-mail
            for cons, ms in por_consultor.items():
                em = db.email_do_usuario(cons)
                if em:
                    _notificar(pid, [em], "Implantação designada — %s" % cliente,
                               "Você foi designado como responsável pela implantação do cliente %s.\n"
                               "Módulos: %s.\nO projeto já está pronto no Painel de Implantação — acesse para conduzir.\n\n"
                               "— Painel de Implantação" % (cliente, ", ".join(ms)))
        _auto_avancar(pid)   # com consultores, avança Designação → Cronograma e Check-list
        return redirect(url_for("projeto_ficha", pid=pid, salvo=1))
    return render_template("consultores.html", p=proj, pid=pid, mods=mods,
                           consultores=consultores, atuais=atuais, erro=request.args.get("erro"))


@app.route("/projetos/<int:pid>/editar/<doc>", methods=["GET", "POST"])
def projeto_doc_editar(pid, doc):
    """Tela de edição ESTRUTURADA (espelha as seções do layout do documento). Grava em
    DocConteudo; a geração fiel lê esses valores para preencher o .docx."""
    import doc_edit
    if doc not in doc_edit.SPEC:
        abort(404)
    if _perfil() and _perfil() not in ("ADM", "Coordenador", "Administrativo", "GCI"):
        abort(403)
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    if request.method == "POST":
        db.doc_conteudo_salvar(pid, doc, doc_edit.campos_editaveis(doc, proj), request.form)
        with db.Session() as s:
            db.registrar_evento(s, pid, "nota",
                                "Editou os dados estruturados (%s)." % doc, _autor())
            s.commit()
        return redirect(url_for("projeto_doc_editar", pid=pid, doc=doc, salvo=1))
    spec = {"titulo": doc_edit.SPEC[doc]["titulo"], "secoes": doc_edit.secoes(doc, proj)}
    return render_template("doc_editar.html", p=proj, pid=pid, doc=doc, spec=spec,
                           vals=doc_edit.valores(doc, proj, db.doc_conteudo(pid, doc)),
                           salvo=request.args.get("salvo"))


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
                   ("cliente", "cnpj", "ramo", "numero_projeto", "numero_proposta",
                    "modulos", "horas_cobradas", "horas_bonificadas",
                    "contato_nome", "contato_email", "contato_tel",
                    "contatos", "observacoes",
                    "data_levantamento", "data_uso_oficial")}
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


# ---------- Agendador de Visitas (calendário por dia + turno) ----------
@app.route("/projetos/<int:pid>/agenda", methods=["GET"])
def projeto_agenda(pid):
    """Agendador de visitas: lateral com as Visitas (do Check List) e calendário
    semanal (dia × turno Manhã/Tarde). As atividades são alocadas por arrastar e soltar."""
    if not pode_gerar("cronograma"):
        abort(403)
    from datetime import date, datetime as _dt, timedelta
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    db.cronograma_atividades_seed(pid, proj.get("modulos", ""))
    ats = db.cronograma_atividades(pid)
    tech = {d["modulo"]: d["consultor"] for d in db.designacoes_do_projeto(pid)}
    tecnicos = []                                             # técnicos atribuíveis por cartão
    for nome in list(tech.values()) + [c.strip() for c in (proj.get("consultor") or "").split(",")]:
        nome = (nome or "").strip()
        if nome and nome not in tecnicos:
            tecnicos.append(nome)
    tecnicos.sort()

    fds = bool(request.args.get("fds"))
    try:
        ref = _dt.strptime(request.args.get("ref", ""), "%Y-%m-%d").date()
    except ValueError:
        ref = date.today()
    seg = ref - timedelta(days=ref.weekday())                 # segunda-feira
    dias = [seg + timedelta(days=i) for i in range(7 if fds else 5)]
    nomes = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
    semana = [{"iso": d.isoformat(), "label": "%s %02d/%02d" % (nomes[i], d.day, d.month)}
              for i, d in enumerate(dias)]
    iso_set = {d.isoformat() for d in dias}

    aloc = {d.isoformat(): {"manha": [], "tarde": []} for d in dias}
    fora = 0
    for a in ats:
        if a["data"] and a["turno"]:
            if a["data"] in iso_set and a["turno"] in ("manha", "tarde"):
                aloc[a["data"]][a["turno"]].append(a)
            else:
                fora += 1
    visitas = db.cronograma_visitas(pid)                      # todos os grupos (containers persistem)
    n_pend = sum(1 for a in ats if not (a["data"] and a["turno"]))
    mods = {}                                                 # visitas agrupadas por MÓDULO (acordeão)
    for g in visitas:
        g["pend"] = sum(1 for a in g["atividades"] if not (a["data"] and a["turno"]))
        mods.setdefault(g["modulo"], []).append(g)
    modulos_visitas = [{"modulo": m, "visitas": vs, "n": len(vs),
                        "pend": sum(x["pend"] for x in vs)} for m, vs in sorted(mods.items())]

    h = db.cronograma_horarios(pid)                           # horário GLOBAL por turno (um só)
    hor = {"manha": {"ini": h["manha"][0], "fim": h["manha"][1]},
           "tarde": {"ini": h["tarde"][0], "fim": h["tarde"][1]}}
    modulos_tec = [{"sigla": m, "tecnico": tech.get(m, "")}    # técnico por módulo (painel central)
                   for m in sorted({a["modulo"] for a in ats})]

    # Disponibilidade: análise CONJUNTA (todos os envolvidos) ou INDIVIDUAL (1 técnico).
    from urllib.parse import quote as _quote
    envolvidos = sorted({(t or "").strip() for t in tech.values() if (t or "").strip()})
    modo = "individual" if request.args.get("modo") == "individual" else "conjunta"
    tec_sel = (request.args.get("tec") or "").strip()
    if modo == "individual":
        if tec_sel not in envolvidos:
            tec_sel = envolvidos[0] if envolvidos else ""
        alvos = [tec_sel] if tec_sel else []
    else:
        tec_sel, alvos = "", envolvidos
    bloqueados, disp_aviso, disp_ativa = {}, None, False
    try:
        import disponibilidade as D
        if D.configurado() and alvos:
            disp_ativa = True
            ocup = D.ocupacao_por_slot(dias[0].isoformat(), dias[-1].isoformat())
            for d in dias:
                for t in ("manha", "tarde"):
                    ocs = [e for e in alvos if ocup.get((e.lower(), d.isoformat(), t))]
                    if ocs:
                        bloqueados["%s|%s" % (d.isoformat(), t)] = ", ".join(ocs)
    except Exception:
        logging.exception("Falha ao consultar disponibilidade")
        disp_aviso = "Disponibilidade indisponível no momento — calendário liberado."

    extra = ("&modo=individual" + (("&tec=" + _quote(tec_sel)) if tec_sel else "")) if modo == "individual" else ""
    qs = ("&fds=1" if fds else "") + extra
    return render_template("agenda.html", p=proj, pid=pid, semana=semana, aloc=aloc,
                           modulos_visitas=modulos_visitas, tech=tech, tecnicos=tecnicos,
                           fora=fora, fds=fds, hor=hor, modulos_tec=modulos_tec,
                           bloqueados=bloqueados, disp_aviso=disp_aviso, disp_ativa=disp_ativa,
                           modo=modo, tec_sel=tec_sel, envolvidos=envolvidos,
                           ref_cur=seg.isoformat(),
                           ref_prev=(seg - timedelta(days=7)).isoformat() + qs,
                           ref_next=(seg + timedelta(days=7)).isoformat() + qs,
                           ref_hoje=date.today().isoformat() + qs,
                           fds_toggle="ref=%s%s" % (seg.isoformat(), ("" if fds else "&fds=1") + extra),
                           titulo_sem="%02d/%02d a %02d/%02d" % (dias[0].day, dias[0].month, dias[-1].day, dias[-1].month),
                           n_pend=n_pend, total=len(ats),
                           aviso=request.args.get("aviso"), erro=request.args.get("erro"))


@app.route("/projetos/<int:pid>/agenda/alocar", methods=["POST"])
def projeto_agenda_alocar(pid):
    """Aloca/desaloca uma atividade (JSON). Técnico padrão = consultor designado do módulo."""
    if not pode_gerar("cronograma"):
        abort(403)
    aid = request.form.get("atividade_id")
    data = request.form.get("data")        # ausente = None (não mexe); "" = desaloca
    turno = request.form.get("turno")
    tecnico = request.form.get("tecnico")  # ausente = None (não mexe)
    if not aid:
        return jsonify(ok=False, erro="atividade_id ausente"), 400
    if data and tecnico is None:           # ao alocar, herda o consultor designado do módulo
        with db.Session() as s:
            a = s.get(db.AtividadeCronograma, int(aid))
            if a and a.projeto_id == pid and not (a.tecnico or "").strip():
                tech = {d["modulo"]: d["consultor"] for d in db.designacoes_do_projeto(pid)}
                tecnico = tech.get(a.modulo)
    upd = db.cronograma_alocar(aid, projeto_id=pid, data=data, turno=turno, tecnico=tecnico)
    if not upd:
        return jsonify(ok=False, erro="atividade não encontrada"), 404
    return jsonify(ok=True, atividade=upd)


@app.route("/projetos/<int:pid>/agenda/alocar_visita", methods=["POST"])
def projeto_agenda_alocar_visita(pid):
    """Aloca a VISITA inteira (todas as atividades pendentes de modulo+seq) num dia/turno."""
    if not pode_gerar("cronograma"):
        abort(403)
    modulo = (request.form.get("modulo") or "").strip()
    data = (request.form.get("data") or "").strip()
    turno = (request.form.get("turno") or "").strip()
    try:
        seq = int(request.form.get("seq") or "")
    except ValueError:
        seq = None
    if not (modulo and seq and data and turno in ("manha", "tarde")):
        return jsonify(ok=False, erro="parâmetros inválidos"), 400
    tech = {d["modulo"]: d["consultor"] for d in db.designacoes_do_projeto(pid)}
    n = 0
    for a in db.cronograma_atividades(pid):
        if a["modulo"] == modulo and a["seq"] == seq and not (a["data"] and a["turno"]):
            t = (a["tecnico"] or "").strip() or (tech.get(modulo) or "")
            db.cronograma_alocar(a["id"], projeto_id=pid, data=data, turno=turno, tecnico=(t or None))
            n += 1
    return jsonify(ok=True, n=n)


@app.route("/projetos/<int:pid>/agenda/horario", methods=["POST"])
def projeto_agenda_horario(pid):
    """Define o horário GLOBAL de início/fim de um turno (manha|tarde) — um só p/ todas as visitas."""
    if not pode_gerar("cronograma"):
        abort(403)
    upd = db.cronograma_horario_salvar(pid, request.form.get("turno"),
                                       request.form.get("hora_inicio"), request.form.get("hora_fim"))
    if not upd:
        return jsonify(ok=False, erro="turno inválido"), 400
    return jsonify(ok=True, horario=upd)


@app.route("/projetos/<int:pid>/agenda/tecnico_modulo", methods=["POST"])
def projeto_agenda_tecnico_modulo(pid):
    """Define o técnico de um MÓDULO (aplica aos cartões e sincroniza a Designação)."""
    if not pode_gerar("cronograma"):
        abort(403)
    n = db.cronograma_tecnico_modulo(pid, request.form.get("modulo"), request.form.get("tecnico"))
    ref = (request.form.get("ref") or "").strip()
    return redirect(url_for("projeto_agenda", pid=pid, ref=ref or None,
                            fds=(1 if request.form.get("fds") else None),
                            aviso="Técnico do módulo aplicado a %d cartão(ões)." % n))


@app.route("/projetos/<int:pid>/agenda/status", methods=["POST"])
def projeto_agenda_status(pid):
    """Define o status de uma atividade (CRONO_STATUS_AGENDA) — JSON."""
    if not pode_gerar("cronograma"):
        abort(403)
    aid = request.form.get("atividade_id")
    if not aid:
        return jsonify(ok=False, erro="atividade_id ausente"), 400
    upd = db.cronograma_status(aid, pid, request.form.get("status"))
    if not upd:
        return jsonify(ok=False, erro="status inválido ou atividade não encontrada"), 400
    return jsonify(ok=True, atividade=upd)


@app.route("/projetos/<int:pid>/agenda/acompanhamento", methods=["GET"])
def projeto_agenda_acompanhamento(pid):
    """Acompanhamento: lista (read-only) as atividades alocadas com status 'Realizada?'."""
    if not pode_gerar("cronograma"):
        abort(403)
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    todas = [a for a in db.cronograma_atividades(pid) if a["data"] and a["turno"]]
    h = db.cronograma_horarios(pid)
    for a in todas:                                   # horário (global) do turno em cada atividade
        a["hora_inicio"], a["hora_fim"] = db.cronograma_horas(h, a["turno"])
    datas = sorted({a["data"] for a in todas})        # opções de filtro
    tecs = sorted({(a["tecnico"] or "").strip() for a in todas if (a["tecnico"] or "").strip()})
    f_data = (request.args.get("data") or "").strip()
    f_tec = (request.args.get("tecnico") or "").strip()
    f_status = (request.args.get("status") or "").strip()
    ats = [a for a in todas
           if (not f_data or a["data"] == f_data)
           and (not f_tec or (a["tecnico"] or "").strip() == f_tec)
           and (not f_status or (a["status"] or "") == f_status)]
    ats.sort(key=lambda a: (a["data"], 0 if a["turno"] == "manha" else 1, a["modulo"], a["seq"]))
    contagem = {st: 0 for st in db.CRONO_STATUS_AGENDA}   # contagem por status (todas as alocadas)
    for a in todas:
        contagem[a["status"]] = contagem.get(a["status"], 0) + 1
    return render_template("agenda_acompanhamento.html", p=proj, pid=pid,
                           atividades=ats, total=len(ats), contagem=contagem,
                           status_opcoes=db.CRONO_STATUS_AGENDA,
                           datas=datas, tecnicos=tecs, f_data=f_data, f_tec=f_tec, f_status=f_status)


@app.route("/projetos/<int:pid>/agenda/gerar", methods=["POST"])
def projeto_agenda_gerar(pid):
    """Gera o cronograma de visitas (.xlsx) a partir das alocações e anexa como Documento."""
    if not pode_gerar("cronograma"):
        abort(403)
    with db.Session() as s:
        p = s.get(db.Projeto, pid)
        if not p:
            abort(404)
        proj = db.to_dict(p)
    ats = db.cronograma_atividades(pid)
    if not any(a["data"] and a["turno"] for a in ats):
        return redirect(url_for("projeto_agenda", pid=pid,
                                erro="Aloque ao menos uma atividade no calendário antes de gerar o cronograma."))
    import gerar_layout
    try:
        path = gerar_layout.gerar_agenda_xlsx(proj, ats, db.cronograma_horarios(pid))
    except Exception:
        logging.exception("Falha ao gerar cronograma de visitas (.xlsx)")
        return redirect(url_for("projeto_agenda", pid=pid, erro="Falha ao gerar o cronograma."))
    with db.Session() as s:
        s.add(db.Documento(projeto_id=pid, tipo="cronograma",
                           arquivo=os.path.basename(path), caminho=path))
        db.registrar_evento(s, pid, "documento",
                            "Gerou cronograma de visitas %s" % os.path.basename(path), _autor())
        s.commit()
    _notificar_evento(pid, _EVT_DOC.get("cronograma"), proj)
    _auto_avancar(pid)
    return redirect(url_for("projeto_ficha", pid=pid, salvo=1,
                            aviso="Cronograma de visitas (.xlsx) gerado e anexado à ficha."))


@app.route("/projetos/<int:pid>/agenda/postergar", methods=["POST"])
def projeto_agenda_postergar(pid):
    """Posterga assunto(s) para uma data/turno destino. Por ASSUNTO (atividade_id) ou por
    TURNO inteiro (data+turno). Cada original vira 'Postergada' (histórico) e nasce uma nova
    ocorrência 'Agendada' no destino."""
    if not pode_gerar("cronograma"):
        abort(403)
    nova_data = (request.form.get("nova_data") or "").strip()
    novo_turno = (request.form.get("novo_turno") or "").strip()
    aid = request.form.get("atividade_id")
    src_data = (request.form.get("data") or "").strip()
    src_turno = (request.form.get("turno") or "").strip()
    ref = (request.form.get("ref") or "").strip()
    fds = request.form.get("fds")
    if aid:
        alvos = [int(aid)]
    elif src_data and src_turno:
        alvos = [a["id"] for a in db.cronograma_atividades(pid)
                 if a["data"] == src_data and a["turno"] == src_turno and a["status"] != "Postergada"]
    else:
        alvos = []
    n = sum(1 for tid in alvos if db.cronograma_postergar(tid, pid, nova_data, novo_turno))
    if n:
        aviso = "%d assunto(s) postergado(s) para %s." % (n, nova_data)
    else:
        aviso = "Informe a data e o turno destino para postergar."
    return redirect(url_for("projeto_agenda", pid=pid, ref=(ref or src_data or nova_data) or None,
                            fds=(1 if fds else None), aviso=aviso))


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
