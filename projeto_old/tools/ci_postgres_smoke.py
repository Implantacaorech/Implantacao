# -*- coding: utf-8 -*-
"""Smoke de paridade Postgres (achado F-08 da auditoria 2026-07-10).

A suíte principal (`webapp/test_painel.py`) roda sempre contra SQLite, de propósito (isolamento
de teste). Este script confere, à parte, que o schema (create_all + _auto_migrar) sobe sem erro
contra um Postgres real — só usado pelo job `test-postgres` do CI, com `PAINEL_DB_URL` apontando
para o serviço Postgres do runner.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "webapp"))
sys.path.insert(0, HERE)

if not os.environ.get("PAINEL_DB_URL"):
    sys.exit("PAINEL_DB_URL não definida — este script é só para rodar contra um Postgres real.")

import db  # noqa: E402

db.init_db()
sessao = db.Session()
try:
    n = sessao.query(db.Projeto).count()
    print(f"ok: schema Postgres criado e migrado (projetos={n})")
finally:
    sessao.close()
