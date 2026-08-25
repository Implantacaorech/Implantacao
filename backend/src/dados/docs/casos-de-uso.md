# Casos de uso — módulo `dados`

Os quatro públicos foram definidos pelo usuário em 2026-08-25 ("preparar para uso geral").

## CU-01 · Módulo do Painel consulta o SICLA

**Ator:** um service do backend (`rns`, `agenda`, `bi-*`, `clientes-sicla`, `disponibilidade`…).

1. O módulo injeta `DadosService` (via `DadosModule`).
2. Chama `consultar('sicla.rns.listar', { data_ini, data_fim })`.
3. Recebe `{ ok, mensagem, colunas, linhas }` e faz o que já fazia: normalizar, agregar,
   montar a tela. Em falha, `ok: false` traz a mensagem pronta — a tela degrada com aviso,
   nunca com exceção.

**O que ele deixa de fazer:** importar `SQL_*` de um `.constants.ts`, montar binds à mão,
decidir teto de linhas, checar "conexão configurada", traduzir erro do Oracle. Tudo isso
passou para o catálogo.

`consultar` (não-lançante) é para módulo; `executar` (lança HTTP) é para o controller. A
diferença existe para preservar o comportamento das telas.

**Todos os 10 módulos já estão migrados** (fase 1, 2026-08-25) e a guarda de CI impede que a
dívida volte.

## CU-02 · Pessoa consulta pela tela do Painel

**Ator:** consultor, coordenador, administrativo.

O Angular chama `POST /api/dados/v1/consultas/{nome}/executar` com o JWT que já tem. O gate
é o **menu**: quem enxerga Execução → RNS consulta `sicla.rns.*`; quem não enxerga recebe
`403` dizendo qual menu falta.

Consequência desejada: liberar ou tirar uma tela no painel de Permissões passa a valer
também para o dado por baixo dela, sem código novo.

## CU-03 · Outro sistema da Rech consome

**Ator:** aplicação interna que hoje abriria uma conexão própria ao SICLA.

1. O Administrador cadastra o cliente em `POST /api/dados/v1/admin/clientes`, com os escopos
   mínimos, e entrega a chave (exibida uma vez).
2. O sistema chama a API com `X-API-Key`, lendo o catálogo por `GET /consultas` para saber o
   que pode pedir.
3. Se a integração for desligada, o Administrador **revoga** — e o `ultimoUsoEm` prova que
   ninguém mais dependia dela.

**O ganho real:** a credencial do Oracle deixa de circular. Antes, cada sistema que quisesse
o dado do SICLA precisava da senha do banco; agora precisa de uma chave escopada, revogável
isoladamente e rastreável no log.

## CU-04 · Agente de IA / automação consulta

**Ator:** skill ou agente que precisa de dado do SICLA (ex.: montar o dossiê de um cliente).

Mesma porta do CU-03, com escopo próprio — o que permite revogar **só** o agente sem afetar
o BI, e ver no log quantas consultas ele fez.

Ponto de atenção: o catálogo é o teto do que um agente consegue perguntar ao banco. Ampliar
o que ele alcança é acrescentar uma consulta declarada e revisada — não soltar SQL.

## CU-05 · BI / planilha lê em massa

**Ator:** Power BI, Excel, script de extração.

1. Chama com `X-API-Key` e pagina: `tamanho` até 5000, `pagina` incremental até
   `temMais: false`.
2. Confere `truncadoNoLimite`: se vier `true`, a janela pedida estourou o teto da consulta —
   estreite o período em vez de aceitar um número errado.
3. `colunas` vem sempre junto de `linhas`, na ordem do SELECT — é o contrato tabular que
   permite montar a tabela sem inferir schema.

Para essas três consultas o teto do banco é maior que uma página, então paginar não é
opcional: `sicla.bi.extrato-horas`, `sicla.agenda.horas-aplicadas`, `portal.visitas.listar`.

## CU-06 · Administrador corrige o SQL de uma consulta

**Ator:** ADM, em Sistema → Consultas BD.

1. Edita o texto (ex.: o nome real de uma coluna da view `POWERBI`).
2. Chama `POST /api/dados/v1/admin/cache/limpar` — senão o resultado anterior sobrevive até
   o TTL.
3. A próxima execução já usa o texto novo, com o **mesmo** contrato: nome, parâmetros e teto
   não mudaram, e nenhum consumidor precisou saber da correção.

## CU-06-A · Administrador diagnostica pela tela

**Sistema → API de Dados** mostra, numa página: o catálogo inteiro (sem SQL), o estado das
duas conexões, os clientes de máquina e o uso por consulta desde o último boot. É por ela
que se cadastra, revoga e rotaciona chave — e o botão de limpar cache mora ali.

## CU-07 · Diagnóstico de "a consulta parou"

1. `GET /api/dados/v1/conexoes` — a conexão está cadastrada e ativa?
2. Código da resposta: `503` é configuração (ação do ADM); `502` é o banco de origem
   (mensagem original vai junto); `400` é a requisição.
3. `GET /api/dados/v1/admin/metricas` — a consulta está sendo chamada? está errando? quanto
   tempo leva?
