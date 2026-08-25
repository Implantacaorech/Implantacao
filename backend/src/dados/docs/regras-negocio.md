# Regras de negócio — módulo `dados`

## RN-01 · Toda consulta a banco externo passa por uma API

Nenhum módulo do Painel abre conexão nem monta SQL para o SICLA ou o Portal Rech: pede a
consulta **pelo nome** ao `DadosService`. A regra é verificada por
[`conformidade-api-dados.spec.ts`](../../common/conformidade-api-dados.spec.ts), que roda em
`npm test` e no CI, e funciona como catraca: os números de exceção só podem cair. A migração
terminou em 2026-08-25 — a dívida de `executarSql` zerou e sobrou UMA exceção de driver, o
Consultor SIGER, permanente e justificada (ver `arquitetura.md`).

## RN-02 · O catálogo é a fonte da verdade

Uma consulta existe se está em [`catalogo/catalogo.ts`](../catalogo/catalogo.ts). Cada
entrada declara nome, conexão, escopo, menus, parâmetros, origem do SQL, teto de linhas e
cache. Consulta fora do catálogo → `404`, com a mensagem apontando `GET /consultas`.

Nome de consulta é **endereço público**: `<origem>.<assunto>.<ação>`, estável. Renomear é
quebra de contrato e só acontece em versão nova.

## RN-03 · O SQL nunca vem de quem chama

Não existe endpoint que aceite SQL. O texto de uma consulta tem três origens possíveis, todas
do lado do servidor: **código** (`catalogo/sql/`), **Consultas BD** (`consultas_bd`, editável
pelo Administrador sem release) e **configuração da conexão** (o SELECT de ocupação, que
varia por instalação). O consumidor não sabe nem precisa saber qual é.

As sete consultas editáveis são semeadas a partir do catálogo
([`catalogo-seed.service.ts`](../catalogo-seed.service.ts)) — antes cada módulo semeava a
sua, e a lista que o Administrador via dependia de quais módulos tinham subido. A semeadura
**nunca sobrescreve** um slug existente: o texto ajustado contra o banco real é a verdade.

A ocupação dos consultores (`sicla.disponibilidade.ocupacao`) **não tem** texto padrão de
propósito: o SELECT varia por instalação, e sem ele a API responde `503` dizendo que falta
preencher — melhor que adivinhar um SELECT contra a agenda de um terceiro.

**Uma exceção, explícita:** `DadosService.executarSqlDeAdministrador` roda SQL fora do
catálogo, para as duas telas em que o próprio ADM é o autor (o "Testar" de Consultas BD e o
motor de Dashboards). Restrita a `@Roles(PERFIS_SISTEMA)` e auditada como o resto — o nome
é incômodo de propósito.

## RN-04 · Parâmetro é tipado, validado e convertido no servidor

| Tipo | Formato aceito | O que o servidor faz |
|---|---|---|
| `data` | `AAAA-MM-DD` | Rejeita data que o calendário não tem (`2026-02-31` viraria 03-03 em silêncio) |
| `competencia` | `AAAA-MM` | Converte para o `AAAA/MM` que a view do SICLA guarda |
| `datahora_minuto` | `AAAA-MM-DD HH:MM` | — |
| `inteiro` | número inteiro | — |
| `texto` | string, com teto de tamanho | Apara |
| `texto_busca` | string, com teto | Apara **e envolve em `%…%`** |
| `lista_texto` | array de strings | Reescreve `:nome` em `(:nome_0, …)`; vazia vira `(NULL)` |

O curinga do `LIKE` é aplicado pelo servidor, nunca pelo consumidor: os SELECTs de busca do
SICLA recebem o termo já com `%`, e deixar isso na mão de quem chama é convite a resultado
silenciosamente vazio.

Erro de parâmetro devolve `400` com **todos** os problemas de uma vez, e nada é enviado ao
banco.

## RN-05 · Só vai o bind que o SQL vigente referencia

O Administrador pode salvar uma versão do SQL sem `:data_ini`. Mandar o bind assim mesmo faz
o driver recusar a execução inteira. O executor confere o texto vigente e envia só o que ele
cita — mesma regra que o BI de Implantação já aplicava à mão.

A checagem usa `:nome` seguido de algo que não seja letra, dígito ou `_`: `:data_ini` não
casa com `:data_inicial`.

## RN-06 · O teto de linhas é da consulta, não de quem chama

Cada consulta declara `limiteLinhas` — o mesmo valor que o módulo dono já usava. O
consumidor escolhe só o tamanho da **página** (teto absoluto 5000). `truncadoNoLimite: true`
avisa que o banco devolveu exatamente o teto e pode haver mais dado.

## RN-07 · Cache por consulta, invalidável pelo Administrador

Cada entrada declara `cacheSegundos` (0 = sem cache), e a chave é a consulta + os
parâmetros. Buscas interativas (cliente, por exemplo) não cacheiam; painéis de BI cacheiam
5 minutos. Ao editar um SQL salvo, o Administrador usa
`POST /api/dados/v1/admin/cache/limpar` — senão o resultado antigo sobrevive até o TTL.

## RN-08 · Duas autenticações, gates diferentes

- **Pessoa (JWT)** → gate por **menu**. Quem não enxerga a tela não consulta o dado por
  baixo dela; sem isso a API viraria porta lateral em volta do painel de Permissões. Uma
  consulta pode declarar mais de um menu (o calendário de alocação serve à tela Agenda e aos
  Dashboards) e basta ter `consulta` em um deles.
- **Máquina (`X-API-Key`)** → gate por **escopo** (`sicla:leitura`, `portal_rech:leitura`).
  Sem menu, sem perfil: pode exatamente o que foi cadastrado.

## RN-09 · Chave de máquina: exibida uma vez, guardada como hash

Formato `rd_<prefixo>_<segredo>`. O prefixo viaja em claro e é o índice de busca; o segredo
só existe como hash bcrypt. Vazamento do dump não devolve chave utilizável, e não há como
recuperar a chave depois — perdeu, rotaciona.

**Revogar** (`ativo: false`) é o caminho preferido a apagar: o registro é a prova de quem
teve acesso e até quando. `ultimoUsoEm` responde "ainda usam isto?" antes de revogar, e
denuncia chave viva esquecida numa integração desligada.

Administrar a API exige **pessoa ADM**: uma chave comprometida não emite outra.

## RN-09-A · Lista vira `IN` no servidor

O node-oracledb não expande lista em bind (o SQLAlchemy do Painel Flask expandia). Um
parâmetro `lista_texto` faz o executor **reescrever** o SQL: `:tecnicos` vira
`(:tecnicos_0, :tecnicos_1, …)`, com um bind por item. Lista vazia vira `(NULL)` — nunca
casa, mesmo efeito de um `IN` sem valores — e a reescrita acontece **mesmo assim**, porque
deixar `:tecnicos` cru faria o driver recusar a execução inteira.

## RN-10 · A API é somente leitura

Todos os escopos são `:leitura` e os dois executores já recusam qualquer comando que não
seja `SELECT`/`WITH`. Escrita em banco de terceiro não é decisão de arquitetura — é decisão
de negócio, e não foi tomada.

## RN-11 · Toda execução é auditada

Vai para o log estruturado (que já carrega o correlation-id da requisição): consulta,
conexão, quem chamou (`usuario:<id>` ou `cliente_api:<id>`), parâmetros, linhas, tempo e
erro. Os parâmetros do catálogo são período, código e termo de busca — nada sensível; um
parâmetro que venha a carregar dado pessoal precisa ser mascarado antes de entrar no log.

`GET /api/dados/v1/admin/metricas` resume o uso por consulta desde o último boot — é o que
responde "quem consome o quê" antes de mexer numa entrada do catálogo.
