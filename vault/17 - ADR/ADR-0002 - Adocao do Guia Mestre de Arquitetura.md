---
titulo: "ADR-0002 - Adoção do Guia Mestre de Arquitetura de Desenvolvimento"
tipo: adr
status: aceito
criado: 2026-07-31
atualizado: 2026-07-31
responsavel: "Arquiteto Principal (IA)"
tags:
  - adr
  - arquitetura
  - decisao
relacionados:
  - "[[17 - ADR]]"
  - "[[ADR-0001 - Adocao do ecossistema Vault + IA]]"
  - "[[Guia Mestre de Arquitetura de Desenvolvimento]]"
  - "[[02 - Arquitetura]]"
  - "[[23 - Padrões]]"
---

# ADR-0002 — Adoção do Guia Mestre de Arquitetura de Desenvolvimento

## Status

Aceito em 2026-07-31. Não revoga o [[ADR-0001 - Adocao do ecossistema Vault + IA]].

## Contexto

O usuário entregou `Padronizacao_de_estrutura/GUIA_MESTRE_ARQUITETURA_DESENVOLVIMENTO.md` —
uma norma de arquitetura corporativa (Controller → Service → Repository, estrutura de
módulo, Clean Code, SOLID, documentação por módulo, cobertura ≥ 80%, segurança) — e pediu
que fosse aplicada ao código.

A medição do backend contra o guia, feita antes de qualquer alteração, encontrou:

**Já conforme:** Controller → Service em todos os 42 controllers, DI do Nest em tudo, DTOs
com `class-validator`, 24 migrations versionadas, Helmet + CORS + `ValidationPipe` global +
JWT + RBAC, Swagger, 91 suítes / 886 testes verdes.

**Divergente:**

1. **Camada Repository inexistente** — 47 arquivos injetavam `Repository<T>` do TypeORM
   direto no Service. Um caso ia além: `PlanoCronogramaController` injetava
   `Repository<Projeto>` e `Repository<Evento>` e executava `findOne`/`save` **no
   controller** — persistência e regra dentro da camada de entrada.
2. **Estrutura** — 37 módulos na raiz de `src/`, não em `src/modules/`; 38 entidades
   centralizadas em `database/entities/`, não distribuídas por módulo.
3. **Documentação por módulo** — nenhuma (o guia pede 6 arquivos × 37 módulos = 222).
4. **Rate Limit** — ausente (`@nestjs/throttler` não instalado).
5. **Cobertura** — 60,07% de linhas, contra os 80% exigidos.

Aplicar o guia ao pé da letra de uma vez significaria reescrever praticamente todo o
backend — 446 arquivos — de um sistema **em produção desde 2026-07-19**, com risco alto e
sem ganho proporcional. Consultado, o usuário optou por **adequação faseada com guarda no
CI**, aplicada ao **projeto inteiro** (backend, frontend e docservice).

## Decisão

1. O guia passa a ser a **norma de arquitetura do repositório**, registrado em
   [[Guia Mestre de Arquitetura de Desenvolvimento]]. Onde conflitar com o
   [Padrão Rech](<../../MD Padrao desenv/Padrao_Rech.md>) (§4.8), **o Padrão Rech
   prevalece** — é norma da empresa; este é do projeto.

2. **`backend/src/plano-cronograma/` é o módulo de referência**: camada Repository
   completa, Service de orquestração, controller reduzido a entrada/saída e os 6 documentos
   do guia. Foi escolhido por conter a única violação real de camada do backend. Ao adequar
   o próximo módulo, copia-se dele.

3. **Repository transversal tem ponto único.** Entidade usada por um módulo só → repository
   dentro do módulo. Entidade usada por vários → `database/repositories/`, exportada por
   `RepositoriosModule`. Repetir `TypeOrmModule.forFeature([Projeto])` em cada módulo é o
   que espalha persistência pelo código.

4. **A norma é verificada por teste, não por revisão de código.** Três guardas rodam no CI
   e falham o build — `backend/src/common/conformidade-arquitetura.spec.ts`,
   `frontend/src/app/conformidade-arquitetura.spec.ts` e
   `docservice/tests/test_conformidade_arquitetura.py`. Seguem o precedente do
   `conformidade-stack.spec.ts` (ADR anterior sobre a stack): desvio de arquitetura entra
   por pressa, não por decisão, e revisão humana não pega o que é sistemático.

5. **Onde a conformidade total ainda não é possível, vale catraca, não exceção aberta.** O
   gate de cobertura fica no patamar medido (60% linhas / 52% branches) e sobe por fase; a
   lista de componentes Angular com `HttpClient` é explícita e **só pode encolher** — um
   componente novo com HTTP direto quebra o CI. Dívida existente não vira licença para
   dívida nova.

6. **Os desvios estruturais são reconhecidos com prazo, não silenciados**: `src/modules/`,
   entidades por módulo, Repository nos 36 módulos restantes, docs por módulo e a subida a
   80% de cobertura estão em [`docs/pendencias.md`](../../docs/pendencias.md), por fase.

## Consequências

- O rate limit (`@nestjs/throttler`, 300 req/min por IP, ajustável por
  `MIGRACAO_RATE_LIMIT`) passa a valer para toda a API. `/api/health` fica de fora
  deliberadamente: o Guardião consulta em intervalo curto do mesmo IP, e um 429 ali faria
  o guardião reiniciar um painel saudável.
- O `SELECT 1` do healthcheck saiu do controller para um `HealthService` — sem isso a regra
  "controller não acessa banco" nasceria com exceção.
- Os testes do módulo-piloto passaram a exercitar o contrato do repository em vez dos verbos
  do TypeORM, e as regras que viviam no controller (404, timeline, releitura do estado)
  ganharam teste próprio — antes só eram alcançáveis por HTTP. O módulo foi de 38 para 46
  testes.
- O CI passa a rodar o backend **com cobertura** (o `coverageThreshold` só é avaliado quando
  a cobertura é coletada) e ganha um job para a guarda do docservice, que antes não tinha
  nenhum teste rodando no CI.
- Uma correção de segurança entrou junto, por ser exatamente a regra §Segurança do guia: uma
  rota do docservice devolvia `str(e)` num **500**, podendo expor caminho de arquivo e
  detalhe de ambiente. Agora responde mensagem genérica — e a guarda impede a volta.
- Decisão futura que revogue ou altere este ADR deve virar ADR-0003 referenciando este.
