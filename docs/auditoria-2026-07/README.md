# Auditoria técnica — 2026-07-10

Índice dos 18 entregáveis desta auditoria. Escopo real (monolito Flask + Postgres, deploy
manual, sem containers/K8s) — não o template genérico de infraestrutura corporativa que a
originou. Integra-se ao já existente em `docs/agentes-software.md` e
`docs/runbooks-operacao.md` em vez de duplicar.

1. [DIAGNOSTICO_GERAL_DO_PROJETO.md](DIAGNOSTICO_GERAL_DO_PROJETO.md) — visão geral, arquitetura, pontos fortes/frágeis.
2. [RELATORIO_DE_FALHAS_E_RISCOS.md](RELATORIO_DE_FALHAS_E_RISCOS.md) — 11 achados (F-01 a F-11), evidência por arquivo/linha.
3. [PLANO_DE_MELHORIAS.md](PLANO_DE_MELHORIAS.md) — 13 ações (M-01 a M-13), esforço/risco/prioridade.
4. [CATALOGO_DE_AGENTES.md](CATALOGO_DE_AGENTES.md) — por que nenhum agente novo foi criado.
5. [ESTRUTURA_DO_SETOR_DE_INFRAESTRUTURA.md](ESTRUTURA_DO_SETOR_DE_INFRAESTRUTURA.md) — inventário real de infra.
6. [MATRIZ_DE_RESPONSABILIDADES.md](MATRIZ_DE_RESPONSABILIDADES.md) — RACI dos agentes de software.
7. [PLANO_DE_TESTES.md](PLANO_DE_TESTES.md)
8. [PLANO_DE_BACKUP_E_RECUPERACAO.md](PLANO_DE_BACKUP_E_RECUPERACAO.md)
9. [PLANO_DE_SEGURANCA.md](PLANO_DE_SEGURANCA.md)
10. [PLANO_DE_MONITORAMENTO.md](PLANO_DE_MONITORAMENTO.md)
11. [PLANO_DE_IMPLANTACAO_E_ROLLBACK.md](PLANO_DE_IMPLANTACAO_E_ROLLBACK.md) — deploy de software (não confundir com "implantação" de cliente).
12. [MAPA_DE_DEPENDENCIAS.md](MAPA_DE_DEPENDENCIAS.md)
13. [MAPA_DE_RISCOS.md](MAPA_DE_RISCOS.md)
14. [ROADMAP_TECNICO.md](ROADMAP_TECNICO.md) — ondas imediato/curto/médio/longo prazo.
15. [CHECKLIST_DE_HOMOLOGACAO.md](CHECKLIST_DE_HOMOLOGACAO.md)
16. [CHECKLIST_DE_PRODUCAO.md](CHECKLIST_DE_PRODUCAO.md)
17. [RUNBOOK_DE_INCIDENTES.md](RUNBOOK_DE_INCIDENTES.md) — classificação S1-S4 + cenários.
18. [CHANGELOG.md](CHANGELOG.md) — registro desta auditoria; histórico normal continua no `git log`.

## Achado mais urgente

**F-01 (crítico):** senha padrão do Postgres (`painel2026`) em texto plano em
`docker-compose.yml` e `tools/painel-backup.sh`. Correção já roteirizada em
`docs/runbooks-operacao.md` §9 — falta só executar (M-01, ~30 min).

## O que esta auditoria deliberadamente não criou

Nenhum agente de software novo, nenhuma pasta `/infrastructure` com containers/rede/réplicas —
o projeto real não tem esse porte. Justificativa completa em `CATALOGO_DE_AGENTES.md` §3 e
`ESTRUTURA_DO_SETOR_DE_INFRAESTRUTURA.md` §"Por que não criar a árvore".
