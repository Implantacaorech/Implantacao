# Proteger_Dados_ACL.ps1 — tranca a pasta de CREDENCIAIS do backend (backend\dados)
# ---------------------------------------------------------------------------------
# Achado M5 da Auditoria de Prontidao dos 9 eixos (2026-08-12): em backend\dados moram, em
# claro, ia_config.json (chaves de IA), smtp.json / imap.json (senhas de e-mail), mariadb.env
# e CSVs. Este script remove a heranca de ACL e restringe a pasta ao SYSTEM, aos Administradores
# e ao dono do servico (quem roda o painel) — tirando Usuarios, Todos e Usuarios Autenticados.
#
# E idempotente: rodar de novo apenas reafirma o estado. Use SIDs bem-conhecidos (nao os nomes)
# para funcionar em Windows em qualquer idioma. Rode UMA VEZ, como Administrador.
#
#   powershell -ExecutionPolicy Bypass -File tools\Proteger_Dados_ACL.ps1
#
# Conferir depois:  icacls backend\dados
# O backend tambem avisa no boot (SegurancaDados) se a pasta continuar aberta a grupos amplos.

$ErrorActionPreference = 'Stop'

# SIDs bem-conhecidos (independentes de idioma)
$SID_SYSTEM   = '*S-1-5-18'      # NT AUTHORITY\SYSTEM
$SID_ADMINS   = '*S-1-5-32-544'  # BUILTIN\Administrators
$SID_USERS    = '*S-1-5-32-545'  # BUILTIN\Users
$SID_EVERYONE = '*S-1-1-0'       # Everyone / Todos
$SID_AUTHUSR  = '*S-1-5-11'      # NT AUTHORITY\Authenticated Users

$dados = Join-Path $PSScriptRoot '..\backend\dados'
if (-not (Test-Path $dados)) {
  Write-Host "Pasta nao encontrada: $dados" -ForegroundColor Yellow
  Write-Host "Nada a fazer (o backend cria a pasta no primeiro uso). Rode de novo depois."
  exit 0
}
$dados = (Resolve-Path $dados).Path
Write-Host "Protegendo: $dados" -ForegroundColor Cyan

# 1) Corta a heranca, convertendo as ACEs herdadas em explicitas (para nao ficar sem acesso).
icacls $dados /inheritance:r | Out-Null

# 2) Concede acesso total a SYSTEM, Administradores e ao usuario atual (dono do servico).
#    (OI)(CI) = a concessao vale para os arquivos e subpastas ja existentes e futuros.
icacls $dados /grant:r "$SID_SYSTEM:(OI)(CI)F" "$SID_ADMINS:(OI)(CI)F" "$($env:USERNAME):(OI)(CI)F" /T | Out-Null

# 3) Remove os grupos amplos que nao deveriam ler credenciais.
icacls $dados /remove:g $SID_USERS $SID_EVERYONE $SID_AUTHUSR /T | Out-Null

Write-Host "ACL aplicada. Estado atual:" -ForegroundColor Green
icacls $dados
