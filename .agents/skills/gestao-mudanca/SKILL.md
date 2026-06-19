---
name: gestao-mudanca
description: >
  Método de Gestão da Mudança (OCM) transversal à implantação, no modelo ADKAR. Use para planejar
  adoção, engajamento de stakeholders, comunicação, avaliação de prontidão, treinamento por papel
  e indicadores de adoção — e para gerar o Kit de Gestão da Mudança em Excel. Palavras-gatilho:
  gestão da mudança, OCM, ADKAR, adoção, stakeholders, comunicação, resistência, engajamento.
---

# Gestão da Mudança (OCM)

**Transversal** a todas as fases · **Responsável:** agente `gestao-mudanca` + Gerente do Projeto
**Por quê:** fecha a lacuna nº 1 frente ao setor — adoção pelas pessoas, não só configuração.

## Modelo ADKAR
| Dimensão | Pergunta | Como tratar |
|----------|----------|-------------|
| **A**wareness (Consciência) | Entende por que mudar? | Comunicar o "porquê" no kickoff |
| **D**esire (Desejo) | Quer apoiar? | Patrocínio da liderança; envolver donos de processo |
| **K**nowledge (Conhecimento) | Sabe usar? | Treino por cenário (não por tela) |
| **A**bility (Habilidade) | Consegue na rotina? | Tarefas práticas + simulações |
| **R**einforcement (Reforço) | Sustenta o novo? | Acompanhamento, indicadores, reconhecimento |

## Entregas (Kit de Gestão da Mudança)
1. **Mapa de stakeholders** (influência × interesse + estratégia).
2. **Plano de comunicação** (momento, público, canal, mensagem, responsável, frequência).
3. **Avaliação de prontidão** por grupo (nota 1–5 por dimensão ADKAR).
4. **Plano de treinamento por papel** (cenários do dia a dia).
5. **Indicadores de adoção** (% treinados, % UAT aprovado, adesão, CSAT).

## Como gerar (Office)
```bash
# 1. ajuste tools/data/gestao_mudanca.yaml e tools/data/exemplo_cliente.yaml
python tools/gerar_kit_mudanca.py
# -> exemplos/Kit_Gestao_Mudanca_<cliente>.xlsx
```

## Integração com o resto do processo
- Alimenta `treinamento-rotinas` (quem treinar, em quê, por cenário).
- Conecta com `acompanhamento-producao` e o futuro `hypercare` (medir adoção).
- O que mais "quebra" em ERP: patrocínio fraco, gestores despreparados, treino por tela e
  hypercare magro. Trate cada um explicitamente.
