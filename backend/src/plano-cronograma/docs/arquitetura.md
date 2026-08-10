# Arquitetura — `plano-cronograma`

## Camadas

```text
HTTP
 │
 ▼
PlanoCronogramaController      entrada: rota, JwtAuthGuard + RolesGuard, DTO, ApiEnvelope
 │
 ▼
PlanoCronogramaService         orquestração: 404, timeline, releitura do estado
 │
 ├──► CronogramaItensService   regra: diff, defaults, plano automático
 │     └──► CronogramaItensRepository
 ├──► ChecklistItensService    regra: diff, defaults, roteiro do catálogo
 │     └──► ChecklistItensRepository
 ├──► ModificacoesService      regra: limite padrão, autor vazio
 │     └──► ModificacoesRepository
 ├──► ProjetoRepository        (transversal, via RepositoriosModule)
 └──► EventoRepository         (transversal, via RepositoriosModule)
                                       │
                                       ▼
                                   MariaDB
```

## Arquivos

```text
plano-cronograma/
├── docs/                              este diretório
├── dto/
│   ├── linha-cronograma.dto.ts        validação de uma linha (class-validator)
│   ├── linha-checklist.dto.ts
│   ├── salvar-cronograma.dto.ts       { linhas: LinhaCronogramaDto[] }
│   └── salvar-checklist.dto.ts
├── repositories/
│   ├── cronograma-itens.repository.ts doProjeto / substituir
│   ├── checklist-itens.repository.ts  doProjeto / substituir
│   └── modificacoes.repository.ts     doProjeto / registrar
├── plano-cronograma.controller.ts     6 rotas, nada além de entrada/saída
├── plano-cronograma.service.ts        orquestração
├── cronograma-itens.service.ts        + plano automático (datas, distribuição de horas)
├── checklist-itens.service.ts         + roteiro do catálogo ChecklistModelo
├── modificacoes.service.ts            histórico
├── catalogo-modulos.util.ts           siglas contratadas / resolução de módulos
├── datas-plano.util.ts                dias úteis, formatação BR
├── linhas-diff.util.ts                diff posicional linha×campo
└── plano-cronograma.module.ts
```

## Onde cada repository mora — a regra

| Situação | Onde fica | Exemplo |
|---|---|---|
| Entidade usada **só por este módulo** | `<modulo>/repositories/` | `CronogramaItem`, `ChecklistItem`, `Modificacao` |
| Entidade **transversal** (vários módulos) | `database/repositories/`, exportada por `RepositoriosModule` | `Projeto` (20+ módulos), `Evento` (7 módulos) |

Por isso o `forFeature` deste módulo declara **três** entidades, não cinco: `Projeto` e
`Evento` chegam pelo `RepositoriosModule`. Repetir `TypeOrmModule.forFeature([Projeto])` em
cada módulo é justamente o que espalha persistência pelo projeto.

## Fronteiras

- O repository **não conhece HTTP**: devolve `null` quando não acha, e quem traduz para 404
  é o service. Não há `NotFoundException` em `repositories/`.
- O repository **não decide valores**: `status = 'Previsto'`, `autor || ''` e o limite de
  200 são regra e ficam nos services.
- `substituir()` é persistência, não regra: o "apaga tudo e reinsere" é o formato de
  gravação desta tabela (herdado de `webapp/db.py:salvar_linhas`), e mantê-lo no repository
  evita que o service conheça `delete`/`create`/`save` do TypeORM.

## Dependências externas ao módulo

| Módulo | Para quê |
|---|---|
| `RepositoriosModule` | `Projeto` (existe? qual consultor?) e `Evento` (timeline) |
| `CatalogosModule` | `ChecklistModeloService` — roteiro do Check List por módulo contratado |
| `DisponibilidadeModule` | agenda do consultor no SICLA, para o plano automático desviar de dia ocupado |
