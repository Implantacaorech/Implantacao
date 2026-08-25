---
titulo: "ADR-0003 - API de Dados como fronteira única de banco externo"
tipo: adr
status: aceito
criado: 2026-08-25
atualizado: 2026-08-25
responsavel: "Arquiteto Principal (IA)"
tags:
  - adr
  - arquitetura
  - decisao
  - integracao
relacionados:
  - "[[17 - ADR]]"
  - "[[ADR-0002 - Adocao do Guia Mestre de Arquitetura]]"
  - "[[Guia Mestre de Arquitetura de Desenvolvimento]]"
  - "[[02 - Arquitetura]]"
  - "[[03 - Backend]]"
---

# ADR-0003 — API de Dados como fronteira única de banco externo

## Status

Aceito em 2026-08-25. Não revoga nenhum ADR anterior; complementa o
[[ADR-0002 - Adocao do Guia Mestre de Arquitetura]], que já exige a camada de acesso a dados
para o banco **próprio** — este estende a mesma disciplina ao banco de **terceiro**.

## Contexto

O usuário definiu a regra para a próxima versão do Painel:

> **Toda e qualquer consulta realizada em banco de dados terá uma API para comunicação.**

O levantamento do estado anterior à decisão encontrou quatro bancos vinculados:

| Banco | Driver | Aberto em | Consumido por |
|---|---|---|---|
| **SICLA** (Oracle) | `oracledb` | `disponibilidade/disponibilidade.service.ts` | **10 módulos** chamando `executarSql` direto |
| **Portal Rech** (MySQL) | `mysql2` | `disponibilidade/portal-db.service.ts` | `bi-implantacao` |
| **painel_novo** (MariaDB) | TypeORM | `database/database.module.ts` | 143 `@InjectRepository` em 52 arquivos |
| **Consultor SIGER** (SQLite, readonly) | `better-sqlite3` | `consultor-siger/consultor-siger.service.ts` | 1 módulo |

O SQL nomeado já estava razoavelmente isolado — 15 constantes em 9 arquivos `*.constants.ts`
mais 7 consultas editáveis na tabela `consultas_bd`. O que **não** existia era fronteira:
qualquer módulo novo podia injetar `DisponibilidadeService`, montar SQL e executar, e nada
no CI impedia. Cada módulo decidia sozinho teto de linhas, tratamento de erro e formato de
resposta.

Quatro decisões de escopo foram tomadas com o usuário antes de qualquer código:

1. **Forma** — módulo interno do backend (fronteira única), não um processo separado.
2. **Escopo** — só os bancos **externos**. O `painel_novo` continua pela camada
   Repository/TypeORM do ADR-0002, e já só é alcançável pela REST do Painel.
3. **Contrato** — catálogo de **consultas nomeadas**. O SQL fica no servidor; o consumidor
   chama por nome com parâmetros tipados.
4. **Consumidores** — não só o Painel: outros sistemas da Rech, agentes de IA e ferramentas
   de BI. *"Precisamos preparar para uso geral."*

## Decisão

Criar `backend/src/dados/` como **única porta de entrada aos bancos externos**, com:

- **Catálogo em código** (`catalogo/catalogo.ts`) — cada consulta declara nome público
  estável, conexão, escopo, menus, parâmetros tipados, origem do SQL, teto de linhas e
  cache. 17 consultas nasceram espelhando exatamente o que o Painel já rodava.
- **Contrato versionado** em `/api/dados/v1` — `GET /consultas`, `GET /consultas/{nome}`,
  `POST /consultas/{nome}/executar`, `GET /conexoes`. Nenhum endpoint aceita SQL, conexão ou
  limite vindos do consumidor.
- **Duas autenticações**: JWT de pessoa, gateado pelos **menus** do painel de Permissões; e
  `X-API-Key` de máquina, gateado por **escopo** (`sicla:leitura`, `portal_rech:leitura`),
  com chave hasheada em `api_clientes`, revogável e rotacionável.
- **Guarda no CI** (`common/conformidade-api-dados.spec.ts`) — proíbe import de driver fora
  de `src/dados/` e chamada a `executarSql` fora dos módulos já listados, por catraca: os
  números só podem cair.

### Adequação faseada — as três fases foram concluídas em 2026-08-25

| Fase | O que mudou | Verificação |
|---|---|---|
| **0** | Módulo, catálogo, executor, auth de máquina, guarda. Nada muda de comportamento em produção | `conformidade-api-dados.spec.ts` §"A fronteira existe" |
| **1** | Os 10 módulos passam a pedir a consulta pelo nome; o SQL sai dos `*.constants.ts` e vem para `dados/catalogo/sql/`; a semeadura das consultas editáveis vira derivada do catálogo | `DIVIDA_EXECUTAR_SQL` **zerou** |
| **2** | `oracledb` e `mysql2` mudam para `dados/conexoes/`; `ConsultaBdService` vem junto; a Disponibilidade vira domínio puro e suas duas consultas entram no catálogo | `PODEM_IMPORTAR_DRIVER` caiu de 3 para **1** |

As fases foram separadas de propósito: criar a fronteira (mudança de contrato, testável e
reversível) e mover driver de conexão a sistema de terceiro em produção (arriscada, difícil
de reverter) não deviam viajar no mesmo passo. Cada uma fechou com a suíte verde antes de a
seguinte começar.

**Um achado durante a fase 1** mudou o escopo: o levantamento inicial contou as consultas que
chamavam `executarSql`, mas a Disponibilidade tinha **outra porta** — `consultar`,
`mapaTecnicos` e `ocupacaoPorSlot` iam ao Oracle direto pelo driver, e três módulos
(`cronograma`, `painel/capacidade`, `plano-cronograma`) dependiam delas. Eram a última
consulta a banco externo fora da fronteira. Entraram no catálogo na fase 2, o que exigiu duas
extensões: a origem `config_conexao` (SQL guardado na configuração da conexão, não em código
nem em Consultas BD) e o tipo de parâmetro `lista_texto`, que reescreve `:tecnicos` numa
lista de binds.

### A exceção que permanece

`consultor-siger` continua importando `better-sqlite3`, e isso é **decisão, não dívida**. A
base dele não é um banco vinculado: é um artefato derivado (SQLite gerado por um indexador
externo a partir do código-fonte do SIGER), arquivo local aberto em readonly, sem credencial,
sem rede e sem outro consumidor; o módulo já é a API dele, e suas 7 consultas são busca
full-text com aridade variável. Nenhum dos riscos que este ADR endereça existe ali, e
encaixá-las num catálogo de consultas *nomeadas* distorceria os dois lados. A exceção está
declarada, com esse motivo, na própria guarda de CI.

## Consequências

**Positivas**

- A credencial do Oracle deixa de precisar circular: outro sistema da Rech que queira o dado
  do SICLA recebe uma chave escopada, revogável isoladamente e rastreável no log — não a
  senha do banco.
- Liberar ou tirar uma tela no painel de Permissões passa a valer também para o dado por
  baixo dela, sem código novo.
- Teto de linhas, timeout, tradução de erro (`502` para falha da origem, `503` para
  configuração), cache e auditoria passam a ser resolvidos num lugar só, em vez de dez.
- Consulta nova é **dado** (uma entrada no catálogo), não código novo: sem controller, sem
  rota, sem DTO.
- O que um agente de IA consegue perguntar ao banco tem teto explícito e revisável.

**Negativas / riscos aceitos**

- Um ponto único de falha e de gargalo para o dado externo. Mitigado por cache por consulta
  e pelos timeouts que já existiam nos executores.
- A fronteira concentrou muito num módulo só: `dados/` hoje é dono dos drivers, do catálogo,
  das consultas salvas e dos clientes de máquina. É o preço de a seta apontar numa direção
  só — a alternativa (dependência circular com a Disponibilidade) é pior.
- Uma mudança de comportamento real na fase 2: a ocupação passou a mandar ao Oracle **apenas
  os binds que o SELECT configurado cita**. O código anterior mandava sempre `data_ini` e
  `data_fim`; num SELECT que não os citasse, isso seria ORA-01036. Nenhuma instalação estava
  nessa situação, mas é diferença observável, não refatoração pura.
- A paginação é em memória sobre o resultado já limitado. É adequada às consultas atuais
  (agregações e janelas de período); `truncadoNoLimite` é o sinal de que alguma passou a
  precisar de paginação no banco.
- A auditoria vai para log estruturado, não para tabela — o volume é de BI e cresceria sem
  teto no `painel_novo`. Persistir com retenção é fase 2.

## Alternativas descartadas

- **Serviço HTTP separado** (`api-dados/`, porta própria). Daria consumo por outros sistemas
  desde o dia 1, mas custa novo deploy, novo guardião, nova autenticação e latência de rede
  — para uma ferramenta interna com um consumidor real hoje. O módulo interno foi construído
  com fronteira de contrato limpa; separá-lo depois é trocar a implementação do executor.
- **Endpoint genérico de SQL** (`POST /dados/sql`). Manteria a flexibilidade da tela
  Consultas BD, mas deixaria o SQL na mão do consumidor — trocaria o transporte sem criar
  fronteira nenhuma. A tela continua existindo, restrita ao Administrador, como o lugar de
  editar o **texto** de uma consulta já catalogada.
- **Incluir o `painel_novo` no escopo.** Mexeria em 52 arquivos e 143 injeções para
  formalizar uma fronteira que o ADR-0002 já cobre e que a REST do Painel já garante.

## Evidências

- Módulo: `backend/src/dados/` (+ os 6 documentos em `backend/src/dados/docs/`).
- Guarda: `backend/src/common/conformidade-api-dados.spec.ts`.
- Migration: `backend/src/database/migrations-mariadb/1787990000000-ApiClientes.ts`.
- Tela: `frontend/src/app/features/config/api-dados.component.ts` (Sistema → API de Dados).
- e2e: `e2e/testes/08-api-dados.spec.ts` (15 casos, contra instância real).
- **19 consultas** no catálogo ao fim da fase 2.
- Suítes verdes em 2026-08-25, ao fim das três fases: backend **136 suítes / 1420 testes**,
  frontend **69 arquivos / 561 testes**, e2e **80 casos**.
