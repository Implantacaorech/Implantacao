---
titulo: "ADR-0001 - Adoção do ecossistema Vault + IA"
tipo: adr
status: aceito
criado: 2026-07-19
atualizado: 2026-07-19
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - adr
  - decisao
relacionados:
  - "[[17 - ADR]]"
  - "[[00 - Dashboard]]"
  - "[[14 - IA]]"
  - "[[08 - Regras de Negócio]]"
---

# ADR-0001 — Adoção do ecossistema Vault + IA

## Status

Aceito em 2026-07-19.

## Contexto

O usuário solicitou a transformação do repositório em um "ecossistema inteligente de
desenvolvimento": documentação como código (Documentation as Code) num Vault Obsidian de 26
seções, integração com um motor de IA de organização de conhecimento (rotulado no pedido
original como "Nano Banana"), pesquisa semântica/RAG, automação contínua de documentação ↔
código ↔ testes, e um fluxo de Git com PR + CI + revisão obrigatória antes de qualquer
merge.

Ao investigar o repositório antes de agir, três fatos relevantes foram confirmados:

1. **A migração de stack já é real**, não aspiracional: o branch
   `feature/migracao-angular-backend-moderno` já tem `backend/` (NestJS/TypeORM) e
   `frontend/` (Angular) coexistindo com o `webapp/` Flask legado, incluindo suporte a
   MariaDB e um script de migração de dados Postgres → schema novo.
2. **[[../CLAUDE.md|CLAUDE.md]]** (regras do repositório, prioridade declarada) descreve um
   modelo deliberadamente enxuto — documentação em pt-BR, memória em `memoria_ia/`, contexto
   consultado sob demanda, "não faça varredura completa do projeto sem justificativa". Isso
   está em tensão direta com a exigência de auditoria contínua e varredura total do pedido
   original.
3. **"Nano Banana"** é, na realidade, o apelido do modelo de geração de *imagens* do Google
   (Gemini 2.5 Flash Image) — não uma ferramenta de organização de documentação/conhecimento.
   Perguntado, o usuário confirmou que quer o modelo de imagem real, não um agente com esse
   nome.

## Decisão

- O **Vault Obsidian** (`vault/`, 26 pastas `00`–`25`) passa a ser a fonte oficial de
  documentação **técnica e arquitetural** do projeto (stack, backend, frontend, banco,
  testes, DevOps, ADRs). Ele **não substitui** [[../CLAUDE.md|CLAUDE.md]] nem `docs/` como
  fonte das regras de **negócio** da implantação SIGER® (SICLA, RNS, papéis, prazos) — ver
  [[08 - Regras de Negócio]]. As duas camadas coexistem e se referenciam.
- [[../CLAUDE.md|CLAUDE.md]] foi atualizado para apontar para o Vault como entrada técnica,
  mantendo intactas as regras críticas de negócio já existentes (não foram removidas nem
  reescritas).
- A integração real com o Nano Banana (Gemini 2.5 Flash Image) **fica pendente de
  configuração externa** — não há, nesta sessão, ferramenta de geração de imagem conectada
  nem chave de API disponível. Ver pendência em [[22 - Troubleshooting]].
- O fluxo de **PR obrigatório + CI + revisão antes de merge** fica **documentado** em
  [[12 - DevOps]] como processo-alvo, mas a configuração de branch protection no GitHub via
  API **não pôde ser aplicada** nesta sessão: não há `gh` CLI instalado, não há
  `GITHUB_TOKEN` no ambiente, e o login OAuth interativo não é executável numa sessão
  não-interativa. Ver pendência em [[22 - Troubleshooting]].

## Consequências

- Trabalho incremental: o Vault nasce como esqueleto (uma nota-índice por seção); conteúdo
  profundo (DER completo, casos de uso, roteiros de teste, dashboards) é preenchido aos
  poucos — não em uma única sessão. Ver [[19 - Roadmap]].
- `memoria_ia/estado-atual.md` continua desatualizado quanto à migração Angular/NestJS; isso
  é uma lacuna pré-existente, não causada por esta decisão, registrada em
  [[22 - Troubleshooting]].
- Decisões futuras que revoguem ou alterem este ADR devem ser registradas como um novo ADR
  (ADR-0002 em diante) referenciando este.
