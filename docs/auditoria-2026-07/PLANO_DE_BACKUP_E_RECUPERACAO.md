# Plano de backup e recuperação

> Procedimento operacional detalhado já vive em `docs/runbooks-operacao.md` §6-8. Este
> documento é a camada de **plano/política** (RPO/RTO, retenção, teste de restauração) que
> faltava formalizar em cima do runbook existente.

## 1. O que é protegido

| Ativo | Mecanismo | Frequência | Retenção |
|---|---|---|---|
| Banco Postgres (`painel-db`) | `pg_dump` comprimido, cron do WSL | Diário (22h) | 14 dias (`find … -mtime +14 -delete`) |
| Código-fonte | Git + push para GitHub (`Implantacaorech/Implantacao`) | A cada commit | Ilimitada (histórico Git) |
| Documentos de cliente gerados | **Não versionados** (`exemplos/`, `_uploads/` — gitignored) | N/A | N/A — são reproduzíveis a partir do banco + templates |
| Segredos/config (`DATA_WRITE/*.json`) | **Não versionados, sem backup automático** | N/A | Risco: perda de config exige reconfiguração manual |

## 2. RPO / RTO (objetivos, não medidos formalmente ainda)

- **RPO (perda de dados aceitável):** até 24h — o backup é diário às 22h; qualquer alteração
  entre backups é perdida em caso de corrupção do banco.
- **RTO (tempo de recuperação aceitável):** estimado em **< 1h** para restaurar o banco a
  partir do último `.sql.gz` (comando único, ver §3), mas **não medido/cronometrado
  formalmente** — recomenda-se um teste cronometrado (ver §5).

## 3. Procedimento de restauração (já documentado, reproduzido aqui por completude)

```bash
gunzip -c /mnt/c/PainelBackups/painel_AAAAMMDD_HHMMSS.sql.gz \
  | docker exec -i painel-db psql -U painel -d painel
```

Após restaurar: reiniciar o painel e rodar `python webapp/verificar_tudo.py` para confirmar
integridade (rotas + banco + e-mail + disponibilidade).

## 4. Gaps identificados

| Gap | Risco | Ação recomendada |
|---|---|---|
| Segredos/config (`DATA_WRITE/*.json`) sem backup | Perda da máquina = reconfigurar SMTP/IMAP/Gmail/disponibilidade do zero | Documentar os valores em um cofre de senhas da equipe (fora do repositório) — decisão organizacional, não técnica |
| Backup só local (`C:\PainelBackups`, mesma máquina do servidor) | Se o disco/máquina falhar, backup e produção são perdidos juntos | Considerar cópia periódica do `.sql.gz` mais recente para um segundo local (OneDrive já está disponível no ambiente) |
| Restauração nunca testada cronometrada | RTO real desconhecido | Rodar 1 restauração de teste em ambiente descartável (ex.: outro container `painel-db-teste`) e cronometrar |
| Retenção fixa em 14 dias sem cópia de longo prazo | Incidente detectado após 14 dias perde a chance de restaurar o estado anterior | Avaliar guardar 1 backup mensal por 6-12 meses, além dos 14 diários |

## 5. Teste de restauração (a ser executado, não apenas planejado)

Nenhum backup deve ser considerado válido sem teste periódico de restauração. Procedimento
sugerido (baixo risco — usa um container descartável, não toca em produção):

```bash
docker run -d --name painel-db-teste -e POSTGRES_PASSWORD=teste -e POSTGRES_USER=painel \
  -e POSTGRES_DB=painel -p 5433:5432 postgres:16
gunzip -c /mnt/c/PainelBackups/<mais_recente>.sql.gz \
  | docker exec -i painel-db-teste psql -U painel -d painel
docker exec painel-db-teste psql -U painel -d painel -c "SELECT count(*) FROM projeto;"
docker rm -f painel-db-teste
```

**Frequência recomendada:** trimestral, ou após qualquer mudança relevante no schema.
**Dono:** `integracoes-operacao`, com resultado registrado em `docs/runbooks-operacao.md`.

## 6. Continuidade

Serviço crítico único: o próprio Painel (não há serviços "menos críticos" a priorizar — é uma
aplicação única). Em caso de indisponibilidade total da máquina:

1. Verificar se é falha de sessão/logon → religar a máquina resolve (watchdog assume).
2. Se for falha de hardware → seguir `RUNBOOK_DE_INCIDENTES.md` cenário "servidor indisponível".
3. Pior caso (perda da máquina): reinstalar a partir do Git (`git clone`) + `docker compose up`
   + restaurar o último backup (§3) — tempo estimado depende de infraestrutura Windows/Docker
   nova, não só do banco.
