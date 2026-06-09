---
name: projeto-implantacao
description: >
  Elaboração do Projeto de Implantação (documento obrigatório que formaliza o escopo). Use para
  redigir o projeto que delimita empresas atendidas, objetivos, conversões, cadastros, módulos,
  envolvidos e pontos críticos, e para conduzir assinatura e arquivamento. Palavras-gatilho:
  projeto de implantação, escopo, documento complementar ao contrato, premissas do projeto.
---

# Projeto de Implantação

**Etapa do processo:** 3.4.1 · **Responsável:** Consultor (elabora) + Setor Adm (assina/arquiva)
**Requisito NÃO opcional.** · **Prazo:** dentro dos 5 dias úteis (com Cronograma).

## Objetivo
Documento complementar ao contrato que formaliza o **escopo** definido no levantamento e na
aderência, identifica envolvidos/responsabilidades e a intenção de **data de uso oficial**.

## Premissas a atender
1. **Empresas atendidas** (no caso de vários CNPJs).
2. **Objetivos macro** pretendidos pelo cliente com a troca.
3. **Conversões:** o que será convertido, extração, validação e limitações.
4. **Cadastros diferenciados:** Tabelas, Produtos, Clientes/Fornecedores.
5. **Módulos/adicionais** por macro rotina (Estoque/Compras, Produção, Fiscal/Contábil,
   Financeiro etc.).
6. **Envolvidos:** participantes por área + **usuário líder** da contratante.
7. **Pontos críticos** e mudanças de método/recursos vs. sistema anterior.
8. **Fora do escopo:** pontos não previstos na aderência que **não** farão parte do escopo original.

## Cliente de menor porte
Projeto **simplificado** e objetivo, desde que conste com clareza **o que será** e **o que não
será** atendido.

## Formalização
Consultor redige → e-mail ao **Setor Adm** → **assinatura digital** (ambas as partes) →
**arquivamento** na pasta do cliente (`XXXX-Cliente`).

## Geração do documento (fiel ao template Rech)
O Projeto é gerado em **.docx fiel ao template oficial** a partir de `tools/data/projeto.yaml`:
```bash
python tools/gerar_projeto_implantacao.py   # -> exemplos/Projeto_Implantacao_<cliente>.docx
```
O YAML cobre os campos do ADM (cliente, CNPJ, equipe, usuários, cronograma macro, horas) e, por
**área** (grupo/sub), os blocos: *Módulos Previstos · Detalhamento · Particularidade · Não previsto*.
O boilerplate (Responsabilidades, Protocolos digitais) é fixo e reproduzido automaticamente.

## Auto-preenchimento a partir do Levantamento (IA)
Replica e melhora o gerador interno da Rech:
1. Extraia o conteúdo do levantamento:
   ```bash
   python tools/extrair_levantamento.py "<caminho do Levantamento.docx>"
   # -> tools/data/projeto_seed.yaml (notas por área)
   ```
2. **A IA redige** as descrições no formato do Projeto (Detalhamento / Particularidade / Não
   previsto) a partir das notas do seed, preenchendo `tools/data/projeto.yaml`.
3. **O Gerente de Projeto revisa/altera** o YAML antes de gerar.
4. Gere o `.docx` (comando acima).

> Cores do template original: 🟩 verde = campo do ADM · 🟥 vermelho = instrução (não vai no
> documento) · 🟨 amarelo = ponto a validar. O gerador já entrega a versão final (sem instruções).

## Próximo passo
`cronograma-implantacao` (em conjunto, mesmo prazo de 5 dias úteis).
