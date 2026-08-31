@echo off
REM Inicia o serviço de geração de documentos (FastAPI/uvicorn).
REM PYTHONUTF8=1 é OBRIGATÓRIO neste Windows: sem UTF-8 mode, o interpretador decodifica
REM os arquivos .py copiados de webapp/gl_*.py com a codepage do sistema (ex.: cp1252) em vez
REM de UTF-8, corrompendo toda string com acento ou travessão nesses módulos (achado real
REM desta migração — ver docs/migracao/03-documento-conversao.md).
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
REM A16 (auditoria 2026-08-12): grava a saida do docservice em log. Sem isto, o guardiao subia
REM o uvicorn numa janela minimizada que morre no reinicio, entao uma falha de start (venv
REM corrompida, porta ocupada, modelo faltando) nao deixava rastro em lugar nenhum. Mesmo
REM padrao do painel_novo_stdout.log.
if not exist "C:\PainelBackups" mkdir "C:\PainelBackups"
echo. >> "C:\PainelBackups\docservice_stdout.log"
echo ===== %date% %time% - iniciando docservice ===== >> "C:\PainelBackups\docservice_stdout.log"
".venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8001 >> "C:\PainelBackups\docservice_stdout.log" 2>&1
echo ===== %date% %time% - docservice encerrou (errorlevel %errorlevel%) ===== >> "C:\PainelBackups\docservice_stdout.log"
