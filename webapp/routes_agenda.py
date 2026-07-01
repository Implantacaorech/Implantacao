# -*- coding: utf-8 -*-
"""Rotas do Agendador de Visitas (/projetos/<pid>/agenda*).

Separado do app.py para reduzir o monólito. Os helpers do app.py são INJETADOS por
register() (evita import circular, já que app.py roda como __main__ em produção).
Os endpoints são registrados via add_url_rule com o nome da função → url_for inalterado.
"""
import os
import logging

import db
from flask import request, render_template, redirect, url_for, abort, jsonify

# Injetados por register() a partir do app.py:
pode_gerar = _autor = _notificar_evento = _auto_avancar = None
_EVT_DOC = {}


def _slot_indisponivel(data, turno, tecnico_nome):
    """Motivo (str) que impede alocar neste dia/turno, ou None se liberado.
    Bloqueia (1) datas passadas — sempre; (2) técnico ocupado no SICLA — quando a
    disponibilidade está configurada e o usuário tem Código SICLA."""
    from datetime import date
    data = (data or "").strip()
    if not data:
        return None
    if data < date.today().isoformat():
        return "Não é possível agendar em data passada — escolha hoje ou uma data futura."
    if turno not in ("manha", "tarde"):
        return None
    try:
        import disponibilidade as D
        if D.configurado() and (tecnico_nome or "").strip():
            cod = (db.codigo_sicla_do_usuario(tecnico_nome) or "").strip()   # código bruto p/ o filtro
            if cod and D.ocupacao_por_slot(data, data, [cod]).get((cod.lower(), data, turno)):
                return "%s está ocupado nesse dia/turno (agenda do SICLA)." % tecnico_nome
    except Exception:
        logging.exception("Falha ao checar disponibilidade na alocação")
    return None


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
    cods = db.codigos_sicla_por_nome(alvos)          # nome_lower -> código SICLA (elo com a agenda)
    tec_codigos = [cods[e.lower()] for e in alvos if cods.get(e.lower())]   # códigos p/ filtrar a consulta
    sem_codigo = sorted(e for e in alvos if not cods.get(e.lower()))
    try:
        import disponibilidade as D
        if D.configurado() and alvos:
            disp_ativa = True
            if D.filtra_por_tecnico():               # SELECT filtra por consultor -> janela ampla (hoje..+18 meses)
                import calendar
                hoje = date.today()
                _m = hoje.month - 1 + 18
                _ano, _mes = hoje.year + _m // 12, _m % 12 + 1
                fim18 = date(_ano, _mes, min(hoje.day, calendar.monthrange(_ano, _mes)[1]))
                di, df = hoje.isoformat(), fim18.isoformat()
            else:                                    # sem filtro -> mantém a semana (não puxa tudo)
                di, df = dias[0].isoformat(), dias[-1].isoformat()
            ocup = D.ocupacao_por_slot(di, df, tec_codigos)
            for d in dias:
                for t in ("manha", "tarde"):
                    ocs = [e for e in alvos
                           if cods.get(e.lower()) and ocup.get((cods[e.lower()].lower(), d.isoformat(), t))]
                    if ocs:
                        bloqueados["%s|%s" % (d.isoformat(), t)] = ", ".join(ocs)
            if sem_codigo:
                disp_aviso = ("Sem Código SICLA no cadastro de: %s — a disponibilidade desse(s) "
                              "não é verificada." % ", ".join(sem_codigo))
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
                           hoje_iso=date.today().isoformat(),
                           ref_cur=seg.isoformat(),
                           ref_prev=(seg - timedelta(days=7)).isoformat() + qs,
                           ref_next=(seg + timedelta(days=7)).isoformat() + qs,
                           ref_hoje=date.today().isoformat() + qs,
                           fds_toggle="ref=%s%s" % (seg.isoformat(), ("" if fds else "&fds=1") + extra),
                           titulo_sem="%02d/%02d a %02d/%02d" % (dias[0].day, dias[0].month, dias[-1].day, dias[-1].month),
                           n_pend=n_pend, total=len(ats),
                           aviso=request.args.get("aviso"), erro=request.args.get("erro"))


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
    if data:                               # alocando (data não-vazia): resolve o técnico efetivo
        eff_tec = (tecnico or "").strip()
        if not eff_tec:
            with db.Session() as s:
                a = s.get(db.AtividadeCronograma, int(aid))
                if a and a.projeto_id == pid:
                    eff_tec = (a.tecnico or "").strip()
                    if not eff_tec:        # herda o consultor designado do módulo
                        tech = {d["modulo"]: d["consultor"] for d in db.designacoes_do_projeto(pid)}
                        eff_tec = (tech.get(a.modulo) or "").strip()
                        if tecnico is None:
                            tecnico = eff_tec or None
        motivo = _slot_indisponivel(data, turno, eff_tec)
        if motivo:
            return jsonify(ok=False, erro=motivo), 409
    upd = db.cronograma_alocar(aid, projeto_id=pid, data=data, turno=turno, tecnico=tecnico)
    if not upd:
        return jsonify(ok=False, erro="atividade não encontrada"), 404
    return jsonify(ok=True, atividade=upd)


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
    motivo = _slot_indisponivel(data, turno, (tech.get(modulo) or ""))
    if motivo:
        return jsonify(ok=False, erro=motivo), 409
    n = 0
    for a in db.cronograma_atividades(pid):
        if a["modulo"] == modulo and a["seq"] == seq and not (a["data"] and a["turno"]):
            t = (a["tecnico"] or "").strip() or (tech.get(modulo) or "")
            db.cronograma_alocar(a["id"], projeto_id=pid, data=data, turno=turno, tecnico=(t or None))
            n += 1
    return jsonify(ok=True, n=n)


def projeto_agenda_horario(pid):
    """Define o horário GLOBAL de início/fim de um turno (manha|tarde) — um só p/ todas as visitas."""
    if not pode_gerar("cronograma"):
        abort(403)
    upd = db.cronograma_horario_salvar(pid, request.form.get("turno"),
                                       request.form.get("hora_inicio"), request.form.get("hora_fim"))
    if not upd:
        return jsonify(ok=False, erro="turno inválido"), 400
    return jsonify(ok=True, horario=upd)


def projeto_agenda_tecnico_modulo(pid):
    """Define o técnico de um MÓDULO (aplica aos cartões e sincroniza a Designação)."""
    if not pode_gerar("cronograma"):
        abort(403)
    n = db.cronograma_tecnico_modulo(pid, request.form.get("modulo"), request.form.get("tecnico"))
    ref = (request.form.get("ref") or "").strip()
    return redirect(url_for("projeto_agenda", pid=pid, ref=ref or None,
                            fds=(1 if request.form.get("fds") else None),
                            aviso="Técnico do módulo aplicado a %d cartão(ões)." % n))


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


def register(app, **deps):
    """Injeta os helpers do app.py e registra as rotas (endpoints = nome da função)."""
    globals().update(deps)   # pode_gerar, _autor, _notificar_evento, _auto_avancar, _EVT_DOC
    rota = lambda regra, fn, metodos=None: app.add_url_rule(regra, view_func=fn, methods=metodos)
    base = "/projetos/<int:pid>/agenda"
    rota(base, projeto_agenda)
    rota(base + "/alocar", projeto_agenda_alocar, ["POST"])
    rota(base + "/alocar_visita", projeto_agenda_alocar_visita, ["POST"])
    rota(base + "/horario", projeto_agenda_horario, ["POST"])
    rota(base + "/tecnico_modulo", projeto_agenda_tecnico_modulo, ["POST"])
    rota(base + "/status", projeto_agenda_status, ["POST"])
    rota(base + "/acompanhamento", projeto_agenda_acompanhamento)
    rota(base + "/gerar", projeto_agenda_gerar, ["POST"])
    rota(base + "/postergar", projeto_agenda_postergar, ["POST"])
