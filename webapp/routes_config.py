# -*- coding: utf-8 -*-
"""Rotas de configuração do Sistema (/config/*): IA, e-mail (SMTP), disponibilidade,
modelos de e-mail (CRUD), IMAP e Gmail. Separadas do app.py (ver register())."""
import os

import db
from flask import request, render_template, redirect, url_for, abort

# Injetados por register():
pode_ver = _e_adm = None


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


def config_modelos_email():
    if not _e_adm():
        abort(403)
    modelos = db.listar_modelos_email(apenas_ativos=False)
    return render_template("config_modelos_email.html",
                           modelos=modelos, etapas=db.ETAPAS)


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


def config_modelo_email_excluir(mid):
    if not _e_adm():
        abort(403)
    ok, err = db.excluir_modelo_email(mid)
    if not ok:
        modelos = db.listar_modelos_email(apenas_ativos=False)
        return render_template("config_modelos_email.html",
                               modelos=modelos, etapas=db.ETAPAS, erro=err)
    return redirect(url_for("config_modelos_email"))


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


def register(app, **deps):
    globals().update(deps)   # pode_ver, _e_adm
    GP = ["GET", "POST"]
    rota = lambda regra, fn, metodos=None: app.add_url_rule(regra, view_func=fn, methods=metodos)
    rota("/config", config, GP)
    rota("/config/email", config_email, GP)
    rota("/config/disponibilidade", config_disponibilidade, GP)
    rota("/config/modelos-email", config_modelos_email)
    rota("/config/modelos-email/novo", config_modelo_email_novo, GP)
    rota("/config/modelos-email/<int:mid>/editar", config_modelo_email_editar, GP)
    rota("/config/modelos-email/<int:mid>/excluir", config_modelo_email_excluir, ["POST"])
    rota("/config/modelos-email/<int:mid>/toggle", config_modelo_email_toggle, ["POST"])
    rota("/config/imap", config_imap, GP)
    rota("/config/gmail", config_gmail, GP)
