@echo off
REM ============================================================
REM  Painel de Implantacao NOVO (Angular + NestJS) - BUILD DE PRODUCAO
REM  Roda o build do backend (NestJS) e do frontend (Angular, modo
REM  producao). Rode isto sempre que atualizar o codigo (git pull)
REM  antes de (re)iniciar com Iniciar_Painel_Novo.bat.
REM ============================================================
setlocal
cd /d "%~dp0"

echo.
echo ===============================================================
echo   BUILD - Painel de Implantacao (stack novo)
echo ===============================================================

echo.
echo [1/2] Build do backend (NestJS)...
cd /d "%~dp0backend"
call npm run build
if errorlevel 1 (
  echo [ERRO] Build do backend falhou. Veja o erro acima.
  pause
  exit /b 1
)

echo.
echo [2/2] Build do frontend (Angular, producao)...
cd /d "%~dp0frontend"
call npm run build -- --configuration production
if errorlevel 1 (
  echo [ERRO] Build do frontend falhou. Veja o erro acima.
  pause
  exit /b 1
)

echo.
echo ===============================================================
echo   BUILD CONCLUIDO. Rode Iniciar_Painel_Novo.bat para subir.
echo ===============================================================
pause
