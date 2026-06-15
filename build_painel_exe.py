# -*- coding: utf-8 -*-
"""
build_painel_exe.py
-------------------
Gera o executável único (.exe) do **Painel de Implantação** (app Flask),
embutindo Python, bibliotecas (Flask, python-docx, openpyxl, PyYAML, lxml),
os templates/estáticos da web, os geradores e o letterhead.

Padrão herdado de GeradorProjetoSIGER/build_exe.py: build em %TEMP%, cópia
para fora do OneDrive e tratamento de "placeholder de nuvem" (ReparsePoint).

Uso (somente na máquina que GERA o .exe):
    pip install pyinstaller flask python-docx openpyxl pyyaml
    python build_painel_exe.py [pasta_destino]
"""
import os
import sys
import shutil
import tempfile
import subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(BASE, "webapp", "app.py")
NAME = "PainelImplantacao"

# Módulos importados dinamicamente (importlib) — o PyInstaller não os detecta.
HIDDEN = [
    "roles", "runner", "forms", "db", "mailer", "fluxo", "imap_intake", "_common",
    "schema_projeto", "conversor_verbal",
    "importar_mapeamento", "verificar", "catalogo", "checklist", "ortografia", "ia",
    "gerar_kit_mudanca", "gerar_roteiros_teste", "gerar_aceite_uat",
    "gerar_reconciliacao_conversao", "gerar_painel_hypercare", "gerar_log_fitgap",
    "gerar_painel_kpi", "gerar_raid", "gerar_dossie_cliente",
    "gerar_projeto_implantacao", "gerar_termo_encerramento", "gerar_levantamento",
    "gerar_checklist_consultor", "gerar_cronograma",
    "psycopg2",   # driver Postgres (PAINEL_DB_URL; opcional em runtime)
    "waitress",   # servidor WSGI de produção
]

# Dados embutidos (origem -> destino no bundle).
DATA_ADDS = [
    ("webapp/templates", "webapp/templates"),
    ("webapp/static", "webapp/static"),
    ("tools/data", "tools/data"),
    ("tools/templates", "tools/templates"),   # letterhead (.docx) embutido
]

EXCLUDES = ["numpy", "pandas", "scipy", "matplotlib", "PIL", "IPython",
            "pytest", "PyQt5", "PySide2", "notebook"]


def _is_reparse_point(path):
    try:
        import stat as _stat
        return bool(os.stat(path).st_file_attributes & _stat.FILE_ATTRIBUTE_REPARSE_POINT)
    except Exception:
        return False


def main():
    if not os.path.exists(APP):
        sys.exit("ERRO: webapp/app.py não encontrado.")
    # checagem amigável do letterhead embutido
    tdir = os.path.join(BASE, "tools", "templates")
    faltando = [f for f in ("base_projeto_tokenizado.docx",) if not os.path.exists(os.path.join(tdir, f))]
    if faltando:
        print("AVISO: faltam templates em tools/templates/:", ", ".join(faltando))
        print("       (o gerador de Projeto não funcionará no .exe sem eles)")

    # Destino padrão fixo (por solicitação): Desktop LOCAL (fora do OneDrive).
    final_dir = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\everton\Desktop\PainelImplantacao"
    os.makedirs(final_dir, exist_ok=True)

    workdir = os.path.join(tempfile.gettempdir(), "painel_build")
    os.makedirs(workdir, exist_ok=True)
    sep = ";" if os.name == "nt" else ":"

    cmd = [sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean",
           "--onefile", "--noupx", "--name", NAME,
           "--paths", os.path.join(BASE, "tools"),
           "--paths", os.path.join(BASE, "webapp"),
           "--collect-data", "docx",            # default.docx do python-docx
           "--collect-all", "anthropic",        # SDK do modo IA (Claude)
           "--collect-data", "certifi",         # bundle de CAs p/ HTTPS
           "--workpath", os.path.join(workdir, "build"),
           "--distpath", os.path.join(workdir, "dist"),
           "--specpath", workdir]
    for src, dst in DATA_ADDS:
        cmd += ["--add-data", f"{os.path.join(BASE, src)}{sep}{dst}"]
    for h in HIDDEN:
        cmd += ["--hidden-import", h]
    for m in EXCLUDES:
        cmd += ["--exclude-module", m]
    cmd.append(APP)

    print(">> PyInstaller…\n   " + " ".join(f'"{c}"' if " " in c else c for c in cmd))
    subprocess.run(cmd, check=True)

    built = os.path.join(workdir, "dist", NAME + ".exe")
    if not os.path.exists(built):
        sys.exit("ERRO: PyInstaller não produziu o .exe.")
    print(">> .exe: %s  (%.1f MB)" % (built, os.path.getsize(built) / 1048576))

    final = os.path.join(final_dir, NAME + ".exe")
    shutil.copy2(built, final)
    if _is_reparse_point(final):
        try:
            subprocess.run(["attrib", "+P", "-U", final], check=False, shell=True)
        except Exception:
            pass
    print("\nCONCLUÍDO. Distribua apenas:\n   " + final)
    print("Os documentos gerados ficam em %LOCALAPPDATA%\\PainelImplantacao\\exemplos\n"
          "(e o download acontece pelo próprio navegador).")


if __name__ == "__main__":
    main()
