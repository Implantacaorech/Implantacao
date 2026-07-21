---
titulo: "Regras de Negócio"
tipo: indice
status: esqueleto
criado: 2026-07-19
atualizado: 2026-07-21
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - regras-de-negócio
relacionados:
  - "[[01 - Projeto]]"
  - "[[09 - Casos de Uso]]"
  - "[[15 - Agentes]]"
---

# Regras de Negócio

> [!info] Sobre esta seção
> Regras do domínio de implantação do SIGER® (SICLA, RNS, papéis, prazos). Este Vault não substitui os documentos de processo já existentes — aponta para eles como fonte.

## Regras de negócio por tela do Painel (transcritas do código)

Geradas pela skill `codigo-para-regra` a partir do código vivo — regenere quando a tela mudar,
não edite regra a regra à mão.

- [[RN - Modo IA (Config IA)]] — como o Painel configura IA por finalidade (provedor/chave/modelo), só ADM.
- [[RN - Dicionário Inteligente]] — busca/pergunta sobre a documentação do SIGER®; RAG que nunca inventa; qualquer autenticado.
- [[RN - Fluxo de Projetos (Onboarding)]] — cria o projeto a partir do e-mail de fechamento (parse, dedup, pacote inicial, e-mail-resumo).
- [[RN - Protocolos de Treinamento]] — vídeo → transcrição → IA → revisão → publicação; aprovar/reprovar só ADM/Coordenador.

## Relacionados no Vault

- [[01 - Projeto]]
- [[09 - Casos de Uso]]
- [[15 - Agentes]]

## Aponta para (conteúdo real do repositório)

- `../docs/processo-implantacao.md`
- `../docs/glossario.md`
- `../CLAUDE.md#regras-críticas-não-pular`

## Status

Esqueleto criado em 2026-07-19; regras por tela do Painel adicionadas a partir de 2026-07-21. Ver [[00 - Dashboard]].
