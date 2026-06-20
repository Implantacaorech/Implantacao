# -*- coding: utf-8 -*-
"""Gera ia_admin/dados.js a partir de ia_admin/uso-cloud.yaml.

Mantenha SÓ o uso-cloud.yaml; rode este script para a tela refletir as mudanças:

    python ia_admin/gerar_painel.py

O painel-uso-cloud.html carrega dados.js via <script src> (funciona offline, no
duplo clique / file://, onde fetch() de arquivo local é bloqueado pelo navegador).
"""
import os
import json

try:
    import yaml
except ImportError:
    raise SystemExit("PyYAML não instalado. Rode: python -m pip install pyyaml")

AQUI = os.path.dirname(os.path.abspath(__file__))


def main():
    origem = os.path.join(AQUI, "uso-cloud.yaml")
    if not os.path.exists(origem):
        raise SystemExit("Não encontrei %s" % origem)
    with open(origem, encoding="utf-8") as f:
        dados = yaml.safe_load(f) or {}
    payload = {
        "atualizado_em": dados.get("atualizado_em", ""),
        "sessoes": dados.get("sessoes", []) or [],
    }
    # default=str: datas YAML (date) viram texto ISO (json não serializa date nativamente)
    js = ("// GERADO por gerar_painel.py a partir de uso-cloud.yaml — NÃO editar à mão.\n"
          "window.IA_DADOS = " + json.dumps(payload, ensure_ascii=False, indent=2, default=str) + ";\n")
    destino = os.path.join(AQUI, "dados.js")
    with open(destino, "w", encoding="utf-8") as f:
        f.write(js)
    print("OK: %d sessão(ões) -> %s" % (len(payload["sessoes"]), destino))


if __name__ == "__main__":
    main()
