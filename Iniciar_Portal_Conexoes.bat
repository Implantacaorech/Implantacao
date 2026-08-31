@echo off
REM ============================================================
REM  PORTAL DE CONEXOES (instancia 1) - MODO SERVIDOR
REM
REM  Mesmo binario do Painel, outra raiz de modulos: sobe SO a API
REM  de Dados, autenticacao, permissoes e health (dist\main-dados.js,
REM  ver backend\src\dados\dados-app.module.ts).
REM
REM  Esta e a instancia que fica na REDE INTERNA com a credencial do
REM  Oracle/MySQL. O Painel publicado (instancia 2) NAO guarda dado
REM  de conexao nenhum: fala com esta por token, pelo tunel.
REM
REM  NUNCA publique esta porta para fora da rede interna.
REM
REM  PRE-REQUISITO: rode Build_Painel_Novo.bat primeiro (compila o
REM  backend e o Angular; o main-dados.js sai do mesmo `nest build`).
REM ============================================================
setlocal
cd /d "%~dp0"

REM --- Variaveis obrigatorias (variaveis de USUARIO do Windows;
REM     NUNCA hardcode segredo aqui). Sao as MESMAS do Painel:
REM   MIGRACAO_DB_URL              mysql://usuario:senha@localhost:3306/painel_novo
REM   MIGRACAO_JWT_SECRET          string aleatoria longa
REM   MIGRACAO_JWT_REFRESH_SECRET  outra string aleatoria
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

set "NODE_ENV=production"

REM --- Porta propria (o Painel usa a 5100). As duas convivem na mesma
REM     maquina durante a transicao, e o firewall trata cada uma a sua
REM     maneira: a 5100 e o que vai para a nuvem, esta nunca sai daqui.
if "%MIGRACAO_DADOS_PORT%"=="" set "MIGRACAO_DADOS_PORT=5110"

REM --- Origem do Painel da NUVEM, para o CORS desta instancia. Sem ela,
REM     vale a mesma lista do Painel (MIGRACAO_CORS_ORIGINS).
REM   MIGRACAO_DADOS_CORS=https://painel.rech.com.br

if "%MIGRACAO_BACKUP_DIR%"=="" set "MIGRACAO_BACKUP_DIR=C:\PainelBackups"

echo.
echo ===============================================================
echo   PORTAL DE CONEXOES - INSTANCIA INTERNA (API de Dados)
echo ===============================================================
echo   Administracao (navegador, so na rede interna):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo        http://%%a:%MIGRACAO_DADOS_PORT%/config/api-dados
echo.
echo   API para o Painel da nuvem:  /api/dados/v1
echo   NAO libere esta porta no firewall para fora da rede interna.
echo ===============================================================
echo.

cd /d "%~dp0backend"
if not exist "%MIGRACAO_BACKUP_DIR%" mkdir "%MIGRACAO_BACKUP_DIR%"
echo. >> "%MIGRACAO_BACKUP_DIR%\portal_conexoes_stdout.log"
echo ===== %date% %time% - iniciando ===== >> "%MIGRACAO_BACKUP_DIR%\portal_conexoes_stdout.log"
node dist\main-dados.js >> "%MIGRACAO_BACKUP_DIR%\portal_conexoes_stdout.log" 2>&1
echo ===== %date% %time% - processo encerrou (errorlevel %errorlevel%) ===== >> "%MIGRACAO_BACKUP_DIR%\portal_conexoes_stdout.log"
