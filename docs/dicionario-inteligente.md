# Dicionário Inteligente do SIGER®

Aba do Painel (`/dicionario`) para consulta técnica dos módulos e adicionais do SIGER®, a
partir da documentação **já curada** no repositório
[Documentacao-Fonte-P](https://github.com/Implantacaorech/Documentacao-Fonte-P) (21 módulos +
66 adicionais = 87 documentos markdown, extraídos por leitura somente-leitura de `F:\Fontes`).

## Objetivo

Reduzir a dependência de programadores para descobrir menu, rotina, configuração, parâmetro,
tabela, dependência e checklist de cada assunto do SIGER®. O consultor busca um termo ou faz
uma pergunta em linguagem natural e recebe a resposta **fundamentada nos documentos**, com as
fontes citadas — nunca uma suposição.

## Arquitetura (decisão)

- **Sem Python.** Todo o pipeline é Node/TypeScript. A ingestão (`scripts/ingerir-dicionario-siger.ts`)
  lê os `.md`, faz o parse (`backend/src/dicionario/markdown-parser.ts`) e grava em MariaDB.
  O ingestor Python que existia no repositório de documentação **não** é usado pelo Painel.
- **Fonte da verdade continua sendo o markdown** no repositório de documentação. O Painel só
  **consome** uma cópia estruturada — reingerir com documentos atualizados substitui as linhas
  (upsert por `slug`, incremental por hash SHA-256; só reprocessa o que mudou).
- **Uma tabela nova** (`dicionario_documentos`), no mesmo banco do Painel (`painel_novo`), via
  migration versionada TypeORM. Sem serviço externo (Postgres/Meilisearch/FastAPI/Next.js do
  pipeline original ficaram fora — reimplementado no stack do Painel).
- **Seções são dado derivado**: não há coluna para elas; `DicionarioService.obter` reparseia o
  markdown na hora. Só `conteudo` (markdown, `text`), `resumo`, `palavrasChave`, `sigla`, `tipo`
  e metadados de origem são persistidos.

```
modulos/*.md + adicionais/*.md
  -> ingerir-dicionario-siger.ts (Node/TS)  [parse + hash + upsert]
  -> MariaDB dicionario_documentos
  -> DicionarioController (/api/dicionario/*)
  -> tela Angular /dicionario
```

## Backend (`backend/src/dicionario/`)

| Arquivo | Papel |
| --- | --- |
| `markdown-parser.ts` | Parse do `.md` → título, sigla, resumo, seções classificadas, palavras-chave, hash. |
| `dicionario.service.ts` | Busca (LIKE por termo/tipo/sigla), documento por slug, siglas, status e recuperação p/ RAG. |
| `dicionario-ia.service.ts` | Resposta em linguagem natural: recupera documentos relevantes e sintetiza via Claude (`IaService`), citando as fontes. |
| `dicionario.controller.ts` | Rotas REST (qualquer perfil autenticado). |

### Endpoints (prefixo `/api/dicionario`)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/pesquisar?q=&tipo=&sigla=` | Busca por termo + filtros. |
| GET | `/siglas` | Lista de módulos/adicionais (para os filtros). |
| GET | `/status` | Cobertura (total, módulos, adicionais, última ingestão). |
| POST | `/perguntar` | `{ pergunta }` → resposta fundamentada + fontes. |
| GET | `/:slug` | Documento completo (conteúdo + seções + fonte). |

### Regra dura da resposta por IA

O prompt do sistema (`dicionario-ia.service.ts`) proíbe inventar menu/programa/tabela/parâmetro.
Sem base suficiente, responde exatamente *"Não foram encontradas informações suficientes nos
documentos disponíveis para responder com segurança."* Sem chave de IA configurada (Config → IA),
não falha: devolve os documentos relevantes para o usuário abrir manualmente.

## Frontend (`frontend/src/app/features/dicionario/`)

- `dicionario.component` — aba **Buscar** (termo + filtros tipo/sigla, cards com trecho) e aba
  **Perguntar** (linguagem natural, resposta + fontes, copiar resposta).
- `dicionario-documento.component` — documento completo, seções por categoria (Configurações,
  Rotinas, Suporte, Dependências, Checklist…), palavras-chave e link para a fonte original.
- Rota `/dicionario` e `/dicionario/:slug`; item de menu "Dicionário Inteligente" (grupo Execução).

## Como atualizar a base

Quando a documentação em `Documentacao-Fonte-P` mudar (novos/alterados `.md`):

```sh
cd backend
npm run ingerir:dicionario           # usa o caminho padrão do OneDrive
# ou: npm run ingerir:dicionario -- "<caminho-da-pasta-raiz>"
```

Incremental por hash: reingerir é seguro e só reprocessa o que mudou. Documentos removidos da
origem **não** são apagados (preserva histórico) — limpe a tabela manualmente se necessário.

> Nota: uma mudança no **parser** (não no markdown) não é detectada pelo hash — nesse caso,
> limpe a tabela e reingira para reprocessar tudo.

## Escopo entregue × pendente

**Entregue (v1):** ingestão dos 87 documentos, busca com filtros, documento detalhado com
seções e fonte, resposta por IA (RAG) fundamentada e honesta, controle de acesso, testes
(unit + e2e + frontend), migration versionada.

**Pendente (fases seguintes, se priorizadas):** painel administrativo de reprocessamento/
aprovação pela UI; sincronização automática agendada com o GitHub; histórico de pesquisas e
avaliação de respostas; busca semântica por embeddings (hoje é textual + recuperação por
pontuação de termos); OCR de anexos. A arquitetura comporta essas frentes sem reescrita.
