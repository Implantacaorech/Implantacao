@echo off
REM ============================================================
REM  Painel de Implantacao - MODO SERVIDOR (rede interna)
REM  Rode em UMA maquina (o "servidor"). A equipe acessa pelo
REM  navegador em http://<IP-desta-maquina>:5000
REM  Deixe esta janela ABERTA enquanto o painel deve ficar no ar.
REM ============================================================
setlocal
cd /d "%~dp0"

REM --- Onde o banco de dados fica -----------------------------
REM   OPCAO A (padrao): SQLite na pasta "dados" ao lado deste .bat.
REM   OPCAO B (rede):   SET "PAINEL_DB=R:\Implantacao\painel.db"
REM   OPCAO C (Docker/Postgres): suba o banco com "docker compose up -d"
REM     (docker-compose.yml no repositorio) e descomente a linha abaixo,
REM     ajustando SENHA e IP do servidor Docker:
REM        SET "PAINEL_DB_URL=postgresql+psycopg2://painel:painel2026@localhost:5432/painel"
SET "PAINEL_DB=%~dp0dados\painel.db"
if not exist "%~dp0dados" mkdir "%~dp0dados"

REM --- Servir para toda a rede --------------------------------
SET "PAINEL_HOST=0.0.0.0"
SET "PAINEL_PORT=5000"

echo.
echo ===============================================================
echo   PAINEL DE IMPLANTACAO - MODO SERVIDOR
echo ===============================================================
echo   Banco de dados: %PAINEL_DB%
echo.
echo   A equipe acessa por um destes enderecos (no navegador):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo        http://%%a:%PAINEL_PORT%
echo.
echo   1) Libere a porta %PAINEL_PORT% no Firewall do Windows (entrada).
echo   2) Mantenha esta janela aberta. Para encerrar, feche-a.
echo ===============================================================
echo.

REM Roda o .exe se estiver na mesma pasta; senao roda via Python (repo).
if exist "%~dp0PainelImplantacao.exe" (
  "%~dp0PainelImplantacao.exe"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo [ERRO] Nao achei PainelImplantacao.exe nesta pasta nem o Python instalado.
    echo Coloque o .exe ao lado deste .bat, ou instale o Python e rode no repositorio.
    pause
    exit /b 1
  )
  python "webapp\app.py"
)
pause
