---
name: virada-oficial
description: >
  Preparação de dados e checklist para a virada oficial (início do uso em produção). Use para
  alinhar pendências que impactam a virada (remessas, integrações, ponto de corte, inventário) e
  montar/aplicar o checklist de virada. Palavras-gatilho: virada oficial, go-live, ponto de corte,
  checklist de virada, preparação de dados, homologação de remessa.
---

# Virada Oficial

**Etapa do processo:** 3.6.2 / 3.6.3 · **Responsável:** Consultor

## Preparação de dados (3.6.2)
Alinhe as situações que impactam a virada:
- Gerações de **remessas bancárias homologadas** (quando aplicável).
- **Integrações com terceiros** testadas e homologadas (quando aplicável).
- **Ponto de corte** para a conversão final de dados (quando aplicável).
- **Data e ação de apuração de inventário** (quando aplicável).
- Confirmar que as **simulações** necessárias foram executadas.
- **Ponto de corte** para limpeza dos movimentos de teste na base oficial.
- Outros pontos relevantes ao cenário do cliente.

## Checklist de virada (3.6.3)
Pontos-chave dos processos que rodam na virada:
- **Revisão das integrações entre os módulos.**
- **Ajuste de numeração de notas fiscais** para o uso oficial.
- Roteiros por área/módulo (em construção).

> Use e preencha `templates/checklist-virada-oficial.md`.

## Saída
Dados preparados + checklist aplicado → autoriza o início da `acompanhamento-producao`.
