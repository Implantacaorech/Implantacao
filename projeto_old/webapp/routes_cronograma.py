# -*- coding: utf-8 -*-
"""Rotas dos planos editáveis Cronograma e Check-list (/projetos/<pid>/cronograma*,
/checklist*) — tabela editável + seed automático + geração do .xlsx do cronograma.
Separadas do app.py (ver register())."""
import os

import _common as C
import db
import runner
from flask import request, render_template, redirect, url_for, abort

# Injetados por register():
_autor = pode_gerar = _etapa_permite_gerar = _notificar_evento = _auto_avancar = None
_EVT_DOC = {}


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


def register(app, **deps):
    globals().update(deps)   # _autor, pode_gerar, _etapa_permite_gerar, _notificar_evento, _auto_avancar, _EVT_DOC
    GP = ["GET", "POST"]
    rota = lambda regra, fn, metodos=None: app.add_url_rule(regra, view_func=fn, methods=metodos)
    rota("/projetos/<int:pid>/cronograma", projeto_cronograma, GP)
    rota("/projetos/<int:pid>/cronograma/seed", projeto_cronograma_seed, ["POST"])
    rota("/projetos/<int:pid>/cronograma/gerar", projeto_cronograma_gerar, ["POST"])
    rota("/projetos/<int:pid>/checklist", projeto_checklist, GP)
    rota("/projetos/<int:pid>/checklist/seed", projeto_checklist_seed, ["POST"])
