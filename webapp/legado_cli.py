# -*- coding: utf-8 -*-
"""Ponte de linha de comando para o assistente administrativo legado (cliente/role/
seleção de módulos/criar templates/tempo verbal/saúde/action) — chamado pelo NestJS via
subprocesso (nunca HTTP), para não misturar esse gerador antigo (tools/gerar_*.py,
catalogo.py, conversor_verbal.py, importar_mapeamento.py) com o docservice novo, cujo
escopo documentado (docs/migracao/02-decisao-arquitetura.md) é só a geração fiel + a
transcrição. Reaproveita webapp/runner.py, roles.py e forms.py TAL COMO SÃO — nenhuma
lógica de geração é reescrita aqui, só o encaixe de entrada/saída (JSON em vez de
Flask request/session).

Contrato: lê um único objeto JSON da stdin (`{"acao": "...", ...}`), imprime uma única
linha JSON na stdout: `{"ok": true, "data": {...}}` ou `{"ok": false, "erro": "..."}`.
"""
import io
import json
import os
import sys

if not sys.flags.utf8_mode:
    raise RuntimeError(
        "legado_cli precisa rodar em UTF-8 mode (PYTHONUTF8=1 ou -X utf8) — sem isso, "
        "texto acentuado sai corrompido (mesma lição de docservice/main.py)."
    )

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import runner  # noqa: E402  (insere tools/ no sys.path como efeito colateral do import)
import roles  # noqa: E402
import forms  # noqa: E402
import _common as C  # noqa: E402


class _FormShim:
    """Imita o suficiente de flask.request.form (.get/.getlist) para reusar runner.py/
    forms.py sem alterá-los — os valores chegam como dict {chave: str | [str, ...]}."""

    def __init__(self, dados):
        self._dados = dados or {}

    def get(self, chave, default=""):
        v = self._dados.get(chave, default)
        if isinstance(v, list):
            return v[0] if v else default
        return default if v is None else v

    def getlist(self, chave):
        v = self._dados.get(chave, [])
        if isinstance(v, list):
            return v
        return [v] if v not in (None, "") else []


class _FileShim:
    """Imita werkzeug.FileStorage (.filename/.save) a partir de um arquivo já salvo em
    disco pelo NestJS (Multer) — evita reescrever runner.converter_docx/save_upload_yaml."""

    def __init__(self, caminho, nome_original=None):
        self._caminho = caminho
        self.filename = nome_original or os.path.basename(caminho)

    def save(self, destino):
        import shutil

        shutil.copyfile(self._caminho, destino)


def _acao_ia_status(_payload):
    try:
        import ia

        return {"ativa": ia.disponivel(), "modelo": ia.MODELO}
    except Exception:
        return {"ativa": False, "modelo": ""}


def _acao_saude(_payload):
    code, relatorio = runner.run_saude()
    return {"code": code, "relatorio": relatorio}


def _acao_catalogo_por_area(_payload):
    grupos = runner.catalogo_por_area()
    return {"grupos": [{"area": area, "modulos": mods} for area, mods in grupos]}


def _acao_cliente_yaml(payload):
    base, nome = forms.build_cliente_yaml(_FormShim(payload.get("form")), runner.DATA, C.slug)
    return {"arquivo": base, "nome": nome}


def _acao_criar_templates(payload):
    return runner.criar_templates(_FormShim(payload.get("form")))


def _acao_converter_verbal_texto(payload):
    novo, mudancas = runner.converter_verbal(payload.get("texto") or "")
    return {"depois": novo, "mudancas": mudancas}


def _acao_converter_verbal_docx(payload):
    arquivo = runner.converter_docx(_FileShim(payload["caminho"], payload.get("nomeOriginal")))
    return {"arquivo": arquivo}


def _acao_gerar_levantamento_form(payload):
    caminho, log = runner.gerar_levantamento_form(_FormShim(payload.get("form")), payload.get("modulos") or [])
    return {"arquivo": caminho, "log": log}


def _acao_gerar_checklist_form(payload):
    caminho, log = runner.gerar_checklist_form(_FormShim(payload.get("form")), payload.get("modulos") or [])
    return {"arquivo": caminho, "log": log}


def _acao_run_sequencia(payload):
    return runner.run_sequencia(payload["caminho"])


def _acao_save_upload_yaml(payload):
    base = runner.save_upload_yaml(_FileShim(payload["caminho"], payload.get("nomeOriginal")), C.slug)
    return {"arquivo": base}


def _acao_gerar(payload):
    caminho, log = runner.run_generator(payload["mod"], payload.get("yamlBasename"))
    return {"arquivo": caminho, "log": log}


_ACOES = {
    "ia_status": _acao_ia_status,
    "saude": _acao_saude,
    "catalogo_por_area": _acao_catalogo_por_area,
    "cliente_yaml": _acao_cliente_yaml,
    "criar_templates": _acao_criar_templates,
    "converter_verbal_texto": _acao_converter_verbal_texto,
    "converter_verbal_docx": _acao_converter_verbal_docx,
    "gerar_levantamento_form": _acao_gerar_levantamento_form,
    "gerar_checklist_form": _acao_gerar_checklist_form,
    "run_sequencia": _acao_run_sequencia,
    "save_upload_yaml": _acao_save_upload_yaml,
    "gerar": _acao_gerar,
}


def main():
    entrada = sys.stdin.buffer.read().decode("utf-8")
    payload = json.loads(entrada) if entrada.strip() else {}
    acao = payload.get("acao")
    fn = _ACOES.get(acao)
    saida = sys.stdout
    if fn is None:
        print(json.dumps({"ok": False, "erro": "ação desconhecida: %s" % acao}, ensure_ascii=False), file=saida)
        return
    try:
        dados = fn(payload)
        print(json.dumps({"ok": True, "data": dados}, ensure_ascii=False), file=saida)
    except Exception as e:  # nunca deixa o subprocesso morrer sem JSON de resposta
        print(
            json.dumps({"ok": False, "erro": "%s: %s" % (type(e).__name__, e)}, ensure_ascii=False),
            file=saida,
        )


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    main()
