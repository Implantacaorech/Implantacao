---
name: aderencia-siger
description: >
  Aderência ao SIGER® — sincronizar o mapeamento com o uso efetivo das funcionalidades. Use para
  definir quais recursos/rotinas do SIGER® serão usados, identificar configurações e
  parametrizações estratégicas e refinar simulações. Palavras-gatilho: aderência, definições de
  uso do SIGER, recursos do sistema, rotinas que serão usadas, configurações estratégicas.
---

# Aderência ao SIGER®

**Etapa do processo:** 3.3 / 3.3.1 · **Responsável:** Consultor
Ocorre **concomitante** ao `levantamento-micro`.

## Objetivo
Sincronizar o que foi mapeado com o uso efetivo do SIGER®:
- Definir **quais recursos/rotinas** do SIGER® serão usados para atender o cliente.
- Identificar **configurações e parametrizações estratégicas** necessárias ao projeto.
- Refinar **simulações** necessárias para garantir melhor uso das rotinas.

## Insumos
- Dados apurados no levantamento (`levantamento-micro`).
- Simulações com base de testes (ver `simulacoes`).

## Passo a passo
1. Para cada processo crítico mapeado, identifique a rotina equivalente no SIGER®.
2. Aponte as **configurações estratégicas** (padrões de carga, bloqueios, compartilhamentos).
3. Liste **lacunas** que exigirão conversão (`encaminhar-conversoes`) ou desenvolvimento
   (`encaminhar-desenvolvimentos`).
4. Registre pontos a simular antes da virada.

## Log de Fit/Gap (robustez P1)
Formalize a aderência num **log de fit/gap**: para cada processo, registre se é **Standard**,
**Configuração**, **Parcial** ou **Gap**, e a **decisão** (usar padrão / configuração /
desenvolvimento / fora de escopo). Governança: preferir **padrão > configuração >
desenvolvimento**; Gap só vira desenvolvimento com aprovação do Gerente do Projeto + RNS ORC.

```bash
# ajuste tools/data/fitgap.yaml
python tools/gerar_log_fitgap.py   # -> exemplos/Log_FitGap_<cliente>.xlsx
```

## Saída
Lista de recursos/rotinas definidos + configurações estratégicas + lacunas (conversão/
desenvolvimento) + **log de fit/gap** — base para o `projeto-implantacao`.
