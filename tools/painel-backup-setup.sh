#!/bin/bash
# Habilita o cron no WSL e agenda o backup diario do Postgres as 22:00 (idempotente).
# Instalar (uma vez), a partir do Windows:
#   wsl -d Ubuntu -u root -- cp /mnt/c/.../tools/painel-backup.sh /usr/local/bin/
#   wsl -d Ubuntu -u root -- cp /mnt/c/.../tools/painel-backup-setup.sh /usr/local/bin/
#   wsl -d Ubuntu -u root -- chmod +x /usr/local/bin/painel-backup*.sh
#   wsl -d Ubuntu -u root -- /usr/local/bin/painel-backup-setup.sh
systemctl enable --now cron >/dev/null 2>&1
( crontab -l 2>/dev/null | grep -v painel-backup; echo "0 22 * * * /usr/local/bin/painel-backup.sh" ) | crontab -
echo "crontab:"; crontab -l | grep painel-backup
