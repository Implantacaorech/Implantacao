---
titulo: "Arquitetura"
tipo: indice
status: em-andamento
criado: 2026-07-19
atualizado: 2026-07-19
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - arquitetura
relacionados:
  - "[[03 - Backend]]"
  - "[[04 - Frontend]]"
  - "[[05 - Banco de Dados]]"
  - "[[17 - ADR]]"
---

# Arquitetura

> [!info] Sobre esta seção
> Arquitetura geral do sistema: Clean Architecture, SOLID, DDD, camadas, módulos e as
> decisões estruturais que os sustentam.

## Auditoria do código real vs. mandato do Prompt Mestre (2026-07-19)

O ADR-0001 pediu Clean Architecture/SOLID/DDD/Repository Pattern em todo módulo. Esta é uma
auditoria **honesta** do que o código de `backend/` e `frontend/` faz de fato hoje — não um
refactor. Achados detalhados por stack em [[03 - Backend]] e [[04 - Frontend]]; resumo aqui.

### Veredito geral

O código segue **SOLID/Clean Code de forma pragmática e real** — não é fachada: Swagger,
validação (`class-validator`/`class-transformer`), JWT, guards e interceptors globais
realmente funcionam (comprovado lendo `main.ts` e módulos reais, não só os `package.json`).
Mas **não segue Clean Architecture/DDD em camadas nem Repository Pattern formal** como o
Prompt Mestre pediu ao pé da letra — é a arquitetura **"modular NestJS idiomática"**: um
módulo por feature de negócio (25 módulos), sem separação formal `domain/`
`application/`/`infrastructure/`, e sem uma camada de abstração de repositório acima do
TypeORM (32 services injetam `Repository<Entity>` do TypeORM direto via
`@InjectRepository`).

Isso é **extremamente comum e defensável** na prática NestJS (muita gente argumenta que o
`Repository<T>` do TypeORM já cumpre o papel de Repository Pattern, sem precisar de uma
interface própria por cima) — mas é, ao pé da letra, um desvio do que o ADR-0001 mandatou.

### Decisão pendente (não tomada nesta auditoria)

| Opção | Custo | Ganho |
| --- | --- | --- |
| Manter como está (idiomático NestJS) | Zero — é o que já funciona hoje, testado (364+111 testes) | Simplicidade, velocidade de entrega |
| Introduzir camada de Repository formal (interfaces + implementações TypeORM) | Médio — toca os 32 services, sem mudar comportamento | Desacopla domínio do ORM, facilita troca de banco/testes com mock |
| DDD completo (domain/application/infrastructure por módulo) | Alto — reestrutura os 25 módulos | Alinhamento total com o Prompt Mestre; risco de regressão em código de produção já rodando |

**Recomendação:** não vale reescrever 617 arquivos de produção que já funcionam só para
bater 100% com o mandato literal do prompt. Se o usuário quiser mexer, o meio-termo (camada
de Repository) é o que dá mais ganho pelo menor risco — mas essa é uma decisão dele, não
uma correção automática.

## Relacionados no Vault

- [[03 - Backend]]
- [[04 - Frontend]]
- [[05 - Banco de Dados]]
- [[17 - ADR]]

## Aponta para (conteúdo real do repositório)

- `../docs/agentes-software.md`
- `../backend/src/main.ts` (bootstrap real: Swagger, ValidationPipe, guards/filters/interceptors globais)

## Status

Auditoria de arquitetura real feita em 2026-07-19 (ver [[03 - Backend]] e [[04 - Frontend]]
para os números). Ver [[00 - Dashboard]].
