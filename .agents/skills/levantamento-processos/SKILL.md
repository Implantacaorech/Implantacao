---
name: levantamento-processos
description: >
  Mapeamento (levantamento) de processos na pré-implantação — apoio comercial. Use quando for
  preparar, conduzir ou documentar o levantamento macro das demandas do cliente para aderência ao
  SIGER®, antes do fechamento do contrato. Cobre geração da demanda, elaboração do documento no
  template padrão e registros no SICLA tipo 12. Palavras-gatilho: levantamento, mapeamento,
  pré-implantação, apoio comercial, demanda de levantamento.
---

# Levantamento (Mapeamento) de Processos — Pré-implantação

**Etapa do processo:** 2.1 · **Responsável:** Consultor (executa) + Setor Adm (prévia do doc)
**Registro no SICLA:** tipo **12** (apoio comercial)

## Objetivo
Mapear as demandas do cliente para aderência do software ainda no pré-fechamento comercial e
apoiar demonstrações do SIGER® quando solicitado.

## Entradas
- Solicitação do Comercial à Coordenação (agenda de consultor).
- Template padrão de levantamento e exemplo (ver `docs/recursos-e-caminhos.md`).
- Base de demonstração (quando aplicável).

## Passo a passo
1. **Demanda:** Comercial solicita à Coordenação; a Coordenação designa o(s) consultor(es) por
   área de mapeamento (ver `docs/papeis-responsabilidades.md`).
2. **Documento:** o Setor Adm elabora a **prévia** no formulário padrão vigente e disponibiliza
   por **link no Google Drive**. O consultor pode solicitar a elaboração ao Setor Adm.
3. **Pasta do cliente:** Setor Adm cria em `...\3-Documentação_Clientes\1-Clientes_Imp`.
4. **Execução junto ao cliente:** conduza o levantamento priorizando módulos necessários,
   particularidades, formulários/relatórios que exijam similaridade no SIGER®.
5. **Registro no SICLA (tipo 12):** registre agenda/visita; no protocolo, **indique o link do
   documento e cole o texto** do levantamento.

## Saídas
- Documento de levantamento preenchido (link no Drive).
- Registros no SICLA (tipo 12).
- Base para a **devolutiva ao Comercial** (módulos, conversões, horas).

## Templates
- `templates/email-encaminhamento-levantamento.md`

## Geração do documento (fiel ao template Rech)
```bash
# edite tools/data/levantamento.yaml
python tools/gerar_levantamento.py   # -> exemplos/Levantamento_<cliente>.docx
```

## Próximo passo
`apoio-comercial-demonstracao` (devolutiva) → na contratação, `abertura-implantacao`.
