@echo off
REM Inicia o serviço de geração de documentos (FastAPI/uvicorn).
REM PYTHONUTF8=1 é OBRIGATÓRIO neste Windows: sem UTF-8 mode, o interpretador decodifica
REM os arquivos .py copiados de webapp/gl_*.py com a codepage do sistema (ex.: cp1252) em vez
REM de UTF-8, corrompendo toda string com acento ou travessão nesses módulos (achado real
REM desta migração — ver docs/migracao/03-documento-conversao.md).
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
".venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8001
