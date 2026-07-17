# Backup do MariaDB do Painel NOVO (painel-db-mariadb): dump comprimido em C:\PainelBackups.
# Banco de producao do painel novo desde a troca de Postgres->MariaDB em 2026-07-17 (ver
# docs/migracao/03-documento-conversao.md §21/§22) - mesmo padrao operacional do backup do
# Postgres (Painel_Novo_Backup.ps1): PowerShell + Tarefa Agendada do Windows, retencao de
# 14 dias, log em C:\PainelBackups.
#
# Senha do MariaDB: NUNCA hardcoded aqui. Defina a variavel de USUARIO do Windows
# PAINEL_NOVO_MARIADB_SENHA antes de agendar este script (mesmo principio do
# PAINEL_NOVO_DB_SENHA do backup do Postgres).
#
# RESTAURAR um backup:
#   Expand-Archive C:\PainelBackups\painel_novo_mariadb_AAAAMMDD_HHMMSS.zip -DestinationPath .
#   Get-Content painel_novo_mariadb_AAAAMMDD_HHMMSS.sql | docker exec -i painel-db-mariadb mariadb -u painel painel_novo

$ErrorActionPreference = "Stop"
$dest = "C:\PainelBackups"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$logFile = Join-Path $dest "backup_novo_mariadb.log"

function Log($msg) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg" | Out-File -Append -FilePath $logFile
}

if (-not $env:PAINEL_NOVO_MARIADB_SENHA) {
  Log "ERRO -> variavel de usuario PAINEL_NOVO_MARIADB_SENHA nao definida"
  exit 1
}

try {
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $sqlFile = Join-Path $dest "painel_novo_mariadb_$ts.sql"
  $zipFile = Join-Path $dest "painel_novo_mariadb_$ts.zip"

  # --single-transaction: dump consistente sem travar as tabelas (InnoDB, mesmo espirito
  # do pg_dump padrao usado no script do Postgres). --routines/--triggers nao se aplicam
  # aqui (schema nao usa nenhum dos dois), omitidos de proposito para o dump ficar simples.
  docker exec -e MYSQL_PWD=$env:PAINEL_NOVO_MARIADB_SENHA painel-db-mariadb `
    mysqldump -u painel --single-transaction --default-character-set=utf8mb4 painel_novo | Out-File -FilePath $sqlFile -Encoding utf8

  Compress-Archive -Path $sqlFile -DestinationPath $zipFile -Force
  Remove-Item $sqlFile

  # Mantem so os ultimos 14 dias (mesma retencao do backup do Postgres).
  Get-ChildItem $dest -Filter "painel_novo_mariadb_*.zip" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } |
    Remove-Item -Force

  Log "ok -> painel_novo_mariadb_$ts.zip"
} catch {
  Log "ERRO -> $($_.Exception.Message)"
  exit 1
}
