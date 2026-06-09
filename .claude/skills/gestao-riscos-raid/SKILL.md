---
name: gestao-riscos-raid
description: >
  Gestão de riscos e issues via RAID (Riscos, Premissas/Assumptions, Issues, Decisões e
  Dependências) por projeto. Use para registrar e acompanhar riscos, premissas a validar, problemas
  ativos, decisões tomadas e dependências de terceiros. Palavras-gatilho: risco, RAID, issue,
  premissa, decisão, dependência, registro de riscos, plano de mitigação.
---

# Gestão de Riscos — RAID

**Transversal** · **Responsável:** Gerente do Projeto + Consultor
**Por quê (P2):** hoje riscos/decisões vivem implícitos nas pendências do SICLA. O RAID os torna
explícitos e rastreáveis.

## O que é RAID
| Letra | Categoria | Conteúdo |
|-------|-----------|----------|
| **R** | Riscos | Eventos futuros que podem impactar (impacto × probabilidade + mitigação) |
| **A** | Premissas (Assumptions) | O que assumimos como verdade (e precisa ser validado) |
| **I** | Issues | Problemas que **já** ocorreram e exigem ação |
| **D** | Decisões / Dependências | O que foi decidido e o que depende de terceiros |

## Como gerar (Office)
```bash
# ajuste tools/data/raid.yaml
python tools/gerar_raid.py   # -> exemplos/RAID_<cliente>.xlsx
```
Gera uma aba por categoria, com dropdowns de impacto/probabilidade/severidade/status.

## Boas práticas
- Revisar o RAID nas reuniões de status (quinzenais).
- Risco que se materializa **vira Issue**; Issue resolvida pode virar **Decisão/lição**.
- Premissa não validada é risco em potencial — cobrar validação.

## Integração
Riscos/issues podem gerar RNS (`encaminhar-desenvolvimentos`) ou ajustes (`parametrizacoes`);
decisões de escopo conversam com o `aderencia-siger` (fit/gap) e o `projeto-implantacao`.
