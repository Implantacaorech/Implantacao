# -*- coding: utf-8 -*-
"""Rotas da Matriz de Conhecimento (/matriz*).

Permissões (pedido de 2026-07-07):
  - ADM (Administrador)            -> vê TUDO e ALTERA qualquer linha (+ importar planilha);
  - Administrativo e Coordenador   -> vê TUDO, somente consulta;
  - Consultor e GCI                -> vê e altera APENAS a própria linha (casada pelo
                                      Código SICLA/nome do cadastro de usuários).
"""
import db
import matriz as M
from flask import request, render_template, redirect, url_for, abort

# Injetados por register():
_autor = _perfil = _user_id = None

VE_TUDO = ("ADM", "Administrativo", "Coordenador")


def _sem_login():
    return not _perfil()          # login desabilitado (instalação sem usuários) = acesso total


def _pode_editar(t):
    """Pode alterar a linha `t`? ADM sempre; Consultor/GCI só a própria."""
    if _sem_login() or _perfil() == "ADM":
        return True
    if _perfil() in ("Administrativo", "Coordenador"):
        return False
    minha = db.matriz_linha_do_usuario(_user_id())
    return bool(minha and t and minha["id"] == t["id"])


def matriz_lista():
    """Consulta: ADM/Administrativo/Coordenador veem todos; Consultor/GCI só a própria linha."""
    perfil = _perfil()
    if _sem_login() or perfil in VE_TUDO:
        itens = db.matriz_listar()
        for t in itens:
            t["qtd_notas"] = len(db.matriz_notas(t))
        restrito = False
    else:
        minha = db.matriz_linha_do_usuario(_user_id())
        if minha:
            return redirect(url_for("matriz_ficha", tid=minha["id"]))
        itens, restrito = [], True
    return render_template("matriz.html", itens=itens, restrito=restrito,
                           pode_admin=(_sem_login() or perfil == "ADM"),
                           salvo=request.args.get("salvo"), aviso=request.args.get("aviso"))


def matriz_ficha(tid):
    """Notas do técnico, agrupadas por área. Editável conforme o perfil."""
    t = db.matriz_get(tid)
    if not t:
        abort(404)
    perfil = _perfil()
    if not _sem_login() and perfil not in VE_TUDO:      # Consultor/GCI: só a própria linha
        minha = db.matriz_linha_do_usuario(_user_id())
        if not (minha and minha["id"] == t["id"]):
            abort(403)
    comps = db.matriz_competencias()
    areas = []
    for c in comps:
        if not areas or areas[-1][0] != c["area"]:
            areas.append((c["area"], []))
        areas[-1][1].append(c)
    return render_template("matriz_ficha.html", t=t, areas=areas, notas=db.matriz_notas(t),
                           editavel=_pode_editar(t),
                           volta=(_sem_login() or perfil in VE_TUDO),
                           salvo=request.args.get("salvo"))


def matriz_salvar(tid):
    t = db.matriz_get(tid)
    if not t:
        abort(404)
    if not _pode_editar(t):
        abort(403)
    db.matriz_salvar_notas(tid, request.form, _autor())
    return redirect(url_for("matriz_ficha", tid=tid, salvo=1))


def matriz_importar():
    """Reimporta a planilha (aditivo — linhas existentes são preservadas). Só Administrador."""
    if not (_sem_login() or _perfil() == "ADM"):
        abort(403)
    try:
        n_c, n_t, ig = M.importar(autor=_autor() or "importação")
        msg = "Importado: %d competências e %d técnicos novos (%d já existiam, preservados)." % (n_c, n_t, ig)
    except Exception as e:
        msg = "Falha na importação: %s" % e
    return redirect(url_for("matriz_lista", aviso=msg))


def register(app, **deps):
    globals().update(deps)   # _autor, _perfil, _user_id
    rota = lambda regra, fn, metodos=None: app.add_url_rule(regra, view_func=fn, methods=metodos)
    rota("/matriz", matriz_lista)
    rota("/matriz/importar", matriz_importar, ["POST"])
    rota("/matriz/<int:tid>", matriz_ficha)
    rota("/matriz/<int:tid>/salvar", matriz_salvar, ["POST"])
