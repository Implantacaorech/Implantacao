@echo off
REM ============================================================
REM  Painel de Implantacao NOVO (Angular + NestJS) - MODO SERVIDOR
REM  Sobe o docservice (geracao de documentos/transcricao, so uso
REM  interno) e o backend NestJS, que tambem serve o Angular ja
REM  compilado (um unico processo/porta para a equipe acessar).
REM
REM  PRE-REQUISITO: rode Build_Painel_Novo.bat primeiro (e sempre
REM  que atualizar o codigo). Este script so INICIA o que ja foi
REM  compilado, para reiniciar rapido (usado pelo guardiao).
REM
REM  Deixe esta janela ABERTA enquanto o painel novo deve ficar no
REM  ar. Para encerrar, feche-a (o docservice sobe numa janela
REM  separada, minimizada - feche-a tambem se for parar tudo).
REM ============================================================
setlocal
cd /d "%~dp0"

REM --- Variaveis obrigatorias (defina como variavel de USUARIO do
REM     Windows antes de rodar - NUNCA hardcode segredo aqui):
REM   MIGRACAO_DB_URL           postgresql://usuario:senha@host/painel_novo
REM   MIGRACAO_JWT_SECRET       string aleatoria longa (ex.: openssl rand -hex 32)
REM   MIGRACAO_JWT_REFRESH_SECRET  outra string aleatoria (diferente da acima)
if "%MIGRACAO_DB_URL%"=="" (
  echo [ERRO] Falta a variavel de usuario MIGRACAO_DB_URL. Configure antes de rodar.
  pause
  exit /b 1
)
if "%MIGRACAO_JWT_SECRET%"=="" (
  echo [ERRO] Falta a variavel de usuario MIGRACAO_JWT_SECRET. Configure antes de rodar.
  pause
  exit /b 1
)
if "%MIGRACAO_JWT_REFRESH_SECRET%"=="" (
  echo [ERRO] Falta a variavel de usuario MIGRACAO_JWT_REFRESH_SECRET. Configure antes de rodar.
  pause
  exit /b 1
)

REM --- Porta do painel novo (diferente da porta 5000 do Flask antigo,
REM     os dois podem ficar no ar em paralelo durante a virada) --------
if "%MIGRACAO_PORT%"=="" set "MIGRACAO_PORT=5100"

echo.
echo ===============================================================
echo   PAINEL DE IMPLANTACAO NOVO - MODO SERVIDOR
echo ===============================================================
echo   A equipe acessa por um destes enderecos (no navegador):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo        http://%%a:%MIGRACAO_PORT%
echo.
echo   1) Libere a porta %MIGRACAO_PORT% no Firewall do Windows (entrada).
echo   2) Mantenha esta janela aberta. Para encerrar, feche-a.
echo ===============================================================
echo.

REM --- Sobe o docservice (geracao de documentos), so se ainda nao
REM     estiver escutando na porta 8001 -------------------------------
powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue)) { exit 1 } else { exit 0 }"
if errorlevel 1 (
  echo Subindo o docservice ^(geracao de documentos^) numa janela separada...
  start "Painel Novo - docservice" /min cmd /c ""%~dp0docservice\iniciar.bat""
  timeout /t 3 /nobreak >nul
) else (
  echo docservice ja esta no ar na porta 8001.
)

REM --- Backend (serve tambem o Angular ja compilado) ------------------
cd /d "%~dp0backend"
node dist\main.js
pause
