---
titulo: "Padrões"
tipo: indice
status: vigente
criado: 2026-07-19
atualizado: 2026-07-31
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - padroes
relacionados:
  - "[[02 - Arquitetura]]"
  - "[[24 - Templates]]"
---

# Padrões

> [!info] Sobre esta seção
> Convenções de código e arquitetura adotadas: Clean Code, SOLID, DRY, KISS, Repository Pattern, Dependency Injection.

## Padrões vigentes

| Padrão | Adotado por | Verificado por |
| --- | --- | --- |
| [[Guia Mestre de Arquitetura de Desenvolvimento]] | [[ADR-0002 - Adocao do Guia Mestre de Arquitetura]] | 3 guardas no CI (backend, frontend, docservice) |

## Relacionados no Vault
- [[02 - Arquitetura]]
- [[24 - Templates]]
- [[17 - ADR]]

## Aponta para (conteúdo real do repositório)

- `backend/src/plano-cronograma/` — **módulo de referência** da arquitetura em camadas
  (Controller → Service → Repository), com os 6 documentos exigidos em `docs/`
- `backend/src/common/conformidade-arquitetura.spec.ts` — guarda do backend
- `frontend/src/app/conformidade-arquitetura.spec.ts` — guarda do frontend
- `docservice/tests/test_conformidade_arquitetura.py` — guarda do docservice
- `docs/pendencias.md` — plano de adequação por fase

## Status
Deixou de ser esqueleto em 2026-07-31, com o registro do
[[Guia Mestre de Arquitetura de Desenvolvimento]]. Ver [[00 - Dashboard]].
