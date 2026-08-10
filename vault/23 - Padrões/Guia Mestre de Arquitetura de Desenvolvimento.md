---
titulo: "Guia Mestre de Arquitetura de Desenvolvimento"
tipo: padrao
status: vigente
criado: 2026-07-31
atualizado: 2026-07-31
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - padroes
  - arquitetura
relacionados:
  - "[[23 - Padrões]]"
  - "[[02 - Arquitetura]]"
  - "[[ADR-0002 - Adocao do Guia Mestre de Arquitetura]]"
  - "[[03 - Backend]]"
  - "[[04 - Frontend]]"
  - "[[13 - Segurança]]"
---

# Guia Mestre de Arquitetura de Desenvolvimento

Norma de arquitetura deste repositório, adotada em 2026-07-31 pelo
[[ADR-0002 - Adocao do Guia Mestre de Arquitetura]].

> **O texto normativo mudou de casa em 2026-08-03.** Ele agora é a **Parte II (§13 a §21)** do
> documento único [`PADRAO-DESENVOLVIMENTO-RECH.md`](../../PADRAO-DESENVOLVIMENTO-RECH.md), que
> consolida numa peça só o Padrão Rech (Parte I, §3 a §10 — **qual** stack usar) e este guia
> (**como organizar o código dentro** dela). Em conflito, a Parte I prevalece: é norma da
> empresa, esta é do projeto.
>
> **Esta nota continua sendo a versão *aplicada***: como cada camada se chama nas três frentes
> daqui, onde mora cada repository, quais guardas rodam no CI e quais desvios estão reconhecidos
> com prazo. Para a norma em si, leia o documento único.

## Princípios

Organização · Escalabilidade · Manutenibilidade · Reutilização · Performance · Segurança ·
Legibilidade · Testabilidade · Documentação · Baixo acoplamento · Alta coesão.

## Arquitetura obrigatória

```text
Cliente → Controller → Service → Repository → Banco de Dados
```

### Responsabilidades

| Camada | Faz | Não faz |
|---|---|---|
| **Controller** | recebe a requisição, valida a entrada, chama o Service, devolve a resposta | regra de negócio, acesso a banco |
| **Service** | regra de negócio, validações, processamento, integração, orquestração | SQL/ORM direto |
| **Repository** | SELECT, INSERT, UPDATE, DELETE, persistência | regra de negócio, exceção de HTTP |

### Injeção de dependência

Sempre a DI do framework. **Nunca** `new` para instanciar dependência. Preferir interfaces
para desacoplar.

## Como cada camada se chama aqui

O guia é escrito sobre um backend. As três frentes deste repositório o realizam assim:

| Guia | `backend/` (NestJS) | `frontend/` (Angular) | `docservice/` (FastAPI) |
|---|---|---|---|
| Controller | `*.controller.ts` | componente (`*.component.ts`) | rotas em `main.py` |
| Service | `*.service.ts` | `core/services/*.service.ts` | `gerador/`, `transcricao/` |
| Repository | `repositories/*.repository.ts` | — (o service é quem conhece a API) | `gerador/db.py` |
| DI | `@Injectable` + construtor | `inject()` | import de módulo |

## Onde mora cada repository (regra deste projeto)

| Situação | Local | Exemplo |
|---|---|---|
| Entidade usada só por um módulo | `<modulo>/repositories/` | `CronogramaItem` em `plano-cronograma/` |
| Entidade transversal (vários módulos) | `database/repositories/`, exportada por `RepositoriosModule` | `Projeto` (20+ módulos), `Evento` (7) |

Repetir `TypeOrmModule.forFeature([Projeto])` em cada módulo é exatamente o que espalha
persistência pelo código — por isso o ponto único.

## Estrutura de módulo

```text
<modulo>/
├── controllers/ · services/ · repositories/
├── entities/ · dto/ · interfaces/ · validators/
├── exceptions/ · events/ · tests/ · docs/
└── <modulo>.module.ts
```

**Módulo de referência: [`backend/src/plano-cronograma/`](../../backend/src/plano-cronograma/docs/README.md).**
Ao adequar o próximo módulo, copie dele.

> **Desvio reconhecido:** os módulos deste backend estão na raiz de `src/`, não em
> `src/modules/`, e as entidades ficam centralizadas em `database/entities/` em vez de
> distribuídas por módulo. Ver [os desvios e prazos](#desvios-reconhecidos).

## Clean Code · SOLID

Métodos pequenos · classe com responsabilidade única · nomes claros · sem duplicação · sem
número mágico · código autoexplicativo. SRP · OCP · LSP · ISP · DIP.

## Banco de dados

Migrations · seeds · índices · constraints · foreign keys. Aqui: TypeORM, migrations
versionadas em `backend/src/database/migrations-mariadb/`.

## Documentação

Cada módulo deve ter, em `docs/`: `README.md` · `arquitetura.md` · `api.md` ·
`regras-negocio.md` · `casos-de-uso.md` · `fluxo.md`.

## Testes

Unitários · integração · E2E · **cobertura mínima de 80%**.

> **Desvio reconhecido:** a cobertura do backend hoje é 60% de linhas. O gate do CI está no
> patamar medido, como catraca — ver [os desvios e prazos](#desvios-reconhecidos).

## Segurança

JWT · RBAC · Helmet · CORS · Rate Limit · validação · sanitização. Todos ativos — ver
[[13 - Segurança]].

## Checklist final

- [ ] Arquitetura respeitada
- [ ] Controller sem regra de negócio
- [ ] Service centralizando a lógica
- [ ] Repository apenas persistência
- [ ] DTOs criados
- [ ] Migrations criadas
- [ ] Testes implementados
- [ ] Documentação completa
- [ ] Logs implementados
- [ ] Segurança aplicada

## A norma é verificada por teste, não por revisão

Estas guardas rodam em `npm test` / CI e falham o build:

| Frente | Arquivo |
|---|---|
| Backend | `backend/src/common/conformidade-arquitetura.spec.ts` |
| Frontend | `frontend/src/app/conformidade-arquitetura.spec.ts` |
| docservice | `docservice/tests/test_conformidade_arquitetura.py` |

O que travam hoje: controller não acessa banco nem conhece ORM · repository só em
`repositories/`, sem exceção de HTTP e sem depender de Service · nada de `new` em
dependência injetável · todo controller com seu `.module.ts` · o módulo-piloto mantém
`repositories/` e os 6 docs · Helmet/CORS/validação/rate limit ligados · componente Angular
não fala HTTP direto (com catraca de dívida que só encolhe) · rota do docservice com
docstring e 5xx sem vazar detalhe interno.

## Desvios reconhecidos

Adequação faseada — plano completo e datas em
[`docs/pendencias.md`](../../docs/pendencias.md).

| # | Desvio | Estado |
|---|---|---|
| 1 | Módulos na raiz de `src/`, não em `src/modules/` | pendente (fase 3) |
| 2 | Entidades centralizadas em `database/entities/` | pendente (fase 3) |
| 3 | Camada Repository só no módulo-piloto (1 de 37) | em andamento (fase 2) |
| 4 | Docs de módulo só no piloto | em andamento (fase 2) |
| 5 | Cobertura 60% (meta 80%) | catraca ativa (fase 4) |
| 6 | Componentes Angular com `HttpClient` | **resolvido em 2026-08-02** — catraca vazia |

O que **já** está conforme: Controller→Service, DI em tudo, DTOs validados, migrations,
JWT/RBAC/Helmet/CORS/rate limit, Swagger.
