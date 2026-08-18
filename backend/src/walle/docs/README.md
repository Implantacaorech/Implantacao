# Módulo Wall-e (Consulta) — visão geral

Tela **Execução → Wall-e** (chave de permissão `walle`): transforma o **acervo documental
dos chats do bot Wall-e** (`R:\GRM\CHAT_WALLE\` — técnico 900 do SICLA) em uma **base de
conhecimento pesquisável**: análises, SQLs, investigações e soluções já produzidas viram
material reutilizável ("já resolvemos algo parecido?").

## Regra absoluta

> **A fonte é oficial e SOMENTE LEITURA.** O módulo lê, indexa, pesquisa e consome — nunca
> cria, altera, exclui, renomeia ou move nada dentro de `R:\GRM\CHAT_WALLE\`. Todo derivado
> (índice, hash, texto extraído, entidades) vive nas tabelas `walle_*` do banco do Painel.

## Peças

| Arquivo | Papel |
|---|---|
| `repositories/acervo-fs.repository.ts` | Leitura tolerante do share (única porta para a fonte) |
| `repositories/walle-*.repository.ts` | Persistência das tabelas `walle_chats/arquivos/entidades` |
| `texto-walle.util.ts` | Funções puras: título, resumo, classificação, entidades, assuntos, sinônimos |
| `indexacao-walle.service.ts` | Sincronização incremental (hash/mtime; removido = flag, nunca delete) |
| `busca-walle.service.ts` | Busca híbrida em memória (identificadores + lexical + expansão) |
| `walle-oracle.service.ts` | Fonte B: metadados de `SICLA.CHAT_WALLE` (opcional, SQL editável) |
| `walle-ia.service.ts` | Síntese RAG pela finalidade `walle` (SÓ provedor local) com degradação |
| `walle.service.ts` | Fachada: status, atualização, visão do chat, conteúdo/imagem |
| `walle.controller.ts` | Rotas `/walle/*` com gate `@Permissao('walle')` |

Documentos irmãos: [arquitetura](arquitetura.md) · [api](api.md) ·
[regras de negócio](regras-negocio.md) · [casos de uso](casos-de-uso.md) · [fluxo](fluxo.md).
