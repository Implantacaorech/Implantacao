---
name: validacao-conversao
description: >
  Validação e reconciliação dos dados convertidos (origem × destino) antes da virada. Use para
  conferir contagem e valores por entidade, controlar as cargas de teste (mock loads), validar
  amostras e formalizar o aceite dos dados convertidos. Palavras-gatilho: reconciliação, validação
  de conversão, conferência de dados, mock load, ponto de corte, aceite da conversão.
---

# Validação e Reconciliação de Conversão

**Etapa do processo:** complementa 3.3.2 (`encaminhar-conversoes`) · **Responsável:** Consultor + Equipe de Conversão
**Por quê (P1):** o processo cobre a mecânica da conversão, mas não a **validação**. Esta skill
fecha esse gap com reconciliação e sign-off.

## O que validar (por entidade)
| Entidade | Conferência típica |
|----------|--------------------|
| Clientes/Fornecedores | Contagem; de/para de grupo, representantes, local de cobrança |
| Produtos | Contagem; saldo de estoque e custo médio na data de corte |
| Financeiro a Pagar/Receber | Contagem de títulos; **soma dos saldos em aberto** |
| Notas Fiscais emitidas | Contagem; numeração e totais por série |

## Fluxo
1. **Cargas de teste (mock loads):** execute Prévia 1, Prévia 2 e, por fim, a Conversão oficial.
2. **Reconciliação:** para cada entidade, confira **Qtd Origem × Qtd Destino** e
   **Valor Origem × Valor Destino** (diferença deve ser 0 nas entidades-chave).
3. **Amostra:** valide manualmente ~20 registros por entidade.
4. **Sign-off:** registre o aceite (consultor + conversão + cliente).

## Como gerar (Office)
```bash
# ajuste tools/data/conversao.yaml
python tools/gerar_reconciliacao_conversao.py   # -> exemplos/Reconciliacao_Conversao_<cliente>.xlsx
```

## Critérios de aceite (gate)
- Diferença de contagem = 0 nas entidades-chave.
- Soma de valores financeiros confere (origem × destino).
- Amostra validada; divergências conhecidas documentadas e **aceitas pelo cliente**.
- **Ponto de corte** definido e comunicado.

## Integração
Pré-requisito de `virada-oficial`. Os tempos seguem apontados na **RNS de conversão**
(ver `encaminhar-conversoes`).
