# -*- coding: utf-8 -*-
"""Rotas dos Protocolos de Treinamento (/protocolos*): consulta (base de conhecimento),
upload manual de vídeo, tela de revisão (vídeo + transcrição + protocolo editável,
aprovar/reprovar) e disparo de processamento. Separadas do app.py (ver register())."""
import os
import logging

import db
import protocolos as P
from flask import request, render_template, redirect, url_for, abort, send_file

import _common as C

# Injetados por register():
_autor = _perfil = None


def _pode_aprovar():
    p = _perfil()
    return (not p) or p in ("ADM", "Coordenador")


def protocolos_lista():
    """Consulta da base de conhecimento, com filtros."""
    f = {k: (request.args.get(k) or "").strip() for k in ("modulo", "menu", "status", "q", "origem")}
    itens = db.protocolos_listar(**f)
    return render_template("protocolos.html", itens=itens, f=f,
                           modulos=db.PROTO_MODULOS, status_op=db.PROTO_STATUS,
                           robo_ok=P.configurado(), pasta=P.pasta_raiz(),
                           salvo=request.args.get("salvo"), aviso=request.args.get("aviso"))


def protocolo_novo():
    """Upload manual: salva o vídeo na pasta 'Videos Pendentes' e dispara o pipeline."""
    f = request.files.get("video")
    if not (f and f.filename):
        return redirect(url_for("protocolos_lista", aviso="Selecione um arquivo de vídeo."))
    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in P.EXTS:
        return redirect(url_for("protocolos_lista",
                                aviso="Formato não suportado (%s). Use: %s" % (ext, ", ".join(P.EXTS))))
    dest_dir = os.path.join(P.pasta_raiz(), "Videos Pendentes")
    os.makedirs(dest_dir, exist_ok=True)
    nome = C.slug(os.path.splitext(os.path.basename(f.filename))[0]) + ext
    caminho = os.path.join(dest_dir, nome)
    n = 1
    base, _e = os.path.splitext(caminho)
    while os.path.exists(caminho):
        caminho = "%s_%d%s" % (base, n, _e)
        n += 1
    f.save(caminho)
    pid, novo = db.protocolo_criar(os.path.basename(caminho), caminho, "upload", _autor())
    if not novo:
        return redirect(url_for("protocolo_revisar", pid=pid,
                                aviso="Este vídeo já foi registrado antes (mesmo conteúdo)."))
    P.processar_async(pid, _autor())
    return redirect(url_for("protocolo_revisar", pid=pid,
                            aviso="Vídeo recebido — transcrição em andamento (acompanhe o status)."))


def protocolo_revisar(pid):
    """Tela de revisão: vídeo, transcrição, protocolo editável e decisão."""
    p = db.protocolo_get(pid)
    if not p:
        abort(404)
    return render_template("protocolo_ficha.html", p=p, campos=db.PROTO_CAMPOS_TEXTO,
                           modulos=db.PROTO_MODULOS, status_op=db.PROTO_STATUS,
                           pode_aprovar=_pode_aprovar(), ia_ok=True,
                           salvo=request.args.get("salvo"), aviso=request.args.get("aviso"))


def protocolo_salvar(pid):
    if not db.protocolo_salvar_edicao(pid, request.form, _autor()):
        abort(404)
    return redirect(url_for("protocolo_revisar", pid=pid, salvo=1))


def protocolo_processar(pid):
    """(Re)processa o vídeo — transcreve e analisa de novo (ex.: após Erro)."""
    p = db.protocolo_get(pid)
    if not p:
        abort(404)
    if p["status"] in ("Transcrevendo", "Analisando"):
        return redirect(url_for("protocolo_revisar", pid=pid, aviso="Já está em processamento."))
    P.processar_async(pid, _autor())
    return redirect(url_for("protocolo_revisar", pid=pid, aviso="Processamento iniciado em segundo plano."))


def protocolo_aprovar(pid):
    if not _pode_aprovar():
        abort(403)
    db.protocolo_decidir(pid, True, _autor())
    return redirect(url_for("protocolo_revisar", pid=pid, salvo=1))


def protocolo_reprovar(pid):
    if not _pode_aprovar():
        abort(403)
    db.protocolo_decidir(pid, False, _autor())
    return redirect(url_for("protocolo_revisar", pid=pid, salvo=1))


def protocolo_video(pid):
    """Serve o vídeo para o player da revisão (suporta range/streaming)."""
    p = db.protocolo_get(pid)
    if not p:
        abort(404)
    path = os.path.abspath(p.get("video_caminho") or "")
    permitidos = [os.path.abspath(P.pasta_raiz()), os.path.abspath(C.DATA_WRITE)]
    if not os.path.exists(path) or not any(path.startswith(x) for x in permitidos):
        abort(403)
    return send_file(path, conditional=True)


def register(app, **deps):
    globals().update(deps)   # _autor, _perfil
    rota = lambda regra, fn, metodos=None: app.add_url_rule(regra, view_func=fn, methods=metodos)
    rota("/protocolos", protocolos_lista)
    rota("/protocolos/novo", protocolo_novo, ["POST"])
    rota("/protocolos/<int:pid>", protocolo_revisar)
    rota("/protocolos/<int:pid>/salvar", protocolo_salvar, ["POST"])
    rota("/protocolos/<int:pid>/processar", protocolo_processar, ["POST"])
    rota("/protocolos/<int:pid>/aprovar", protocolo_aprovar, ["POST"])
    rota("/protocolos/<int:pid>/reprovar", protocolo_reprovar, ["POST"])
    rota("/protocolos/<int:pid>/video", protocolo_video)
