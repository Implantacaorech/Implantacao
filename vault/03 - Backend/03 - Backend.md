---
titulo: "Backend"
tipo: indice
status: em-andamento
criado: 2026-07-19
atualizado: 2026-07-19
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - backend
relacionados:
  - "[[02 - Arquitetura]]"
  - "[[06 - APIs]]"
  - "[[05 - Banco de Dados]]"
---

# Backend

> [!info] Sobre esta seção
> Backend em NestJS/TypeScript: módulos, controllers, services, DTOs, guards, interceptors e
> regras de negócio da API. Convive, durante a migração, com o painel Flask legado.

## Estrutura real (levantada em 2026-07-19)

**26 módulos de feature** em `src/`: `auth`, `cadastro`, `catalogos`, `config`,
`cronograma`, `database`, `designacao`, `digest`, `disponibilidade`, `documentos`, `email`,
`fluxo`, `geracao`, `health`, `ia`, `legado`, `levantamento`, `matriz`, `metricas`,
`painel`, `plano-cronograma`, `projetos`, `protocolos`, `transcricao`, `users`,
**`agentes`** (novo, 2026-07-19 — telemetria real de execução de agentes, ver [[14 - IA]]).

Cada módulo segue o padrão `Controller` + `Service` + `Module` + `DTO`, com validação via
`class-validator` e documentação via decorators `@ApiProperty` (Swagger) — confirmado lendo
DTOs reais, não só o `package.json`.

### Cross-cutting concerns (`common/`)

- **Guard:** `roles.guard.ts` (1) — controle de perfil.
- **Filter:** `http-exception.filter.ts` (1) — tratamento global de erro.
- **Interceptor:** `response.interceptor.ts` (1) — envelope de resposta padronizado.
- **Pipes:** nenhum customizado — usa o `ValidationPipe` global do Nest
  (`whitelist: true, forbidNonWhitelisted: true, transform: true`), configurado em
  `main.ts`.
- **Swagger/OpenAPI:** genuinamente ligado — `SwaggerModule.setup('api/docs', app, ...)` em
  `main.ts`, não só instalado.
- **JWT:** `jwt.strategy.ts` + `jwt-auth.guard.ts` — autenticação real.
- **Segurança HTTP:** `helmet` configurado em `main.ts`, com HSTS/CSP `upgrade-insecure-requests`
  desligados de propósito (comentário no código explica: rede interna sem TLS/reverse
  proxy — achado real de um incidente de tela branca em produção).

### Onde desvia do mandato do ADR-0001/Prompt Mestre

- **Repository Pattern:** não existe uma camada de abstração própria — **32 arquivos**
  injetam `Repository<Entity>` do TypeORM direto via `@InjectRepository`. Entidades ficam
  centralizadas em `database/entities/`, não dentro de cada módulo de domínio.
- **Clean Architecture/DDD em camadas:** não há separação `domain/`/`application/`
  `infrastructure/` — é uma "modular monolith" plana por feature, padrão idiomático do
  NestJS. Ver discussão de custo/benefício em [[02 - Arquitetura]].

### Testes

**44 arquivos `.spec.ts`** contra **211 arquivos não-spec** (~21% em contagem de arquivos) —
364 testes de fato, todos passando (`npm test`, rodado localmente e confirmado no CI real
em 2026-07-19, ver [[11 - Testes]]). Cobertura não é uniforme entre módulos — não auditado
módulo a módulo nesta rodada.

## Relacionados no Vault

- [[02 - Arquitetura]]
- [[06 - APIs]]
- [[05 - Banco de Dados]]
- [[11 - Testes]]

## Aponta para (conteúdo real do repositório)

- `../backend/`
- `../backend/src/main.ts` (bootstrap: Swagger, ValidationPipe, guards/filters globais)
- `../webapp/` (legado Flask, em migração)

## Status

Estrutura real levantada e auditada em 2026-07-19. Ver [[00 - Dashboard]].
