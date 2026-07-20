# -*- coding: utf-8 -*-
"""Diagnóstico do envio de e-mail do Painel — ferramenta de operação.

Confere o caminho de envio (Gmail API e SMTP), os destinatários da Coordenação e os
últimos eventos de e-mail na timeline (entrega real). NÃO imprime segredos/tokens.

Uso (no servidor, com a env do Painel):  python webapp/verificar_email.py
Saída: 0 = há caminho de envio e a última notificação saiu (ou não há histórico);
       1 = nenhum caminho configurado OU a última notificação falhou (pendente).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "tools"))


def _checa_gmail():
    print("1) GMAIL API (porta 443 — contorna bloqueio de SMTP)")
    try:
        import gmail_api as G
    except Exception as e:
        print("   erro ao importar gmail_api:", type(e).__name__, e)
        return False
    print("   credencial (gmail_client.json):", "presente" if G.tem_client() else "AUSENTE")
    print("   token (gmail_token.json)      :", "presente" if G.configurado() else "AUSENTE")
    if not G.configurado():
        return False
    try:
        creds = G._creds()
    except Exception as e:
        print("   validação do token FALHOU:", type(e).__name__, "-", str(e)[:140])
        return False
    if creds is None:
        print("   token INVÁLIDO/expirado sem refresh — refaça Config → Gmail API → Autorizar.")
        return False
    print("   token VÁLIDO -> envio pelo Gmail habilitado.")
    return True


def _checa_smtp():
    print("2) SMTP (fallback — costuma ser bloqueado pela rede corporativa)")
    try:
        import mailer as M
        c = M.load_cfg()
    except Exception as e:
        print("   erro ao importar mailer:", type(e).__name__, e)
        return False
    ok = bool(c.get("host") and c.get("remetente"))
    print("   host:", "definido" if c.get("host") else "ausente",
          "| remetente:", "definido" if c.get("remetente") else "ausente",
          "| senha:", "definida" if c.get("senha") else "ausente")
    print("   SMTP", "configurado." if ok else "NÃO configurado.")
    return ok


def _checa_banco():
    """Destinatários + últimos eventos de e-mail. Só roda se houver banco configurado.
    Retorna: None (sem banco) | True (última notificação saiu) | False (última falhou)."""
    if not (os.environ.get("PAINEL_DB_URL") or os.environ.get("PAINEL_DB")):
        print("3) BANCO: PAINEL_DB_URL/PAINEL_DB não definidos neste shell — pulei.")
        print("   (rode no servidor, com a env do Painel, para ver destinatários e timeline.)")
        return None
    print("3) DESTINATÁRIOS + TIMELINE (banco real)")
    try:
        import db
        dest = [u["login"] for u in db.usuarios_por_perfil("ADM") + db.usuarios_por_perfil("Coordenador")
                if u["login"]]
        print("   destinatários da Coordenação (ADM+Coordenador):", len(dest))
        if not dest:
            print("   >>> SEM destinatários: a notificação por evento não tem para quem ir.")
        with db.Session() as s:
            evs = (s.query(db.Evento).filter(db.Evento.tipo == "email")
                   .order_by(db.Evento.criado_em.desc()).limit(10).all())
        if not evs:
            print("   (nenhum evento de e-mail na timeline ainda)")
            return None
        pend = sum(1 for e in evs if (e.descricao or "").startswith("Notificação pendente"))
        print("   últimos %d eventos de e-mail (%d pendente(s)):" % (len(evs), pend))
        for e in evs:
            print("    ", e.criado_em.strftime("%d/%m %H:%M"), "|", (e.descricao or "")[:88])
        ultimo_falhou = (evs[0].descricao or "").startswith("Notificação pendente")
        return not ultimo_falhou
    except Exception as e:
        print("   erro ao consultar o banco:", type(e).__name__, str(e)[:140])
        return None


def main():
    print("=" * 64)
    gmail_ok = _checa_gmail()
    print("=" * 64)
    smtp_ok = _checa_smtp()
    print("=" * 64)
    entrega = _checa_banco()
    print("=" * 64)
    print("VEREDITO:")
    if not (gmail_ok or smtp_ok):
        print("  ✗ NENHUM caminho de envio configurado. Configure o Gmail API (Config → Gmail API)")
        print("    — passos em docs/runbooks-operacao.md §3.")
        return 1
    if gmail_ok:
        print("  ✓ Gmail API autorizado — envio pela porta 443.")
    elif smtp_ok:
        print("  ⚠ Apenas SMTP configurado. Se a rede bloquear SMTP (erro 'TimeoutError'),")
        print("    a entrega falha — configure o Gmail API (runbook §3).")
    if entrega is False:
        print("  ✗ A ÚLTIMA notificação ficou 'pendente' — a entrega está FALHANDO agora.")
        return 1
    if entrega is True:
        print("  ✓ A última notificação saiu ('Notificou …').")
    return 0


if __name__ == "__main__":
    sys.exit(main())
