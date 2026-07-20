# -*- coding: utf-8 -*-
"""Verificação COMPLETA de operação do Painel — um comando, um veredito.

Roda em sequência: rotas (smoke), banco, e-mail, disponibilidade e backup.
Uso (no servidor, com a env do Painel):  python webapp/verificar_tudo.py
Saída: 0 = tudo essencial OK; 1 = alguma checagem essencial falhou.
"""
import os
import sys
import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "tools"))

FALHAS, AVISOS = [], []


def _sec(nome):
    print("=" * 64)
    print(nome)


def checa_rotas():
    _sec("1) ROTAS / APP (smoke)")
    import subprocess
    r = subprocess.run([sys.executable, os.path.join(HERE, "verificar_app.py")],
                       capture_output=True, text=True, timeout=120)
    print("  ", (r.stdout or r.stderr).strip().splitlines()[-1])
    if r.returncode != 0:
        FALHAS.append("rotas/app (verificar_app)")


def checa_banco():
    _sec("2) BANCO DE DADOS")
    try:
        import db
        with db.Session() as s:
            n = s.query(db.Projeto).count()
            u = s.query(db.Usuario).filter(db.Usuario.ativo == 1).count()
        print("   conexão OK (%s) — %d projeto(s), %d usuário(s) ativo(s)." % (db.engine.dialect.name, n, u))
    except Exception as e:
        print("   FALHOU: %s: %s" % (type(e).__name__, str(e)[:160]))
        FALHAS.append("banco de dados")


def checa_email():
    _sec("3) E-MAIL (envio)")
    try:
        import gmail_api as G
        gmail_ok = False
        if G.configurado():
            try:
                gmail_ok = G._creds() is not None
            except Exception:
                gmail_ok = False
        import mailer as M
        c = M.load_cfg()
        smtp_ok = bool(c.get("host") and c.get("remetente"))
        if gmail_ok:
            print("   Gmail API autorizado (porta 443) — OK.")
        elif smtp_ok:
            print("   Apenas SMTP configurado — se a rede bloquear (TimeoutError), a entrega falha.")
            AVISOS.append("e-mail só por SMTP (configure a Gmail API — runbook §3)")
        else:
            print("   NENHUM caminho de envio configurado.")
            FALHAS.append("e-mail (nenhum caminho de envio)")
        import db
        with db.Session() as s:
            ev = (s.query(db.Evento).filter(db.Evento.tipo == "email")
                  .order_by(db.Evento.criado_em.desc()).first())
        if ev and (ev.descricao or "").startswith("Notificação pendente"):
            print("   Última notificação ficou PENDENTE (entrega falhando).")
            FALHAS.append("e-mail (última notificação pendente)")
        elif ev:
            print("   Última notificação saiu OK.")
    except Exception as e:
        print("   erro na checagem: %s: %s" % (type(e).__name__, str(e)[:160]))
        AVISOS.append("checagem de e-mail incompleta")


def checa_disponibilidade():
    _sec("4) DISPONIBILIDADE (agenda x SICLA)")
    try:
        import disponibilidade as D
        if not D.configurado():
            print("   não configurada (calendário fica liberado, sem checagem).")
            AVISOS.append("disponibilidade não configurada")
            return
        import time
        hoje = datetime.date.today()
        t0 = time.time()
        linhas = D.consultar(hoje.isoformat(), (hoje + datetime.timedelta(days=7)).isoformat(),
                             None if not D.filtra_por_tecnico() else [])
        print("   conexão OK — consulta de 7 dias em %.1fs (%d linha(s))."
              % (time.time() - t0, len(linhas)))
        print("   SELECT filtra por :tecnicos?", "sim" if D.filtra_por_tecnico() else "NÃO (janela fica na semana)")
    except Exception as e:
        print("   FALHOU: %s: %s" % (type(e).__name__, str(e)[:160]))
        FALHAS.append("disponibilidade (conexão/SELECT)")


def checa_backup():
    _sec("5) BACKUP DO POSTGRES")
    pasta = r"C:\PainelBackups"
    try:
        dumps = sorted((f for f in os.listdir(pasta) if f.startswith("painel_") and f.endswith(".sql.gz")),
                       reverse=True)
    except OSError:
        print("   pasta %s inacessível — backup não verificado." % pasta)
        AVISOS.append("backup não verificado (pasta inacessível)")
        return
    if not dumps:
        print("   NENHUM dump encontrado em %s." % pasta)
        FALHAS.append("backup (nenhum dump)")
        return
    ultimo = os.path.join(pasta, dumps[0])
    idade_h = (datetime.datetime.now()
               - datetime.datetime.fromtimestamp(os.path.getmtime(ultimo))).total_seconds() / 3600
    tam = os.path.getsize(ultimo)
    print("   último: %s (%.0fh atrás, %d KB) — %d dump(s) na pasta." % (dumps[0], idade_h, tam // 1024, len(dumps)))
    if idade_h > 48:
        FALHAS.append("backup (último dump com mais de 48h)")
    elif tam < 1024:
        AVISOS.append("backup: último dump muito pequeno (<1 KB) — conferir")


def main():
    checa_rotas()
    checa_banco()
    checa_email()
    checa_disponibilidade()
    checa_backup()
    _sec("VEREDITO")
    for a in AVISOS:
        print("   ⚠  " + a)
    if FALHAS:
        for f in FALHAS:
            print("   ✗  " + f)
        print("   => %d falha(s) essencial(is)." % len(FALHAS))
        return 1
    print("   ✓  Tudo essencial OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
