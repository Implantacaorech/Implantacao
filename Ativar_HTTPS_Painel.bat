@echo off
REM ============================================================
REM  Ativa o HTTPS do Painel de Implantacao (duplo clique).
REM
REM  Existe para tirar duas pedras do caminho que fazem o
REM  Gerar_Certificado_Painel.ps1 "nao funcionar":
REM   1. .ps1 com duplo clique NAO executa (abre no editor), e
REM      pelo menu cai na politica de execucao do PowerShell;
REM   2. criar certificado na loja da maquina, regra de firewall
REM      e variavel de ambiente de sistema exige ELEVACAO.
REM
REM  Este .bat pede a elevacao (UAC) sozinho e roda o script com
REM  -ExecutionPolicy Bypass.
REM
REM  NAO reinicia o painel: quem esta usando agora nao e afetado.
REM  O HTTPS entra no ar no proximo Iniciar_Painel_Novo.bat.
REM ============================================================
setlocal
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  echo Pedindo elevacao ^(UAC^)...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b 0
)

echo.
echo ===============================================================
echo   Ativando HTTPS do Painel ^(certificado + firewall + variaveis^)
echo ===============================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Gerar_Certificado_Painel.ps1"
if errorlevel 1 (
  echo.
  echo [ERRO] A configuracao falhou. Veja a mensagem acima.
  pause
  exit /b 1
)

echo.
echo ===============================================================
echo   FALTA REINICIAR O PAINEL para o HTTPS entrar no ar:
echo.
echo     Build_Painel_Novo.bat     ^(codigo novo + migrations^)
echo     Iniciar_Painel_Novo.bat
echo.
echo   A porta 5100 continua no ar depois disso - quem ja usa o
echo   painel nao perde acesso.
echo ===============================================================
pause
