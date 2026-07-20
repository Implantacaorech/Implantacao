# -*- coding: utf-8 -*-
"""Rotas de geração de documentos, Levantamento e gate de origem do Projeto
(/projetos/<pid>/gerar*, /projeto/origem, /levantamento, /editar/<doc>).
Os documentos de fase são gerados FIELMENTE pelos layouts cadastrados.
Separadas do app.py (ver register())."""
import logging
import os

import _common as C
import db
import runner
from flask import request, render_template, redirect, url_for, abort

# Injetados por register():
pode_gerar = _etapa_permite_gerar = _autor = None
_notificar_evento = _auto_avancar = _perfil = None
_EVT_DOC = {}
_ETAPA_DOC = {}
UPLOADS = ""

# Documentos de fase gerados FIELMENTE pelos layouts cadastrados (troca só placeholders).
_LAYOUT_SLUGS = ("levantamento", "projeto", "cronograma", "termo")


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
    import docview
    docview.preaquecer(path)   # converte o PDF do 'Ver' em segundo plano (1º acesso instantâneo)
    return path


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


def register(app, **deps):
    globals().update(deps)   # pode_gerar, _etapa_permite_gerar, _autor, _notificar_evento,
                             # _auto_avancar, _perfil, _EVT_DOC, _ETAPA_DOC, UPLOADS
    GP = ["GET", "POST"]
    rota = lambda regra, fn, metodos=None: app.add_url_rule(regra, view_func=fn, methods=metodos)
    rota("/projetos/<int:pid>/gerar_pendentes", projeto_gerar_pendentes, ["POST"])
    rota("/projetos/<int:pid>/gerar/<tipo>", projeto_gerar, ["POST"])
    rota("/projetos/<int:pid>/gerar-layout/<slug>", projeto_gerar_layout, ["POST"])
    rota("/projetos/<int:pid>/gerar_projeto", projeto_gerar_projeto, ["POST"])
    rota("/projetos/<int:pid>/projeto/origem", projeto_origem, GP)
    rota("/projetos/<int:pid>/levantamento", projeto_levantamento, GP)
    rota("/projetos/<int:pid>/editar/<doc>", projeto_doc_editar, GP)
