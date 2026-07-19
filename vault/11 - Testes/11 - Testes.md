---
titulo: "Testes"
tipo: indice
status: em-andamento
criado: 2026-07-19
atualizado: 2026-07-19
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - testes
relacionados:
  - "[[03 - Backend]]"
  - "[[04 - Frontend]]"
  - "[[22 - Troubleshooting]]"
---

# Testes

> [!info] Sobre esta seção
> Estratégia de testes: unitários, integração e E2E no backend/frontend novos, além da
> suíte pytest do painel Flask legado.

## Cobertura atual por stack (validado 2026-07-19)

| Stack | Ferramenta | Onde roda | Resultado local |
| --- | --- | --- | --- |
| `webapp/` (Flask legado) | pytest | CI (`test`) | 128 testes, cobertura no relatório do CI |
| Schema vs. Postgres real | script próprio | CI (`test-postgres`) | smoke dedicado |
| `backend/` (NestJS) | Jest | CI (`backend-test`, novo) | 44 suítes / 364 testes |
| `frontend/` (Angular) | Vitest (`@angular/build:unit-test`) | CI (`frontend-test`, novo) | 27 arquivos / 111 testes |

Antes de 2026-07-19, `backend/` e `frontend/` tinham `npm test` funcionando localmente mas
**não rodavam no CI** — gap identificado ao redigir o PR #8 e fechado no mesmo dia
(ver [[12 - DevOps]] e [[18 - Histórico]]).

## Lint (adicionado 2026-07-19, best-effort — não bloqueia)

Rodei `npx eslint "{src,apps,libs,test}/**/*.ts"` no `backend/` antes de plugar no CI:
**1212 achados (1196 erros, 16 warnings)**, dos quais **1134 são auto-corrigíveis** (quase
todos formatação Prettier — vírgula final, quebra de linha), e uns poucos reais
(`@typescript-eslint/require-await` em 2 métodos `async` sem `await`).

**Decisão tomada:** não rodei `--fix` em massa — isso tocaria centenas de arquivos só por
formatação, um diff enorme e fora do que foi pedido nesta rodada. O job `backend-test`
agora roda o lint com `continue-on-error: true` (visível no CI, não bloqueia merge) até
alguém decidir rodar o `--fix` de propósito (ou aceitar a dívida como está).

`frontend/` **não tem ESLint configurado** (nem `eslint.config.*` nem a dependência no
`package.json`, nem `architect.lint` no `angular.json`) — diferente do backend, isso não é
"plugar no CI", é instalar e configurar do zero (`ng add @angular-eslint/schematics`).
Não fiz nesta rodada — registrado como pendência em [[19 - Roadmap]].

## O que ainda falta (não fechado nesta rodada)

- Testes E2E (frontend) — existe script `test:e2e` no `backend/package.json`, mas não há
  E2E de frontend configurado nem rodando.
- Cobertura mínima obrigatória (threshold) — nenhum dos jobs novos falha se a cobertura cair;
  só falha se algum teste quebrar.
- ESLint no frontend (do zero) — ver acima.
- Checagem de tipos do TypeScript (`tsc --noEmit`) não está no pipeline de CI.

## Relacionados no Vault

- [[03 - Backend]]
- [[04 - Frontend]]
- [[22 - Troubleshooting]]
- [[12 - DevOps]]

## Aponta para (conteúdo real do repositório)

- `../webapp/test_painel.py`
- `../backend/` (specs `*.spec.ts` via Jest)
- `../frontend/` (specs `*.spec.ts` via Vitest)
- `../.github/workflows/ci.yml`

## Status

Cobertura de CI ampliada em 2026-07-19 (backend + frontend plugados). Ver [[00 - Dashboard]].
