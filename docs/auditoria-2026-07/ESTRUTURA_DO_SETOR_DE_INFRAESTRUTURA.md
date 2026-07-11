# Estrutura do setor de infraestrutura

> Adaptado à realidade: **não** existe uma pasta `/infrastructure` com subpastas de containers,
> rede, etc. porque **não há infraestrutura desse porte** — 1 container (Postgres), 1 servidor
> Windows, sem rede complexa, sem múltiplos ambientes. Criar essa árvore de pastas seria
> estrutura vazia sem conteúdo real para preencher. Em vez disso, este documento mapeia a
> infraestrutura **real** e onde cada parte já vive no repositório.

## Inventário real de infraestrutura

| Componente | O que é | Onde vive hoje | Dono (agente) |
|---|---|---|---|
| Banco de dados | Postgres 16, 1 container Docker (WSL2) | `docker-compose.yml` | `integracoes-operacao` |
| Servidor de aplicação | Windows, `waitress` a partir da fonte | `Iniciar_Servidor.bat` | `integracoes-operacao` |
| Watchdog de uptime | Tarefa Agendada Windows + VBS, checa `/health` a cada 5 min | `Guardiao_Painel.vbs` | `integracoes-operacao` |
| Backup do banco | Script cron (WSL, 22h diário, retenção 14 dias) | `tools/painel-backup.sh`, `tools/painel-backup-setup.sh` | `integracoes-operacao` |
| Robô de integridade | Tarefa Agendada diária (07:30): saúde + operação + suíte completa | `webapp/robo_integridade.py`, `Verificar_Integridade.bat` | `integracoes-operacao` |
| CI | GitHub Actions: compileall, smoke, pytest, smoke dos geradores | `.github/workflows/ci.yml` | `qualidade` |
| Rede/acesso | Acesso interno via `http://I7M1700-01-EVE:5000`, firewall Windows | `docs/runbooks-operacao.md` §1b | `integracoes-operacao` |
| Segredos/config | Arquivos gitignored em `DATA_WRITE` + variáveis de ambiente | `docs/runbooks-operacao.md` §9-10 | `seguranca-permissoes` + `integracoes-operacao` |
| Logs | Arquivo de log do app (modo servidor) + `backup.log` + `guardiao.log` + `integridade.log` | `C:\PainelBackups\*.log` | `integracoes-operacao` |

**Não existe hoje** (e não é recomendado criar sem justificativa de crescimento real):
containers de aplicação, orquestrador (K8s/Swarm), balanceador de carga, CDN, WAF, réplica de
banco, ambiente de homologação separado, fila de mensagens, cache distribuído.

## Responsabilidades cobertas (mapeadas às categorias do template de auditoria)

| Categoria pedida pelo template | Cobertura real | Gap? |
|---|---|---|
| Gerenciar ambientes | Só "notebook" vs "servidor" — sem homologação formal | Gap conhecido (F-08), aceitável para o porte atual |
| Gerenciar servidores | 1 servidor Windows, watchdog + robô de integridade | Coberto |
| Gerenciar containers | 1 container (Postgres) | Coberto, escopo mínimo |
| Gerenciar redes | Rede interna, firewall documentado | Coberto |
| Gerenciar certificados/DNS | Não há HTTPS/domínio formal (uso só na rede interna) | Fora de escopo hoje — reavaliar se o painel for exposto externamente |
| Gerenciar variáveis de ambiente/segredos | `docs/runbooks-operacao.md` §9-10 | Coberto, exceto F-01 (senha padrão) |
| Gerenciar banco de dados | Docker + backup + restauração documentados | Coberto |
| Gerenciar filas | Não existe (threads em memória para robôs) | Não aplicável no porte atual |
| Gerenciar armazenamento | `_uploads/`, `dados/`, `exemplos/` — sem quota | Gap menor (F-05) |
| Gerenciar logs | 4 arquivos de log distintos, sem centralização | Aceitável para 1 servidor; centralizar só se houver múltiplos servidores |
| Gerenciar monitoramento/alertas | `/health`, `verificar_tudo.py`, robô diário com e-mail em falha | Coberto (ver `PLANO_DE_MONITORAMENTO.md`) |
| Gerenciar backups/restauração | Cron diário + procedimento de restauração documentado | Coberto (ver `PLANO_DE_BACKUP_E_RECUPERACAO.md`) |
| Gerenciar implantação/rollback | `.bat` + guardião; rollback = `git revert` + reiniciar | Coberto para o modelo de deploy atual |
| Gerenciar disponibilidade | Watchdog a cada 5 min | Coberto, mas com SPOF conhecido (F-02) |
| Gerenciar capacidade/escalabilidade | Sem métrica formal de capacidade (CPU/memória/disco) além do robô de integridade | Gap menor — só relevante se o volume de uso crescer |
| Gerenciar incidentes | Sem histórico formal de incidentes | Ver `RUNBOOK_DE_INCIDENTES.md` (criado nesta auditoria) |
| Gerenciar vulnerabilidades | Sem scanner automático | Gap (F-10), resolvido por M-05 |
| Gerenciar continuidade | Backup + restauração testável; sem plano formal de RPO/RTO | Ver `PLANO_DE_BACKUP_E_RECUPERACAO.md` |

## Por que não criar a árvore `/infrastructure`

O template de auditoria sugere uma estrutura de pastas dedicada
(`environments/deploy/containers/scripts/monitoring/logging/security/backup/recovery/network/
database/documentation/runbooks/incidents`). Adotá-la literalmente criaria **13 pastas majoritariamente
vazias**, movendo scripts que já têm um lugar natural e testado (`tools/`, `docs/`) para uma
estrutura nova sem ganho — na prática, dividiria o conhecimento operacional em dois lugares
(o `docs/runbooks-operacao.md` existente e a pasta nova), aumentando o risco de divergência.

**Decisão:** manter a organização atual (`tools/` para scripts de infra, `docs/` para runbooks
e planos, raiz para os `.bat`/`.vbs` de bootstrap) e usar este documento como o índice que
mapeia "categoria de infraestrutura → onde está de fato". Revisar esta decisão se o número de
servidores/ambientes crescer o suficiente para justificar uma pasta dedicada.
