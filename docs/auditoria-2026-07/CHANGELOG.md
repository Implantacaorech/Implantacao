# Changelog da auditoria técnica

> O projeto não mantém um `CHANGELOG.md` de produto separado — o histórico de mudanças do
> Painel já vive no `git log` (mensagens de commit descritivas, ex.: `feat(ops): guardiao que
> mantem o Painel sempre no ar`), que é a fonte de verdade e não deve ser duplicado aqui.
> Este arquivo registra especificamente o **ciclo desta auditoria** e serve de modelo para
> registrar futuras correções que nascerem dela (ver `PLANO_DE_MELHORIAS.md`).

## 2026-07-10 — Auditoria técnica completa

- Diagnóstico geral, relatório de falhas/riscos, plano de melhorias e demais 18 entregáveis
  produzidos em `docs/auditoria-2026-07/`, adaptados à realidade do projeto (monolito Flask +
  Postgres, sem containers/K8s), integrando-se ao catálogo de agentes já existente
  (`docs/agentes-software.md`) em vez de recriá-lo.
- Achado crítico: senha padrão do Postgres em texto plano (F-01) — pendência já conhecida em
  `docs/runbooks-operacao.md` §9, formalizada aqui com plano de correção (M-01).
- Nenhum agente de software novo foi criado — conclusão da auditoria é que os 6 agentes
  existentes já cobrem o território necessário para o porte atual (ver
  `CATALOGO_DE_AGENTES.md` §3-4).

## 2026-07-10 — Correções de baixo risco aplicadas (M-01 código, M-02, M-05, M-09, M-13)

- **M-01 (parte de código):** `docker-compose.yml` não aceita mais senha padrão
  (`PAINEL_DB_SENHA` agora é obrigatória, o compose falha alto sem ela); `tools/painel-backup.sh`
  não tem mais `PGPASSWORD` hardcoded (lê de `/usr/local/etc/painel-db.env`, fora do repo);
  `tools/painel-backup-setup.sh` e `docs/runbooks-operacao.md` §9 atualizados. **Falta**:
  rotacionar a senha real em produção (rastreado em `memoria_ia/pendencias.md`, P0).
- **M-02:** `webapp/app.py::_carrega_secret()` não usa mais uma string fixa como último recurso
  — gera uma chave aleatória em memória e loga `CRITICAL` se não conseguir persistir
  `secret.key`.
- **M-05:** `.github/dependabot.yml` criado (pip em `/tools`, github-actions em `/`, semanal).
- **M-09:** novo job `test-postgres` em `.github/workflows/ci.yml`, com serviço Postgres 16 e
  `tools/ci_postgres_smoke.py` (novo arquivo) — confere que `create_all`/`_auto_migrar` sobem
  sem erro contra Postgres real, sem alterar a suíte principal (que segue isolada em SQLite).
- **M-13:** `pytest-cov` adicionado ao job `test` (`--cov=webapp --cov-report=term-missing`,
  só relatório, sem gate).
- Validado localmente antes do commit: `compileall` limpo, `verificar_app.py` OK (32 endpoints),
  suíte completa 98/98 verde, YAML e bash sintaticamente válidos.

## Modelo para entradas futuras

```
## AAAA-MM-DD — <título curto>
- O que mudou, por quê (1-2 linhas). Referência ao item do PLANO_DE_MELHORIAS.md/ROADMAP se aplicável.
```

Use este arquivo só para itens que nasceram desta auditoria (M-01 a M-13). Mudanças de produto
normais continuam registradas via commit — não migrar o histórico existente para cá.
