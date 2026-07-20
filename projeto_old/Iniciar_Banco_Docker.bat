@echo off
REM ============================================================
REM  Banco do Painel em DOCKER (PostgreSQL no WSL2)
REM  Sobe/garante o Postgres. Rode ANTES do Iniciar_Servidor
REM  quando estiver usando o banco em Docker (Opcao C).
REM
REM  AUTO-START (ja configurado nesta maquina, sem precisar de admin):
REM    - Lancador oculto na pasta de Inicializacao do usuario:
REM        %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PainelImplantacao-Banco.vbs
REM    - Ele roda /usr/local/bin/painel-keepalive.sh no WSL, que mantem a VM
REM      viva (o WSL2 desligaria a distro ociosa e derrubaria o Postgres).
REM    Para desativar: apague o .vbs da pasta Startup.
REM
REM  Recriar do zero (se o container for removido):
REM    wsl -d Ubuntu -u root -- docker run -d --name painel-db ^
REM      --restart unless-stopped -e POSTGRES_DB=painel ^
REM      -e POSTGRES_USER=painel -e POSTGRES_PASSWORD=painel2026 ^
REM      -p 5432:5432 -v painel_pgdata:/var/lib/postgresql/data postgres:16
REM ============================================================
echo Acordando o WSL e o servico Docker...
wsl -d Ubuntu -u root -- systemctl start docker
echo Iniciando o container do banco...
wsl -d Ubuntu -u root -- docker start painel-db
echo.
wsl -d Ubuntu -u root -- docker ps --filter name=painel-db
echo.
echo Postgres pronto em localhost:5432 (base "painel").
echo No Iniciar_Servidor.bat, use a Opcao C:
echo    SET "PAINEL_DB_URL=postgresql+psycopg2://painel:painel2026@localhost:5432/painel"
echo.
pause
