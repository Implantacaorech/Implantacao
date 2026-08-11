# ⚠️ HISTORICO - NAO USE. O painel novo roda em MariaDB desde 2026-07-17, e o Postgres
# `painel-db-novo` (assim como o Docker desta maquina) nao existe mais. O backup em uso e o
# tools/Painel_Novo_Backup_MariaDB.ps1. Este arquivo fica so como registro de como era.
#
# Backup do Postgres do Painel NOVO (painel-db-novo): dump comprimido em C:\PainelBackups.
# Diferente do Postgres do Flask antigo (painel-db, container no WSL2), o painel-db-novo
# roda direto no Docker Desktop do Windows - por isso este script e PowerShell + Tarefa
# Agendada do Windows, em vez do padrao bash + cron do WSL usado em tools/painel-backup.sh.
#
# Senha do Postgres: NUNCA hardcoded aqui. Defina a variavel de USUARIO do Windows
# PAINEL_NOVO_DB_SENHA antes de agendar este script (mesmo principio do achado F-01 da
# auditoria 2026-07-10, que corrigiu o equivalente do Flask).
#
# RESTAURAR um backup:
#   Expand-Archive C:\PainelBackups\painel_novo_AAAAMMDD_HHMMSS.zip -DestinationPath .
#   Get-Content painel_novo_AAAAMMDD_HHMMSS.sql | docker exec -i painel-db-novo psql -U painel_novo -d painel_novo

$ErrorActionPreference = "Stop"
$dest = "C:\PainelBackups"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$logFile = Join-Path $dest "backup_novo.log"

# UTF-8 sem BOM (ver Painel_Novo_Backup_MariaDB.ps1: `Out-File -Append` da PS 5.1 grava
# UTF-16 sem -Encoding e carimba BOM com ele, deixando o log ilegivel).
$script:Utf8SemBom = New-Object System.Text.UTF8Encoding($false)
function Log($msg) {
  $linha = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg`r`n"
  [System.IO.File]::AppendAllText($logFile, $linha, $script:Utf8SemBom)
}

if (-not $env:PAINEL_NOVO_DB_SENHA) {
  Log "ERRO -> variavel de usuario PAINEL_NOVO_DB_SENHA nao definida"
  exit 1
}

try {
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $sqlFile = Join-Path $dest "painel_novo_$ts.sql"
  $zipFile = Join-Path $dest "painel_novo_$ts.zip"

  docker exec -e PGPASSWORD=$env:PAINEL_NOVO_DB_SENHA painel-db-novo `
    pg_dump -U painel_novo -d painel_novo | Out-File -FilePath $sqlFile -Encoding utf8

  Compress-Archive -Path $sqlFile -DestinationPath $zipFile -Force
  Remove-Item $sqlFile

  # Mantem so os ultimos 14 dias (mesma retencao do backup do Flask antigo).
  Get-ChildItem $dest -Filter "painel_novo_*.zip" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } |
    Remove-Item -Force

  Log "ok -> painel_novo_$ts.zip"
} catch {
  Log "ERRO -> $($_.Exception.Message)"
  exit 1
}
