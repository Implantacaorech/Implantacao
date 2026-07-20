@echo off
rem Robo de integridade do Painel: roda todas as verificacoes (operacao + suite de testes)
rem e alerta em falha. Agendado no Windows (diario); pode ser rodado manualmente tambem.
cd /d "%~dp0webapp"
set PYTHONUTF8=1
python robo_integridade.py
if errorlevel 1 (
  echo.
  echo *** INTEGRIDADE FALHOU - veja C:\PainelBackups\integridade.log ***
)
