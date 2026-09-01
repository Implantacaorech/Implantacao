# Arquitetura — módulo `dados`

## Camadas

```
Consumidor (Painel · outro sistema · agente de IA · BI)
        │  HTTP  /api/dados/v1
        ▼
  DadosController ─────────── AcessoDadosGuard
        │                       ├─ X-API-Key → ClienteApiService (consultas do token)
        │                       └─ Bearer JWT → PermissoesService (menu)
        ▼
  DadosService  ── catalogo/catalogo.ts        (o contrato: nome → SQL, params, teto)
        │       ── catalogo/sql/*.sql.ts       (o texto do SQL)
        │       ── catalogo/parametros.util.ts (validação, binds, expansão de lista)
        │       ── ConsultaBdService           (texto vigente das consultas editáveis)
        ▼
  ConexoesService  ── 'sicla'       → ConexaoSiclaService  (oracledb)
                   └─ 'portal_rech' → ConexaoPortalService (mysql2)
```

Nenhum módulo de negócio injeta as conexões: eles injetam `DadosService` e pedem a consulta
pelo nome. `DadosModule` **não importa módulo de negócio nenhum** — é o que impede a
fronteira de virar um ciclo.

`ClienteApiService → ClienteApiRepository → ClienteApi` segue o Controller → Service →
Repository do [Guia Mestre](<../../../../vault/23 - Padrões/Guia Mestre de Arquitetura de Desenvolvimento.md>):
nenhum controller toca banco, nenhum repository lança exceção HTTP.

## Arquivos

| Arquivo | Papel |
|---|---|
| `dados.module.ts` | Monta o módulo; exporta `DadosService` — a porta de todo mundo |
| `dados-app.module.ts` | **Raiz do Portal API**: só este módulo, auth, permissões e health |
| `consumo/dados-remoto.service.ts` | O Painel PEDINDO a consulta ao Portal API (paginando até o fim) |
| `consumo/token-api-dados.service.ts` | Cadastro dos tokens que o Painel usa |
| `consumo/delegado-remoto.ts` | O contrato que o `DadosService` injeta de forma OPCIONAL |
| `dados.controller.ts` | `/api/dados/v1` — catálogo, conexões, execução |
| `dados-admin.controller.ts` | `/api/dados/v1/admin` — consultas da tela, clientes de máquina, métricas, cache (ADM) |
| `dados.service.ts` | Executor: resolve, valida, executa, pagina, cacheia, audita |
| `catalogo/catalogo.types.ts` | Tipos do contrato (conexões, parâmetros, consulta) |
| `catalogo/catalogo.ts` | **O catálogo de código** — as 19 consultas revisadas |
| `catalogo/catalogo.service.ts` | **Catálogo EFETIVO** — código + publicadas pela tela (cache 30 s) |
| `catalogo/binds.util.ts` | Extrai os `:binds` de um SQL e decide se ele é só leitura |
| `consultas-publicadas.service.ts` | "Testar" e publicação de consulta criada pela TELA |
| `catalogo/sql/*.sql.ts` | O TEXTO do SQL, agrupado por assunto |
| `catalogo/parametros.util.ts` | Validação, conversão em bind e expansão de lista (`IN`) |
| `catalogo-seed.service.ts` | Semeia em Consultas BD as consultas editáveis do catálogo |
| `consulta-bd.service.ts` | Persistência de `consultas_bd` (o texto que o ADM edita) |
| `conexoes/conexoes.service.ts` | Roteador da conexão |
| `conexoes/conexao-sicla.service.ts` | **Driver Oracle** + configuração da conexão |
| `conexoes/conexao-portal.service.ts` | **Driver MySQL** + configuração da conexão |
| `cliente-api.service.ts` | Cadastro/autenticação dos clientes de máquina |
| `repositories/cliente-api.repository.ts` | Persistência de `api_clientes` |
| `guards/acesso-dados.guard.ts` | As duas portas de autenticação |
| `decorators/chamador.decorator.ts` | Identidade e consultas autorizadas do chamador |

## A fronteira, em cinco fases — todas concluídas em 2026-08-25

As fases foram separadas de propósito: criar o contrato (reversível, testável) e mover o
driver de conexão a sistema de terceiro em produção (arriscado) não deviam viajar no mesmo
passo. Cada uma terminou com a suíte verde antes de a seguinte começar.

| Fase | O que mudou | Como se verifica |
|---|---|---|
| **0** | `dados/` nasce; catálogo espelha as consultas reais; nada muda de comportamento | `conformidade-api-dados.spec.ts` §"A fronteira existe" |
| **1** | Os 10 módulos passam a `DadosService.consultar(nome, params)`; o SQL sai dos `*.constants.ts` e vem para `catalogo/sql/`; a semeadura vira derivada do catálogo | `DIVIDA_EXECUTAR_SQL` **zerou** |
| **2** | `oracledb`/`mysql2` mudam para `conexoes/`; `DisponibilidadeService` vira domínio puro; a ocupação e o mapa de técnicos entram no catálogo | `PODEM_IMPORTAR_DRIVER` caiu de 3 para **1** |
| **3** | Token autoriza **por consulta**; consulta pode nascer pela TELA (contrato extraído do banco); a **instância 1** ganha entrypoint próprio | `dados-app.module.spec.ts` fecha a lista de módulos da instância |
| **4** | Menu por instância (`GET /api/instancia`); conexão cadastrável no Portal API; **consumo remoto** (`consumo/`) com tela de tokens no Painel | `dados-remoto.service.spec.ts` + a delegação em `dados.service.spec.ts` |

A guarda de CI é a catraca: os dois números só podem **cair**. Um módulo novo que importe
driver ou chame `executarSql` quebra o build.

### A exceção que sobrou, e por quê

> Desde 2026-09-01 **não há exceção**: o Consultor SIGER, o único módulo que importava um
> driver fora de `src/dados/`, foi retirado do Painel a pedido do usuário.

## Decisões e o porquê

**Três origens de SQL, não uma.** O texto de uma consulta pode vir de (a) **código**
(`catalogo/sql/`, muda por PR), (b) **Consultas BD** (`consultas_bd`, o ADM edita sem
release — é o caso das 7 consultas validadas contra o banco real) ou (c) **configuração da
conexão** (tela Disponibilidade — só as duas consultas de ocupação, cujo SELECT varia por
instalação e viaja junto das credenciais desde o Painel Flask). O catálogo declara qual é a
origem; o executor resolve. Reduzir a uma só quebraria um caso legítimo de cada vez.

**O catálogo é código — e, desde a fase 3, código MAIS tela.** O que segue abaixo continua
valendo para o catálogo revisado; a consulta criada pela tela é a exceção deliberada, com o
custo pago em validação na hora de salvar (`consultas-publicadas.service.ts`) e em rótulo:
o catálogo diz que ela veio da tela, e "revisada ou de tela?" é a primeira pergunta quando
algo dá errado. Em conflito de nome, **o código vence**.

**O catálogo é código, não tabela.** Consulta nomeada é contrato público: mudar o teto de
linhas ou o tipo de um parâmetro afeta consumidor externo, e isso precisa passar por PR,
revisão e teste — não por um formulário. O que *é* editável em tela continua editável: o
**texto** do SQL de 7 consultas vive em `consultas_bd` (Sistema → Consultas BD), porque foi
validado contra o banco real pelo Administrador e precisa de correção sem release. O
contrato em volta dele (nome, parâmetros, teto) segue fixo.

**Duas autenticações, uma porta.** Pessoa entra por JWT e é gateada por **menu** — quem não
enxerga a tela não consulta o dado por baixo dela, senão a API viraria porta lateral em
volta do painel de Permissões. Máquina entra por `X-API-Key` e é gateada pela **lista
de consultas do token** — não tem tela nem perfil, e um JWT de 15 minutos não serve para
integração. A autorização é por CONSULTA e não por conexão (decisão do usuário, fase 3): um
token emitido para o painel de RNS não alcança o extrato de horas, mesmo sendo da mesma
conexão.

**Paginação em memória.** As consultas do SICLA são agregações e janelas de período, com
teto dimensionado para caber num round-trip; paginar no banco exigiria reescrever cada
SELECT e mudaria o custo no Oracle. O campo `truncadoNoLimite` é o sinal de que alguma
consulta passou a precisar de paginação de verdade.

**Auditoria em log, não em tabela.** O volume é de BI e cresceria sem teto no banco do
Painel. A trilha vai para o log estruturado, que já carrega o correlation-id da requisição.
Persistir com retenção continua em aberto (`docs/pendencias.md`).

**Um escape hatch, explícito.** Duas telas rodam SQL de que o próprio Administrador é autor
(o "Testar" de Consultas BD e o motor de Dashboards). Elas usam
`DadosService.executarSqlDeAdministrador` — nome deliberadamente incômodo, restrito a
`@Roles(PERFIS_SISTEMA)` e auditado como o resto. Fingir que esse caminho não existe o
empurraria para fora da fronteira, que é exatamente o que se fechou.

## Dependências

- `PermissoesModule` — `@Global`, dá o `PermissoesService` ao guard.
- `TypeOrmModule.forFeature([ClienteApi, ConsultaBD])` — tabelas `api_clientes`
  (migration `1787990000000-ApiClientes`) e `consultas_bd`.

`DELEGADO_REMOTO` — **opcional**. Só o Painel monta `DadosConsumoModule`; no Portal API o
delegado não existe e a execução é sempre local, que é o que aquela ponta existe para fazer.

E só. **Nenhum módulo de negócio** — a seta aponta sempre para cá. É essa pobreza de
dependências que torna possível a **instância 1**: subir este módulo (mais auth, permissões e
health) num processo próprio, na máquina que tem a credencial, sem arrastar o Painel junto.
Ver [`docs/portal-conexoes.md`](../../../../docs/portal-conexoes.md).
