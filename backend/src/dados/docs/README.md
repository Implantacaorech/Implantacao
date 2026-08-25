# Módulo `dados` — API de Dados

**Fronteira única entre o Painel e os bancos de dados EXTERNOS.**

> **A regra** (decidida em 2026-08-25, registrada no
> [ADR-0003](<../../../../vault/17 - ADR/ADR-0003 - API de Dados como fronteira unica de banco.md>)):
>
> **Toda e qualquer consulta realizada em banco de dados externo terá uma API para
> comunicação.**
>
> Na prática: uma consulta só existe se estiver declarada no catálogo, com nome estável,
> parâmetros tipados e teto de linhas. Nenhum endpoint aceita SQL de quem chama.

## O que está do lado de dentro

| Banco | Dialeto | O que é | Cadastro |
|---|---|---|---|
| **SICLA** | Oracle | CRM/ERP interno da Rech (views `POWERBI.*`, tabelas `SICLA.*`) | Sistema → Ferramentas → Disponibilidade |
| **Portal Rech** | MySQL | `portalrech.com.br` — protocolo e aprovação de visita, que o SICLA não espelha | Sistema → Consultas BD |

Os dois drivers (`oracledb`, `mysql2`) moram em [`conexoes/`](../conexoes/) — e só lá.

**Não** entra aqui o `painel_novo` (MariaDB): é o banco da própria aplicação, acessado pela
camada Repository/TypeORM, e já só alcançável pela REST do Painel. Foi decisão explícita
manter o escopo da regra no dado de **terceiro** — ver o ADR.

**Também não entra** a base do Consultor SIGER (SQLite): não é banco vinculado, e sim um
artefato *derivado* (gerado por indexador externo a partir do código-fonte), arquivo local
aberto em readonly, sem credencial e sem outro consumidor — o módulo já é a API dele. É a
única exceção de driver que sobrou, declarada e justificada em
[`conformidade-api-dados.spec.ts`](../../common/conformidade-api-dados.spec.ts).

## Documentos

| Arquivo | Conteúdo |
|---|---|
| [arquitetura.md](arquitetura.md) | Camadas, arquivos, a fase 0/1/2 e onde o driver mora |
| [api.md](api.md) | Rotas, autenticação, contrato de requisição/resposta, códigos |
| [regras-negocio.md](regras-negocio.md) | Catálogo, validação, tetos, cache, auditoria |
| [casos-de-uso.md](casos-de-uso.md) | Painel, outro sistema, agente de IA, BI/planilha |
| [fluxo.md](fluxo.md) | Sequência de uma execução, ponta a ponta |

## Como acrescentar uma consulta

1. Escreva o SQL em [`catalogo/sql/`](../catalogo/sql/) e declare a entrada em
   [`catalogo/catalogo.ts`](../catalogo/catalogo.ts) — nome, conexão, escopo, menus,
   parâmetros, origem do SQL, teto e cache.
2. `npm test` — [`catalogo.spec.ts`](../catalogo/catalogo.spec.ts) confere nome único,
   menu existente, bind declarado × bind usado, tetos.
3. Pronto: a consulta já aparece em `GET /api/dados/v1/consultas` e já é executável.

Não há passo de controller, rota ou DTO — é de propósito. Consulta nova é **dado**, não
código novo. Se a origem for `consulta_salva`, ela ainda aparece sozinha em Sistema →
Consultas BD: a semeadura é derivada do catálogo ([`catalogo-seed.service.ts`](../catalogo-seed.service.ts)).

## Estado da migração — **concluída** (2026-08-25)

- **Fase 0.** Módulo, catálogo, executor, autenticação de máquina, guarda de CI.
- **Fase 1.** Os 10 módulos passaram a pedir a consulta pelo nome; o SQL saiu dos
  `*.constants.ts` deles e veio para [`catalogo/sql/`](../catalogo/sql/); a semeadura das
  consultas editáveis virou derivada do catálogo. A dívida de `executarSql` **zerou**.
- **Fase 2.** `oracledb` e `mysql2` mudaram para [`conexoes/`](../conexoes/); a
  Disponibilidade virou domínio puro (ocupação e mapa de técnicos, pelo catálogo);
  `ConsultaBdService` veio para cá; as duas consultas que rodavam por fora — a ocupação e o
  mapa de técnicos, cujo SQL vem da CONFIGURAÇÃO da conexão — entraram no catálogo.

**19 consultas** no catálogo, **1** exceção de driver (o Consultor SIGER, permanente e
justificada). O que ficou em aberto — por decisão, não por falta — está em
[`docs/pendencias.md`](../../../../docs/pendencias.md).
