#!/bin/bash
# Mantem o banco do Painel (Docker/Postgres) no ar e a VM do WSL viva.
# Instalado em /usr/local/bin/ e disparado pela Tarefa Agendada no logon
# (ver Iniciar_Banco_Docker.bat). O WSL2 desliga a distro quando ociosa, o
# que derrubaria o Postgres; o 'sleep infinity' mantem a VM viva.
for i in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 2; done
docker start painel-db >/dev/null 2>&1
exec sleep infinity
