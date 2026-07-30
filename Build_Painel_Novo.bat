@echo off
REM ============================================================
REM  Painel de Implantacao NOVO (Angular + NestJS) - BUILD DE PRODUCAO
REM  Roda o build do backend (NestJS) e do frontend (Angular, modo
REM  producao) e aplica as migrations pendentes no MariaDB. Rode
REM  isto sempre que atualizar o codigo (git pull) antes de
REM  (re)iniciar com Iniciar_Painel_Novo.bat.
REM ============================================================
setlocal
cd /d "%~dp0"

echo.
echo ===============================================================
echo   BUILD - Painel de Implantacao (stack novo)
echo ===============================================================

echo.
echo [1/3] Build do backend (NestJS)...
cd /d "%~dp0backend"
call npm run build
if errorlevel 1 (
  echo [ERRO] Build do backend falhou. Veja o erro acima.
  pause
  exit /b 1
)

echo.
echo [2/3] Build do frontend (Angular, producao)...
cd /d "%~dp0frontend"
call npm run build -- --configuration production
if errorlevel 1 (
  echo [ERRO] Build do frontend falhou. Veja o erro acima.
  pause
  exit /b 1
)

REM --- Migrations -------------------------------------------------
REM  O backend NAO aplica migration sozinho - migrationsRun:false em
REM  database.module.ts -, entao sem este passo o codigo novo sobe
REM  contra um schema velho. Foi o que aconteceu em 2026-07-29 com a
REM  tabela preferencias_usuario: o codigo que a usa ficou um dia em
REM  producao sem a tabela existir e, como o frontend engole o erro de
REM  preferencia, ninguem percebeu.
REM
REM  Roda DEPOIS dos builds - build quebrado nao encosta no banco - e
REM  ANTES do Iniciar, com o processo antigo ainda no ar: migration
REM  aditiva, de coluna ou tabela nova, nao atrapalha o codigo velho.
REM
REM  Nao fica no Iniciar_Painel_Novo.bat de proposito: aquele script e
REM  o que o guardiao executa a cada queda, e migration em toda
REM  recuperacao atrasaria a volta do painel sem necessidade.
echo.
echo [3/3] Migrations pendentes no banco...
if "%MIGRACAO_DB_URL%"=="" (
  echo [AVISO] MIGRACAO_DB_URL nao definida - migrations NAO aplicadas.
  echo         Sem essa variavel o TypeORM cai no SQLite descartavel de
  echo         desenvolvimento, veja data-source.ts, entao aplicar aqui
  echo         so criaria schema num banco que ninguem usa.
  echo         Na maquina do painel a variavel e obrigatoria: configure
  echo         antes de subir, senao o Iniciar_Painel_Novo.bat ja para.
) else (
  cd /d "%~dp0backend"
  call npm run migration:run
  if errorlevel 1 (
    echo.
    echo [ERRO] Migration falhou. NAO suba o painel: o codigo novo
    echo        espera um schema que o banco ainda nao tem. Resolva o
    echo        erro acima e rode este script de novo.
    pause
    exit /b 1
  )
)

echo.
echo ===============================================================
echo   BUILD CONCLUIDO. Rode Iniciar_Painel_Novo.bat para subir.
echo ===============================================================
pause
