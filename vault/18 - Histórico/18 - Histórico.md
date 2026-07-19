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

## Relacionados no Vault

- [[17 - ADR]]
- [[19 - Roadmap]]
- [[20 - Releases]]

## Aponta para (conteúdo real do repositório)

- `../docs/agentes-software.md`

## Status

Esqueleto criado em 2026-07-19 — conteúdo será enriquecido incrementalmente. Ver [[00 - Dashboard]].
