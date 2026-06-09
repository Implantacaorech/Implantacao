---
name: testes-sit-uat
description: >
  Gestão de testes formais SIT (Teste Integrado) e UAT (Aceite do Usuário) — substitui as
  "simulações" informais por roteiros versionados, registro de defeitos e sign-off como gate da
  virada. Use para montar roteiros de teste por módulo, registrar defeitos, controlar o aceite e
  gerar as planilhas/termo em Office. Palavras-gatilho: teste, SIT, UAT, aceite, roteiro de teste,
  caso de teste, defeito, homologação, sign-off, gate da virada.
---

# Testes SIT / UAT

**Etapa do processo:** 3.6 (evolução das `simulacoes`) · **Responsável:** Consultor (SIT) + Cliente (UAT)
**Por quê:** o processo marcava "roteiros à construir". Esta skill constrói e formaliza.

## SIT vs. UAT
| | SIT (Teste Integrado) | UAT (Aceite do Usuário) |
|--|-----------------------|--------------------------|
| Quem | Consultor de Implantação | Usuários do cliente |
| Foco | Integração entre módulos (macroprocesso) | Processo real do dia a dia |
| Quando | Após parametrização/treino | Antes da virada (gate) |
| Saída | Defeitos corrigidos | **Sign-off** que libera a virada |

## O que testar (processos críticos)
Emissão e reflexos (tributação, comissão, baixa de estoque); entrada de notas (estoque, custo,
conversão de unidade); produção; financeiro (remessa/retorno bancário); fiscal (apuração, SPED);
e o **macroprocesso ponta a ponta**. Os casos padrão estão em `tools/data/roteiros_teste.yaml`.

## Fluxo
1. **Roteirizar:** ajuste/expanda `tools/data/roteiros_teste.yaml` ao escopo do cliente.
2. **Gerar** as planilhas e o termo:
   ```bash
   python tools/gerar_roteiros_teste.py   # -> Roteiros_SIT_UAT_<cliente>.xlsx
   python tools/gerar_aceite_uat.py       # -> Termo_Aceite_UAT_<cliente>.docx
   ```
3. **Executar:** marcar Status (Aprovado/Reprovado/Bloqueado) por caso.
4. **Defeitos:** registrar na aba "Registro de Defeitos" (severidade + responsável).
5. **Sign-off:** validar o gate na aba "Resumo e Sign-off" e assinar o termo.

## Gate da virada (critério de liberação)
- **≥ 95%** dos casos **UAT Aprovados**.
- **0** defeitos de severidade **Crítica** em aberto.
- Defeitos **Altos** com plano de ação acordado.
- Remessas bancárias e integrações homologadas (quando aplicável).

## Integração
É pré-requisito de `virada-oficial`: sem sign-off, não libera a preparação de dados/virada.
Os defeitos viram, quando necessário, RNS (`encaminhar-desenvolvimentos`) ou ajustes de
parametrização (`parametrizacoes`).
