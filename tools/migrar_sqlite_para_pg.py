# -*- coding: utf-8 -*-
"""Migra os dados do Painel de SQLite para PostgreSQL (Docker).

Copia projetos, documentos e eventos preservando os IDs e reseta as sequências
do Postgres (para os próximos inserts não colidirem).

Uso:
    python migrar_sqlite_para_pg.py ^
        --sqlite "C:\\Users\\everton\\AppData\\Local\\PainelImplantacao\\data\\painel.db" ^
        --pg "postgresql+psycopg2://painel:SENHA@localhost:5432/painel" [--force]

Sem --sqlite usa o caminho padrão do .exe; sem --pg usa a env PAINEL_DB_URL.
"""
import os
import sys
import argparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "webapp"))
sys.path.insert(0, HERE)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sqlite", help="caminho do .db de origem")
    ap.add_argument("--pg", help="URL do Postgres de destino (ou env PAINEL_DB_URL)")
    ap.add_argument("--force", action="store_true", help="limpa o destino antes de copiar")
    a = ap.parse_args()

    src = a.sqlite or os.path.join(os.environ.get("LOCALAPPDATA", ""),
                                   "PainelImplantacao", "data", "painel.db")
    dst = a.pg or os.environ.get("PAINEL_DB_URL")
    if not os.path.exists(src):
        sys.exit("Origem SQLite não encontrada: %s" % src)
    if not dst or dst.startswith("sqlite"):
        sys.exit("Destino inválido: informe --pg (postgresql://...) ou a env PAINEL_DB_URL.")

    os.environ["PAINEL_DB_URL"] = dst       # o db monta o engine de destino
    import db
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker

    src_engine = create_engine("sqlite:///" + src)
    Src = sessionmaker(bind=src_engine)
    db.Base.metadata.create_all(db.engine)  # garante as tabelas no destino

    modelos = [("projetos", db.Projeto), ("documentos", db.Documento), ("eventos", db.Evento)]
    with Src() as ss, db.Session() as ds:
        existentes = ds.query(db.Projeto).count()
        if existentes and not a.force:
            sys.exit("Destino já tem %d projeto(s). Use --force para sobrescrever." % existentes)
        if a.force:
            for _, M in reversed(modelos):
                ds.query(M).delete()
            ds.commit()
        total = {}
        for nome, M in modelos:
            n = 0
            for row in ss.query(M).all():
                ds.add(M(**db.to_dict(row)))
                n += 1
            ds.commit()
            total[nome] = n
        if db.engine.dialect.name == "postgresql":
            for nome, _ in modelos:
                ds.execute(text("SELECT setval(pg_get_serial_sequence('%s','id'), "
                                "COALESCE((SELECT MAX(id) FROM %s),1))" % (nome, nome)))
            ds.commit()
    print("Migração concluída:", total)


if __name__ == "__main__":
    main()
