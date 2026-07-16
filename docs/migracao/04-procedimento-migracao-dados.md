# Procedimento — migração de dados do Painel Flask para o backend novo

Script: `backend/src/database/seeds/migrar-legado.ts` (`npm run migrar:legado`, dentro de
`backend/`). Lê o Postgres do Painel Flask (produção) e grava no Postgres do backend
NestJS. Ver o cabeçalho do próprio arquivo para as regras inegociáveis (nunca escreve na
origem, nunca lê `PAINEL_DB_URL`, dry-run por padrão, idempotente). Este documento é o
roteiro operacional — o que rodar, em que ordem, e o que conferir depois.

## O que é migrado (25 tabelas) e o que fica de fora

| Tabela (origem) | Estratégia | Observação |
|---|---|---|
| `usuarios` | id preservado | **Senha sempre resetada** — ver §3 |
| `projetos` e as 11 tabelas por-projeto (`documentos`, `eventos`, `designacoes`, `cronograma_itens`, `checklist_itens`, `modificacoes`, `cronograma_atividades`, `cronograma_slots`, `cronograma_config`, `cronograma_periodos_bloqueados`, `levantamento_respostas`, `doc_conteudo`) | id preservado | Copia 1:1; `documentos.caminho` tenta copiar o arquivo físico (ver §4) |
| `protocolos` | id preservado | Tenta copiar o vídeo físico (ver §4) |
| `matriz_competencias`, `matriz_tecnicos` | id preservado | Dado de avaliação — nunca reimportado, sempre migrado tal qual |
| `consultas_bd`, `modelos_email` | **upsert por `slug`** | O destino já nasce com alguns padrões semeados no boot da aplicação nova — a migração atualiza esses padrões com o texto real da origem (preserva edições feitas em produção) e cria os que forem exclusivos da origem |
| `checklist_modelo`, `indice_topicos` | **substitui o catálogo inteiro** | O destino nasce semeado do mesmo YAML compartilhado, mas o ADM pode ter editado além do YAML nas telas de Cadastro — a origem é tratada como fonte da verdade e o catálogo do destino é limpo e recriado a partir dela |
| `modelos_documento` | upsert por `slug` (id pode mudar) | Tenta copiar o arquivo físico da versão vigente (ver §4) |
| `modelos_documento_versoes`, `modelos_documento_campos` | id preservado, `modelo_id` remapeado | Dependem do id novo atribuído a `modelos_documento` |
| `cadastros_pendentes` | **não migrada, de propósito** | Expira em 30min — não sobrevive até o dia da virada; qualquer auto-cadastro em andamento no momento exato da virada só precisa ser refeito (código de verificação de novo) |
| — (`refresh_tokens`) | não se aplica | Tabela nova, sem equivalente no Flask (sessão de servidor vs. JWT) — cada usuário simplesmente loga de novo no sistema novo |

## 1. Pré-requisitos

1. O backend novo já precisa ter rodado **pelo menos uma vez** contra o Postgres de
   destino (`npm run migration:run` + subir a aplicação uma vez, mesmo que só para os
   `OnModuleInit` semearem os catálogos padrão — `ChecklistModelo`/`IndiceTopico`/
   `ModeloDocumento`/`ModeloEmail`/`ConsultaBD`). A migração de dados faz *upsert* contra
   esse estado — rodar antes do primeiro boot não quebra nada, só faz a migração criar
   tudo do zero em vez de mesclar com os padrões.
2. **NÃO rode `npm run seed:admin` antes desta migração** — o script já traz os usuários
   reais da origem (com senha resetada, ver §3). Rodar o seed antes só criaria um usuário
   ADM extra desnecessário (inofensivo, mas evitável).
3. Defina as variáveis de ambiente (nunca commitar nenhuma delas):
   ```bash
   MIGRACAO_DB_URL=postgresql://usuario:senha@host/banco_novo       # já deve estar configurada
   MIGRACAO_ORIGEM_DB_URL=postgresql://usuario:senha@host/painel    # copie o valor de PAINEL_DB_URL manualmente
   MIGRACAO_ORIGEM_DADOS_DIR=/caminho/para/a/pasta/gravavel/do/flask   # opcional, ver §4
   ```
4. Faça um **backup do Postgres de destino** antes de rodar com `--aplicar` (mesmo sendo
   idempotente, é sempre a rede de segurança mais simples: `pg_dump`).

## 2. Rodando

```bash
cd backend

# 1) Dry-run — só mostra quantas linhas existem na origem, não grava nada.
npm run migrar:legado

# 2) Aplicar de verdade.
npm run migrar:legado -- --aplicar

# 3) Se precisar rodar de novo (retomar após uma falha no meio do caminho, ou reaplicar
#    depois de uma correção), o destino já não estará mais vazio — use --continuar:
npm run migrar:legado -- --aplicar --continuar
```

Cada rodada termina com um relatório tabela-a-tabela (`origem=N migrados=N`, mais
observações quando relevante). Se alguma tabela reportar menos `migrados` que `origem`,
leia a observação — normalmente é `modelos_documento_versoes`/`modelos_documento_campos`
"ignorada(s) por não achar o modelo remapeado" (a linha correspondente de
`modelos_documento` não migrou por algum motivo — investigue antes de seguir).

## 3. Senhas — reset obrigatório

O Flask usa hash `werkzeug.security` (scrypt/pbkdf2); o backend novo usa `bcrypt`. Não há
conversão possível entre os dois formatos. **Toda senha é resetada** durante a migração:
cada usuário recebe uma senha temporária aleatória nova.

- A lista fica em `backend/dados/migracao-senhas-temporarias.csv` (`login,nome,email,
  senha_temporaria`) — **nunca no console/log**, só nesse arquivo.
- Esse arquivo é um segredo: **não versionar** (já está no `.gitignore` via `/dados`),
  distribuir por um canal seguro (nunca e-mail em texto plano) e **apagar depois de
  distribuído**.
- Não existe tela de "esqueci minha senha" neste backend ainda. Cada usuário troca a
  própria senha temporária pedindo para o ADM editar o campo Senha em Usuários (ou o
  próprio usuário, se/quando uma tela de "trocar minha senha" existir).

## 4. Arquivos físicos (documentos gerados, vídeos, modelos customizados)

Três tabelas guardam CAMINHOS de arquivo que apontavam para o disco do servidor Flask:
`documentos.caminho`, `protocolos.video_caminho`, e a versão vigente de
`modelos_documento` (via `modelos_documento_versoes.arquivo`). O script tenta copiar o
arquivo de verdade (não só a linha do banco) em duas tentativas, nesta ordem:

1. O caminho **absoluto exato** gravado na origem — funciona se este script rodar no
   MESMO host (ou um host com o mesmo caminho montado) do servidor Flask.
2. `MIGRACAO_ORIGEM_DADOS_DIR` + nome do arquivo — fallback para quando o script roda em
   outra máquina, mas com uma cópia (rede, drive montado) da pasta gravável do Flask.

Se nenhuma das duas achar o arquivo, **a linha ainda é migrada** (metadados, timeline,
histórico — tudo preservado) — só o download desse documento específico fica
indisponível até alguém copiar o arquivo manualmente para
`backend/dados/documentos_gerados/` (ou `protocolos_videos/`, ou `modelos_documento/`,
conforme o caso) e ajustar a coluna `caminho`/`arquivo` do registro. O relatório final
avisa quantas linhas de cada tabela ficaram sem o arquivo físico — use isso para
dimensionar o trabalho manual, se houver.

## 5. Depois de migrar

1. Confira o relatório final — todo `origem=N migrados=N` sem observação de erro é sinal
   verde.
2. Rode um smoke test: logue com um usuário migrado usando a senha temporária do CSV,
   confira que os projetos/documentos/timeline aparecem certinhos na tela.
3. Distribua as senhas temporárias (§3) e apague o CSV.
4. Se algum arquivo físico não foi encontrado (§4), copie manualmente ou avise os
   usuários afetados que aquele documento específico precisa ser gerado de novo.
5. Só depois de validar o suficiente, considere seguir para o merge da branch
   `feature/migracao-angular-backend-moderno` e a virada de produção propriamente dita —
   ver docs/migracao/03-documento-conversao.md §10 (procedimento de rollback) e §13
   (pendências que sobram fora do backlog de conversão). **A decisão de mesclar/virar é
   do time, não deste script** — a migração de dados só prepara o banco novo, não troca
   qual sistema está no ar.

## 6. Como isto foi testado

Nenhum teste rodou contra o Postgres real do Painel (nem contra qualquer banco de
produção) — o script foi validado ponta a ponta contra **dois containers Docker
descartáveis** (`postgres:16-alpine`, portas locais `15432`/`15433`, destruídos ao final),
um simulando a origem (schema recriado manualmente a partir de `webapp/db.py`, com dados
sintéticos cobrindo os casos difíceis: usuário com senha a resetar, projeto com todas as
tabelas filhas preenchidas, `ModeloEmail`/`ConsultaBD` com um slug igual ao padrão semeado
no boot MAIS um slug exclusivo da origem, catálogo `checklist_modelo`/`indice_topicos`
com uma linha editada além do YAML, e `ModeloDocumento` com uma versão customizada) e
outro simulando o destino (migrations reais aplicadas + os catálogos padrão inseridos à
mão, simulando o primeiro boot da aplicação). Confirmado nesta bateria:

- Dry-run não grava nada (conferido por contagem antes/depois).
- `--aplicar` grava exatamente as contagens esperadas, com os merges corretos (o
  `ModeloEmail`/`ConsultaBD` com slug já existente ficou com o texto EDITADO da origem,
  preservando os campos novos do destino que a origem não tinha; o catálogo
  `checklist_modelo`/`indice_topicos` ficou com a linha editada da origem).
- **Rodar duas vezes seguidas (`--aplicar` depois `--aplicar --continuar`) não duplica
  nenhuma linha** — bug real encontrado e corrigido nesta própria sessão de teste:
  `modelos_documento_versoes`/`modelos_documento_campos` inicialmente não preservavam o
  `id` de origem e duplicavam a cada rodada; corrigido para preservar o id (mesma
  estratégia das demais tabelas por-projeto) antes de considerar o script pronto.
- **Bug crítico de preservação de `id` (achado só na migração real, não nos testes
  sintéticos) — corrigido.** Todas as tabelas marcadas "id preservado" nesta seção
  usavam `repository.create({id, ...}) + repository.save(...)`, confiando no TypeORM para
  fazer upsert pelo `id` explícito. Isso NUNCA funcionou: para colunas
  `@PrimaryGeneratedColumn()`, o TypeORM omite a coluna `id` da lista de colunas do
  `INSERT` mesmo com o valor setado no objeto, deixando o Postgres gerar um id novo por
  sequence — sem erro, sem aviso. Nos testes com dados sintéticos isso ficou invisível
  porque os ids de origem usados (1, 2) coincidiam, por acaso, com os que a sequence do
  destino vazio geraria de qualquer forma. Só apareceu ao migrar o projeto real (id 174):
  cada rodada criava uma linha nova com id auto-gerado (nunca 174), deixando toda tabela
  filha (`designacoes`, `eventos`, `cronograma_atividades`, `levantamento_respostas` etc.,
  que gravam o `projeto_id` da ORIGEM) órfã — sem constraint de FK no banco, a corrupção
  foi silenciosa. Corrigido trocando todo ponto de escrita "id preservado" por um helper
  único (`upsertComId`, em `migrar-legado.ts`) que faz `INSERT ... ON CONFLICT (id) DO
  UPDATE` via SQL bruto, resolvendo os nomes de coluna pelos metadados do próprio
  TypeORM. Revalidado com o mesmo ciclo Docker, desta vez com um projeto de id não
  sequencial (174) de propósito, para não repetir o mesmo ponto cego. O `painel-db-novo`
  já tinha sido corrompido por essa forma antes da correção (projeto duplicado, ~1150
  linhas filhas órfãs) — foi zerado e remigrado do zero com o script corrigido; a
  migração real completa (25 tabelas, ids conferidos sem órfãos) rodou com sucesso em
  2026-07-15.
- A sequence do Postgres fica sincronizada depois da migração — um `INSERT` novo (sem id
  explícito) simulando o uso normal da aplicação depois da migração pega o próximo id
  livre, sem colidir com nenhum id migrado.
- O guard de "destino não está vazio" bloqueia corretamente uma segunda rodada sem
  `--continuar`, com uma mensagem explicando as duas saídas possíveis.
- A ausência de `MIGRACAO_ORIGEM_DB_URL` é rejeitada com uma mensagem clara, antes de
  tentar conectar em qualquer lugar.

**Não testado** (por não ter uma instância disponível neste ambiente): a cópia de arquivo
físico contra um caminho de rede/UNC real do servidor Flask de produção — a lógica de
fallback (§4) foi exercitada só com caminhos inexistentes (confirma que o "arquivo não
encontrado" é reportado corretamente, sem quebrar a migração), não com um arquivo real
presente no host. Recomenda-se validar isso manualmente na primeira migração real, com um
subconjunto pequeno de dados, antes de rodar contra a base inteira.
