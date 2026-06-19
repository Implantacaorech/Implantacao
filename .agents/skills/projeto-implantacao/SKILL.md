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

## Geração do documento (engine de tokens, portada do gerador interno Rech)
O Projeto é gerado pela **engine de tokens** portada do `GeradorProjetoSIGER`: preenche o
template tokenizado, **remove as áreas não usadas**, reconstrói a tabela de usuários, **limpa os
marcadores do modelo** (vermelho/realce) e corrige o typo "Da de Início":
```bash
python tools/gerar_projeto_implantacao.py [data/projeto_<cliente>.yaml]
# -> exemplos/Projeto_Implantacao_<cliente>.docx
```
Dados em YAML, campos = **tokens** (`client_name`, `cnpj`, `conv_N_*`, `<area>_<subcampo>`,
`crono_*`, `horas_*`, `usuarios`, `equipe`, `areas_incluidas`). Requer o template tokenizado em
`tools/templates/base_projeto_tokenizado.docx` (ver README de lá). Estrutura canônica (áreas,
subcampos, 6 linhas de conversão incl. "Cadastro de Formulações") em `tools/schema_projeto.py`.

## Pipeline Levantamento → Projeto (com conversão verbal)
Replica o fluxo do `.exe` + IA:
1. **Importar** o levantamento (port do `mapping_import`):
   ```bash
   python tools/importar_mapeamento.py "<Levantamento.docx>"
   # -> tools/data/projeto_<cliente>.yaml (rotinas já no FUTURO)
   ```
   Aplica a **conversão verbal Presente→Futuro** (`tools/conversor_verbal.py`: *utiliza→utilizará*,
   *é→será*, voz passiva só no auxiliar), preservando termos protegidos (*Formulação/Estrutura*).
2. **Revisão do Gerente de Projeto** no YAML (ajustar/complementar rotinas por área).
3. **Gerar** o `.docx` (comando acima).

> Para redação com contexto, a IA (agente) pode reescrever as rotinas seguindo o prompt oficial
> (Presente→Futuro; verdades atemporais permanecem no presente).

## Próximo passo
`cronograma-implantacao` (em conjunto, mesmo prazo de 5 dias úteis).
