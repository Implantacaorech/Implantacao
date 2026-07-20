# -*- coding: utf-8 -*-
"""Telas-painel (visão executiva): home (/), coordenação (/coordenacao),
atividade (/atividade) e monitoramento operacional (/monitoramento), com os
helpers de consolidação usados só aqui. Separadas do app.py (ver register())."""
import db
import roles
from flask import request, render_template, url_for, abort

# Injetados por register():
_so_meus = pode_ver = None


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

def capacidade():
    """Capacidade da equipe p/ receber cliente novo: módulos × matriz de conhecimento ×
    agenda (Painel + SICLA) × go-live previsto. Responde 'quem' e 'a partir de quando'."""
    if not pode_ver("gestao"):
        abort(403)
    import capacidade as CAP
    modulos = [m for m in (request.args.get("modulos") or "").replace(";", ",").split(",")
               if m.strip()]
    try:
        semanas = max(2, min(12, int(request.args.get("semanas") or 6)))
    except ValueError:
        semanas = 6
    r = CAP.avaliar_equipe(modulos, semanas=semanas)
    return render_template("capacidade.html", r=r, filtro=", ".join(r["modulos"]),
                           semanas=semanas)


def register(app, **deps):
    globals().update(deps)   # _so_meus, pode_ver
    rota = lambda regra, fn: app.add_url_rule(regra, view_func=fn)
    rota("/", home)
    rota("/coordenacao", coordenacao)
    rota("/coordenacao/capacidade", capacidade)
    rota("/atividade", atividade)
    rota("/monitoramento", monitoramento)

