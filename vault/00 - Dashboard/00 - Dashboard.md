---
titulo: "Dashboard"
tipo: indice
status: esqueleto
criado: 2026-07-19
atualizado: 2026-07-19
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - dashboard
relacionados:
  - "[[01 - Projeto]]"
  - "[[02 - Arquitetura]]"
  - "[[14 - IA]]"
  - "[[19 - Roadmap]]"
---

# Dashboard

> [!info] Sobre este Vault
> Ponto de entrada único do ecossistema de documentação deste projeto. Qualquer pessoa ou
> IA que abra este repositório deve começar por aqui. Este Vault documenta a **arquitetura e
> o processo de engenharia** (stack TypeScript/NestJS/Angular/MariaDB em migração); as
> **regras de negócio da implantação SIGER®** continuam tendo [[../CLAUDE.md|CLAUDE.md]] e
> `docs/` como fonte — ver [[08 - Regras de Negócio]].

<!-- -->

> [!warning] Estado real do projeto (não confundir com aspiração)
> Este Vault nasceu em 2026-07-19 como **esqueleto**. As seções abaixo têm uma nota-índice
> cada, mas a maior parte do conteúdo profundo (DER, casos de uso, roteiros de teste,
> dashboards de cobertura/segurança, RAG/embeddings etc.) ainda **não existe** — é trabalho
> incremental descrito no [[19 - Roadmap]] e rastreado no [[17 - ADR/ADR-0001 - Adocao do ecossistema Vault + IA|ADR-0001]].

## Mapa do Vault

| Seção | Conteúdo |
| --- | --- |
| [[01 - Projeto]] | Objetivos, escopo, stakeholders |
| [[02 - Arquitetura]] | Clean Architecture, camadas, decisões estruturais |
| [[03 - Backend]] | NestJS/TypeScript — módulos, controllers, services |
| [[04 - Frontend]] | Angular/TypeScript — componentes, rotas, serviços |
| [[05 - Banco de Dados]] | MariaDB, TypeORM, migrations, DER |
| [[06 - APIs]] | Endpoints REST, Swagger/OpenAPI |
| [[07 - Documentação]] | Convenções deste próprio Vault |
| [[08 - Regras de Negócio]] | SICLA, RNS, papéis — aponta para `docs/` |
| [[09 - Casos de Uso]] | Atores e fluxos do sistema |
| [[10 - Fluxogramas]] | Diagramas Mermaid |
| [[11 - Testes]] | Estratégia de testes (novo stack + pytest legado) |
| [[12 - DevOps]] | CI/CD, deploy, PR obrigatório |
| [[13 - Segurança]] | Permissões, segredos, LGPD |
| [[14 - IA]] | Papel da IA como membro da equipe |
| [[15 - Agentes]] | Agentes especializados (`.claude/agents/`) |
| [[16 - Prompts]] | Prompts e skills (`.claude/skills/`) |
| [[17 - ADR]] | Decisões arquiteturais registradas |
| [[18 - Histórico]] | Linha do tempo de eventos e marcos |
| [[19 - Roadmap]] | Próximas fases do ecossistema |
| [[20 - Releases]] | Changelog e releases |
| [[21 - Conhecimento]] | FAQ e "como fazer" |
| [[22 - Troubleshooting]] | Problemas conhecidos e soluções |
| [[23 - Padrões]] | Convenções de código e arquitetura |
| [[24 - Templates]] | Modelos para novos documentos |
| [[25 - Automações]] | Scripts e robôs de sincronização |

## Ligações essenciais fora do Vault

- [[../CLAUDE.md|CLAUDE.md]] — guia curto do repositório, regras críticas de negócio (SICLA/RNS/prazos).
- [[../memoria_ia/estado-atual.md|memoria_ia/estado-atual.md]] — estado do painel Flask legado (desatualizado quanto à migração Angular/NestJS — ver [[22 - Troubleshooting]]).
- [[../memoria_ia/pendencias.md|memoria_ia/pendencias.md]] — backlog técnico da camada de IA.
- [[../docs/agentes-software.md|docs/agentes-software.md]] — mapa dos agentes de software e fronteiras por módulo.

## Como abrir este Vault no Obsidian

Abra a pasta `vault/` (não a raiz do repositório) como vault no Obsidian, para que os
wikilinks relativos entre as seções resolvam corretamente.
