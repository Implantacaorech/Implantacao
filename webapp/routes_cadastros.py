# -*- coding: utf-8 -*-
"""Rotas dos cadastros de referência (/cadastros/*): Check-list, Índice de Tópicos
e Modelos de Documentos (layouts + versões + campos). Separadas do app.py (register())."""
import os

import db
from flask import request, render_template, redirect, url_for, abort, send_file

# Injetados por register():
pode_ver = _arg_int = _autor = None
_PAG_CHECK = 50


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


def cad_checklist_salvar():
    if not pode_ver("sistema"):
        abort(403)
    db.checklist_modelo_salvar(request.form)
    return redirect(url_for("cad_checklist", mod=request.form.get("f_mod", ""),
                            q=request.form.get("f_q", ""), pg=request.form.get("f_pg", 1), salvo=1))


def cad_checklist_excluir(cid):
    if not pode_ver("sistema"):
        abort(403)
    db.checklist_modelo_excluir(cid)
    return redirect(url_for("cad_checklist", mod=request.form.get("f_mod", ""),
                            q=request.form.get("f_q", ""), pg=request.form.get("f_pg", 1),
                            aviso="Linha removida."))


def cad_checklist_reimportar():
    if not pode_ver("sistema"):
        abort(403)
    n = db._reseed_checklist_modelo()
    return redirect(url_for("cad_checklist", aviso="Catálogo reimportado do modelo (%d linhas)." % n))


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


def cad_indice_salvar():
    if not pode_ver("sistema"):
        abort(403)
    db.indice_salvar(request.form)
    return redirect(url_for("cad_indice", mod=request.form.get("f_mod", ""),
                            q=request.form.get("f_q", ""), salvo=1))


def cad_indice_excluir(cid):
    if not pode_ver("sistema"):
        abort(403)
    db.indice_excluir(cid)
    return redirect(url_for("cad_indice", mod=request.form.get("f_mod", ""),
                            q=request.form.get("f_q", ""), aviso="Tópico removido."))


def cad_indice_reimportar():
    if not pode_ver("sistema"):
        abort(403)
    n = db._reseed_indice_topicos()
    return redirect(url_for("cad_indice", aviso="Índice reimportado da planilha (%d tópicos)." % n))


def cad_modelos():
    if not pode_ver("sistema"):
        abort(403)
    return render_template("cad_modelos.html", modelos=db.modelos_documento_listar(),
                           salvo=request.args.get("salvo"), aviso=request.args.get("aviso"))


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


def cad_modelo_campo_salvar(mid):
    if not pode_ver("sistema"):
        abort(403)
    db.modelo_documento_campo_salvar(mid, request.form)
    return redirect(url_for("cad_modelo", mid=mid, salvo=1))


def cad_modelo_campo_excluir(mid, cid):
    if not pode_ver("sistema"):
        abort(403)
    db.modelo_documento_campo_excluir(cid)
    return redirect(url_for("cad_modelo", mid=mid, aviso="Campo removido."))


def register(app, **deps):
    globals().update(deps)   # pode_ver, _arg_int, _autor, _PAG_CHECK
    rota = lambda regra, fn, metodos=None: app.add_url_rule(regra, view_func=fn, methods=metodos)
    rota("/cadastros/checklist", cad_checklist)
    rota("/cadastros/checklist/salvar", cad_checklist_salvar, ["POST"])
    rota("/cadastros/checklist/<int:cid>/excluir", cad_checklist_excluir, ["POST"])
    rota("/cadastros/checklist/reimportar", cad_checklist_reimportar, ["POST"])
    rota("/cadastros/indice", cad_indice)
    rota("/cadastros/indice/salvar", cad_indice_salvar, ["POST"])
    rota("/cadastros/indice/<int:cid>/excluir", cad_indice_excluir, ["POST"])
    rota("/cadastros/indice/reimportar", cad_indice_reimportar, ["POST"])
    rota("/cadastros/modelos", cad_modelos)
    rota("/cadastros/modelos/<int:mid>", cad_modelo)
    rota("/cadastros/modelos/<int:mid>/versao", cad_modelo_versao, ["POST"])
    rota("/cadastros/modelos/<int:mid>/baixar", cad_modelo_baixar)
    rota("/cadastros/modelos/<int:mid>/versao/<int:vid>/baixar", cad_modelo_baixar)
    rota("/cadastros/modelos/<int:mid>/campo/salvar", cad_modelo_campo_salvar, ["POST"])
    rota("/cadastros/modelos/<int:mid>/campo/<int:cid>/excluir", cad_modelo_campo_excluir, ["POST"])
