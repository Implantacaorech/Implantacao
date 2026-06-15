#!/bin/bash
# Backup do Postgres do Painel: dump comprimido em C:\PainelBackups (Windows).
# Instalado em /usr/local/bin/ e disparado pelo cron do WSL (diario as 22:00).
# Mantem os ultimos 14 dias. Configurar com painel-backup-setup.sh.
#
# RESTAURAR um backup:
#   gunzip -c /mnt/c/PainelBackups/painel_AAAAMMDD_HHMMSS.sql.gz \
#     | docker exec -i painel-db psql -U painel -d painel
DEST=/mnt/c/PainelBackups
mkdir -p "$DEST"
TS=$(date +%Y%m%d_%H%M%S)
docker exec -e PGPASSWORD=painel2026 painel-db pg_dump -U painel -d painel 2>>"$DEST/backup.log" \
  | gzip > "$DEST/painel_$TS.sql.gz"
find "$DEST" -name 'painel_*.sql.gz' -mtime +14 -delete 2>/dev/null
echo "$(date '+%Y-%m-%d %H:%M:%S') ok -> painel_$TS.sql.gz" >> "$DEST/backup.log"
