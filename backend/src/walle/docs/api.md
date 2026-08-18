# API — módulo Wall-e

Todas as rotas sob `/api/walle`, gate `@Permissao('walle')` (JWT + RBAC). Envelope padrão
`ApiEnvelope<T>`.

| Método | Rota | Nível | O que faz |
|---|---|---|---|
| GET | `/walle/status` | consulta | Estado do acervo indexado: contagens, última atualização, resumo da última sincronização, cobertura Oracle, limitações da base |
| POST | `/walle/atualizar` | **alteracao** | Sincroniza o índice com a fonte (leitura na fonte; escrita só nas tabelas `walle_*`) + enriquecimento SICLA best-effort |
| GET | `/walle/busca` | consulta | Busca híbrida. Query: `q`, `chat`, `categoria`, `origem`, `assunto` (DTO `PesquisarWalleDto`) |
| GET | `/walle/pergunta?q=` | consulta | Busca + síntese por IA local (finalidade `walle`); degrada para fontes sem síntese |
| GET | `/walle/chats` | consulta | Chats do acervo (metadados SICLA quando enriquecidos) |
| GET | `/walle/chats/:codigo` | consulta | Visão completa: arquivos, assuntos, entidades, chats relacionados |
| GET | `/walle/arquivos/:id` | consulta | Documento completo (texto extraído + classificação) |
| GET | `/walle/arquivos/:id/imagem` | consulta | Bytes da imagem, lidos da fonte na hora (`StreamableFile`, inline) |

## Resposta da busca (`RespostaBusca`)

`resumo` (síntese honesta por confiança; vazio usa a frase-contrato da §24),
`resultados[]` (card: título, chat, técnico/sistema, categoria, origem, relevância %,
confiança alta/média/baixa, assuntos, evidências de rastreabilidade), `assuntosRelacionados[]`
(chips), `tambemPodeSerUtil[]` (com `motivo`), `sqlsRelacionados[]` (objetivo, tabelas,
operações — **conteúdo documental, nunca executado**), `sugestoes[]`, `cobertura`.

## Resposta da pergunta (`RespostaWalleIa`)

`resposta` (ou a frase-contrato `Não foi localizada evidência suficiente nas fontes
consultadas.`), `fontes[]` numeradas (arquivo/chat/caminho), `temFundamento`,
`iaDisponivel`, e a `busca` completa embutida (a tela reaproveita).
