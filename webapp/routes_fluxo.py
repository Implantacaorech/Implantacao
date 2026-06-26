# -*- coding: utf-8 -*-
"""Rotas auxiliares: fluxo de início pelo e-mail de fechamento (/fluxo*), envio de
e-mail por projeto (/projetos/<pid>/email), mapa mental do setor (/mapa) e
pré-visualização WYSIWYG de documentos (/projetos/<pid>/doc/<id>/ver).
Separadas do app.py (ver register())."""
import os

import db
import runner
from flask import request, render_template, redirect, url_for, abort

# Injetados por register():
_autor = _notificar_evento = pode_ver = None
ALLOWED_DIRS = []


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


def fluxo_parse():
    return _fluxo_confirmar(request.form.get("texto", ""), fonte="e-mail colado")


def fluxo_inbox():
    import imap_intake
    corpo, assunto, erro = imap_intake.buscar_fechamento()
    if erro:
        return redirect(url_for("fluxo_inicio", erro=erro))
    return _fluxo_confirmar(corpo, assunto=assunto, fonte="caixa de entrada")


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


def register(app, **deps):
    globals().update(deps)   # _autor, _notificar_evento, pode_ver, ALLOWED_DIRS
    GP = ["GET", "POST"]
    rota = lambda regra, fn, metodos=None: app.add_url_rule(regra, view_func=fn, methods=metodos)
    rota("/projetos/<int:pid>/email", projeto_email, GP)
    rota("/fluxo", fluxo_inicio)
    rota("/fluxo/parse", fluxo_parse, ["POST"])
    rota("/fluxo/inbox", fluxo_inbox, ["POST"])
    rota("/fluxo/criar", fluxo_criar, ["POST"])
    rota("/mapa", mapa)
    rota("/projetos/<int:pid>/doc/<int:doc_id>/ver", projeto_doc_ver)
