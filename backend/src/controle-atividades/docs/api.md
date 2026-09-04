# API — Controle de Atividades

Base: `/api/atividades`. Todas as rotas exigem JWT e o menu `controle_atividades`
(`@Permissao`, nível `consulta`) — **a leitura é geral**. O que separa escrita de consulta é
ser responsável pelo quadro, decidido no service, por quadro.

Todas as respostas vêm no envelope padrão (`{ success, data, message, timestamp }`).

## Quadros

| Verbo | Rota | Observações |
|---|---|---|
| GET | `/quadros` | `{ meus, demais, consultores }` — `consultores` alimenta o filtro da aba |
| GET | `/projetos-disponiveis` | Projetos em que o usuário está designado |
| POST | `/quadros` | `{ codigoClienteSicla, nomeCliente, projetoId }` — idempotente por cliente |
| GET | `/quadros/:codigo` | Quadro inteiro (colunas, cartões, membros, checklist, anexos, conversa) |
| POST | `/quadros/:codigo/responsaveis` | `{ usuarioId }` |
| DELETE | `/quadros/:codigo/responsaveis/:usuarioId` | Recusa remover o último |
| POST | `/quadros/:codigo/responsaveis/sincronizar` | Repuxa a designação do projeto |

## Colunas

| Verbo | Rota |
|---|---|
| POST | `/quadros/:codigo/listas` — `{ titulo, visivelCliente? }` |
| PATCH | `/listas/:id` — `{ titulo?, visivelCliente? }` |
| DELETE | `/listas/:id` — arquiva; recusa se houver cartão dentro |

## Cartões

| Verbo | Rota | Observações |
|---|---|---|
| POST | `/cartoes` | Nasce interno (Rech) ou compartilhado (cliente) |
| PATCH | `/cartoes/:id` | Título, descrição, prazo, etiquetas |
| PATCH | `/cartoes/:id/mover` | `{ listaId, indice }` — grava **uma** linha (ponto médio) |
| PATCH | `/cartoes/:id/visibilidade` | `{ visivelCliente }` — registra evento |
| DELETE | `/cartoes/:id` | Arquiva |
| POST/DELETE | `/cartoes/:id/membros[/:membroId]` | Cliente só designa `tipo: 'interno'` |
| POST/PATCH/DELETE | `/cartoes/:id/checklist[/:itemId]` | Marcar exige só *interagir* |
| POST | `/cartoes/:id/anexos` | multipart, campo `arquivo`, teto `LIMITE_UPLOAD_DOC` |
| POST | `/cartoes/:id/anexos/link` | `{ url, nome? }` — só http/https |
| GET | `/cartoes/:id/anexos/:anexoId` | Download; **reconfere a permissão do cartão** |
| DELETE | `/cartoes/:id/anexos/:anexoId` | |
| POST | `/cartoes/:id/comentarios` | `{ texto }` — avisa o outro lado |

## Busca e avisos

| Verbo | Rota | Observações |
|---|---|---|
| GET | `/busca?termo=&consultor=` | Todos os quadros que o usuário alcança; teto de 50 |
| GET | `/notificacoes` | Avisos pendentes (o pop-up) |
| POST | `/notificacoes/lidas` | `{ ids? }` — sem ids, fecha todos |

## Apoio

| Verbo | Rota |
|---|---|
| GET | `/etiquetas` — catálogo fixo |
| GET | `/consultores` — usuários internos ativos |
| GET | `/clientes?termo=` — `sicla.clientes.buscar` (API de Dados) |
| GET | `/contatos/:codigo` — `sicla.contatos.listar`, atrás do mesmo gate do quadro |

## Códigos de resposta

| Código | Quando |
|---|---|
| **404** | Quadro/cartão que o usuário **não alcança**. Deliberado: dizer "proibido" confirmaria que aquele cliente ou cartão existe |
| **403** | Alcança, mas não pode a AÇÃO ("somente consulta", "coluna não aceita o cartão") |
| **400** | Entrada inválida — coluna de destino de outro quadro, link sem http/https, coluna com cartões |
| **413** | Anexo acima do teto |
