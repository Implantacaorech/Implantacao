@echo off
REM ============================================================
REM  Abre o banco do Painel (PostgreSQL no Docker) no terminal psql.
REM  Comandos uteis dentro do psql:
REM     \dt              lista as tabelas
REM     \d projetos      mostra a estrutura da tabela projetos
REM     SELECT * FROM projetos;     (terminar com ; )
REM     \q               sair
REM  (Se trocar a senha do banco, ajuste PGPASSWORD abaixo.)
REM ============================================================
echo Abrindo o banco "painel"...  (digite  \q  para sair)
echo.
wsl -d Ubuntu -u root -- docker exec -it -e PGPASSWORD=painel2026 painel-db psql -U painel -d painel
