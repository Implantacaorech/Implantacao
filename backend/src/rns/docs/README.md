# Módulo `rns` — tela Execução → RNS

Consulta de assuntos nas RNS do SICLA, no molde do **Dicionário Inteligente**: o consultor
pesquisa um assunto qualquer ("comissão", "conversão de produtos", o nome do cliente, o nº
do pedido) e vê as RNS relacionadas, identificadas por **Pedido + Item**, com todo o
contexto (status, datas, responsáveis, versões, valores) no detalhe.

A origem é a view `SICLA.LISTA_ITEMPED` (pedidos/itens de RNS), lida pela **mesma conexão
Oracle da Disponibilidade** — o idioma das outras leituras do SICLA (BIs, Agenda,
Usuários). O SELECT é o fornecido pelo usuário (revisão 2026-08-17) e vive como **consulta
nomeada no Consultas BD** (Sistema → Consulta BD, slug `rns_lista_itemped`): semeado no
boot e editável pelo Administrador sem deploy (ver `regras-negocio.md`).

## Arquivos

| Arquivo                        | Papel                                                     |
| ------------------------------ | --------------------------------------------------------- |
| `rns.controller.ts`            | `GET /rns` e `GET /rns/detalhe` — valida a query e delega |
| `rns.service.ts`               | Janela saneada + leitura do SICLA + contrato da tela      |
| `rns.constants.ts`             | SQL default, slug do Consultas BD, teto e normalização    |
| `dto/query-consulta-rns.dto.ts`| Janela `ini`/`fim` (opcionais)                            |
| `dto/query-detalhe-rns.dto.ts` | `numero` da RNS (o `PEDIDO`) para o resumo completo       |
| `rns.module.ts`                | Amarra tudo; importa `DisponibilidadeModule`              |

Não há camada Repository nem entity própria: o módulo **não persiste nada** — só lê a view
do SICLA. A busca por assunto acontece **na tela** (em memória), sobre o período que o
backend entregou — mesma decisão da Agenda e dos BIs.

Além da consulta por período, `GET /rns/detalhe?numero=` devolve o **resumo completo de
uma RNS** (todos os itens do pedido) — é o que o **calendário da Agenda** abre num modal
ao clicar num compromisso com RNS vinculada. A ficha exibida é o componente compartilhado
`app-rns-detalhe` (frontend `features/rns/`), o mesmo do detalhe expandido da tela RNS.

Documentos irmãos: [arquitetura.md](arquitetura.md) · [api.md](api.md) ·
[regras-negocio.md](regras-negocio.md) · [casos-de-uso.md](casos-de-uso.md) ·
[fluxo.md](fluxo.md).
