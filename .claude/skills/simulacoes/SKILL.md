---
name: simulacoes
description: >
  Simulações de micro e macroprocessos para validar as rotinas treinadas antes da virada. Use
  para planejar e executar simulações de processos críticos (emissão, entrada de notas, produção)
  e do macroprocesso completo, antecipando ajustes. Palavras-gatilho: simulação, microprocesso,
  macroprocesso, testar rotinas, ênfase nos testes, cenário adverso.
---

# Simulações

**Etapa do processo:** 3.6 / 3.6.1 · **Responsável:** Consultor

## Objetivos
- **Microprocessos** (ex.: emissão de uma Nota Fiscal).
- **Macroprocessos** (ex.: pedido → reserva → faturamento → boleto na emissão → financeiro →
  baixa de estoque).
- **Antecipar cenários adversos** que exijam ajuste.

## O que simular (processos críticos)
- **Emissão e reflexos:** tributação, comissão, baixa de estoque.
- **Entrada de notas e reflexos:** movimentação de estoque, custos, conversões de unidade.
- **Geração de demanda de produção e reflexos.**

## Quando simular
- Durante os treinamentos; e
- Em um **período de ênfase** combinado com o cliente (conforme a capacidade de tempo dele),
  buscando sempre o **macroprocesso** para identificar ajustes.

## Saída
Rotinas validadas e lista de ajustes identificados. Alimenta a `virada-oficial`.

> Roteiros de simulação e checklist corporativos: em construção (ver `docs/recursos-e-caminhos.md`).
> Use `templates/checklist-virada-oficial.md` como apoio.
