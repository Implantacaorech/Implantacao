---
name: hypercare
description: >
  Hypercare — período de estabilização intensiva pós-virada, com governança diária, registro de
  chamados e critérios de saída objetivos para liberar a transição ao Suporte. Use para planejar e
  controlar o pós-go-live. Palavras-gatilho: hypercare, pós-virada, estabilização, command center,
  critério de saída, transição para suporte, primeiros fechamentos.
---

# Hypercare (estabilização pós-virada)

**Etapa do processo:** formaliza 3.7 (`acompanhamento-producao`) · **Responsável:** Consultor + Gerente do Projeto
**Por quê (P1):** você já acompanha *full time*; o mercado formaliza **janela**, **governança
diária** e **critérios de saída quantitativos** (a saída deixa de ser só documental).

## Janela e governança
- **Janela típica:** 4 semanas (ajustar à complexidade).
- **Command center:** consultor + usuário líder + suporte.
- **Stand-up diário** nas 2 primeiras semanas; depois 2x/semana.
- **Escalonamento:** incidente Crítico tratado em até 2h.
- Agendas estratégicas: full time no início, espaçando após o pico (como já previsto em 3.7.1).

## O que controlar
- **Registro de chamados** (severidade, status, resolução, tempo).
- **Acompanhamento diário** (abertos, resolvidos, críticos, adesão %).
- **Primeiros fechamentos críticos** (estoque, impostos, financeiro).

## Como gerar (Office)
```bash
# ajuste tools/data/hypercare.yaml (janela e critérios)
python tools/gerar_painel_hypercare.py   # -> exemplos/Painel_Hypercare_<cliente>.xlsx
```
O painel calcula a janela a partir da `data_virada_prevista` do cliente e cria um dia a dia.

## Critérios de saída (gate para transição ao Suporte)
- 1º fechamento mensal concluído com sucesso.
- Volume de chamados em **queda por 2 semanas** consecutivas.
- **0** incidentes Críticos em aberto.
- **≥ 80%** de adesão de uso na última semana.
- Usuário responsável pela atualização definido.
- Remessas/integrações estáveis.

## Integração
Conecta `gestao-mudanca` (medir adoção) e `encerramento-implantacao` (só encerra com os
critérios atingidos → termo + transição ao Suporte).
