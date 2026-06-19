# -*- coding: utf-8 -*-
"""
build_painel_exe.py
-------------------
Gera o executável único (.exe) do **Painel de Implantação** (app Flask),
embutindo Python, bibliotecas (Flask, SQLAlchemy, python-docx, openpyxl,
PyYAML, lxml, httpx, google-auth, anthropic, waitress), os templates/estáticos
da web, os geradores e o letterhead.

Padrão herdado de GeradorProjetoSIGER/build_exe.py: build em %TEMP%, cópia
para fora do OneDrive e tratamento de "placeholder de nuvem" (ReparsePoint).

Uso (somente na máquina Windows que GERA o .exe):
    pip install pyinstaller flask sqlalchemy python-docx openpyxl pyyaml ^
                waitress httpx google-auth google-auth-oauthlib anthropic
    python build_painel_exe.py [pasta_destino]

Última auditoria: 2026-06 — cobre todos os módulos do projeto incluindo:
  - db.py com ModeloEmail (modelos de e-mail editáveis)
  - gmail_api.py (envio OAuth2 via Gmail API)
  - definir_gci / agendar (etapas separadas de agendamento)
  - config_modelos_email / config_modelo_email_form (templates novos)
"""
import os
import sys
import shutil
import tempfile
import subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(BASE, "webapp", "app.py")
NAME = "PainelImplantacao"

# ---------------------------------------------------------------------------
# Módulos importados dinamicamente (importlib/import inline) que o PyInstaller
# não detecta na análise estática. Todos os módulos do webapp e tools estão
# listados aqui para garantia total.
# ---------------------------------------------------------------------------
HIDDEN = [
    # --- webapp: módulos de negócio ---
    "roles", "runner", "forms", "db", "mailer", "fluxo",
    "imap_intake", "docview", "gmail_api", "gerar_layout",

    # --- tools: geradores e helpers ---
    "_common", "preencher_layout",
    "schema_projeto", "conversor_verbal",
    "importar_mapeamento", "verificar", "catalogo", "checklist",
    "ortografia", "ia",
    "gerar_kit_mudanca", "gerar_roteiros_teste", "gerar_aceite_uat",
    "gerar_reconciliacao_conversao", "gerar_painel_hypercare",
    "gerar_log_fitgap", "gerar_painel_kpi", "gerar_raid",
    "gerar_dossie_cliente", "gerar_projeto_implantacao",
    "gerar_termo_encerramento", "gerar_levantamento",
    "gerar_checklist_consultor", "gerar_cronograma",

    # --- SQLAlchemy: dialetos e drivers ---
    "sqlalchemy.dialects.sqlite",       # banco padrão (SQLite)
    "sqlalchemy.dialects.postgresql",   # suporte a Postgres (PAINEL_DB_URL)
    "psycopg2",                         # driver Postgres (opcional em runtime)
    "psycopg",                          # driver Postgres alternativo (psycopg3)

    # --- Servidor WSGI de produção ---
    "waitress",
    "waitress.runner",

    # --- Gmail API / Google OAuth ---
    "httpx",
    "google.auth",
    "google.auth.transport",
    "google.auth.transport.requests",
    "google.oauth2",
    "google.oauth2.credentials",
    "google_auth_oauthlib",
    "google_auth_oauthlib.flow",

    # --- Anthropic SDK (modo IA) ---
    "anthropic",

    # --- Flask e extensões ---
    "flask",
    "werkzeug",
    "jinja2",
    "jinja2.ext",
    "markupsafe",

    # --- Outros ---
    "yaml",          # PyYAML (importado como 'yaml' em vários módulos)
    "certifi",       # bundle de CAs para HTTPS
    "charset_normalizer",
    "idna",
    "urllib3",
]

# ---------------------------------------------------------------------------
# Dados embutidos no bundle (origem relativa ao BASE -> destino no sys._MEIPASS)
# ---------------------------------------------------------------------------
DATA_ADDS = [
    ("webapp/templates", "webapp/templates"),   # todos os .html incluindo os novos
    ("webapp/static",    "webapp/static"),      # CSS, JS, imagens
    ("tools/data",       "tools/data"),         # YAMLs de configuração e defaults
    ("tools/templates",  "tools/templates"),    # letterhead .docx
]

# ---------------------------------------------------------------------------
# Módulos pesados que não são usados — excluídos para reduzir tamanho do .exe
# ---------------------------------------------------------------------------
EXCLUDES = [
    "numpy", "pandas", "scipy", "matplotlib", "PIL", "IPython",
    "pytest", "PyQt5", "PySide2", "notebook", "tkinter",
    "unittest", "doctest", "pdb", "profile", "cProfile",
    "xmlrpc", "ftplib", "nntplib", "telnetlib", "turtle",
]

# ---------------------------------------------------------------------------
# Verificações de arquivos críticos antes de iniciar o build
# ---------------------------------------------------------------------------
_CRITICOS = [
    ("webapp/app.py",                   "Aplicação Flask principal"),
    ("webapp/db.py",                    "Banco de dados / ORM"),
    ("webapp/mailer.py",                "Envio de e-mail SMTP"),
    ("webapp/gmail_api.py",             "Envio via Gmail API"),
    ("webapp/fluxo.py",                 "Lógica de fluxo de etapas"),
    ("webapp/templates/base.html",      "Template base HTML"),
    ("webapp/templates/home.html",      "Página inicial"),
    ("webapp/templates/projeto_ficha.html", "Ficha do projeto"),
    ("webapp/templates/agendar.html",   "Etapa: Definir Data do Levantamento"),
    ("webapp/templates/definir_gci.html", "Etapa: Definir GCI"),
    ("webapp/templates/config_modelos_email.html",    "Listagem de modelos de e-mail"),
    ("webapp/templates/config_modelo_email_form.html","Formulário de modelo de e-mail"),
    ("webapp/templates/projeto_email.html", "Envio de e-mail por projeto"),
    ("tools/_common.py",                "Helpers compartilhados dos geradores"),
    ("tools/data/catalogo_modulos.yaml","Catálogo de módulos"),
]


def _verificar_criticos():
    ok = True
    for rel, desc in _CRITICOS:
        p = os.path.join(BASE, rel)
        if not os.path.exists(p):
            print("ERRO: arquivo crítico não encontrado: %s  (%s)" % (rel, desc))
            ok = False
    return ok


def _is_reparse_point(path):
    """Detecta placeholder do OneDrive (ReparsePoint) no Windows."""
    try:
        import stat as _stat
        return bool(os.stat(path).st_file_attributes & _stat.FILE_ATTRIBUTE_REPARSE_POINT)
    except Exception:
        return False


def main():
    print("=" * 60)
    print("  Build: %s" % NAME)
    print("=" * 60)

    # Verificação de pré-requisitos
    if not _verificar_criticos():
        sys.exit("\nBuild abortado: corrija os arquivos faltantes acima.")

    # Aviso sobre letterhead (não crítico, mas funcionalidade afetada)
    tdir = os.path.join(BASE, "tools", "templates")
    faltando_tpl = [f for f in ("base_projeto_tokenizado.docx",)
                    if not os.path.exists(os.path.join(tdir, f))]
    if faltando_tpl:
        print("\nAVISO: faltam templates em tools/templates/: %s" % ", ".join(faltando_tpl))
        print("       (o gerador de Projeto de Implantação não funcionará no .exe sem eles)")

    # Destino padrão: Desktop LOCAL (fora do OneDrive)
    final_dir = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\everton\Desktop\PainelImplantacao"
    os.makedirs(final_dir, exist_ok=True)

    workdir = os.path.join(tempfile.gettempdir(), "painel_build")
    os.makedirs(workdir, exist_ok=True)
    sep = ";" if os.name == "nt" else ":"

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm", "--clean",
        "--onefile", "--noupx",
        "--name", NAME,

        # Paths de busca de módulos
        "--paths", os.path.join(BASE, "tools"),
        "--paths", os.path.join(BASE, "webapp"),

        # Coleta completa de pacotes com dados embutidos
        "--collect-data",    "docx",                   # default.docx do python-docx
        "--collect-all",     "anthropic",              # SDK do modo IA (Claude)
        "--collect-all",     "google_auth_oauthlib",   # OAuth2 Gmail
        "--collect-submodules", "google.auth",
        "--collect-submodules", "google.oauth2",
        "--collect-submodules", "sqlalchemy",          # todos os dialetos SQLAlchemy
        "--collect-data",    "certifi",                # bundle de CAs para HTTPS
        "--collect-data",    "httpx",                  # certificados httpx

        # Diretórios de trabalho e saída
        "--workpath", os.path.join(workdir, "build"),
        "--distpath", os.path.join(workdir, "dist"),
        "--specpath", workdir,
    ]

    # Dados embutidos
    for src, dst in DATA_ADDS:
        full_src = os.path.join(BASE, src)
        if os.path.exists(full_src):
            cmd += ["--add-data", "%s%s%s" % (full_src, sep, dst)]
        else:
            print("AVISO: pasta de dados não encontrada (ignorada): %s" % src)

    # Hidden imports
    for h in HIDDEN:
        cmd += ["--hidden-import", h]

    # Exclusões
    for m in EXCLUDES:
        cmd += ["--exclude-module", m]

    cmd.append(APP)

    print("\n>> Iniciando PyInstaller...\n")
    subprocess.run(cmd, check=True)

    built = os.path.join(workdir, "dist", NAME + ".exe")
    if not os.path.exists(built):
        sys.exit("ERRO: PyInstaller não produziu o .exe esperado em: %s" % built)

    size_mb = os.path.getsize(built) / 1048576
    print("\n>> .exe gerado: %s  (%.1f MB)" % (built, size_mb))

    # Cópia para o destino final
    final = os.path.join(final_dir, NAME + ".exe")
    shutil.copy2(built, final)
    print(">> Copiado para: %s" % final)

    # Remove marcador de nuvem do OneDrive (se aplicável)
    if _is_reparse_point(final):
        try:
            subprocess.run(["attrib", "+P", "-U", final], check=False, shell=True)
            print(">> Marcador OneDrive removido (arquivo fixado localmente).")
        except Exception:
            pass

    print("\n" + "=" * 60)
    print("  CONCLUÍDO com sucesso!")
    print("=" * 60)
    print("\nDistribua apenas o arquivo:")
    print("   %s  (%.1f MB)" % (final, size_mb))
    print("\nAo executar pela primeira vez:")
    print("  - O banco de dados é criado automaticamente.")
    print("  - Os 7 modelos de e-mail padrão são inseridos automaticamente.")
    print("  - Documentos gerados ficam em:")
    print("    %%LOCALAPPDATA%%\\PainelImplantacao\\exemplos")
    print("  - Dados do cliente ficam em:")
    print("    %%LOCALAPPDATA%%\\PainelImplantacao\\data")


if __name__ == "__main__":
    main()
