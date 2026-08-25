---
titulo: "ADR (Architecture Decision Records)"
tipo: indice
status: esqueleto
criado: 2026-07-19
atualizado: 2026-07-19
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - adr
relacionados:
  - "[[02 - Arquitetura]]"
  - "[[18 - Histórico]]"
---

# ADR (Architecture Decision Records)

> [!info] Sobre esta seção
> Registro histórico e imutável das decisões arquiteturais do projeto — por que, não só o
> quê. Um ADR não é editado depois de aceito; uma decisão que o revogar vira um novo ADR
> referenciando o anterior.

## Índice de ADRs

| # | Título | Status |
| --- | --- | --- |
| [[ADR-0001 - Adocao do ecossistema Vault + IA]] | Adoção do ecossistema Vault Obsidian + IA como camada de documentação | Aceito |
| [[ADR-0002 - Adocao do Guia Mestre de Arquitetura]] | Adoção do Guia Mestre de Arquitetura (Controller → Service → Repository), com adequação faseada e guarda no CI | Aceito |
| [[ADR-0003 - API de Dados como fronteira unica de banco]] | API de Dados como fronteira única de banco EXTERNO: catálogo de consultas nomeadas, contrato `/api/dados/v1`, chave de máquina e guarda no CI | Aceito |

## Relacionados no Vault

- [[02 - Arquitetura]]
- [[18 - Histórico]]

## Aponta para (conteúdo real do repositório)

_(nenhum ainda — ADRs futuros sobre a migração Flask → NestJS/Angular devem referenciar os
commits `feat(migracao): ...` já existentes no histórico do Git como evidência.)_

## Status

Esqueleto criado em 2026-07-19 — primeiro ADR real registrado ([[ADR-0001 - Adocao do ecossistema Vault + IA]]).
Em 2026-07-31 entrou o [[ADR-0002 - Adocao do Guia Mestre de Arquitetura]], cujas decisões
são verificadas por teste no CI (ver [[Guia Mestre de Arquitetura de Desenvolvimento]]).
Em 2026-08-25 entrou o [[ADR-0003 - API de Dados como fronteira unica de banco]], que
estende a mesma disciplina ao banco de terceiro (SICLA, Portal Rech) e também é verificado
por teste no CI. Ver [[00 - Dashboard]].
