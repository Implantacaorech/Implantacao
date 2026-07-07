# -*- coding: utf-8 -*-
"""Robô de integridade: roda TODAS as verificações do Painel e alerta em falha.

O que roda (nesta ordem):
  1. verificar_tudo.py  — operação: rotas (smoke), banco, e-mail, disponibilidade, backup.
  2. pytest test_painel.py — a suíte completa (banco de teste zerado antes, p/ rodada limpa).

Resultado: linha no log C:\\PainelBackups\\integridade.log (junto do backup do banco) e,
em FALHA, e-mail de alerta para INTEGRIDADE_PARA (env) ou para a Coordenação (ADM/
Coordenador do cadastro). Sai 0 = tudo ok, 1 = algo falhou.

Agendado no Windows (Task Scheduler, diário) por Verificar_Integridade.bat — ver runbook §10.
Uso manual:  python webapp/robo_integridade.py
"""
import os
import sys
import subprocess
import tempfile
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
LOG = r"C:\PainelBackups\integridade.log"


def _run(nome, args, timeout=900):
    env = dict(os.environ, PYTHONUTF8="1")
    try:
        r = subprocess.run(args, cwd=HERE, env=env, capture_output=True,
                           text=True, timeout=timeout)
        saida = (r.stdout or "") + (r.stderr or "")
        return r.returncode == 0, "%s: %s" % (nome, saida.strip().splitlines()[-1] if saida.strip() else "sem saída")
    except Exception as e:
        return False, "%s: %s: %s" % (nome, type(e).__name__, e)


def _alerta(resumo, detalhes):
    """E-mail de falha: INTEGRIDADE_PARA (env, ; separado) ou a Coordenação do cadastro."""
    try:
        sys.path.insert(0, HERE)
        sys.path.insert(0, os.path.join(os.path.dirname(HERE), "tools"))
        import mailer
        dest = [x.strip() for x in os.environ.get("INTEGRIDADE_PARA", "").split(";") if x.strip()]
        if not dest:
            import db
            with db.Session() as s:
                dest = [u.login for u in s.query(db.Usuario)
                        .filter(db.Usuario.perfil.in_(["ADM", "Coordenador"]),
                                db.Usuario.ativo == 1).all() if u.login and "@" in u.login]
        if dest and mailer.configurado():
            mailer.enviar(dest, "⚠ Painel — verificação de integridade FALHOU",
                          "Verificação automática do Painel de Implantação falhou em %s.\n\n%s\n\n"
                          "Detalhes no log: %s" % (datetime.now().strftime("%d/%m/%Y %H:%M"),
                                                   detalhes, LOG))
            return True
    except Exception:
        pass
    return False


def _site_no_ar():
    """O Painel está respondendo AGORA? (falha real: servidor cai e ninguém percebe)."""
    import urllib.request
    url = "http://localhost:%s/health" % os.environ.get("PAINEL_PORT", "5000")
    try:
        with urllib.request.urlopen(url, timeout=8) as r:
            return r.status == 200, "site no ar: %s -> %d" % (url, r.status)
    except Exception as e:
        return False, "site FORA DO AR (%s): %s" % (url, type(e).__name__)


def main():
    resultados = []

    resultados.append(_site_no_ar())

    ok1, msg1 = _run("verificar_tudo", [sys.executable, os.path.join(HERE, "verificar_tudo.py")])
    resultados.append((ok1, msg1))

    # suíte completa em banco de teste zerado (mesma rodada limpa do CI manual)
    try:
        p = os.path.join(tempfile.gettempdir(), "painel_pytest.db")
        if os.path.exists(p):
            os.remove(p)
    except OSError:
        pass
    ok2, msg2 = _run("pytest", [sys.executable, "-m", "pytest",
                                os.path.join(HERE, "test_painel.py"), "-q", "--tb=line"])
    resultados.append((ok2, msg2))

    tudo_ok = all(ok for ok, _ in resultados)
    detalhes = "\n".join(("[OK] " if ok else "[FALHOU] ") + m for ok, m in resultados)
    linha = "%s %s | %s" % (datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            "ok" if tudo_ok else "FALHOU", detalhes.replace("\n", " || "))
    try:
        os.makedirs(os.path.dirname(LOG), exist_ok=True)
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(linha + "\n")
    except OSError:
        pass
    print(detalhes)
    if not tudo_ok:
        _alerta("integridade falhou", detalhes)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
