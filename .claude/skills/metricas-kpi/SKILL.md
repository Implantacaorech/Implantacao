---
name: metricas-kpi
description: >
  Métricas e KPIs da implantação — mede resultado, não só esforço. Use para montar e acompanhar
  indicadores (prazo, orçamento, adoção, time-to-value, qualidade, CSAT), marcos do projeto e
  horas planejado×real. Palavras-gatilho: KPI, indicador, métrica, on-time, on-budget, adoção,
  time-to-value, CSAT, painel de desempenho.
---

# Métricas e KPIs

**Transversal** · **Responsável:** Gerente do Projeto + Consultor
**Por quê (P2):** o processo media **esforço** (horas/SLA); o setor mede **resultado** (adoção,
valor, qualidade). Esta skill fecha esse gap.

## KPIs sugeridos
| Categoria | KPI | Meta de referência |
|-----------|-----|--------------------|
| Projeto | Prazo (on-time) | Virada na data prevista (±5%) |
| Projeto | Orçamento (on-budget) | Horas reais ≤ contratadas+bonificadas |
| Adoção | % usuários treinados | 100% antes da virada |
| Adoção | Adoção de uso (1ª semana) | ≥ 80% |
| Qualidade | % UAT aprovado | ≥ 95% |
| Qualidade | Defeitos críticos na virada | 0 |
| Valor | Time-to-value | 1º fechamento no 1º mês |
| Estabilização | Chamados no hypercare | Queda semana a semana |
| Satisfação | CSAT | ≥ 4 de 5 |

## Como gerar (Office)
```bash
# ajuste tools/data/kpi.yaml
python tools/gerar_painel_kpi.py   # -> exemplos/Painel_KPIs_<cliente>.xlsx
```
O painel traz **KPIs (com farol)**, **marcos (prazo)** e **horas (planejado × real)** com
fórmulas de desvio.

## Integração
Consome dados de `testes-sit-uat` (% UAT), `gestao-mudanca` (adoção), `hypercare` (chamados) e
da RNS(I) (horas). Alimenta o `dossie-cliente` e o e-mail de encerramento.
