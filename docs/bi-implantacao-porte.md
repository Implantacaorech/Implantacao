# Porte dos BIs de Implantação (Power BI → Painel)

## Área BI do Painel

Um menu só (**BI**), duas abas, cada uma com subabas:

| Aba | Origem | Subabas |
| --- | --- | --- |
| **BI Implantação** | `BI_Interno.pbix` | Previsão de Início Oficial ✅ · Indicadores de Contratação ✅ · Indicadores de Conclusão ✅ · % de Utilização das Horas ✅ · Alocação de Agendas — Calendário ✅ · Alocação de Agendas — Horas Aplicadas ✅ · Movimentos de trabalho efetivo ✅ |
| **Implantação Clientes SIGER** | `BI_clientes.pbix` | Resumo ✅ · Extrato de Protocolo/Horas ✅ · RNS vinculadas ✅ · Agendas ✅ |

RBAC: as duas abas seguem chaves separadas — `dashboards` (BI Implantação) e `bi_implantacao`
(Implantação Clientes SIGER). O item "BI" aparece se o usuário tiver pelo menos uma.

### Indicadores (BI_Interno) — o que a view exige

As três telas de Indicadores saem de `POWERBI.POWERBI_IMP_RNIMPLANTACAO_2` (2.889 linhas), a
mesma da consulta "Previsão Início Oficial". Peculiaridades confirmadas no banco:

- **As datas são TEXTO** `DD/MM/YYYY` (VARCHAR2), não DATE — só `DATA PREVISAO DE USO` e
  `DATATRANSMAN` são TIMESTAMP. Converter no Oracle é arriscado (um valor sujo derruba a
  query inteira, e o `ON CONVERSION ERROR` do 12c+ não aceita coluna no 19c daqui); a
  conversão é feita no serviço.
- **As colunas "HORAS ..." são strings** `"108:00"`. Para cálculo valem as `MINUTOS ... (DEC)`.
- `COMPETENCIA CONTRATACAO`/`ENCERRAMENTO` vêm como `AAAA/MM` — ordenáveis como texto, o que
  as torna o filtro de período mais seguro que converter data.
- Nomes com espaço e acento (`"POSIÇÃO IMPLANTAÇÃO"`) exigem aspas duplas no SQL.
- **"Concluído" é a POSIÇÃO** (`6-…`), não a existência de data de encerramento: há RNS com
  encerramento *previsto* preenchido que ainda não concluíram.

### Alocação de Agendas (BI_Interno) — Calendário e Horas Aplicadas

Backend: [`backend/src/bi-agenda-alocacao/`](../backend/src/bi-agenda-alocacao/) —
`GET /bi-agenda-alocacao/calendario` e `GET /bi-agenda-alocacao/horas-aplicadas`, gate
`dashboards` (igual às três de Indicadores). Frontend: os dois componentes vivem em
`frontend/src/app/features/bi-indicadores/` (`bi-alocacao-calendario.*` e
`bi-alocacao-horas.*`), rotas `/bi/implantacao/alocacao-calendario` e `/alocacao-horas`, na
mesma `BiIndicadoresStore` das outras três (o mês do calendário ganhou `mesAlocacao`, igual ao
`mesAgenda` do outro BI — técnico/grupo/tipo de suporte reaproveitam `responsavel`/`grupo`/
`tipoSuporte`, já existentes).

Ao contrário do calendário do BI_clientes.pbix (que tem `ESPECIE IN (84, 92)` gravado no
próprio visual), a inspeção do `Report/definition/` do `BI_Interno.pbix` **não achou nenhum
filtro fixo de página nem de relatório** restringindo espécie ou tipo de suporte nestas duas
páginas — os slicers (`TIPO_SUPORTE`, técnico, status) são livres, sem seleção padrão. O único
filtro de relatório encontrado (`Report/definition/report.json`, global, vale para as 7
páginas) é `LISTA_CLIENTES.TIPO IN ('C')` / `Clientes.TIPO IN ('C')` — cliente de verdade, não
prospect —, reproduzido aqui pelo JOIN com `PEDIDOIMP`: uma linha só carrega
FANTASIA/GRUPO_ECONOMICO quando está de fato ligada a uma RNS de implantação
(`PEDIDOIMP = POWERBI_IMP_RNIMPLANTACAO_2.CODIGO`, confirmado batendo 925 de 929 preenchidos).
Por isso o **Calendário mostra tudo** por padrão (inclusive Scrum, treinamento, folga, posto
flex — que não têm `PEDIDOIMP`) e conta com os filtros do usuário para recortar.

**Calendário** — fonte `POWERBI.POWERBI_IMP_LISTACOMPROMISSOS_2` (5.452 linhas, janela rolante
jul–nov/2026 na inspeção). ⚠️ Uma linha é **por técnico**: um compromisso com 2 participantes
gera 2 linhas com o mesmo `CODIGO` — contar "compromissos" exige `Set` de códigos distintos
(`totalCompromissos` já faz isso no serviço), contar "por técnico" usa a linha direto.
`STATUS` é `NUMBER` puro (1/3/6/7), sem 8-Postergada/9-Cancelada — confirmado em 5.452 linhas;
os rótulos reaproveitam o vocabulário de `COR_STATUS_AGENDA` (bi-implantacao) por serem o mesmo
domínio.

**Horas Aplicadas** — fonte `POWERBI.POWERBI_AGENDA_POSTERGACAO_IMP_2` (6.331 linhas, histórico
desde 2009), uma linha por compromisso com 6 colunas indicador 0/1
(`ENCAMINHADA`/`AGENDADA`/`REALIZADA`/`NAO__REALIZADA`/`POSTERGADA`/`CANCELADA`, sempre
exatamente uma marcada). ⚠️ **"Horas" não é contagem de compromissos**, apesar do nome das
medidas do BI parecer isso — é a **duração** (`DATAFIM − DATAINI`) somada por status. Verificado
batendo os números antes de escrever qualquer SQL: em julho/2026 a duração média por
compromisso é 3,02h (mín. 0,17h, máx. 9,5h, zero negativos/zerados em 6.331 linhas) — plausível
para agenda de atendimento, o que "contar 1 por linha" não seria. Em produção (jan–jul/2026):
65 RNS, 10.044h somadas, 16,8% postergada no agregado. `RNS` bate com
`POWERBI_IMP_RNIMPLANTACAO_2.CODIGO` em 97,9% das linhas (6.197 de 6.331) — o resto é RNS fora
da janela atual daquela view. A duração é calculada no **serviço** (`(fim − ini) / 3.600.000`
em milissegundos), não no SQL — o Oracle devolve `DATAINI`/`DATAFIM` como `INTERVAL DAY TO
SECOND` ao subtrair TIMESTAMPs, que dá `ORA-00932` se comparado/agregado direto sem `CAST`.

### Movimentos de trabalho efetivo (BI_Interno) — a página que foge do padrão

Backend: [`backend/src/bi-movimentos/`](../backend/src/bi-movimentos/) — `GET /bi-movimentos`,
gate `dashboards`. Frontend: `frontend/src/app/features/bi-indicadores/bi-movimentos.*`, rota
`/bi/implantacao/movimentos`, mesma `BiIndicadoresStore` (só o período — `movDataIni`/
`movDataFim` — é compartilhado/persistido; técnico, tipo de movimento e "cobra hora" são
filtros locais da tela, ver abaixo o porquê).

Fonte: `POWERBI.POWERBI_APONTAMENTO_TECNICOS` — **663.969 linhas** em 2026-07-29, de longe a
maior origem entre as ~11 páginas de BI já portadas (a segunda maior, RNS vinculadas, tem 56,9
mil). É uma **VIEW sem índice próprio** (confirmado em `ALL_IND_COLUMNS`) — um `COUNT(*)` sem
filtro **levou ~4 minutos**. Por isso esta é a ÚNICA página do BI cujo SQL já entrega
**agregado pelo próprio Oracle** (`GROUP BY` técnico × tipo de movimento × cobrança), em vez do
padrão "busca tudo, filtra/agrega no Node" que todas as outras ~10 páginas usam — buscar as
210 mil linhas cruas de uma janela de 12 meses para agregar no Node teria o mesmo problema de
escala, só que pago a cada requisição HTTP.

- **Filtrar por `DTINICIO`** (a única coluna TIMESTAMP real da tabela) é o que torna a consulta
  viável: 3s numa janela de 30 dias, ~18s numa de 12 meses (210 mil linhas cruas → 431
  agregadas). `DATA_RECH`/`ANO RECH` (os slicers do relatório original) são texto **sem ano
  completo** (`"07-Julho"`) e parecem ser data de fechamento/processamento do apontamento, não
  da atividade — não usados.
- **Janela padrão de 3 meses, teto de 6** (`MESES_PADRAO_MOVIMENTOS`/
  `MAX_MESES_JANELA_MOVIMENTOS`) — mais curta que o padrão de 12/24 meses do resto do BI, de
  propósito: 12 meses já levou ~18s numa consulta agregada; pedir mais que 6 meses é recortado
  silenciosamente (a tela avisa via `periodoLimitado`). Por essa razão o período desta tela usa
  campos PRÓPRIOS no store (`movDataIni`/`movDataFim`), não os `compIni`/`compFim`
  compartilhados com Contratação/Conclusão/Utilização/Horas Aplicadas — usar os mesmos faria
  esta página herdar (ou impor às outras) uma janela errada para a escala de cada uma.
- **`MINDURACAO` ≈ `DURACAO_TOTAL`** em praticamente toda amostra observada (a diferença é
  `SEGDURACAO`, quase sempre 0) — a tela usa `MINDURACAO` como duração total e `MINCOBRADO`
  como a parte cobrada. `VALOR_COBRADO` é monetário, fora do escopo (a página é de horas, não
  de faturamento). `CAT`/`TIPOCATDES` são **sempre NULL** nas 663.969 linhas — confirmadas
  mortas, não usadas.
- **Técnico não reaproveita o filtro `responsavel` do resto da aba.** `TECNICODES` vem em
  **MAIÚSCULAS** (`"THOMAZ"`, `"MICAEL"`) — formato diferente do `RESPONSAVELDES` usado nas
  outras páginas (`"Kailan"`, `"Pereira"`). Reaproveitar o mesmo campo do store misturaria dois
  formatos que não batem — mesma classe de erro já cometida antes com `statusRns` ×
  `statusImplantacao`. Por isso técnico, tipo de movimento e "cobra hora" são `signal`s locais
  do componente, não do `BiIndicadoresStore`.

#### ⚠️ Os 6 tipos de movimento podem não ser somáveis num "total de horas"

`TP_MOVIMENTO` tem 6 valores: **AGENDA** e **VISITAS** (sempre 100% `COBRA_HORA = 'Sim'`) e
**RNS**, **PENDENCIA**, **ATENDIMENTOS**, **FICHA** (sempre 0%, confirmado em produção). O
relatório original mostra as 6 medidas `_Total_horas_X_decimais` como barras **separadas** num
`clusteredBarChart` — nunca somadas numa medida "total geral" confirmada (o DAX está no
`DataModel` binário, ilegível). Testado em produção (2026-07-29, janela de 3 meses): a média
geral fica em ~8,5h/técnico/dia (plausível), mas alguns técnicos somam **mais de 13h/dia**
quando os 6 tipos são somados — sinal de que os tipos podem registrar o **mesmo intervalo de
relógio por ângulos diferentes do SICLA** (ex.: uma visita que também vira um lançamento de
RNS), não necessariamente tempo adicional. A tela expõe a soma como "Horas totais (soma dos
tipos)", com tooltip explicando a ressalva, em vez de apresentá-la como "horas trabalhadas"
sem qualificação — não havia como confirmar a fórmula original sem o DAX.

---

## Porte do BI_clientes.pbix (Implantação Clientes SIGER)

Registro do que foi extraído do relatório **`BI_clientes.pbix`** e de como cada parte dele
está sendo reimplementada nativamente no Painel. Iniciado em 2026-07-29.

## Origem dos dados

Tudo vem do **Oracle do SICLA** (`SICLAPDB`, host `192.168.255.199:1521`), pelo usuário
**`powerbi`** — a MESMA conexão já configurada na aba Disponibilidade
(`backend/dados/disponibilidade.json`) e usada por `DisponibilidadeService.executarSql`.
Não houve cópia nem migração de dados: as telas leem as views direto.

| Tabela no modelo do Power BI | Objeto real no Oracle | Colunas |
| --- | --- | --- |
| `POWERBI_IMPLANTACAO_RESUMO` | `POWERBI.POWERBI_IMPLANTACAO_RESUMO` (view) | 28 |
| `POWERBI_IMPLANTACAO_AGENDAS` | `POWERBI.POWERBI_IMPLANTACAO_AGENDAS` (view) | 35 |
| `POWERBI_IMPLANTACAO_EXTRATO_HORAS` | `POWERBI.POWERBI_IMPLANTACAO_EXTRATO_HORAS` (view) | 18 |
| `POWERBI_IMPLANTACAO_MODULOS` | `POWERBI.POWERBI_IMPLANTACAO_MODULOS` (view) | 22 |
| `POWERBI_IMPLANTACAO_RNS_VINCULADAS` | `POWERBI.POWERBI_IMPLANTACAO_RNS_VINCULADAS` (view) | 183 |
| `POWERBI_IMP_LISTARNS` | `POWERBI.POWERBI_IMP_LISTARNS` (view) | 91 |
| `LISTA_CLIENTES` | `SICLA.LISTA_CLIENTES` (view) | 82 |
| `dCalendario`, `Medidas`, `ParametrosAno`, `ParametrosMes` | — (tabelas locais do modelo) | — |

### Equivalências de nome (BI → banco)

- `Status_RNS` → `POWERBI_IMPLANTACAO_RESUMO.TIPOSTATUS`
- `GRUPO_ECONOMICO` → `SICLA.LISTA_CLIENTES.GRECONDES`
- `RNImp` → `POWERBI_IMPLANTACAO_RESUMO.CODIGO`

Valores de `TIPOSTATUS` (1.860 linhas na view em 2026-07-29): `1-Não inciado`,
`2-Lenvatamento de Projeto`, `3-Em Treinamento`, `4-Simulações`, `5-Uso Oficial`,
`6-Concluída`, `7-Parada`, `8-Cancelada`. *(Os dois erros de grafia são do dado de origem —
mantidos como estão para não divergir do SICLA.)*

## As 4 páginas do relatório

| Página do BI | Conteúdo | Situação |
| --- | --- | --- |
| **Resumo Implantação** | Filtros + CONTROLE DE HORAS + tabela de RNS com previstas/realizadas/saldo | ✅ **Portada** (`/bi-implantacao`) |
| **Extrato de Protocolo/Horas** | Filtros + lista de lançamentos com horas, saldo acumulado e descrição | ✅ **Portada** (`/bi-implantacao/extrato`) |
| **RNS** | Filtros de status e validação + tabela de RNS vinculadas | ✅ **Portada** (`/bi-implantacao/rns`) |
| **Agendas** | Calendário mensal com status por cor + cards de contagem/% | ✅ **Portada** (`/bi-implantacao/agendas`) |

**As 4 páginas estão portadas.** O `.pbix` vira material de consulta; o que vale é o código.

### Painel "Visitas do Portal Rech — aprovação" (Resumo, abaixo do CONTROLE DE HORAS)

Adicionado em 2026-08-17 (pedido do usuário — não existia no `.pbix`): tabela com as visitas
do **Portal Rech** (empresa, contato, consultor, protocolo, data, horário, turno e
aprovação), na tela Resumo, logo abaixo do CONTROLE DE HORAS.

- **Fonte: o BANCO DO PORTAL RECH (MySQL), conexão cadastrada pelo ADM** em Sistema →
  Consulta BD → aba **"Banco do Portal Rech"** (`PortalDbService`, segredo em
  `dados/portal_db.json`, mesmo padrão da Disponibilidade). A consulta do usuário (MySQL,
  `visita`/`visita_aprovacao`/`empresa`/`contato`/`usuario`) **vive no Consultas BD**
  (slug `bi_visitas_portal`, semeada no boot, editável sem deploy) com **`conexao =
  'portal'`** — o campo `conexao` (sicla | portal) nasceu junto (migration
  `ConsultaBdConexao`), e o Testar da tela e os Dashboards roteiam o executor por ele.
  Assim o painel mostra **TODOS os protocolos** (de todos os consultores), sempre
  respeitando o cliente filtrado.
- **Por que nem o SICLA nem a API do Portal** (a lição do dia 2026-08-17): o SICLA não
  espelha nem o protocolo nem a aprovação — `LISTA_VISITAS.PROTOCOLO` é o atendimento de
  origem, `CODVISITA` é contador interno (~125–128 mil), `PROTOCOLOVIS` diverge ENTRE
  tabela e view E do nº real do Portal (protocolos reais 135089/135096 provaram), e
  `RECEBIDA` não é a aprovação (135089 APROVADO no Portal com RECEBIDA=0). Já a API do
  Portal (`GET /api/v1/visita`, ver `PortalRechService.listarVisitas`) traz o dado certo
  mas é **escopada por usuário** — não serve para ver todos os protocolos do cliente.
- **O painel respeita SEMPRE o cliente filtrado**: só entram visitas dos clientes visíveis na
  tabela de implantações (todos os filtros da tela + busca local valem nele). O casamento é
  por `codigoCliente`, com fallback pelo nome fantasia (`visitasVisiveis` no componente).
- Endpoint: `GET /bi-implantacao/visitas-portal` (`dataIni`/`dataFim`), mesmo gate
  `bi_implantacao`. A tela só reconsulta o banco quando o De/Até muda; os binds
  `:data_ini`/`:data_fim` só são passados se o SQL vigente os referenciar.
- **Filtros locais, gráfico e exportação** (2026-08-17): acima da tabela há filtros em
  cascata por Empresa/Contato/Consultor/Turno/Aprovado + busca por nº de protocolo — valem
  para os contadores do título, para o gráfico e para o "Exportar Excel" (CSV com BOM, o
  mesmo formato do Resumo). O gráfico de barras empilhadas mostra **protocolos por contato**
  (verde = aprovados, vermelho = não aprovados; top 15 contatos por volume), com visão
  **Geral / Mês atual / Semana atual** (semana de segunda a domingo — recorte puro em
  `visitas-portal.util.ts`, testável com data fixa).

### Filtros padrão das telas

Toda página do BI no Painel oferece o mesmo conjunto: **Grupo econômico · RNS de Implantação ·
Status da RNS · Consultor** (mais os específicos de cada tela). Decisões por trás disso:

- O extrato **não tem** o status da RNS: ele vem de um `LEFT JOIN` com
  `POWERBI_IMPLANTACAO_RESUMO` por `CODIGO` (verificado: `CODIGO` é único nas 1.860 linhas da
  view, então o join não duplica lançamentos).
- Listas longas (215 grupos, 819 RNS, 405 clientes) ganham busca por bloco, teto de 80 itens
  exibidos e a garantia de que **uma opção já marcada nunca some da lista** — senão o usuário
  não conseguiria desmarcá-la depois de digitar outra busca.

#### Cascata

Marcar um filtro **restringe as opções dos demais**: escolher um grupo econômico reduz as
listas de RNS, status, consultor, cliente e módulo. A regra é calcular as opções de cada
dimensão aplicando todos os filtros **menos o da própria dimensão** (`emCascata` no serviço) —
se a própria entrasse na conta, marcar um consultor encolheria a lista de consultores para só
ele e não daria mais para trocar a escolha nem marcar um segundo.

#### Estado compartilhado entre as abas

Os filtros vivem em `BiFiltrosStore` (`providedIn: 'root'`), não nos componentes: trocar de aba
destrói e recria a tela, então um filtro guardado no componente se perderia. O que se marca
numa aba vale nas outras.

⚠️ **Dois "status" que não podem se misturar.** `statusImplantacao` é o `TIPOSTATUS` da RNS de
implantação ("6-Concluída", "5-Uso Oficial") — no Resumo e no Extrato ele viaja no parâmetro
`status`; na página RNS, em `statusImplantacao`. Já `statusRns` é o status da RNS **filha**
("10-Entregue", "99-Cancelada") e só existe na página RNS. Confundi-los troca o significado da
tela; há teste travando a separação.

### Página RNS: o que "vinculadas" significa

`POWERBI_IMPLANTACAO_RNS_VINCULADAS` guarda **todas** as RNS do SICLA (56.869 em 2026-07-29),
mas só **379** têm `IMP_COD` preenchido — é esse campo que amarra a RNS a uma implantação. O
`WHERE IMP_COD IS NOT NULL` é, portanto, a própria definição da página: sem ele a tela viraria
um dump do SICLA inteiro. `VALIDADOCLI` (0/1) é a "Validação Cliente" do relatório.

### Regra de ouro dos painéis

Todo painel de uma tela deriva das **linhas visíveis**, nunca dos agregados que o backend
calculou antes da busca textual. Sem isso, o gráfico mostra um conjunto e a tabela logo abaixo
mostra outro — foi exatamente o defeito reportado em 2026-07-29 nos gráficos e no top-10 de
consultores do Resumo. Há teste de regressão travando o comportamento.

### Sobre o CLOB da descrição (Extrato)

`DESC_VISITA` é um CLOB que chega a **71 mil caracteres**; 6% dos lançamentos passam de 2.000.
Duas consequências práticas:

- O driver devolve um objeto `Lob`, que o `executarSql` não sabe serializar — por isso o SQL
  usa `DBMS_LOB.SUBSTR`. O teto do `SUBSTR` é em **bytes**: pedir 4.000 caracteres com acentos
  em UTF-8 estoura com ORA-06502.
- A listagem traz só 300 caracteres (~0,7 MB numa janela de 6 meses); o texto completo vem de
  `GET /bi-implantacao/extrato/descricao` quando o usuário abre o item, com chave composta
  **protocolo + data/hora** (o protocolo sozinho pode repetir).

`LISHORASUTILIZADAS` é gravado **negativo** no SICLA (é consumo) — o relatório mostra o valor
absoluto, e o serviço faz o mesmo.

> **Atenção ao comparar as telas:** boa parte dos visuais do `.pbix` é entulho de um template
> comercial (slicers de `produto_marca`, `representante`, `cliente_zona_venda` e medidas de
> `Faturamento Liquido`), escondidos e sem uso. Nada disso foi portado.

## Página portada: Resumo Implantação

- Backend: [`backend/src/bi-implantacao/`](../backend/src/bi-implantacao/) — `GET /bi-implantacao/resumo`
  (o SQL fica em `bi-implantacao.constants.ts`).
- Frontend: [`frontend/src/app/features/bi-implantacao/`](../frontend/src/app/features/bi-implantacao/),
  rota `/bi-implantacao`.
- Permissão: menu **`bi_implantacao`** (grupo Gestão) — semeado por `PADRAO_PERMISSOES`;
  liberado para ADM/Coordenador/GCI com alteração e Administrativo/Consultor/Levantador em
  consulta. **Fora do Comercial**, porque a tela expõe saldo de horas por cliente.

Só o recorte de **período** vai ao Oracle (padrão: últimos 12 meses); status, consultor,
grupo econômico, ativo e tipo de cliente são aplicados em memória, para que as listas de
opções não encolham conforme o usuário filtra.

## As medidas HTML do relatório

Três visuais eram **HTML gerado por medida DAX**. A definição mora na parte `DataModel` do
`.pbix`, comprimida em **XPress9** — ilegível por leitura direta. O usuário exportou as três
pelo Power BI Desktop em 2026-07-29; as regras estão registradas abaixo.

### `Grafico_Horas_HTML` — ✅ aplicada (página Resumo)

Virou o painel **CONTROLE DE HORAS**, reescrito em Angular nativo. Regras preservadas:

- **`COBRADAS` = `HORASCOBRADAS` + `HORASCOBRADASADICIONAIS`**; **`BONIFICADAS` =
  `HORABONIFICADAS` + `HORABONIFICADASADICIONAIS`**. As colunas "adicionais" são fáceis de
  esquecer e mudam o número (em 2026: +1,8h cobradas, +22h bonificadas).
- **`SALDO` = previstas − realizadas** — a medida **não** usa a coluna `HORASALDO`. Por isso
  os totais expõem `horasSaldo` (coluna do SICLA) *e* `horasSaldoCalculado` (o do BI).
- Faixas por % de utilização, bordas inclusive na faixa de baixo:
  ≤25 `INICIADO` `#10b981` · ≤50 `DESENVOLVIMENTO` `#fbbf24` · ≤75 `AVANÇADO` `#fb923c` ·
  ≤100 `FINALIZADO` `#ef4444` · >100 `ULTRAPASSADO` `#1f2937`.
- Régua de 4 faixas de 25%. Passando de 100%, as faixas comprimem para 21,25% (85% do total)
  e os 15% finais viram a barra de excedente; o marcador vai para
  `85 + (mín(%, 150) − 100) × 0,15` — ou seja, **satura em 150%**.
- Cards: PREVISTAS cinza `#6b7280` · REALIZADAS `#ef4444` · SALDO `#10b981`/`#ef4444` conforme
  o sinal · COBRADAS `#3b82f6` · BONIFICADAS `#8b5cf6`. Saldo com sinal (`+3.505h`).

### `Tabela_Resumo_HTML` — ⬜ para a página *Extrato de Protocolo/Horas*

Lista de `POWERBI_IMPLANTACAO_EXTRATO_HORAS` ordenada por `DATAHORA` **desc**, com:
`DATAHORA` (dd/MM/yyyy), `LIS_SIGLA`, `LIS_TECNICODESCRICAO`, descrição **truncada em 60
caracteres** (com indicador e modal para o texto completo), `ABS(LISHORASUTILIZADAS)` e
`SALDO_ACUMULADO`, ambos com 2 casas. Quebras de linha viram `<br>` no modal.

### `Calendario` — ✅ aplicada (página Agendas)

Grade mensal de `POWERBI_IMPLANTACAO_AGENDAS` (semana começando no **domingo**), agrupada por
**`PARTICIPANTES`** (vazio ⇒ "Não informado"), filtrada por ano/mês. Regras não óbvias:

- **Realizada é derivada**: `VISITA <> 0` e não vazio ⇒ status `6-Realizada`, sobrepondo
  `STATUSDES`.
- **Prioridade do dia**: se o dia tem alguma `3-Agendada`, mostra **só** as agendadas; senão,
  se tem alguma `1-Solicitada`, oculta as canceladas; senão mostra tudo.
- **Status predominante do técnico**, nesta ordem: Cancelada › Não realizada › Postergada ›
  Realizada › Agendada › Solicitada.
- Cores (pastel): `1-Solicitada` `#FFFFE0` · `3-Agendada` `#E0FFE0` · `6-Realizada` `#FFF5E0` ·
  `7-Não realizada` `#F5DEB3` · `8-Postergada` `#F0F0F0` · `9-Cancelada` `#FFE0E0`.
- Espécie: **84** = Agenda Remoto · **92** = Agenda Presencial · **90** = Agenda Interna Rech.
- Turno: `<12h` Manhã · `<18h` Tarde · senão Noite. Ordenação por `turno × 10000 + hora × 60 +
  minuto`. No modal do técnico as canceladas nunca aparecem.

#### O calendário mostra SÓ duas espécies de compromisso

`ESPECIE IN (84, 92)`. **A fonte é o filtro gravado no visual dentro do `.pbix`**, não a medida:

```json
// Report/Layout → página "Agendas" → filtro Categorical do visual htmlContent
"In": { "Expressions": [ ... "Property": "ESPECIE" ],
        "Values": [ [{"Literal": {"Value": "'92'"}}], [{"Literal": {"Value": "'84'"}}] ] }
```

⚠️ **Não se guie pelo `SWITCH` da medida `Calendario`.** Ele rotula **três** códigos (84, 92 e
90), mas o 90 é rotulagem remanescente — o filtro do visual nunca deixou o 90 passar. Foi
exatamente esse o erro cometido na 1ª tentativa: incluir o 90 trouxe "Produção Interna Normal
Apontada", 194 das 706 agendas de julho/2026, que não é agenda de implantação.

Fica de fora: produção interna (90), férias, reuniões tática/estratégica, posto flex e os
atendimentos **COBRADOS** (87, 98). Em julho/2026 sobram **413 das 706** agendas do mês.

O filtro está em `ESPECIES_CALENDARIO` (`bi-implantacao.constants.ts`) e entra no `WHERE` do
SQL — não é filtro de tela; incluir uma espécie nova é mexer nessa constante.

> Para conferir filtros de um visual do Power BI sem abrir o Desktop: o `.pbix` é um ZIP; o
> `Report/Layout` (JSON em UTF-16) traz `filters` por página e por visual, com os literais
> selecionados. É a fonte mais confiável — a medida DAX pode conter código morto.

#### Duas divergências entre o DAX e o banco, resolvidas a favor do banco

- **`PARTICIPANTES` é uma lista**, não um nome: a coluna guarda `"Alan,Brito,Dibah,Everton"`.
  O DAX agrupava pela **string inteira**, então "Jolemar,Silva" virava um "técnico" distinto de
  "Jolemar". Em julho/2026 isso dava **109 "técnicos" para 47 pessoas reais**. A tela divide por
  vírgula: cada nome é um participante, e o filtro de consultor passa a funcionar de verdade.
- **Os rótulos de espécie do DAX estão errados.** Ele fixava 84 = "Agenda Remoto", 92 = "Agenda
  Presencial", 90 = "Agenda Interna Rech"; o `ESPECIEDES` da view diz, respectivamente,
  "Atendimento Interno NÃO COBRADO", "Atendimento Externo NÃO COBRADO" e "Produção Interna
  Normal Apontada". A tela mostra o `ESPECIEDES` — a fonte manda.

Duas notas menores: `VISITA` na view é **nula ou preenchida**, nunca 0 (o `VISITA <> 0` do DAX
sugeria o contrário); e a prioridade do dia esconde bastante — em julho/2026, **704 agendas
viram 453 visíveis**, então cada dia mostra quantas foram ocultadas.

> ⚠️ **Cuidado com as cores de status.** Antes da exportação, um script TMDL avulso embutido no
> pacote (`TMDLScripts/Script 1.tmdl`) trazia uma variante ANTIGA do calendário, com cores
> fortes (`#9C27B0`, `#2196F3`, `#4CAF50`…). A medida vigente usa os pastéis acima. A tela do
> Resumo herdou as cores fortes para colorir status na tabela e no gráfico por status — o que
> **não é infidelidade**, porque a página Resumo do BI não colore status; mas a página Agendas,
> quando for feita, deve usar os pastéis.
