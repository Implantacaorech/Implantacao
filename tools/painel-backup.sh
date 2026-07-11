#!/bin/bash
# Backup do Postgres do Painel: dump comprimido em C:\PainelBackups (Windows).
# Instalado em /usr/local/bin/ e disparado pelo cron do WSL (diario as 22:00).
# Mantem os ultimos 14 dias. Configurar com painel-backup-setup.sh.
#
# Senha do Postgres: NUNCA hardcoded aqui (achado F-01 da auditoria 2026-07-10). Crie, na
# maquina do servidor (fora do repositorio), o arquivo /usr/local/etc/painel-db.env com uma
# linha:  PGPASSWORD=SUA_SENHA
#
# RESTAURAR um backup:
#   gunzip -c /mnt/c/PainelBackups/painel_AAAAMMDD_HHMMSS.sql.gz \
#     | docker exec -i painel-db psql -U painel -d painel
DEST=/mnt/c/PainelBackups
ENV_FILE=/usr/local/etc/painel-db.env
mkdir -p "$DEST"

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi
if [ -z "$PGPASSWORD" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') ERRO -> PGPASSWORD nao definido ($ENV_FILE ausente ou vazio)" >> "$DEST/backup.log"
  exit 1
fi

TS=$(date +%Y%m%d_%H%M%S)
docker exec -e PGPASSWORD="$PGPASSWORD" painel-db pg_dump -U painel -d painel 2>>"$DEST/backup.log" \
  | gzip > "$DEST/painel_$TS.sql.gz"
find "$DEST" -name 'painel_*.sql.gz' -mtime +14 -delete 2>/dev/null
echo "$(date '+%Y-%m-%d %H:%M:%S') ok -> painel_$TS.sql.gz" >> "$DEST/backup.log"
