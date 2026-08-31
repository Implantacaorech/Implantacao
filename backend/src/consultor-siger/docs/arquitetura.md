# Arquitetura — Consultor SIGER

## Camadas

- `ConsultorSigerController` — entrada HTTP; valida DTO, chama o service, devolve
  `ApiEnvelope`. Gate `@Permissao('consultor_siger')` na classe (nível `consulta` basta —
  a tela toda é leitura; o feedback é parte de usar a tela).
- `ConsultorSigerService` — toda a regra: interpretação da pergunta (intenção + sinônimos
  do domínio), busca FTS5 na base derivada, reponderação por tipo de fonte, montagem das
  seções, assuntos relacionados, confiança e feedback.
- **Não há camada Repository/TypeORM aqui de propósito** — decisão registrada: a base é um
  **SQLite derivado e regenerável** (um índice, não um banco de domínio), gerado pelo
  indexador Python em `F:\CONSULTOR-SIGER` (fora do repo, validado no protótipo de
  2026-08-18) e aberto via `better-sqlite3` em `readonly`. Migrar essa base para tabelas
  do Painel é evolução possível e está em `docs/pendencias.md`;
  hoje o volume (≈300 mil chunks / 344 MB) e o reuso do indexador validado pesaram contra.

## Fonte × derivado

`F:\SIGER` (somente leitura, nunca acessada pelo Painel) → indexador externo
(`F:\CONSULTOR-SIGER\indexer\extrair.py`, com guarda de escrita própria e testada) →
`consultor.db` (entidades + relações + chunks FTS5) → este módulo (leitura) → tela Angular.

## Por que o bm25 é dividido pelo peso

O `bm25()` do FTS5 retorna valor **negativo** (mais negativo = mais relevante). Boost é
**dividir** por peso < 1; penalidade é dividir por peso > 1. Multiplicar inverteria o
efeito — defeito real encontrado e corrigido no protótipo; o comentário no código existe
para ninguém "simplificar" de volta.
