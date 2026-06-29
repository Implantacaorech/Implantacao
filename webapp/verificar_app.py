# -*- coding: utf-8 -*-
"""Smoke check rápido (segundos) do app Flask — guarda contra regressões de roteamento.

Confirma que o app importa, que os 8 módulos de rotas continuam registrados (um endpoint
representativo de cada) e que o `url_for` dos endpoints críticos funciona. Use ANTES de cada
push e SEMPRE após um pull que traga mudanças do MANUS (que às vezes sobrescreve app.py).

Uso:  python webapp/verificar_app.py        (sai 0 = ok, 1 = falhou)
"""
import os
import sys

# Banco em memória e sem login para subir o app sem efeitos colaterais.
os.environ["PAINEL_DB"] = ":memory:"
os.environ.pop("PAINEL_DB_URL", None)
os.environ.pop("PAINEL_SENHA", None)

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "tools"))

# (endpoint, kwargs do url_for) — um representativo por módulo de rota + núcleo.
# Acrescentar rotas é livre; a AUSÊNCIA de um destes sinaliza que o registro quebrou.
CRITICOS = [
    ("home", {}),                                   # routes_painel
    ("coordenacao", {}),                            # routes_painel
    ("monitoramento", {}),                          # routes_painel
    ("login", {}),                                  # núcleo
    ("usuarios", {}),                               # núcleo
    ("projetos", {}),                               # núcleo
    ("projeto_ficha", {"pid": 1}),                  # núcleo
    ("projeto_agenda", {"pid": 1}),                 # routes_agenda
    ("projeto_agenda_alocar", {"pid": 1}),          # routes_agenda
    ("config", {}),                                 # routes_config
    ("cad_checklist", {}),                          # routes_cadastros
    ("projeto_cronograma", {"pid": 1}),             # routes_cronograma
    ("projeto_checklist", {"pid": 1}),              # routes_cronograma
    ("projeto_origem", {"pid": 1}),                 # routes_geracao
    ("projeto_gerar", {"pid": 1, "tipo": "termo"}),  # routes_geracao
    ("projeto_levantamento", {"pid": 1}),           # routes_geracao
    ("projeto_designar", {"pid": 1}),               # routes_designacao
    ("projeto_definir_gci", {"pid": 1}),            # routes_designacao
    ("fluxo_inicio", {}),                           # routes_fluxo
    ("projeto_email", {"pid": 1}),                  # routes_fluxo
    ("mapa", {}),                                   # routes_fluxo
    ("projeto_doc_ver", {"pid": 1, "doc_id": 1}),   # routes_fluxo
]


def main():
    try:
        import app as A
    except Exception as e:
        print("FALHOU: app nao importou -> %s: %s" % (type(e).__name__, e))
        return 1

    rules = {r.endpoint for r in A.app.url_map.iter_rules()}
    faltando = [ep for ep, _ in CRITICOS if ep not in rules]
    if faltando:
        print("FALHOU: endpoints ausentes (registro de rotas quebrado?): %s" % ", ".join(faltando))
        return 1

    erros = []
    with A.app.test_request_context():
        from flask import url_for
        for ep, kw in CRITICOS:
            try:
                url_for(ep, **kw)
            except Exception as e:
                erros.append("%s (%s)" % (ep, type(e).__name__))
    if erros:
        print("FALHOU: url_for nao resolveu: %s" % ", ".join(erros))
        return 1

    print("OK: app importou; %d endpoints criticos registrados e url_for resolvendo." % len(CRITICOS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
