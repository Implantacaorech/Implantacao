---
titulo: "Histórico"
tipo: indice
status: em-andamento
criado: 2026-07-19
atualizado: 2026-07-19
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - histórico
relacionados:
  - "[[17 - ADR]]"
  - "[[19 - Roadmap]]"
  - "[[20 - Releases]]"
---

# Histórico

> [!info] Sobre esta seção
> Linha do tempo de eventos, decisões e marcos relevantes do projeto, incluindo a migração
> Flask → NestJS/Angular e a troca Postgres → MariaDB.

## Linha do tempo

- **2026-07-19** — Decisão de adotar o Vault Obsidian + IA como ecossistema de documentação
  técnica ([[ADR-0001 - Adocao do ecossistema Vault + IA|ADR-0001]]). Vault criado
  (26 seções) e `CLAUDE.md` atualizado.
- **2026-07-19** — Aberto o **PR #8** (`feature/migracao-angular-backend-moderno` → `main`):
  <https://github.com/Implantacaorech/Implantacao/pull/8> — reúne os 41 commits da migração
  do Painel (Flask → Angular/NestJS/MariaDB) mais o Vault. Ainda não mergeado; branch
  protection em `main` segue pendente (ver [[12 - DevOps]] e [[22 - Troubleshooting]]).
- **2026-07-19** — CI ampliado: `backend-test` (Jest, 364 testes) e `frontend-test`
  (Vitest, 111 testes) plugados em `.github/workflows/ci.yml`, fechando o gap citado no
  PR #8 (antes só o painel Flask legado rodava no CI). Ver [[11 - Testes]] e [[12 - DevOps]].
- **2026-07-19** — Auditoria de arquitetura do código real (não um refactor): backend segue
  padrão NestJS idiomático por feature (25 módulos), sem Repository Pattern formal nem
  camadas DDD; frontend é 100% standalone components + Signals, sem NgModule legado.
  Detalhe em [[02 - Arquitetura]], [[03 - Backend]] e [[04 - Frontend]].
- **2026-07-19** — DER + dicionário de dados completos (26 entidades), 3 diagramas Mermaid
  reais, lint no CI (best-effort), Casos de Uso + FAQ reais, busca semântica (RAG-lite)
  testada ponta a ponta, e backlog consolidado. Ver [[19 - Roadmap]] para o que ficou de
  fora e por quê.
- **2026-07-19 (virada para produção)** — Fase 1 do plano de virada validada manualmente
  pelo responsável do projeto. Na Fase 2, achado que o Flask estava fora do ar desde
  18/07 (Postgres desaparecido durante a janela de migração de banco do stack novo,
  2 dias sem ninguém notar — ver [[22 - Troubleshooting]] item 5). Decisão do responsável
  do projeto: seguir direto para produção só com o stack novo. Flask desligado (processo +
  Tarefas Agendadas do guardião/integridade) e arquivos exclusivos dele movidos para
  `projeto_old/` (preservando `webapp/legado_cli.py`+`runner.py`+`roles.py`+`forms.py` e
  todo `tools/`, dependências vivas do backend novo). CI atualizado (`tools-smoke`
  substitui os jobs do Flask). Registro completo em
  `docs/migracao/05-plano-de-virada.md` §"Registro real da virada".
- **2026-07-19 (mesma noite)** — Telemetria real de execução de agentes: módulo
  `backend/src/agentes/` (entity + migration aplicada em produção + API + testes e2e) e
  painel "Agentes de IA" (grafo SVG + feed) dentro do Centro de Monitoramento Operacional.
  Provado com dado real (4 execuções genuínas desta sessão, não simulação) via conta de
  serviço `sistema-agentes`. No caminho, um incidente breve (~1-2min de indisponibilidade
  por restart com porta errada) foi causado, percebido e corrigido na hora — registrado em
  [[22 - Troubleshooting]] item 6, não escondido. Ver [[14 - IA]].

## Relacionados no Vault

- [[17 - ADR]]
- [[19 - Roadmap]]
- [[20 - Releases]]

## Aponta para (conteúdo real do repositório)

- `../docs/agentes-software.md`

## Status

Esqueleto criado em 2026-07-19 — conteúdo será enriquecido incrementalmente. Ver [[00 - Dashboard]].
