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

function Log($msg) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg" | Out-File -Append -FilePath $logFile
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
