@echo off
REM ============================================================
REM  TESTE da gravacao de reuniao - libera o microfone no painel
REM
REM  O navegador so entrega microfone/captura de tela em "contexto
REM  seguro" (HTTPS ou localhost). O painel roda em HTTP numa
REM  maquina da rede, entao a tela Gravar reuniao sobe com os
REM  botoes bloqueados.
REM
REM  Este script abre o Edge (ou o Chrome) tratando ESSA origem
REM  como segura, num PERFIL SEPARADO - a flag e ignorada se o
REM  navegador reaproveitar o perfil normal ja aberto.
REM
REM  E SO PARA TESTE. A solucao definitiva e publicar o painel em
REM  HTTPS ou aplicar a politica OverrideSecurityRestrictionsOnInsecureOrigin
REM  por GPO. Ver docs/gravacao-reuniao.md.
REM ============================================================
setlocal

REM Precisa bater EXATAMENTE com o que aparece na barra de enderecos.
set "ORIGEM=http://i7m1700-01-eve:5100"
set "PERFIL=%TEMP%\painel-teste-gravacao"

set "NAVEGADOR="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "NAVEGADOR=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined NAVEGADOR if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "NAVEGADOR=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined NAVEGADOR if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "NAVEGADOR=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined NAVEGADOR if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "NAVEGADOR=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

if not defined NAVEGADOR (
  echo [ERRO] Edge ou Chrome nao encontrados nos caminhos padrao.
  echo        Abra o navegador manualmente com:
  echo          --unsafely-treat-insecure-origin-as-secure="%ORIGEM%"
  echo          --user-data-dir="%PERFIL%"
  pause
  exit /b 1
)

echo.
echo ===============================================================
echo   TESTE - gravacao de reuniao com microfone liberado
echo ===============================================================
echo   Navegador : %NAVEGADOR%
echo   Origem    : %ORIGEM%
echo   Perfil    : %PERFIL%  (separado, so para o teste)
echo.
echo   Faca login normalmente - este perfil nao tem sua sessao.
echo   Na primeira gravacao o navegador vai pedir permissao do
echo   microfone: clique em Permitir.
echo ===============================================================
echo.

start "" "%NAVEGADOR%" ^
  --unsafely-treat-insecure-origin-as-secure="%ORIGEM%" ^
  --user-data-dir="%PERFIL%" ^
  --no-first-run ^
  --no-default-browser-check ^
  "%ORIGEM%/protocolos/gravar"

echo Navegador aberto. Feche esta janela quando terminar.
timeout /t 5 >nul
