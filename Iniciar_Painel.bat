@echo off
REM ============================================================
REM  Painel de Implantacao (SIGER) - inicia o app web local.
REM  Duplo-clique para abrir no navegador (http://127.0.0.1:5000).
REM ============================================================
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python nao encontrado. Instale o Python 3 e marque "Add python.exe to PATH".
  start https://www.python.org/downloads/
  pause
  exit /b 1
)

echo Verificando dependencias (flask, python-docx, openpyxl, pyyaml, anthropic, sqlalchemy)...
python -m pip install --quiet flask python-docx openpyxl pyyaml anthropic sqlalchemy

echo.
echo Iniciando o Painel... o navegador abrira em alguns segundos.
echo Para encerrar, feche esta janela.
echo.
python "webapp\app.py"
pause
