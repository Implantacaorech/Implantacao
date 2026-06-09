# -*- coding: utf-8 -*-
"""Executor: roda os geradores, o importador, o conversor e o verificador.
Ciente de empacotamento (.exe): grava em pasta gravável via _common."""
import os
import re
import io
import sys
import contextlib
import importlib

HERE = os.path.dirname(os.path.abspath(__file__))
if not getattr(sys, "frozen", False):
    TOOLS = os.path.join(os.path.dirname(HERE), "tools")
    if TOOLS not in sys.path:
        sys.path.insert(0, TOOLS)

import _common as C   # noqa: E402

DATA = C.DATA_WRITE   # pasta gravável (= tools/data no modo normal)


def run_generator(modname, yaml_basename=None):
    """Roda gerar_*.main(); retorna (caminho_do_arquivo, log)."""
    mod = importlib.import_module(modname)
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        mod.main("data/" + yaml_basename) if yaml_basename else mod.main()
    out = buf.getvalue().strip()
    matches = re.findall(r"-> (.+)", out)
    return (matches[-1].strip() if matches else None), out


def save_upload_yaml(file_storage, slug_fn):
    """Salva um .yaml enviado em <gravável>/upload_<slug>.yaml e devolve o basename."""
    base = "upload_" + slug_fn(os.path.splitext(file_storage.filename)[0]) + ".yaml"
    file_storage.save(os.path.join(DATA, base))
    return base


def run_import(docx_path):
    """Importa o levantamento .docx -> projeto_<cliente>.yaml (com conversão verbal)."""
    import importar_mapeamento as I
    import yaml as _yaml
    data = I.extract(docx_path)
    ydict = I.to_yaml_dict(data, aplicar_verbal=True)
    nome = data.get("client_name") or "cliente"
    out = os.path.join(DATA, "projeto_%s.yaml" % C.slug(nome))
    with open(out, "w", encoding="utf-8") as f:
        f.write("# Gerado pelo Painel a partir do levantamento. Revisar antes de gerar.\n")
        f.write("# Rotinas já no FUTURO (conversão verbal aplicada).\n")
        _yaml.safe_dump(ydict, f, allow_unicode=True, sort_keys=False, width=100)
    return out, data


def converter_verbal(texto):
    import conversor_verbal as V
    return V.converter_texto(texto)


def run_saude():
    import verificar
    verificar.R.clear()
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        code = verificar.main()
    return code, buf.getvalue()


def catalogo_por_area():
    """[(area, [módulos])] de TODO o catálogo, para a tela de seleção."""
    import catalogo as CAT
    return CAT.por_area(CAT.load())


def gerar_levantamento_form(form, modulos):
    """Monta o levantamento.yaml a partir do formulário (campos + módulos marcados)
    e gera o documento. Retorna (caminho, log)."""
    import yaml as _yaml
    nome = (form.get("cliente") or "Cliente").strip()
    doc = {
        "cliente": nome,
        "data": form.get("data", ""),
        "responsaveis": form.get("responsaveis", ""),
        "identificacao": {
            "razao_social": nome,
            "ramo": form.get("ramo", ""),
            "produto": form.get("produto", ""),
            "fornecedor_atual": form.get("fornecedor_atual", ""),
            "localizacao": form.get("localizacao", ""),
            "observacoes_objetivos": form.get("observacoes", ""),
        },
        "modulos_contratados": modulos,
    }
    base = "lev_" + C.slug(nome) + ".yaml"
    with open(os.path.join(DATA, base), "w", encoding="utf-8") as f:
        _yaml.safe_dump(doc, f, allow_unicode=True, sort_keys=False, width=120)
    return run_generator("gerar_levantamento", base)
