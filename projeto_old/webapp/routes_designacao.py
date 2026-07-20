# -*- coding: utf-8 -*-
"""Rotas das fases Agendamento e Designação (/projetos/<pid>/designar, /definir_gci,
/agendar, /consultores): define GCI(s), data do Levantamento e consultores por módulo,
com notificação por e-mail. Separadas do app.py (ver register())."""
import os

import db
import runner
from flask import request, render_template, redirect, url_for, abort

# Injetados por register():
pode_designar = _perfil = _autor = _notificar = _auto_avancar = _data_br = None


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


def register(app, **deps):
    globals().update(deps)   # pode_designar, _perfil, _autor, _notificar, _auto_avancar, _data_br
    GP = ["GET", "POST"]
    rota = lambda regra, fn, metodos=None: app.add_url_rule(regra, view_func=fn, methods=metodos)
    rota("/projetos/<int:pid>/designar", projeto_designar, GP)
    rota("/projetos/<int:pid>/definir_gci", projeto_definir_gci, GP)
    rota("/projetos/<int:pid>/agendar", projeto_agendar, GP)
    rota("/projetos/<int:pid>/consultores", projeto_consultores, GP)
