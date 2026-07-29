# Porte do BI de Implantação (Power BI → Painel)

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

#### O calendário mostra SÓ três espécies de compromisso

`ESPECIE IN (84, 90, 92)` — é o que a medida `Calendario` rotula (o `SWITCH` cobre exatamente
esses três) e o que o slicer de `ESPECIE` da página deixava passar. O resto da agenda do SICLA
não é da implantação: férias, reuniões tática/estratégica, posto flex e atendimentos
**COBRADOS**. Em julho/2026, das 706 agendas do mês, **607 são destas três**.

O filtro está em `ESPECIES_CALENDARIO` (`bi-implantacao.constants.ts`) e entra no `WHERE` do
SQL — não é filtro de tela; incluir uma espécie nova é mexer nessa constante.

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
