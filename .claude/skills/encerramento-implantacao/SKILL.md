---
name: encerramento-implantacao
description: >
  Finalização da implantação e transição para manutenção/suporte. Use para revisar pendências e
  RNS, atualizar a RNS(I), preencher o checklist do follow up (a–i), elaborar o Termo de
  Encerramento e enviar os e-mails de encerramento (cliente e Coordenação/Gerência). Palavras-gatilho:
  encerramento, finalização, termo de encerramento, transição, follow up, fechar projeto.
---

# Finalização da Implantação e Transição

**Etapa do processo:** 3.8 · **Responsável:** Consultor (elabora) + Gerente do Projeto (valida, item *h*)

## Objetivos
Concluir pendências do projeto, revisar/entregar RNS, registrar particularidades no SICLA,
formalizar o encerramento com o cliente e comunicar a confirmação ao Gerente do Projeto.

## Passo a passo

### 1. Revisão das pendências (3.8.1)
- Concluídas → status **"concluídas"**.
- Em tratamento (não impeditivas) → mencionar no **termo** e no **follow up da RNS(I)**.

### 2. Revisão das RNS vinculadas (3.8.2)
- Geradas/entregues → status **"Entregues"**.
- Em tratamento (não impeditivas) → mencionar no termo/follow up; se ligadas à implantação,
  serão entregues futuramente pelo consultor responsável.

### 3. Atualização da RNS(I) (3.8.3)
- Módulos **implantados** (configurados + treinados): etapa **"Final do Projeto"** → **"Concluída"**.
  Se o cliente optar por não usar → mencionar no termo/follow up.
- Módulos **não implantados**: motivo + pretensão (manter/cancelar) no termo/follow up.
- **Usuários:** demitidos → data de demissão no contato (inativa); ativos treinados → revisar
  nome, e-mail, telefone, módulos capacitados; indicar **responsável pela atualização**.

### 4. Checklist do follow up (itens a–i)
Preencher na aba "Follow up" da RNS(I). Use `templates/checklist-followup-rns.md`.
Item **h** (negociações em aberto) é do **Gerente do Projeto**.

### 5. Termo de Encerramento
Elaborar (referenciar o projeto, ratificar o atendido + ressalvas, alterações de escopo por área,
quadro de módulos). Gere o documento **fiel ao template Rech**:
```bash
# edite tools/data/termo.yaml
python tools/gerar_termo_encerramento.py   # -> exemplos/Termo_Encerramento_<cliente>.docx
```
Depois envie ao **Setor Adm** → assinatura digital → arquivamento.

### 6. E-mails (3.8.4)
- **Ao cliente** (dá dinâmica; **registrar no SICLA**) — não dispensa o termo assinado.
- **À Coordenação/Gerência** formalizando o checklist.
Use `templates/email-encerramento.md`.

## Saída
Projeto encerrado: RNS(I) atualizada, termo enviado, e-mails registrados, transição ao Suporte
formalizada.
