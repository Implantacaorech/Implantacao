<!--
Gate de cobertura do teste integrado — §9.3 de GERARTESTEINTEGRADOPLAYWRIGHT.md.
Toda nova implementação entra em docs/TESTES-INTEGRADOS.md ANTES de ser considerada pronta.
-->

## O que muda

<!-- Uma frase. O porquê importa mais que o quê. -->

## Como testei

<!-- Comandos rodados e o que deu. `cd backend && npm test`, `cd frontend && npm test`,
     e o e2e quando mexer em passo, permissão ou geração de documento. -->

## Gate de cobertura (obrigatório)

Marque todas, ou explique abaixo por que não se aplica.

- [ ] Rodei a **varredura delta** (§9.2): `git diff --name-only main..HEAD`, e revi cada
      arquivo perguntando se nasceu rota, tela, campo, permissão, job, integração ou regra.
- [ ] Toda **superfície nova** está na **Seção 3** de [`docs/TESTES-INTEGRADOS.md`](../docs/TESTES-INTEGRADOS.md).
- [ ] Toda superfície **P0** nova tem caso `CT-###` na **Seção 4** e **spec passando**.
- [ ] Nenhum `CT-###` foi renumerado ou reaproveitado (caso removido vira
      `CT-0NN — REMOVIDO (motivo, data)` na Seção 13).
- [ ] **Seção 13** atualizada e versão do documento incrementada.
- [ ] Suíte `@p0` verde: `cd e2e && npm run test:p0`.
- [ ] Se mexi em rota pública: a lista `PUBLICAS` de
      [`e2e/testes/11-superficies-publicas.spec.ts`](../e2e/testes/11-superficies-publicas.spec.ts)
      e a Seção 5 do inventário foram atualizadas **com a razão**.

<!-- Não se aplica porque: -->

## Antes do merge

- [ ] `cd backend && npm test` e `cd frontend && npm test` verdes.
- [ ] `python tools/verificar.py` (só se mexi em `tools/`).
