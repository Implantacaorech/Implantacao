# Documento de conversão — Painel de Implantação → Angular + NestJS

**Branch:** `feature/migracao-angular-backend-moderno` (não mesclada em `main`; o Flask
em produção não foi tocado). Status: autenticação, Projetos, o **Agendador de Visitas**
(o módulo mais complexo do sistema), **Cadastros** (pré-requisito da geração de
documentos), a **geração de documentos completa** (serviço Python híbrido — cronograma
de visitas + Levantamento/Projeto/Termo fiéis, com anexo Documento/Evento), os
**Protocolos de Treinamento** (vídeo -> transcrição local via faster-whisper -> análise
IA -> revisão/aprovação, incluindo o robô de varredura de pasta e a tela Config → IA) e
**E-mail/IMAP/Gmail** (SMTP + Gmail API + modelos de e-mail + o robô da caixa de entrada
que cria projetos a partir do e-mail de fechamento do Comercial) convertidos ponta a
ponta, com o padrão replicável documentado para o restante. Ver honestidade de escopo em
[02-decisao-arquitetura.md](02-decisao-arquitetura.md#escopo-desta-fase-da-migração-honestidade-de-escopo).

## 1. Tecnologia anterior → nova

| | Antes | Depois |
|---|---|---|
| Frontend | Jinja2 (server-side, `webapp/templates/`) | Angular 22 (standalone components, TypeScript 6) |
| Backend | Flask 3 (Python), rotas em `routes_*.py` | NestJS 11 (TypeScript), módulos em `backend/src/*` |
| ORM | SQLAlchemy 2 (sem FKs declaradas) | TypeORM 0.3.31 (sem FKs declaradas — mesmo padrão do Flask, ver §6) |
| Auth | Sessão Flask + senha mestra de emergência | JWT (access curto + refresh rotativo revogável) |
| Banco | Postgres (prod) / SQLite (dev/teste) | Mesmo padrão: Postgres (prod) / SQLite (dev/teste) |
| Docs de API | Nenhuma | Swagger/OpenAPI em `/api/docs` |

Justificativa completa da escolha NestJS vs. Spring Boot e da arquitetura híbrida (serviço
Python mantido só para geração de documentos e transcrição) em
[02-decisao-arquitetura.md](02-decisao-arquitetura.md).

## 2. Arquivos/módulos convertidos nesta entrega

- **Autenticação completa**: `backend/src/auth/*` (login, refresh rotativo, logout com
  revogação, guard JWT, guard de perfil) — equivalente a `/login`, `/logout`,
  `pode_ver`/`pode_gerar`/`pode_designar`/`_e_adm` do Flask.
- **Usuários** (`backend/src/users/*`): busca por login, criação com bcrypt — base para o
  restante do CRUD de `/usuarios` (ainda não convertido).
- **Projetos** (`backend/src/projetos/*`): CRUD completo + paginação + filtro por
  cliente/etapa + **filtro de visibilidade por perfil** (`_so_meus` do Flask: ADM/
  Coordenador/Administrativo veem tudo, GCI só onde é GCI, Consultor só onde é designado).
  Escolhido como módulo de referência por ser a entidade raiz do sistema.
- **Health check** (`backend/src/health/*`) — equivalente a `GET /health`.
- **Agendador de Visitas** (`backend/src/cronograma/*`, `backend/src/catalogos/*`) —
  conversão completa: atividades/visitas (seed a partir do Check List), alocação manual
  (atividade e visita inteira), horários por turno, configuração da distribuição (modo
  conjunta/individual, data início, dias/turnos excluídos, analista padrão), períodos sem
  agenda (globais ou por técnico específico), status, postergação (por assunto/turno/visita
  inteira), exclusão de histórico Postergada (ADM), e o **algoritmo de distribuição
  automática** completo (`distribuicao.service.ts`) — busca gulosa do primeiro turno livre
  em ordem de treinamento dos módulos, preservando V1 < V2, com piso de reorganização,
  checagem de Go-live e "Não distribuir" por módulo. Equivalente a `webapp/routes_agenda.py`
  inteiro. Ver §9 para a única lacuna proposital (disponibilidade externa SICLA).
- **Cadastros** (`backend/src/catalogos/*`, `backend/src/levantamento/*`) — pré-requisito
  da geração de documentos (ver §6 item 6 desta versão anterior do documento): CRUD
  completo do Check List (já convertido no item anterior, ganhou filtro/paginação/
  reimportar), `IndiceTopico` (catálogo + seed do YAML, mesmo padrão do Check List),
  `ModeloDocumento`+`ModeloDocumentoVersao` (registro, versionamento, upload/download do
  arquivo fiel — `ModeloDocumentoCampo`, só informativo, tem CRUD mas sem seed nesta
  fatia), e o questionário do Levantamento (`LevantamentoResposta`, semeado do Índice
  pelos módulos contratados) + `DocConteudo` (conteúdo estruturado por documento).
  **Todos os três catálogos globais (Check List, Índice, Modelos) agora se semeiam
  sozinhos no boot** (`OnModuleInit`, pulado em teste via `NODE_ENV=test` — ver §6 item 7).
  Só backend nesta fatia; tela Angular de Cadastros ainda não foi construída (ver §8).
- **Frontend**: tela de login, guard de rota, interceptor HTTP (Bearer + renovação
  automática em 401), lista de projetos (paginada, com filtro), formulário de
  criar/editar projeto, shell com navegação e logout, e a tela do **Agendador de Visitas**
  (calendário semanal, designação de técnico por módulo, períodos sem agenda, ações
  Distribuir/Refazer/Desfazer tudo com indicador de progresso). Ver §9 sobre a
  simplificação de interação (sem arrastar-e-soltar nesta primeira versão).
- **Geração de documentos — completa** (`docservice/`, serviço Python/FastAPI +
  `backend/src/geracao/*` + `backend/src/documentos/*`): implementa a arquitetura híbrida
  decidida em [02-decisao-arquitetura.md](02-decisao-arquitetura.md) — um serviço Python
  interno, nunca exposto publicamente, que reaproveita `webapp/gl_xlsx.py`,
  `gl_levantamento.py`, `gl_projeto.py`, `gl_termo.py`, `doc_edit.py` e
  `tools/preencher_layout.py` **copiados sem alterar a lógica** (só a fonte de dados muda,
  via um `db.py`/`_common.py` "shim" que lê de um contexto por requisição em vez de um
  banco).
  - `POST /gerar/cronograma-visitas` gera o cronograma de visitas (.xlsx) do Agendador; o
    NestJS monta o payload (projeto, atividades, horários, designações, config) e expõe
    `POST /projetos/:id/agenda/gerar`.
  - `POST /gerar/documento-fiel` gera Levantamento/Projeto/Termo (.docx, com blocos
    condicionais por módulo contratado) a partir do template enviado em base64 (o NestJS lê
    o arquivo vigente do `ModeloDocumentoService` e envia — o docservice nunca acessa um
    banco nem o disco do NestJS); dispatcher novo `gerador/gerar_fiel.py` (adaptação
    stateless de `webapp/gerar_layout.py:gerar()` — a substituição de placeholders em si
    continua 100% nos módulos copiados). NestJS expõe
    `POST /projetos/:id/gerar-layout/:slug` (`GeracaoLayoutService` monta o payload a partir
    de Projeto + Índice de Tópicos + LevantamentoResposta + DocConteudo).
  - Ambos os endpoints, depois de gerar com sucesso, anexam o arquivo ao projeto
    (`Documento`) e registram na timeline (`Evento`) — mesmo comportamento de
    `webapp/routes_agenda.py:projeto_agenda_gerar` /
    `webapp/routes_geracao.py:_gerar_e_anexar_fiel`.
- **Protocolos de Treinamento** (`backend/src/protocolos/*`, `backend/src/ia/*`,
  `backend/src/transcricao/*`, `docservice/transcricao/*`) — base de conhecimento de
  vídeos de treinamento transcritos e analisados por IA, **sem vínculo com Projeto**.
  Pipeline completo: upload manual OU robô de varredura da pasta OneDrive/SharePoint
  (`Videos Pendentes`, com checagem de estabilidade de 90s) -> registro `Pendente`
  (dedup por hash) -> `Transcrevendo` (faster-whisper local, CPU, no docservice) ->
  `Analisando` (Claude via `@anthropic-ai/sdk`, chave gerenciada pela nova tela
  Config → IA) -> `Em revisão` (edição humana dos 16 campos estruturados) -> `Aprovado`/
  `Reprovado`, com histórico auditado em cada transição. Arquitetura: `transcritor.py`
  copiado sem alterar a lógica para `docservice/transcricao/`, exposto como um job
  assíncrono em memória (`POST /transcrever` devolve na hora, `GET
  /transcrever/{id}/status` é feito polling) — diferente do resto do docservice
  (stateless por request), aqui o estado do job vive em memória do processo Python
  porque uma transcrição pode levar até 3h e nunca deve bloquear a resposta HTTP; quem
  tem o banco e decide a máquina de estados continua sendo o NestJS
  (`ProcessamentoProtocolosService`, com `RoboProtocolosService` fazendo a varredura
  periódica via `SchedulerRegistry` — o intervalo é configurável em runtime, por isso não
  dá pra usar `@Interval()` estático). A análise por IA roda **direto no NestJS** (não no
  docservice) via `@anthropic-ai/sdk` — não precisa de Python, só o SDK oficial do
  Anthropic em Node. Endpoints: `GET/POST /protocolos`, `GET /protocolos/:id`, `POST
  /protocolos/:id/{salvar,processar,aprovar,reprovar}`, `GET
  /protocolos/:id/{status,video}` (o último com suporte a `Range`, para o player).
  Equivalente a `webapp/protocolos.py` + `webapp/protocolo_ia.py` +
  `webapp/routes_protocolos.py` + `webapp/transcritor.py` + a fatia de `tools/ia.py` que
  este módulo usa (chave/modelo — o resto de `tools/ia.py`, a correção verbal opcional
  dos documentos gerados, não foi portado, ver §8).
- **E-mail/IMAP/Gmail** (`backend/src/email/*`, `backend/src/fluxo/*`) — bindings Node
  diretos, sem depender do docservice (nenhuma destas bibliotecas é Python-only):
  `nodemailer` (SMTP), `imapflow`+`mailparser` (IMAP), `google-auth-library` (OAuth2 do
  Gmail). Equivalente a `webapp/mailer.py` + `webapp/imap_intake.py` +
  `webapp/gmail_api.py` + `webapp/fluxo.py` + a parte de `webapp/db.py` de `ModeloEmail` +
  os gatilhos `_notificar*`/`_EVT_MSG`/`_EVT_DOC` de `webapp/app.py`.
  - `MailerService`: SMTP (config em `dados/smtp.json`, env `MIGRACAO_SMTP_*` tem
    prioridade) + `GmailService` como transporte alternativo (tentado primeiro quando
    autorizado, mesma prioridade do Flask original). Anexos via `nodemailer`
    `MailComposer` (usado também para montar o `raw` RFC822 do envio pela API do Gmail —
    um único ponto de montagem de mensagem para os dois transportes).
  - `GmailService`: **única mudança arquitetural deliberada desta fatia** (decidida com o
    usuário) — o Flask original usa o fluxo OAuth "Desktop app"
    (`InstalledAppFlow.run_local_server`, abre navegador + servidor HTTP local efêmero NA
    MÁQUINA do painel); aqui é "Web application" com uma rota de callback real
    (`GET /config/gmail/callback`, **pública de propósito** — é o navegador do Google
    navegando direto até ela após o consentimento, sem cabeçalho `Authorization`; a
    proteção é um `state` de uso único gerado em `urlAutorizacao()` e conferido em
    `trocarCodigoPorToken()`). Exige criar uma credencial OAuth tipo **"Aplicativo da
    Web"** no Google Cloud Console (não "Desktop"), com essa URL cadastrada como redirect
    URI autorizado — ver `MIGRACAO_GMAIL_REDIRECT_URI` em `.env.example`.
  - `ModeloEmailService`: CRUD + os 7 modelos padrão semeados no boot (idempotente por
    slug, mesmo padrão de `ChecklistModeloService`) + `renderizar()` (substituição
    literal de `{{VAR}}`, incluindo `_consultorA`/`_consultorB` derivados do campo
    `consultor`) — migrado 1:1 de `webapp/db.py` (`_MODELOS_PADRAO`, `VAR_CAMPO`,
    `renderizar_modelo`).
  - `NotificacaoService`: `notificar`/`notificarEvento`/`emailsCoordenacao` — mesma tabela
    de eventos (`fechamento`, `levantamento_ok`, `projeto_ok`, `cronograma_ok`,
    `checklist_ok`, `termo_ok`, `encerrado`) do `_EVT_MSG` original. Diferença deliberada:
    o Flask dispara `_notificar_sync` numa thread daemon para não bloquear a requisição
    (SMTP pode travar); em Node isso é desnecessário (I/O já é assíncrono/não-bloqueante)
    — fora de teste, `notificar()` simplesmente não é `await`ado pelo chamador (mesmo
    efeito, sem precisar de thread). **Já ligado** aos pontos onde o evento correspondente
    já existe no schema novo: `ProjetosService.atualizar()` (evento `encerrado`, quando
    `situacao` MUDA para `"Concluído"` — não a cada save já concluído),
    `CronogramaController.gerar()` (`cronograma_ok`),
    `DocumentosController.gerarLayout()` (`levantamento_ok`/`projeto_ok`/`termo_ok`, por
    slug). `checklist_ok` fica pendente — a geração de checklist ainda não foi convertida
    (não é o mesmo `ChecklistModelo` do catálogo, que já existe; é o gerador do
    documento). Os gatilhos de `webapp/routes_designacao.py` (GCI/consultor designado)
    também ficam pendentes — essa tela em si ainda não foi convertida (ver §8).
  - `ImapIntakeService`/`FluxoService`/`RoboCaixaService`: robô de varredura da caixa de
    entrada (mesmo padrão `SchedulerRegistry` de `RoboProtocolosService`) que detecta
    e-mails de fechamento não lidos (marcador `"IMPLANTA"`, substring case-insensitive no
    assunto), extrai os campos (parser de linhas `"Rótulo: valor"`, mesma tabela de
    rótulos de `webapp/fluxo.py:_LABELS`) e cria o Projeto, com dedup por CNPJ/nome (mesma
    lógica de `webapp/db.py:projeto_existe`). Endpoints: `GET /fluxo` (status),
    `POST /fluxo/parse` (cola texto cru), `POST /fluxo/inbox` (busca via IMAP, não marca
    como lido), `POST /fluxo/criar` (cria a partir dos campos confirmados/editados).
    **Escopo reduzido desta fatia**: `fluxo_criar` original também deixa o usuário
    escolher GCI/técnicos e gera automaticamente o pacote de documentos + e-mail-resumo
    com anexos aos responsáveis — essa parte não foi portada (cria só o projeto + notifica
    `fechamento`); pode ser adicionada depois compondo `GeracaoLayoutService` +
    `MailerService`, que já existem.
  - Circularidade evitada de propósito: `NotificacaoService` injeta o repositório
    `Evento` diretamente (não `DocumentosService`) — `EmailModule` não importa
    `DocumentosModule` porque `DocumentosModule` agora importa `EmailModule` (para o
    `DocumentosController` disparar `levantamento_ok`/`projeto_ok`/`termo_ok`); um import
    circular entre os dois quebraria o boot do Nest. Ver §6 item 13.

## 3. Funcionalidades preservadas (nesta fatia)

- Login por usuário/senha, com a mesma política de bloqueio (login/senha incorretos
  nunca revelam qual campo errou).
- Perfis (`ADM`, `Coordenador`, `Administrativo`, `GCI`, `Consultor`) com os mesmos nomes
  usados no banco atual — permite importar dados do Postgres de produção sem remapear.
- Regra de visibilidade de projetos por perfil (`_so_meus`), replicada e **coberta por
  teste** (é a regra de negócio mais fácil de esquecer numa reescrita).
- Estrutura de campos do Projeto (cliente, CNPJ, etapa, situação, datas, módulos
  contratados, contatos etc.) — todos os campos de `db.Projeto` mapeados 1:1.
- **Invariante V1 < V2 do Agendador de Visitas** — a distribuição automática processa
  estritamente em ordem `(ordem do módulo, módulo, seq)` com busca gulosa pelo turno livre
  mais cedo, o que garante matematicamente que uma visita nunca fica num turno igual ou
  anterior ao da visita anterior do mesmo módulo. Coberto por teste dedicado.
- **Período sem agenda por técnico específico** (recurso mais recente adicionado ao Flask
  nesta mesma sessão de trabalho, antes de começar a migração) — replicado e testado:
  período sem `tecnicos` bloqueia todos; com `tecnicos`, só os listados.
- **"Não distribuir" por módulo** e **Go-live** (última visita de cada técnico nunca cai no
  dia da virada ou depois) — replicados fielmente.

## 4. Funcionalidades melhoradas

- **Autenticação real com JWT + refresh rotativo e revogável** — o Flask usa sessão de
  servidor sem expiração/rotação de token e uma senha mestra que sempre loga como ADM
  incondicionalmente; o novo backend elimina esse modo de acesso irrestrito (ver §7).
- **Limpeza de projeto centralizada e testada** — nenhuma entidade nova declara FK/
  `onDelete: CASCADE` (mesma ausência de FKs do SQLAlchemy original), então
  `ProjetosService.excluir()` chama explicitamente `limparProjeto(id)` de cada serviço
  dependente (Cronograma, Designações, Levantamento-resposta, DocConteudo, Documentos)
  antes de remover o projeto — espelhando por injeção de dependência a mesma tupla de
  limpeza hardcoded que `webapp/app.py:projeto_excluir` já usa. Diferença real em relação
  ao Flask: aqui a chamada é coberta por teste dedicado (`projetos.service.spec.ts`), o que
  reduz o risco de esquecer uma tabela nova — mas a categoria de bug (linha órfã se algum
  `limparProjeto` for esquecido) continua existindo por construção, só fica mais difícil de
  passar despercebida. Ver §6 para a lição completa (doc já teve, por um tempo, a afirmação
  incorreta de que existiam FKs reais com cascade).
- **Contrato de API padronizado** (`{success, data, message, timestamp}` /
  `{success:false, statusCode, error, message, details, path}`) com documentação Swagger
  automática — o Flask não tinha nenhuma API JSON documentada (era HTML renderizado no
  servidor).
- **Validação de entrada declarativa** (`class-validator`) rejeitando campos desconhecidos
  (`forbidNonWhitelisted`) — o Flask aceitava qualquer campo de formulário sem checagem de
  schema.

## 5. Funcionalidades REMOVIDAS nesta fatia (não descartadas — pendentes, ver §8)

Nada foi removido em definitivo. O que existe no Flask e **ainda não tem equivalente no
NestJS/Angular** está listado em §8 como pendência, não como decisão de remoção.

## 6. Falhas corrigidas / riscos encontrados durante a conversão

Encontrados e corrigidos **durante o desenvolvimento desta própria fatia** (vale registrar
porque são o tipo de erro fácil de reintroduzir ao converter os módulos que faltam):

1. **Confusão entre dois conjuntos de perfis distintos do Flask**: `pode_ver("gestao")`
   (visibilidade de menu/tela, inclui GCI) foi usado por engano como se fosse o grupo que
   "vê todos os projetos" em `_so_meus` (que NÃO inclui GCI). Um teste unitário
   (`projetos.service.spec.ts`) pegou o erro antes do commit. Lição para os próximos
   módulos: **todo `pode_*` do Flask precisa ser conferido linha a linha em `app.py`
   antes de reaproveitar em outro contexto** — nomes parecidos, escopos diferentes.
2. **Colisão de refresh token**: dois logins do mesmo usuário no mesmo segundo geravam o
   JWT byte-a-byte idêntico (mesmo `iat`/`exp`), e o índice único em `token_hash` rejeitava
   o segundo insert. Corrigido com um `jti` aleatório por emissão.
3. **`import type` quebra a inferência de coluna do TypeORM**: `Perfil`/`Etapa`/`Situacao`
   precisaram de `import type` para satisfazer `isolatedModules`, mas isso apaga o
   `design:type` refletido em runtime — o TypeORM via `Object` em vez de `String` e
   rejeitava a entidade (`DataTypeNotSupportedError`). Corrigido declarando `type: 'varchar'`
   explicitamente nessas colunas. **Todo `@Column()` cuja propriedade seja um alias de
   tipo (não uma classe) precisa de `type` explícito** — regra a seguir nos módulos
   restantes.
4. **Conexão acidental ao Postgres de produção durante o desenvolvimento**: o shell desta
   máquina já tinha `PAINEL_DB_URL` exportada (usada pelo Painel Flask em produção). O
   primeiro rascunho do `configuration.ts` lia essa mesma variável, e o seed inicial quase
   rodou contra o banco real (a query falhou antes de qualquer escrita, por incompatibilidade
   de schema — nenhum dado foi alterado). Corrigido adotando o prefixo **`MIGRACAO_`**
   para toda variável de ambiente do backend novo, nunca reaproveitando nomes `PAINEL_*`.
   **Isto é uma regra permanente enquanto os dois stacks rodarem em paralelo.**
5. **Envelope de resposta por duck-typing colidia com campos de entidade chamados `data`**:
   o interceptor de resposta original detectava "isto já é um envelope `{data,message}`"
   checando `'data' in payload` — mas `AtividadeCronograma.data` (a data da visita, AAAA-MM-DD)
   é um campo real da entidade, então qualquer `AtividadeCronograma` devolvida crua virava
   `payload.data` (uma string) sendo tratada como o envelope inteiro, quebrando a resposta.
   Um teste e2e do Agendador (`alocação manual…`) pegou isso na hora. Corrigido substituindo
   o duck-typing por uma classe explícita `ApiEnvelope` checada com `instanceof`
   (`common/dto/api-envelope.ts`) — nenhuma entidade jamais colide com isso por acidente.
   **Lição: nunca detectar formato de resposta por presença de propriedade — usar um tipo
   explícito.**
6. **Geração de documentos (item 2 original) não é isolável de Cadastros (item 6
   original)**: `gerar_layout.py`/`gl_*.py` dependem diretamente de `db.modelos_documento_*`
   (arquivo-base do layout), `db.indice_modulos`/`db.indice_listar` (catálogo do
   Levantamento), `db.levantamento_respostas` e `db.doc_conteudo` — nenhum desses ainda
   existe no schema novo. Gerar documentos para um projeto criado no Angular exigiria ler
   esses dados do banco Flask antigo, reacoplando os dois schemas (o que o item 4 desta
   lista evitou de propósito). **Decisão (confirmada com o usuário): inverter a ordem** —
   Cadastros (`ModeloDocumento`+versão, `IndiceTopico`, `LevantamentoResposta`,
   `DocConteudo`) passa a vir ANTES da geração de documentos no backlog. Ver §8.
7. **Seed dos catálogos nunca era chamado (bug real, sem teste que pegasse)**: os três
   serviços de catálogo (`ChecklistModeloService`, depois `IndiceTopicoService` e
   `ModeloDocumentoService`) tinham `seedDoYaml()`/`seedDefaults()` prontos, mas nada no
   `AppModule` os invocava — numa instalação nova de verdade, as tabelas ficariam vazias
   para sempre (o Agendador só "funcionou" nos testes porque cada teste insere seus
   próprios dados sintéticos diretamente, mascarando a ausência do seed automático). Só
   percebi ao ir registrar o mesmo padrão pela terceira vez. Corrigido implementando
   `OnModuleInit` nos três serviços (mesmo padrão do `init_db()` do Flask, que semeia a
   cada subida). Para não vazar o catálogo real da empresa para dentro dos testes, o
   `onModuleInit` é pulado quando `NODE_ENV==='test'` (setado automaticamente pelo Jest) —
   os testes continuam controlando seus próprios dados sintéticos. **Lição: ao introduzir
   um serviço com seed idempotente, registrar no mesmo commit onde/quando ele é chamado —
   "pronto para usar" não é o mesmo que "em uso".**
8. **Corrupção silenciosa de acentos no serviço Python — codepage do Windows em vez de
   UTF-8** (achado só no smoke manual, não pego pelos testes na primeira tentativa): os
   módulos copiados de `webapp/gl_*.py` têm strings com acento/travessão (`"—"`). Neste
   Windows, sem o interpretador em UTF-8 mode, ele decodifica esses arquivos `.py` com a
   codepage do sistema em vez de UTF-8 — o travessão de "Cronograma de Visitas — Cliente"
   virava um caractere de substituição (`�`), e o teste original só checava
   `"Cliente" in valor`, então passou mesmo com o texto corrompido. Corrigido em duas
   camadas: (1) `docservice/main.py` verifica `sys.flags.utf8_mode` e recusa subir com um
   erro claro se não estiver ativo — falha rápido em vez de gerar documento corrompido
   silenciosamente; (2) `docservice/iniciar.bat` sempre define `PYTHONUTF8=1`. O teste
   também foi reforçado para checar o caractere exato (`ord(valor[i]) == 0x2014`), não só
   uma substring. **Lição: ao portar módulos com texto acentuado para um ambiente novo,
   testar o caractere exato, não só a presença de uma palavra-chave ASCII** — um teste
   "verde" só prova o que ele realmente checa.
9. **Este próprio documento afirmou por um tempo que o schema novo tinha FK real com
   `onDelete: CASCADE`** (linha da tabela §1 e um item de §4) — falso: nenhuma entidade
   declara `@ManyToOne`/`onDelete` em lugar nenhum (`grep -rn "ManyToOne\|onDelete"
   backend/src/database/entities/` não retorna nada). Se `ProjetosService.excluir()` tivesse
   sido escrito confiando nessa afirmação, todo `projeto_id` órfão em `documentos`/`eventos`
   (e nas tabelas do Agendador/Levantamento) sobreviveria à exclusão do projeto — exatamente
   a mesma classe de bug do item 1 desta lista, só que na documentação em vez do código.
   Corrigido: (1) `ProjetosService.excluir()` injeta os 5 serviços com dado por-projeto
   (`CronogramaService`, `DesignacoesService`, `LevantamentoRespostaService`,
   `DocConteudoService`, `DocumentosService`) e chama `limparProjeto(id)` de cada um antes de
   remover a linha do projeto — mesma tupla de limpeza do `webapp/app.py:projeto_excluir`,
   agora via injeção de dependência em vez de lista hardcoded; (2) teste dedicado
   (`projetos.service.spec.ts`, "excluir limpa os dados de todos os módulos...") garante que
   os 5 `limparProjeto` são chamados; (3) texto de §1/§4 corrigido para não afirmar cascade
   real. **Lição: uma afirmação arquitetural no documento de conversão é tão passível de
   verificação quanto uma linha de código — não escrever "X existe" sem ter rodado o grep que
   prova.**
10. **Corrida entre specs e2e no mesmo caminho real em disco (`EBUSY` no Windows)**: ao
    adicionar `geracao-layout.e2e-spec.ts` (que também chama
    `ModeloDocumentoService.seedDefaults()`, igual a `cadastros.e2e-spec.ts`), a suíte
    completa passou a falhar intermitentemente com `EBUSY: resource busy or locked` no
    `copyFileSync` de `levantamento.docx`. Causa: cada arquivo `*.e2e-spec.ts` roda num
    processo Jest separado com seu próprio SQLite `:memory:` (isolado por natureza), mas o
    store de `ModeloDocumento` grava em `backend/dados/modelos_documento/` — um caminho
    real, único, **compartilhado por todos os processos** — então dois specs rodando em
    paralelo colidiam copiando para o mesmo `levantamento_v1.docx`. Corrigido isolando o
    store por `JEST_WORKER_ID` quando `NODE_ENV==='test'`
    (`modelo-documento.service.ts:store()`), mesmo padrão já usado para pular o auto-seed em
    teste. **Lição: isolamento de teste por SQLite `:memory:` não isola gravação em disco —
    qualquer serviço que grava arquivo (não só banco) precisa do mesmo cuidado assim que
    dois specs e2e passam a exercitá-lo.** A mesma correção (isolar por `JEST_WORKER_ID`)
    foi aplicada preventivamente em `IaService.arquivoChave()`, ao criá-la nesta mesma
    sessão de trabalho, já sabendo do problema.
11. **Coluna nullable com tipo TypeScript união (`Date | null`) vira `Object` para o
    TypeORM, não `Date`** (achado ao rodar a suíte e2e completa pela primeira vez após
    criar a entidade `Protocolo`): `processadoEm`/`aprovadoEm` foram declaradas
    `Date | null`, e o `design:type` refletido por essa união é `Object` — o driver
    `better-sqlite3` rejeita a entidade (`DataTypeNotSupportedError: ... "Object" ...`).
    Uma primeira tentativa de corrigir com `type: 'timestamp'` explícito também falhou:
    `'timestamp'` não existe no driver SQLite (só `'datetime'`), e `'datetime'` não existe
    no driver Postgres (só `'timestamp'`) — não há um literal comum aos dois. Corrigido
    declarando a propriedade como `Date` simples (sem `| null`, com `nullable: true` só no
    `@Column()`) e deixando o TypeORM inferir o tipo nativo certo por driver a partir do
    `design:type`. **Mesma causa-raiz do item 3 desta lista** (`import type` apagando o
    `design:type` de colunas com tipo alias) — família de bug: **qualquer `@Column()` cuja
    propriedade não seja exatamente uma classe concreta (união, tipo importado com `import
    type`, etc.) precisa de atenção redobrada**, e datas nullable especificamente não têm
    um `type` explícito universal entre SQLite/Postgres — deixar sem `type` e sem união é
    o caminho seguro.
12. **Teste e2e de dedup por upload testava um cenário que o próprio Flask original nunca
    deduplicou**: a primeira versão de `protocolos.e2e-spec.ts` enviava o mesmo conteúdo
    duas vezes com o mesmo nome original, esperando `novo=false` na segunda. Falhou — mas
    ao reler `webapp/routes_protocolos.py:protocolo_novo`, o Flask original **também**
    resolve a colisão de nome em disco (`nome_1.mp4`, `nome_2.mp4`, ...) ANTES de chamar
    `protocolo_hash`, e o hash inclui o nome do arquivo salvo — então dois uploads com o
    mesmo conteúdo e nome original geram hashes DIFERENTES (nomes salvos diferentes) em
    ambos os sistemas; o dedup por hash só funciona de verdade para o robô de pasta
    (revarrendo o MESMO caminho estável). Corrigido removendo o teste (premissa inválida)
    e documentando a limitação no comentário do teste que ficou. **Lição: quando um teste
    novo falha logo de cara, reler o comportamento ORIGINAL linha a linha antes de assumir
    que é bug na porta — às vezes o teste é que está testando um comportamento que nunca
    existiu.**
13. **Import circular entre `EmailModule` e `DocumentosModule`**: o desenho natural era
    `EmailModule` importar `DocumentosModule` (para `NotificacaoService` gravar o evento
    "Notificou.../Notificação pendente" via `DocumentosService.registrarEvento`) — mas
    `DocumentosController` também precisa de `NotificacaoService` (para disparar
    `levantamento_ok`/`projeto_ok`/`termo_ok` depois de gerar um documento), o que exigiria
    `DocumentosModule` importar `EmailModule` de volta. NestJS não resolve um `imports`
    circular direto entre dois módulos sem `forwardRef()` nos dois lados. Em vez de
    `forwardRef` (mais frágil, mais fácil de esquecer ao mexer de novo nesses módulos),
    **quebrado na raiz**: `NotificacaoService` passou a injetar o repositório `Evento`
    diretamente (`@InjectRepository(Evento)`, registrado também em `EmailModule` via
    `TypeOrmModule.forFeature`) em vez de depender do `DocumentosService` inteiro — só
    precisava de uma linha (`eventos.save(...)`), não do serviço completo (que também
    arrasta `CatalogosModule`/`LevantamentoModule`/`GeracaoModule`, irrelevantes para
    e-mail). Com isso, `EmailModule` não depende mais de `DocumentosModule`, e
    `DocumentosModule` pôde importar `EmailModule` livremente (sentido único). **Lição:
    antes de reimportar um módulo "grande" só por um método pequeno, checar se dá pra
    injetar a entidade/repositório diretamente — evita tanto o import circular quanto o
    acoplamento desnecessário ao resto daquele módulo.**
14. **Registrar o provider mas esquecer de importar o módulo**: ao adicionar
    `NotificacaoService` ao construtor de `CronogramaController`, o `CronogramaModule` não
    foi atualizado para importar `EmailModule` — só apareceu ao rodar a suíte e2e completa
    (`Nest can't resolve dependencies of the CronogramaController (..., ?)`), não no
    `npm run build` (TypeScript não valida grafo de DI em runtime) nem nos testes
    unitários (que mockam todas as dependências manualmente, sem passar pelo módulo real).
    **Lição, reforçando uma já registrada nesta sessão: só a suíte e2e completa
    (`Test.createTestingModule({imports:[AppModule]})`) valida o grafo de módulos de
    verdade — build limpo e testes unitários passando não bastam depois de adicionar uma
    dependência nova a um controller/service existente.**
15. **Teste e2e dependente de uma conexão de rede real e instável**: a suíte nova
    (`email-fluxo.e2e-spec.ts`) salva uma config SMTP fictícia e, mais adiante, um outro
    teste muda a situação de um projeto para "Concluído" — o que dispara
    `NotificacaoService.notificarEvento`, que tenta mandar e-mail de verdade se
    `mailer.configurado()` for true. Usar um host como `smtp.exemplo.com` arriscava DNS
    lento/instável (ou um `connectionTimeout` de 20s) dependendo da rede do ambiente onde
    os testes rodam. Corrigido em duas camadas: (1) o host de teste virou `smtp.invalid`
    — TLD reservado pela RFC 2606, garantidamente nunca resolve em DNS, então a falha é
    rápida e determinística em qualquer ambiente (com ou sem acesso à internet); (2) o
    teste de notificação de encerramento foi reordenado para rodar ANTES de qualquer
    teste que configure SMTP/Gmail no mesmo arquivo, exercitando de propósito o caminho
    mais rápido ("e-mail não configurado", sem nenhuma tentativa de rede). **Lição: em
    teste de integração que pode acionar I/O de rede de verdade, nunca usar um domínio
    "que parece de teste" (`.exemplo.com`, `.test.com`) — só os TLDs reservados
    (`.invalid`, `.example`, `.test`, `.localhost`, RFC 2606) garantem a falha rápida e
    sem depender de conectividade do ambiente.**

## 7. Vulnerabilidades / débitos de segurança do sistema atual, tratados na conversão

- **Modo "login desabilitado = acesso total"** do Flask (quando não há usuários nem senha
  mestra cadastrados) **não foi replicado** — no novo backend, o primeiro acesso exige rodar
  o seed do ADM (`npm run seed:admin`) explicitamente.
- **Senha mestra universal que loga como ADM incondicionalmente** não existe no novo
  backend — todo login é usuário/senha real, com bcrypt (custo 12).
- Refresh tokens são **hasheados (SHA-256) antes de persistir** e podem ser revogados
  individualmente (logout real, não só descarte no cliente).

## 8. Pendências reais (não convertido ainda — priorizado)

Ordem sugerida para dar sequência (cada um segue o mesmo padrão: entidade TypeORM →
service → controller → tela Angular → testes):

1. ~~Agendador de Visitas~~ — **convertido** (ver §2). Duas lacunas propositais dentro dele,
   ambas registradas e não escondidas:
   - **Disponibilidade externa (SICLA/Oracle)** não é consultada pela distribuição
     automática nem pelo indicador visual do calendário ainda — depende do item 4 abaixo
     (mesma conexão Oracle usada por Consultas BD/Dashboards). O algoritmo já tem o ponto de
     extensão comentado em `distribuicao.service.ts`.
   - **Sem arrastar-e-soltar** na tela Angular — a interação foi simplificada para
     formulários de data/turno por visita (mesma capacidade funcional: alocar, mover,
     desalocar), mais simples de implementar corretamente sob prazo e mais acessível por
     teclado; drag-and-drop pode ser adicionado depois como polimento de UX.
2. ~~Cadastros~~ — **convertido** (backend completo: `ChecklistModelo` CRUD, `IndiceTopico`
   com seed, `ModeloDocumento`+`ModeloDocumentoVersao` com upload/download de versão,
   `LevantamentoResposta` e `DocConteudo`). Lacuna proposital: `ModeloDocumentoCampo` (mapa
   de preenchimento, só informativo) tem CRUD mas **sem seed** — a geração de documentos não
   lê essa tabela, então isso não bloqueia o item 3. **Tela Angular de Cadastros ainda não
   existe** — só backend/API nesta fatia; ninguém no time consegue editar os catálogos pela
   UI ainda (só reimportar do YAML/gerenciar modelos via API/Swagger diretamente).
3. ~~Geração de documentos~~ — **convertido**: serviço Python híbrido (`docservice/`,
   FastAPI) com os quatro documentos fiéis — cronograma de visitas (`.xlsx`,
   `POST /gerar/cronograma-visitas` + `POST /projetos/:id/agenda/gerar`) e
   Levantamento/Projeto/Termo (`.docx`, blocos condicionais por módulo contratado,
   `POST /gerar/documento-fiel` + `POST /projetos/:id/gerar-layout/:slug`). `Documento`/
   `Evento` (entidades novas) persistem o anexo e a timeline em ambos os fluxos.
4. ~~Protocolos de Treinamento~~ — **convertido**: pipeline completo vídeo -> transcrição
   local (faster-whisper, no docservice) -> análise IA (Claude, direto no NestJS via
   `@anthropic-ai/sdk`) -> revisão/aprovação, com robô de varredura de pasta
   (`RoboProtocolosService`) e a nova tela Config → IA (`IaModule`). Ver §2. Lacuna
   proposital: a correção verbal/ortográfica opcional dos documentos GERADOS (a outra
   metade de `tools/ia.py` — `revisar`/`revisar_lote`, usada por `gl_*.py` no Flask) não
   foi portada — só a chave/config (`IaService.obterChave`/`modelo`) é compartilhada.
5. ~~E-mail/IMAP/Gmail~~ — **convertido**: SMTP (`nodemailer`) + Gmail API (bypass de SMTP
   bloqueado, `google-auth-library`, OAuth "Web application" com callback real — mudança
   deliberada em relação ao "Desktop app" do Flask, decidida com o usuário) + IMAP
   (`imapflow`+`mailparser`, robô da caixa que cria projetos a partir do e-mail de
   fechamento) + `ModeloEmail` (7 modelos padrão + CRUD) + `NotificacaoService` (ligado
   aos eventos `encerrado`/`cronograma_ok`/`levantamento_ok`/`projeto_ok`/`termo_ok`). Ver
   §2. Lacunas propositais: `checklist_ok` (a geração do documento de checklist em si
   ainda não foi convertida) e os gatilhos de `routes_designacao.py` (GCI/consultor
   designado — essa tela do fluxo de Designação ainda não existe no NestJS, item 8 desta
   lista é só o CRUD de usuários, não essa tela); `fluxo_criar` não gera automaticamente o
   pacote de documentos + e-mail-resumo com anexos (só cria o projeto e notifica).
6. **Disponibilidade externa/Consultas BD/Dashboards** (conexão Oracle configurável,
   `oracledb` tem binding Node oficial) — não convertido; destrava a lacuna do item 1.
7. **Matriz de Conhecimento** e **telas executivas** (`routes_painel.py`) — não convertidos.
8. **Usuários** (`/usuarios`, CRUD completo), **auto-cadastro com código por e-mail** e a
   tela de **Designação** (GCI/consultor por projeto, `routes_designacao.py`) —
   `UsersService` já tem a base (`criar`, `porPerfil`) e o e-mail já está pronto (item 5);
   falta o controller/tela de Usuários e a tela de Designação em si (essa tela vai
   precisar de um lookup usuário-por-nome equivalente a `webapp/db.py:email_do_usuario`,
   ainda não portado — não há chamador para ele nesta fatia).
9. **Jobs agendados** (digest diário, robô de caixa) — usar `@nestjs/schedule` (já
   instalado e registrado em `AppModule`; os robôs de protocolos e da caixa de entrada já
   foram implementados como parte dos itens 4 e 5, ver `RoboProtocolosService`/
   `RoboCaixaService` — só o digest diário continua pendente).

## 9. Incompatibilidades / decisões de portabilidade

- **Hashes de senha não são compatíveis**: Flask usa `werkzeug.security` (scrypt/pbkdf2);
  o novo backend usa `bcrypt`. Usuários existentes **precisarão resetar a senha** na
  virada — não há como migrar o hash diretamente. Ver script de importação a criar
  (pendência).
- **`pywin32`/Word COM e `faster-whisper`** não têm equivalente Node/Java maduro — mantidos
  como serviço Python interno (`docservice/`, já criado e rodando para o cronograma de
  visitas; Word COM/faster-whisper ainda não usados por ele nesta fatia).
- **`docservice/` exige `PYTHONUTF8=1`** neste Windows — sem isso, o interpretador decodifica
  os módulos copiados de `webapp/gl_*.py` (que têm acento/travessão) com a codepage do
  sistema em vez de UTF-8, corrompendo texto nos documentos gerados. `main.py` falha rápido
  com erro claro se detectar que não está em UTF-8 mode; `docservice/iniciar.bat` já define a
  variável — sempre usar esse script (ou `python -X utf8`) para subir o serviço.
- **TypeORM 1.1.0 existe no npm** (tag `latest`) mas foi **propositalmente NÃO usado** —
  fixado em `0.3.31` (tag `legacy` do próprio pacote) porque é a versão cujo comportamento
  e API eu conseguia verificar com confiança; o major 1.x é recente demais para eu revisar
  com segurança sem acesso à documentação atualizada. Reavaliar quando houver tempo para
  validar a 1.x com calma.
- **`tools/data/checklist_modulos.yaml` é dado local, fora do git** (mesma regra do Flask) —
  o catálogo `ChecklistModelo` do backend novo é semeado a partir desse MESMO arquivo
  (`ChecklistModeloService.seedDoYaml`, lido de `../tools/data/` relativo a `backend/`), nunca
  copiado para dentro do repositório. Ambiente sem esse arquivo funciona normalmente, só com
  o catálogo vazio (nenhuma atividade é semeada — comportamento consistente com o Flask).

## 10. Procedimento de rollback

Nada em produção foi alterado: o Flask (`main`) continua sendo a única coisa rodando em
`http://127.0.0.1:5000`, via `Iniciar_Servidor.bat`, exatamente como antes. Para "desfazer"
esta conversão basta **não mesclar** `feature/migracao-angular-backend-moderno` — não há
nenhuma migration nem alteração de schema aplicada ao Postgres de produção (o backend novo
usa `MIGRACAO_DB_URL`, uma variável e, na prática, um banco/schema **diferentes** do
`PAINEL_DB_URL` do Flask).

## 11. Comandos

### Backend (`backend/`)

```bash
npm install                        # instalação
cp .env.example .env                # editar com os segredos reais (nunca commitar)
npm run seed:admin -- --login=admin --nome="Administrador" --email=adm@empresa.com
npm run start:dev                  # desenvolvimento (SQLite local se MIGRACAO_DB_URL não definida)
npm run build && npm run start:prod  # produção
npm run test                       # unitários
npm run test:e2e                   # integração (auth + projetos)
npm run lint                       # ESLint
npm run migration:run              # aplica migrations no Postgres (MIGRACAO_DB_URL definida)
npm run migration:revert           # desfaz a última migration
```

Swagger/OpenAPI: `http://localhost:3000/api/docs` (com o backend rodando).

### Frontend (`frontend/`)

```bash
npm install
npm start        # dev server em http://localhost:4200 (proxy esperado para /api → :3000)
npm run build     # build de produção em dist/frontend
npm test          # unitários (Vitest via @angular/build:unit-test)
```

### Serviço de geração de documentos (`docservice/`)

```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
iniciar.bat                       # já define PYTHONUTF8=1 — ver §9 sobre por que é obrigatório
set PYTHONUTF8=1 && .venv\Scripts\python -m pytest tests/ -v
```

Swagger/OpenAPI: `http://127.0.0.1:8001/docs` (com o serviço rodando). Nunca exponha esta
porta fora do host — é um serviço interno, chamado só pelo backend NestJS
(`MIGRACAO_DOCSERVICE_URL`).

## 12. Como validar esta entrega

1. `cd backend && npm run build && npm run test && npm run test:e2e` — build limpo,
   169/169 testes passando (109 unitários + 60 e2e), incluindo as suítes dedicadas do
   Agendador de Visitas (`test/cronograma.e2e-spec.ts`, com o teste do endpoint
   `/agenda/gerar` usando um fake do serviço Python), de Cadastros
   (`test/cadastros.e2e-spec.ts`), de Geração de documentos fiéis
   (`test/geracao-layout.e2e-spec.ts`, endpoint `/projetos/:id/gerar-layout/:slug`), de
   Protocolos de Treinamento (`test/protocolos.e2e-spec.ts` — upload multipart real,
   pipeline completo com `TranscricaoService`/`ProtocoloIaService` mockados por
   `overrideProvider`, edição, controle de acesso ADM/Coordenador em aprovar/reprovar,
   streaming do vídeo), de E-mail/Fluxo (`test/email-fluxo.e2e-spec.ts` — Config→E-mail/
   IMAP/Gmail com controle de acesso ADM-only, upload de credencial OAuth, callback
   público do Gmail, CRUD dos 7 modelos padrão, fluxo completo parse→criar com dedup por
   CNPJ, e a notificação automática de `encerrado` ao mudar a situação do projeto) e o
   teste unitário de `ProjetosService.excluir()` que garante a limpeza dos 5 módulos com
   dado por-projeto (Cronograma, Designações, Levantamento-resposta, DocConteudo,
   Documentos/Eventos — ver §6 item 9). Suíte e2e validada estável em múltiplas execuções
   consecutivas (inclusive repetindo cada spec novo isoladamente, para pegar corridas de
   estado entre execuções — ver §6 itens 10 e 15).
2. `cd frontend && npm run build && npm test` — build limpo, 6/6 testes passando.
3. `cd docservice && set PYTHONUTF8=1 && .venv\Scripts\python -m pytest tests/ -v` — 14/14
   testes passando: os 4 do cronograma de visitas (checagem estrita de caractere, não só
   substring, para pegar corrupção de encoding), os 5 de `test_documento_fiel.py` — que
   geram Levantamento/Projeto/Termo a partir dos **templates .docx reais** de
   `tools/templates/layouts/` (os mesmos usados em produção), não de fixtures sintéticas —
   e os 5 novos de `test_transcricao.py` (job assíncrono de transcrição: sucesso, erro,
   404, e rejeição de dois jobs concorrentes do mesmo protocolo).
4. Smoke manual feito nesta sessão: backend + frontend + docservice rodando juntos (3
   processos reais, não mockados), login real, CRUD de projeto, fluxo completo do Agendador
   (seed de atividades, designação de técnico, distribuição automática, período sem agenda
   por técnico) e **geração real do cronograma de visitas .xlsx** (baixado e inspecionado
   byte a byte para confirmar a correção do bug de encoding) confirmados por `curl` contra o
   servidor real (ver histórico de comandos desta sessão). **Teste visual em navegador não
   foi realizado** — este ambiente não tem uma ferramenta de navegador disponível;
   recomenda-se abrir `http://localhost:4200` manualmente antes de considerar as telas de
   Projetos e do Agendador definitivamente validadas do ponto de vista de UX. A geração de
   Levantamento/Projeto/Termo foi validada por testes automatizados reais (item 3 acima),
   não por smoke manual adicional nesta sessão. **Protocolos de Treinamento: o
   `faster-whisper` real foi instalado e importado com sucesso no docservice (pacote
   `faster-whisper>=1.0` + `ctranslate2`), mas nenhuma transcrição real foi executada
   nesta sessão** (exigiria baixar um modelo Whisper e um arquivo de áudio/vídeo de
   verdade) — a suíte de testes (docservice e NestJS) mocka
   `transcritor.transcrever_isolado`/`TranscricaoService`, mesmo padrão já usado pelos
   testes originais do Flask (`test_protocolo_pipeline_mock`). Da mesma forma, a análise
   por IA (`ProtocoloIaService`/`@anthropic-ai/sdk`) não foi exercitada contra a API real
   da Anthropic — só mockada. **Recomenda-se um teste manual ponta a ponta com um vídeo
   curto real e uma chave de API válida antes de considerar este módulo pronto para
   produção.** **E-mail/IMAP/Gmail: nenhum dos três transportes foi exercitado contra um
   servidor real nesta sessão** (SMTP/IMAP reais exigiriam credenciais de uma caixa de
   e-mail de verdade; o fluxo OAuth do Gmail exige um credencial "Aplicativo da Web"
   cadastrado no Google Cloud Console com o redirect URI de produção, e um consentimento
   humano no navegador — não automatizável em CI). Os testes cobrem toda a orquestração
   (config salva/lida corretamente, dispatcher Gmail-antes-de-SMTP, tradução de erro
   amigável, parsing/dedup do fechamento, CSRF do OAuth) com o transporte de rede real
   substituído por um host `.invalid` (SMTP/IMAP, para forçar uma falha rápida e
   determinística sem depender de conectividade) ou mockado (Gmail). **Antes de usar em
   produção**: validar manualmente o envio SMTP com uma conta real (Gmail/Outlook exigem
   senha de app), a leitura IMAP com um e-mail de fechamento de teste, e o fluxo OAuth do
   Gmail ponta a ponta (upload do client "Aplicativo da Web", autorizar, callback,
   enviar).
