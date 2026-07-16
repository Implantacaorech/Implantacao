# Documento de conversão — Painel de Implantação → Angular + NestJS

**Branch:** `feature/migracao-angular-backend-moderno` (não mesclada em `main`; o Flask
em produção não foi tocado). **Status: o backlog original de conversão do backend está
INTEIRO convertido, incluindo a última pendência (geração do documento Cronograma)** —
autenticação, Projetos, Agendador de Visitas, Cadastros, geração de documentos
(Levantamento/Projeto/Cronograma/Termo, os 4 slugs do "layout fiel" + cronograma de
visitas), Protocolos de Treinamento, E-mail/IMAP/Gmail, Disponibilidade externa/Consultas
BD/Dashboards, Matriz de Conhecimento + telas executivas (Capacidade/Coordenação/
Atividade/Home/Monitoramento Operacional), Usuários (CRUD) + auto-cadastro + Designação,
Jobs agendados (digest diário) e as linhas editáveis do Cronograma/Check List. Ver a
lista detalhada de cada item em §2 e o fechamento da última pendência (geração do
Cronograma, com a decisão de escopo sobre o Check List) em §8 item 11. **Frontend
Angular: as 51 telas reais do Flask (`webapp/templates/`, exceto partials) têm
equivalente Angular** — o backlog original de 11 telas (§13: Home, Usuários,
auto-cadastro, Designação, Cronograma/Check List editáveis, Matriz de Conhecimento,
Coordenação/Capacidade, Atividade/Monitoramento, Config→Disponibilidade/Consultas
BD/Dashboards) foi seguido, numa sessão posterior, do fechamento de todas as lacunas de
tela restantes — Levantamento, Doc editar, Protocolos, Config→Modelos de E-mail, Agenda→
Acompanhamento, Projeto origem, Fluxo completo (+ pacote inicial/e-mail-resumo no
backend), Projeto e-mail (endpoint novo), o assistente administrativo legado (ponte de
subprocesso isolada do docservice) e a pré-visualização de documento (`.docx`/`.xlsx` via
Word COM no docservice) — ver §14. O que falta é só o que fica **fora** deste backlog de
funcionalidade: migração de dados de produção e o checklist operacional de virada, ver
[05-plano-de-virada.md](05-plano-de-virada.md). Ver honestidade de escopo em
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
    ~~Escopo reduzido desta fatia~~ — **fechado na sessão de 2026-07-16** (ver §14):
    `FluxoService.criarComPacote` agora deixa o usuário escolher GCI/técnicos e gera
    automaticamente o pacote de documentos (Mapeamento + Cronograma, via
    `GeracaoLayoutService`) + o e-mail-resumo com anexos aos responsáveis (via
    `MailerService`), preservando `criarDeCampos`/`criarDeFechamento` (usados pelo robô da
    caixa) intactos — método novo, não alteração dos existentes. Único item que ficou de
    fora: o gerador legado de Check List (`runner.py`/`tools/gerar_checklist_consultor.py`)
    não foi ligado ao pacote inicial (ver §14).
  - Circularidade evitada de propósito: `NotificacaoService` injeta o repositório
    `Evento` diretamente (não `DocumentosService`) — `EmailModule` não importa
    `DocumentosModule` porque `DocumentosModule` agora importa `EmailModule` (para o
    `DocumentosController` disparar `levantamento_ok`/`projeto_ok`/`termo_ok`); um import
    circular entre os dois quebraria o boot do Nest. Ver §6 item 13.
- **Disponibilidade externa/Consultas BD/Dashboards** (`backend/src/disponibilidade/*`) —
  100% Node/NestJS (decisão já tomada numa sessão de pesquisa anterior a esta: `oracledb`
  tem driver Node oficial em modo thin puro-JS, sem detour pelo docservice). Equivalente a
  `webapp/disponibilidade.py` + a fatia de `webapp/db.py` de `ConsultaBD` +
  `webapp/routes_dashboards.py` + os 3 pontos de integração Oracle de
  `webapp/routes_agenda.py`.
  - `DisponibilidadeService`: conexão Oracle via `oracledb` (só o dialeto Oracle é
    implementado de verdade — os outros que o Flask suportava genericamente via
    SQLAlchemy, postgresql/mysql/sqlserver, nunca tiveram uso real neste sistema, só o
    SICLA). Config em `dados/disponibilidade.json` (mesmo contrato de "reenvio do form
    inteiro" — exceto senha — de `MailerService`/`ImapIntakeService`, ver §6 item 16).
    `executarSql` só aceita `SELECT`/`WITH` (mesma proteção mínima do Flask — quem edita
    já é Administrador). `:tecnicos` (o contrato do SELECT de ocupação, `... IN
    :tecnicos`) é expandido manualmente em binds nomeados
    (`:tecnicos_0, :tecnicos_1, ...`), já que o node-oracledb não tem o "expanding
    bindparam" do SQLAlchemy. Caches em memória com TTL (180s ocupação, 600s mapa de
    técnicos) preservados — protegem o Oracle do SICLA de ser martelado a cada
    navegação de calendário.
  - `ConsultaBdService`: CRUD + seed idempotente da consulta "Previsão Início Oficial"
    (mesmo texto/comentários do Flask original).
  - `DashboardsService`: **motor genérico** (decisão tomada com o usuário — o Flask
    original só implementava de verdade UMA análise, hardcoded no Python, apesar do
    comentário dizer "estrutura já pronta para novas análises"). Generalizado com 2
    colunas novas em `ConsultaBD` (`colunaData`/`colunaSituacao`/`mostrarGrafico`) — a
    consulta declara qual coluna do próprio SELECT é a data (filtro de período + bucket
    mensal do gráfico) e qual é a situação (filtro multi-seleção); qualquer consulta
    salva com `colunaData` preenchida vira um dashboard, sem escrever código novo.
    Endpoints: `GET /dashboards` (lista as disponíveis), `GET /dashboards/:slug` (roda).
  - **Fecha a pendência documentada do item 1** (Agendador de Visitas):
    `DistribuicaoService.distribuirAutomatico` agora consulta a disponibilidade externa
    (via `UsersService.codigosSiclaPorNome` + `DisponibilidadeService.ocupacaoPorSlotCache`)
    e respeita `modo` (conjunta/individual) exatamente como
    `webapp/routes_agenda.py:_distribuir_automatico` — fail-open (qualquer falha na
    conexão externa só loga e segue sem bloquear). **Escopo reduzido**: só o algoritmo de
    distribuição automática foi ligado — o guard da alocação manual (arrastar-e-soltar,
    `_slot_indisponivel`) e o indicador visual de células bloqueadas no calendário
    (`projeto_agenda`'s `bloqueados`) não foram portados nesta fatia (a tela do Agendador
    em si já roda sem eles; ver §8).
- **Matriz de Conhecimento + telas executivas** (`backend/src/matriz/*`,
  `backend/src/metricas/*`, `backend/src/painel/*`) — equivalente a `webapp/matriz.py` +
  `webapp/routes_matriz.py` + `webapp/capacidade.py` + `webapp/routes_painel.py` (exceto
  `monitoramento`, ver §8) + a fatia de `webapp/db.py` de `MatrizCompetencia`/
  `MatrizTecnico`/`metricas`/`alertas`/`gate_status`/`campos_faltantes`/`cabecalho`/
  `metricas_uso`/`funil_macro`.
  - **Matriz de Conhecimento** (`MatrizService`): skill matrix técnico×competência (notas
    0-10, JSON `{sigla: nota}` por técnico — mesmo formato não-normalizado do original).
    Importador de planilha (`docs/Matriz de Conhecimento.xlsx`, local/não versionada)
    reescrito com `exceljs`, **aditivo** (nunca sobrescreve técnico já cadastrado, só
    cria o que falta) — validado estruturalmente contra a planilha real do time nesta
    sessão (só metadados/contagens, nenhum dado de nota individual foi lido/exibido, por
    ser dado de RH). Permissões (pedido de 2026-07-07, preservado): ADM vê/edita tudo +
    importa; Administrativo/Coordenador veem tudo, só consulta; Consultor/GCI veem/editam
    só a própria linha (casada por Código SICLA ou nome). Endpoints: `GET /matriz`,
    `GET /matriz/:id`, `POST /matriz/:id/salvar`, `POST /matriz/importar` (ADM).
  - **`MetricasService` — motor de métricas/gates/alertas, NOVO nesta sessão**: ao portar
    as telas executivas, veio à tona que `webapp/db.py:metricas/alertas/gate_status/
    campos_faltantes/cabecalho/metricas_uso/funil_macro` (o motor de estágio/gate que
    calcula "o que falta pra avançar de etapa", KPIs da carteira e alertas proativos)
    **nunca tinha sido portado em nenhum item anterior** — nem para a ficha do projeto.
    Portado como serviço só-leitura (`MetricasService`), fiel função a função. **Decisão
    de escopo**: a ENFORCEMENT de `pode_avancar` (bloquear a troca de etapa no
    `ProjetosService.atualizar()` quando falta campo/documento/ação) não foi ligada nesta
    fatia — mudaria o comportamento do fluxo de Projeto já publicado nos itens 1-6, o que
    está fora do pedido original ("Matriz + telas executivas"); ver pendência em §8.
  - **Capacidade da equipe** (`CapacidadeService`, delega a `MatrizService` +
    `DisponibilidadeService` + `UsersService`): cruza conhecimento (Matriz) × agenda
    (Painel + SICLA, quando configurada) × carga (nº clientes ativos) × próxima liberação
    (go-live) num score 0-100 explicável (45/35/20) por Consultor/GCI ativo, para
    responder "dá pra receber esse cliente, e a partir de quando". `GET
    /painel/coordenacao/capacidade?modulos=&semanas=`.
  - **Painel de Coordenação** (`CoordenacaoService`): KPIs da carteira + funil por etapa +
    distribuição por situação + atrasados + carga por consultor + alertas — via
    `MetricasService.metricas`/`alertas`. `GET /painel/coordenacao`. O envio do resumo por
    e-mail ("digest") do Flask fica a cargo do job agendado (item de Jobs agendados, ainda
    não convertido — ver §8).
  - **Atividade da operação** (`AtividadeService`): uso dos últimos 30 dias + funil
    macro + feed cronológico (últimos 60 eventos, com nome do cliente resolvido). `GET
    /painel/atividade`.
  - **Home** (`HomeService`): KPIs resumidos + fila de "próximas ações" por projeto ativo
    (documento/ação pendente, ou "Avançar para X" quando o gate já está ok), ordenada por
    urgência (atraso desc) + projeto em foco (o ativo atualizado mais recentemente). Único
    endpoint do módulo Painel sem gate de perfil (`@Roles()` vazio sobrepõe o
    `@Roles(...PERFIS_GESTAO)` da classe) — todo perfil autenticado acessa, igual ao Flask
    original (`home()` não chama `pode_ver`). `GET /painel/home`. Os `url_for`/`cta` do
    Flask (que geravam links HTML) foram substituídos por um campo `tipo` estável — o
    frontend Angular resolve rota e rótulo do botão a partir dele.
  - **Monitoramento Operacional NÃO foi convertido nesta fatia** — decisão tomada com o
    usuário ao descobrir, durante o port, que essa tela depende de `CronogramaItem`/
    `ChecklistItem`/`Modificacao` (as linhas EDITÁVEIS do documento Cronograma/Check List,
    com status por linha — um subsistema inteiro, diferente do Agendador de Visitas do
    item 1) que nunca foi portado. Ver pendência detalhada em §8.
- **Usuários (CRUD) + auto-cadastro + tela de Designação** (`backend/src/users/*`,
  `backend/src/cadastro/*`, `backend/src/designacao/*`) — equivalente a
  `webapp/app.py:usuarios`/`cadastro`/`cadastro_confirmar` + `webapp/routes_designacao.py`
  (exceto a rota combinada `projeto_designar`, ver abaixo) + a fatia de `webapp/db.py` de
  `CadastroPendente`/`existe_usuario`/`email_do_usuario`.
  - **Usuários**: `UsersController` REST (`GET/POST /usuarios`, `PUT /usuarios/:id`) —
    adapta o formulário único create/edit do Flask para verbos HTTP próprios; sem rota de
    exclusão (igual ao original — desativação é o campo `ativo`). Nunca devolve
    `senhaHash` na resposta (checagem explícita, o Flask original não tinha esse risco por
    nunca serializar a entidade inteira p/ JSON). `UsersService` ganhou `atualizar`,
    `existeUsuario` (login OU e-mail, exclui o próprio id na edição) e `emailDoUsuario`
    (usado pela Designação).
  - **Auto-cadastro** (`CadastroController`, rotas públicas — sem `JwtAuthGuard` de
    propósito): código de 6 dígitos por e-mail, expira em 30min, 5 tentativas erradas
    derrubam o cadastro pendente (tudo igual ao Flask). Cria o `Usuario` direto na
    confirmação, **sempre** perfil `Consultor`, **sem fila de aprovação do ADM** (mesmo
    comportamento do original) — e já devolve os tokens (login imediato), reaproveitando
    `AuthService.emitirParaUsuario` (extraído de `AuthService.login`, sem mudar o
    comportamento de login normal). O e-mail do código é enviado direto via
    `MailerService.enviar()` (texto fixo, **não** passa pelo `ModeloEmail`/`{{VAR}}`,
    igual ao Flask original — é um e-mail de sistema, não editável pelo ADM). Adaptação
    deliberada: o Flask usa `session["cad_email"]` para lembrar o e-mail entre a etapa 1 e
    a confirmação; a API REST (sem sessão de servidor) devolve o e-mail na resposta de
    `POST /cadastro` e o frontend o reenvia explicitamente em `POST /cadastro/confirmar`.
  - **Designação** (`DesignacaoController`, `/projetos/:id/{definir-gci,agendar,
    consultores}`) — **decisão de fidelidade importante**: o Flask tem 3 gates de
    permissão DIFERENTES nas 3 telas do mesmo fluxo, que pareciam inconsistentes à
    primeira leitura (`definir_gci`/`agendar` = só ADM+Administrativo; `consultores` = só
    ADM+GCI — nenhum dos dois usa a constante `PERFIS_DESIGNA` já existente no backend
    novo). Perguntado ao usuário, que confirmou com uma tabela detalhada de
    responsável-por-etapa do processo real: são deliberadamente distintos (Administrativo
    agenda o Levantamento e define o GCI; o próprio GCI designa os consultores). Portado
    fielmente com 2 constantes novas, `PERFIS_AGENDAMENTO`/`PERFIS_DESIGNA_CONSULTORES` —
    **não** normalizado para `PERFIS_DESIGNA`. A rota combinada `projeto_designar` (que
    fazia GCI+consultores numa tela só) **não foi portada**: confirmado que nenhum
    template do Flask linka para ela — está morta na navegação atual, só o fluxo
    `definir_gci` → `agendar` → `consultores` (3 telas separadas) é realmente usado.
    Também portado nesta fatia (pré-requisito descoberto, não usado antes por nenhum
    item): `MetricasService.autoAvancar` (espelha `webapp/app.py:_auto_avancar` — avança a
    etapa automaticamente enquanto o gate da próxima já está satisfeito; nunca conclui
    "Levantamento" sozinho, isso é sempre manual/GCI). A notificação de cada etapa usa
    `MailerService.enviar()` direto (mesmo padrão do Flask — não passa pelo
    `NotificacaoService`, que cobre outros eventos).
- **Jobs agendados — resumo diário** (`backend/src/digest/*`) — equivalente a
  `webapp/app.py:_digest_destinos`/`_montar_digest`/`enviar_digest`/`_agendador_digest`.
  Os outros dois jobs agendados do Flask original (robô de protocolos, robô da caixa de
  entrada) já tinham sido convertidos nos itens 4 e 5 — este fecha a lista.
  - `DigestService`: monta o resumo (KPIs de `MetricasService.metricas` + até 30 alertas
    de `MetricasService.alertas`) e envia via `MailerService.enviar()` para os
    destinatários de `MIGRACAO_DIGEST_PARA` (`;`/`,`/quebra de linha, mesmo parsing do
    Flask). **Sem tela de configuração** (nem no Flask, nem aqui) — é ajuste de
    ambiente/ops; o fallback de arquivo `digest_para.txt` do Flask original não foi
    portado, por não ter UI que o gerencie (só o env var, que é o caminho realmente usado
    em produção).
  - `RoboDigestService`: espelha `_agendador_digest` — checa a cada 30min (mesmo
    `time.sleep(1800)` do Flask, via `SchedulerRegistry`, mesmo padrão de
    `RoboProtocolosService`/`RoboCaixaService`) se a hora atual bate com
    `MIGRACAO_DIGEST_HORA` (default 8h) e ainda não enviou hoje.
  - Botão "enviar agora" do Painel de Coordenação portado como
    `POST /painel/coordenacao/digest` (gate `PERFIS_GESTAO`, mesmo do resto do
    Painel) — substitui o `?digest=` por querystring do Flask (padrão PRG que não faz
    sentido numa API JSON) por uma resposta direta `{ok, mensagem}`.
- **Linhas editáveis do Cronograma/Check List** (`backend/src/plano-cronograma/*`) —
  equivalente a `webapp/routes_cronograma.py` + a fatia de `webapp/db.py` de
  `CronogramaItem`/`ChecklistItem`/`Modificacao`/`salvar_linhas`/`registrar_modificacao`.
  **Pré-requisito para o Monitoramento Operacional** (único item pendente, ver §8) —
  construído a pedido explícito do usuário depois de fechar o restante do backlog
  original. **Não confundir com `backend/src/cronograma/*`** (o Agendador de Visitas,
  item 1 — motor de AGENDAMENTO de visitas técnicas); esta fatia são as linhas do
  DOCUMENTO Cronograma/Check List, editáveis manualmente durante a implantação, com
  status por linha — por isso o módulo novo vive em `plano-cronograma/` (mesmo prefixo
  "plano" dos templates Flask `plano_cronograma.html`/`plano_checklist.html`, escolhido
  de propósito para não colidir com o nome do módulo já existente).
  - `CronogramaItensService`/`ChecklistItensService`: CRUD "apaga tudo e reinsere" por
    projeto (`salvar`), com histórico de diffs em `Modificacao`
    (`ModificacoesService`) — a comparação é **posicional** (linha 1 vs linha 1, linha 2
    vs linha 2...), igual ao Flask original; **preservada de propósito uma limitação
    conhecida**: inserir/remover uma linha no meio do plano faz todas as linhas
    seguintes aparecerem como "todo campo mudou" no histórico, em vez de detectar um
    deslocamento (documentado em `linhas-diff.util.ts`).
  - `CronogramaItensService.gerarPlanoAutomatico`: porta fielmente
    `tools/gerar_cronograma.py:_plano_automatico/_distribuir` (plano padrão de 8+
    etapas, horas distribuídas pelo método do maior resto, datas em dias úteis a cada 5
    dias a partir de `data_inicio`) + `tools/catalogo.py:resolve` (resolução de
    módulo→descrição via `tools/data/catalogo_modulos.yaml`, dado local não versionado,
    mesma convenção de `checklist_modulos.yaml`).
  - `ChecklistItensService.gerarRoteiroDoCatalogo`: **diferença deliberada do Flask
    original** — semeia a partir do catálogo `ChecklistModelo` já portado (Cadastros →
    Check List) em vez de reler `tools/data/checklist_modulos.yaml` diretamente. No
    Flask, essas duas fontes DIVERGEM (edições no catálogo do ADM nunca chegavam ao
    seed por-projeto nem ao gerador do documento) — bug real encontrado durante a
    pesquisa desta fatia, corrigido no port ao unificar a fonte.
  - Endpoints (todos sob `/projetos/:id`): `GET/POST cronograma`, `POST
    cronograma/seed`, `GET/POST checklist`, `POST checklist/seed`. **Gate aplicado a
    TODAS as rotas, diferente do Flask original**: lá, só a rota de geração do
    documento (não portada nesta fatia, ver abaixo) tinha `pode_gerar("cronograma")` —
    as rotas de edição/seed não tinham NENHUM controle de acesso além do login estar
    ativo. Deixar escrita sem gate de perfil não é comportamento a preservar por
    fidelidade; aplicado `PERFIS_GERA_CRONOGRAMA` (mesmo grupo do Flask) a todas.
  - **Escopo explicitamente cortado nesta fatia**: a GERAÇÃO do documento Cronograma
    (`.docx`, botão "Gerar documento" da tela Flask) não foi portada — a pesquisa
    revelou que o Flask original tem **três caminhos de geração concorrentes**
    (`tools/gerar_cronograma.py` gerando `.docx` a partir das linhas editadas;
    `gl_xlsx.py` preenchendo um `.xlsx` a partir das MESMAS linhas via um slug de
    documento diferente; e `runner.py` recomputando um plano do zero, ignorando
    qualquer edição, para o botão de "gerar pendentes" em lote) e que a geração do
    Check List **não lê `ChecklistItem` de jeito nenhum** — usa só o catálogo estático.
    O Monitoramento Operacional (próximo item) só precisa das LINHAS, não do
    documento gerado, então esse trabalho de geração fica registrado como pendência
    própria, não bloqueando a sequência atual.
- **Monitoramento Operacional** (`backend/src/painel/monitoramento.service.ts`) —
  equivalente a `webapp/routes_painel.py:_monitoramento_operacional`/`monitoramento`, a
  função mais complexa de todo o Flask original. **Fecha o backlog inteiro** desta
  migração de backend (ver cabeçalho). `GET /painel/monitoramento`, gate `PERFIS_GESTAO`
  (mesmo do resto do Painel).
  - Consolida a carteira visível (`soMeus`) em **8 "setores" inferidos** (Comercial/
    Administrativo/Coordenação/GCI/Consultoria/Implantação/Suporte/Desenvolvimento) —
    não são uma tabela própria, só contagens/keywords sobre projetos, gates
    (`MetricasService.gateStatus`/`camposFaltantes`), `CronogramaItem`/`ChecklistItem`
    (pendentes/atrasados/concluídos) e alertas (`MetricasService.alertas`), cada um com
    um estado (`normal`/`pendencias`/`sobrecarregado`/`aprovacao`/`espera`/`concluido`)
    calculado por limiares fixos (`estadoSetor`, ex.: `atrasadas >= 2 || pendentes >= 6
    || andamento >= 8` → sobrecarregado).
  - Score de **saúde 0-100**: começa em 100 e desconta por atrasados (até 35),
    em-risco (até 25), gate pendente (até 20) e setores sobrecarregados (até 20).
  - **Carga por colaborador**: soma horas + nº de projetos por GCI/consultor, juntando o
    que vem do campo `Projeto.gci`/`.consultor` (string bruta, separada em nomes
    individuais) com as `Designacao` do projeto (que podem ter um consultor não
    refletido no campo denormalizado do Projeto).
  - **Próximas entregas**: junta `dataLevantamento`/`dataUsoOficial` dos projetos ativos
    com as datas pendentes de `CronogramaItem`, ordenadas cronologicamente.
  - **Mapa de progresso**: % de avanço pela posição da etapa em `ETAPAS`, ordenado
    atrasado → em risco → mais alertas → nome do cliente.
  - **Quirk do Flask original preservada de propósito, encontrada ao portar**: no setor
    "Suporte", os campos `andamento` e `pendentes` recebem o MESMO valor
    (`len(suporte_pend)`) — todos os outros setores têm valores distintos para os dois.
    Não corrigido por fidelidade (documentado em teste dedicado,
    `monitoramento.service.spec.ts`).
  - O parâmetro `eventos` do `_monitoramento_operacional` original **nunca era lido
    dentro da função** (parâmetro morto) — não foi portado, nem a query que o alimentava.

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
16. **`salvarConfig` "sobrescreve o registro inteiro" não é intuitivo sem o contexto do
    Flask** (achado ao escrever o próprio teste de `DisponibilidadeService`): os três
    serviços de config baseados em arquivo desta migração (`MailerService`,
    `ImapIntakeService`, `DisponibilidadeService`) espelham fielmente
    `webapp/mailer.py:salvar_cfg` — TODOS os campos de texto são sobrescritos a cada
    chamada (menos a senha, que só muda se reenviada não-vazia), porque o Flask original
    é um formulário HTML que sempre reenvia a tela inteira. Um teste escrito assumindo
    semântica de PATCH parcial (`salvarConfig({ativo: true})` preservando `host` de uma
    chamada anterior) falhou — não porque o código estava errado, mas porque a suposição
    do teste divergia do contrato real. **Lição: ao portar um `salvar_cfg` baseado em
    formulário Flask, o contrato "reenvio do registro inteiro" é intencional e consistente
    entre todos os serviços de config desta migração — documentar isso explicitamente no
    código (não só no teste) evita a mesma suposição errada da próxima vez.**
17. **`node-oracledb` não tem o "expanding bindparam" do SQLAlchemy**: o contrato do
    SELECT de disponibilidade (`... IN :tecnicos`, documentado em
    `webapp/disponibilidade.py`) depende do SQLAlchemy expandir automaticamente um único
    bind nomeado numa lista de valores (`IN (:tecnicos_1, :tecnicos_2, ...)`). O driver
    Node não tem esse recurso — implementado à mão em
    `DisponibilidadeService.expandirTecnicos()`: substitui o token `:tecnicos` (com
    fronteira de palavra `\b`, para não casar `:tecnicos_outros` por engano) por
    `(:tecnicos_0, :tecnicos_1, ...)` e monta os binds nomeados correspondentes; lista
    vazia vira `(NULL)` (nunca casa, em vez de gerar `IN ()`, SQL inválido). Coberto por
    teste dedicado. **Lição: ao portar uma dependência de um ORM/toolkit maduro (SQLAlchemy)
    para um driver mais fino (node-oracledb), vale conferir se cada "mágica" do
    original (binds expansíveis, coerção de tipo, etc.) tem equivalente pronto ou precisa
    ser reimplementada — não é sempre 1:1.**
18. **Verificar contra o comportamento real do driver, não só contra a leitura do código
    Python, quando não dá pra testar contra o sistema externo de verdade**: como não há
    uma instância Oracle/SICLA acessível neste ambiente, `DisponibilidadeService` foi
    validado só com `oracledb` mockado (`jest.mock('oracledb', ...)`) — a normalização de
    linha (`normalizarLinha`, que baixa a caixa de toda chave antes de ler
    `tecnico`/`data`/`turno`) é uma decisão defensiva, não uma certeza: o código Python
    original tem uma inconsistência real entre `consultar()` (lê chaves em minúsculo,
    confiando que o dialeto SQLAlchemy do Oracle já normaliza) e
    `routes_dashboards.py` (que uppercasa defensivamente antes de ler, não confiando no
    driver) — os dois `.get()` diferentes sugerem que nem o autor original tinha certeza
    do case exato devolvido. **Lição, registrada explicitamente para quem for validar
    esta fatia contra o SICLA de verdade: a normalização de case dos nomes de coluna
    pode precisar de ajuste depois do primeiro teste manual contra um Oracle real — não
    foi (nem podia ser) validada nesta sessão.**
19. **`exceljs`: `actualRowCount`/`actualColumnCount` são uma CONTAGEM de linhas/colunas
    com valor, não o maior índice usado** — o parser da Matriz de Conhecimento
    (`matriz-import.util.ts`) inicialmente usava `ws.actualRowCount || ws.rowCount` para
    limitar a varredura. Como a planilha real tem as linhas 1-6 vazias (o conteúdo só
    começa na linha 7), `actualRowCount` (contagem de linhas NÃO-vazias) ficava MENOR que
    o índice da última linha de dado, truncando a varredura antes de chegar nos técnicos
    (linha 9+) — um teste sintético com esse mesmo formato (linhas vazias antes do
    conteúdo) pegou o bug antes de chegar em produção; confirmado depois contra a
    planilha real (`rowCount: 1007` vs. `actualRowCount: 114`, `columnCount: 224` vs.
    `actualColumnCount: 159`). Corrigido usando `ws.rowCount`/`ws.columnCount` (maior
    índice já tocado) em vez das variantes `actual*`. **Lição: ao portar um parser de
    planilha com cabeçalho deslocado (linhas/colunas iniciais vazias) para `exceljs`,
    usar sempre `rowCount`/`columnCount` para limites de varredura — as variantes
    `actual*` só servem para contar densidade de preenchimento, não para dimensionar um
    loop.**
20. **`QueryBuilder.where(string)` do TypeORM NÃO envolve a condição em parênteses
    automaticamente** — `UsersService.existeUsuario` combinava `.where('LOWER(login)=:l
    OR LOWER(email)=:e', ...)` com `.andWhere('id != :id', ...)` (para excluir o próprio
    registro ao editar). SQL gerado: `WHERE LOWER(login)=? OR LOWER(email)=? AND id != ?`
    — sem parênteses, `AND` tem precedência maior que `OR` em SQL, então a condição vira
    `WHERE LOWER(login)=? OR (LOWER(email)=? AND id != ?)`: um usuário editando o PRÓPRIO
    registro sempre "colidia consigo mesmo" (o primeiro termo do OR bate sozinho,
    ignorando a exclusão de id). Pego pelo teste e2e de edição (`test/usuarios.e2e-spec.ts`
    — editar um usuário sem trocar login/e-mail devolvia 409 em vez de 200); **o teste
    unitário equivalente, com o `QueryBuilder` mockado, não pegou** porque o mock de
    `getCount()` é um valor fixo, não uma simulação real do SQL gerado — só a suíte e2e
    contra um banco real expõe esse tipo de bug de geração de SQL. Corrigido envolvendo a
    condição OR em parênteses explícitos: `.where('(LOWER(login)=:l OR LOWER(email)=:e)',
    ...)`. **Lição: ao combinar `.where()` com `.andWhere()` usando strings cruas no
    TypeORM, parênteses em condições `OR` são responsabilidade de quem escreve a query —
    nunca confiar em agrupamento automático; e lembrar que testes unitários com
    `QueryBuilder` mockado não substituem um teste de integração real para esse tipo de
    bug de precedência SQL.**
21. **Duas fontes de verdade divergentes para o roteiro de Check List por módulo,
    encontradas ao pesquisar `routes_cronograma.py`**: o catálogo `ChecklistModelo`
    (tabela, editável pelo ADM em Cadastros → Check List, já portado num item anterior)
    é semeado UMA VEZ a partir de `tools/data/checklist_modulos.yaml`, mas tanto o seed
    do Check List por-projeto (`_seed_checklist`) quanto o gerador do documento Check
    List (`tools/gerar_checklist_consultor.py`) releem o MESMO arquivo YAML
    diretamente, **nunca** passando pelo catálogo em banco — uma edição do ADM no
    catálogo simplesmente não tem efeito nenhum em nenhum dos dois. **Lição: ao portar
    um catálogo "fonte única" que na verdade tem consumidores lendo de origens
    diferentes (banco vs. arquivo), decidir explicitamente qual vira a fonte real no
    port — aqui, `ChecklistItensService.gerarRoteiroDoCatalogo` foi escrito para ler do
    `ChecklistModeloService` (banco), corrigindo a divergência em vez de replicá-la; a
    escolha foi documentada explicitamente (§2) para não parecer um desvio silencioso
    de comportamento.**

## 7. Vulnerabilidades / débitos de segurança do sistema atual, tratados na conversão

- **Modo "login desabilitado = acesso total"** do Flask (quando não há usuários nem senha
  mestra cadastrados) **não foi replicado** — no novo backend, o primeiro acesso exige rodar
  o seed do ADM (`npm run seed:admin`) explicitamente.
- **Senha mestra universal que loga como ADM incondicionalmente** não existe no novo
  backend — todo login é usuário/senha real, com bcrypt (custo 12).
- Refresh tokens são **hasheados (SHA-256) antes de persistir** e podem ser revogados
  individualmente (logout real, não só descarte no cliente).
- **Rotas de edição/seed do Cronograma/Check List sem NENHUM controle de acesso** no
  Flask original (`webapp/routes_cronograma.py` — só a rota de geração de documento
  checava `pode_gerar`; editar/apagar as linhas de qualquer projeto exigia só estar
  logado, perfil nenhum) — no port, todas as rotas de
  `backend/src/plano-cronograma/*` exigem `PERFIS_GERA_CRONOGRAMA` (ADM/Coordenador/
  Administrativo/Consultor), o mesmo grupo que já gatava a geração do documento no
  original.

## 8. Pendências reais (não convertido ainda — priorizado)

Ordem sugerida para dar sequência (cada um segue o mesmo padrão: entidade TypeORM →
service → controller → tela Angular → testes):

1. ~~Agendador de Visitas~~ — **convertido** (ver §2). A lacuna de **disponibilidade
   externa (SICLA/Oracle) na distribuição automática foi fechada no item 6** (ver abaixo)
   — `DistribuicaoService` agora consulta o SICLA. Duas lacunas propositais menores
   continuam:
   - **Guard manual + indicador visual do calendário**: a distribuição AUTOMÁTICA já
     respeita o SICLA; falta portar `_slot_indisponivel` (bloqueia arrastar manualmente
     para um slot ocupado no SICLA) e o cálculo de `bloqueados` do `projeto_agenda`
     (células cinza no calendário) — puramente cosméticos/de guarda adicional, a tela já
     funciona sem eles (o pior caso é o usuário alocar manualmente por cima de um
     compromisso externo, sem aviso).
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
   lista é só o CRUD de usuários, não essa tela). ~~`fluxo_criar` não gera
   automaticamente o pacote de documentos + e-mail-resumo~~ — **fechado em 2026-07-16**,
   ver §14.
6. ~~Disponibilidade externa/Consultas BD/Dashboards~~ — **convertido**: conexão Oracle
   (`oracledb`, modo thin) + Consultas BD (CRUD + seed) + Dashboards (**motor genérico**,
   decisão tomada com o usuário — ver §2) + a checagem de disponibilidade externa ligada
   à distribuição automática do Agendador, fechando a lacuna do item 1. Lacunas
   propositais: o guard manual de alocação e o indicador visual do calendário (ver item 1
   acima); e os outros dialetos que o Flask suportava genericamente (postgresql/mysql/
   sqlserver via SQLAlchemy) não têm equivalente Node implementado — só Oracle, o único
   realmente usado neste sistema (SICLA).
7. ~~Matriz de Conhecimento~~ e ~~telas executivas~~ (`routes_painel.py`, exceto
   `monitoramento` — ver item 10) — **convertidos**: skill matrix com importador de
   planilha aditivo, `MetricasService` (motor de gates/campos obrigatórios/alertas/
   cabeçalho, novo nesta sessão — não existia em NENHUM item anterior, nem para a ficha do
   projeto), Capacidade da equipe, Painel de Coordenação, Atividade da operação e Home.
   Ver §2. **Pendência descoberta durante este item**: a ENFORCEMENT de `pode_avancar`
   (bloquear a troca de etapa em `ProjetosService.atualizar()`/`criar()` quando falta
   campo obrigatório/documento do gate/ação de entrada) não foi ligada — `MetricasService`
   só expõe a versão LEITURA (para as telas mostrarem o que falta), o caminho de escrita
   do Projeto continua sem validação de estágio, exatamente como estava nos itens 1-6.
   Fechar isso é uma mudança de comportamento do fluxo já publicado, então foi
   deliberadamente deixada fora desta fatia (decidido com o usuário) — avaliar como item
   próprio, não como parte de uma tela executiva.
8. ~~Usuários (CRUD completo), auto-cadastro com código por e-mail e a tela de
   Designação~~ — **convertido**: `UsersController` REST (`GET/POST /usuarios`,
   `PUT /usuarios/:id`, nunca devolve `senhaHash`), auto-cadastro público
   (`CadastroController` — código de 6 dígitos, 30min de expiração, 5 tentativas, cria o
   `Usuario` direto com perfil `Consultor` e já loga — sem fila de aprovação do ADM, igual
   ao Flask) e o fluxo de Designação (`DesignacaoController` —
   `definir-gci`/`agendar`/`consultores`, com os 2 gates de permissão distintos do
   processo real preservados fielmente, `email_do_usuario` portado como
   `UsersService.emailDoUsuario`, e `MetricasService.autoAvancar` como pré-requisito novo
   desta fatia). Ver §2. A rota combinada `projeto_designar` não foi portada por estar
   morta na navegação do Flask original (nenhum template linka pra ela).
9. ~~Jobs agendados (digest diário, robô de caixa)~~ — **convertido**: os robôs de
   protocolos e da caixa de entrada já tinham sido implementados como parte dos itens 4 e
   5 (`RoboProtocolosService`/`RoboCaixaService`); o digest diário (`DigestService`/
   `RoboDigestService`) fecha a lista, com o botão "enviar agora" do Painel de Coordenação
   também portado (`POST /painel/coordenacao/digest`). Ver §2.
10. ~~Monitoramento Operacional~~ — **convertido** (`backend/src/painel/
    monitoramento.service.ts`, ver §2). Fecha o backlog original inteiro de conversão do
    backend.
11. ~~Geração do documento Cronograma~~ — **convertido**. Pesquisa revelou que o Cronograma
    já era o 4º slug do sistema de "layout fiel" existente (`_LAYOUT_SLUGS = ("levantamento",
    "projeto", "cronograma", "termo")` em `webapp/routes_geracao.py`), com o modelo `.xlsx`
    já seedado no catálogo (`ModeloDocumentoService`, slug `cronograma`, tipo `xlsx`) e a
    função de preenchimento (`_preencher_cronograma_xlsx`) já copiada para
    `docservice/gerador/gl_xlsx.py` — só nunca tinha sido ligada (o shim
    `db.cronograma_do_projeto` era um stub `return []`, com comentário explícito "fica para
    a próxima fatia"). Portado: `docservice/gerador/gerar_fiel.py:gerar_xlsx()` (branch
    `else: xlsx (cronograma)` de `webapp/gerar_layout.py:gerar()`) + `db.py` shim passa a
    devolver `cronograma_itens` do contexto da requisição; `GeracaoLayoutService`/
    `DocumentosController` (NestJS) ganham o 4º slug, injetando `CronogramaItensService` e
    reaproveitando 100% da infraestrutura já existente de Levantamento/Projeto/Termo
    (`POST /projetos/:id/gerar-layout/cronograma`, mesmo evento `cronograma_ok` que o Flask
    original já dispara tanto daqui quanto do cronograma de visitas do Agendador — não é
    uma duplicação nova, é fidelidade ao `_EVT_DOC` original). Validado byte-a-byte contra
    o template real (`tools/templates/layouts/cronograma.xlsx`) em testes pytest novos
    (célula por célula: cliente, consultor, horas cobradas/bonificadas, linhas da tabela)
    e um teste e2e NestJS novo (payload + evento). **Decisão de escopo (Check List não
    portado)**: diferente do Cronograma, o Check List NUNCA teve um botão de geração
    per-projeto no Flask original ligado a `ChecklistItem` — `routes_cronograma.py` só
    registra `GET/POST checklist` e `checklist/seed`, sem nenhuma rota `/checklist/gerar`;
    a única geração de Check List existente (`gerar_checklist_consultor`, via
    `runner.gerar_do_projeto`/`gerar_checklist_form`) sempre leu o catálogo estático de
    módulos contratados, nunca as linhas editadas. Não havia, portanto, um comportamento
    real do Flask a portar aqui — inventar um novo botão de geração do Check List seria uma
    funcionalidade nova, não uma conversão fiel, e ficou fora desta fatia.

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
   440/440 testes passando (310 unitários + 130 e2e), incluindo as suítes dedicadas do
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
   CNPJ, e a notificação automática de `encerrado` ao mudar a situação do projeto), de
   Disponibilidade/Consultas BD/Dashboards (`test/disponibilidade-dashboards.e2e-spec.ts`
   — Oracle mockado na fronteira de rede (`jest.mock('oracledb', ...)`), controle de
   acesso ADM-only/gestão, CRUD de consultas nomeadas, motor de dashboard genérico rodando
   de ponta a ponta), de Matriz de Conhecimento (`test/matriz.e2e-spec.ts` — permissões
   ADM/Administrativo-Coordenador/Consultor-GCI, importação da planilha com resultado
   tolerante à ausência do arquivo local) e de Painel (`test/painel.e2e-spec.ts` — gate
   único de gestão em `/painel/coordenacao`/`/coordenacao/capacidade`/`/atividade`, Home
   sem gate, filtro de visibilidade `_so_meus` refletido nos KPIs) e testes unitários
   dedicados de `DistribuicaoService` para a nova checagem de disponibilidade externa
   (modo conjunta/individual, fail-open em falha de conexão), de `MetricasService` (motor
   de gates/campos obrigatórios/alertas/cabeçalho, novo nesta sessão — ver §2 item 7), de
   `CapacidadeService`/`CoordenacaoService`/`AtividadeService`/`HomeService`, do parser da
   planilha da Matriz (`matriz-import.util.spec.ts`, com um caso de forward-fill de área e
   clamp de nota), de Usuários (`test/usuarios.e2e-spec.ts` — CRUD ADM-only,
   `senhaHash` nunca exposta, senha preservada/alterada conforme enviada ou não na edição;
   pegou o bug de precedência SQL do §6 item 20), de Auto-cadastro
   (`test/cadastro.e2e-spec.ts` — fluxo feliz completo com login imediato, e-mail
   duplicado, código errado incrementando tentativas, reenvio) e de Designação
   (`test/designacao.e2e-spec.ts` — os 2 gates de permissão distintos, notificação e
   auto-avanço de etapa em cada uma das 3 telas; `MailerService` trocado por um fake via
   `overrideProvider`, mesmo padrão já usado em `protocolos.e2e-spec.ts`), de
   `DigestService`/`RoboDigestService` (parsing de destinatários, corpo do resumo com/sem
   alertas, hora configurável, "só uma vez por dia", e o endpoint manual coberto em
   `test/painel.e2e-spec.ts`), das linhas editáveis de Cronograma/Check List
   (`test/plano-cronograma.e2e-spec.ts` — gate único aplicado a todas as rotas, seed do
   plano automático com datas em dias úteis reais, seed do roteiro a partir do catálogo
   `ChecklistModelo`, histórico de diffs acumulado entre seed e edição; unitários
   dedicados de `linhas-diff.util` — incluindo um teste que documenta a quirk da
   comparação posicional preservada de propósito —, `catalogo-modulos.util`,
   `datas-plano.util` e do algoritmo `_distribuir`/`_plano_automatico` em
   `cronograma-itens.service.spec.ts`), do Monitoramento Operacional
   (`test/painel.e2e-spec.ts` — gate de gestão, mapa/carteira filtrados por `soMeus`;
   unitários dedicados de `monitoramento.util` e de `monitoramento.service.spec.ts`
   cobrindo os 8 setores, o score de saúde, a ordenação do mapa, entregas, carga por
   colaborador e a quirk do setor Suporte preservada de propósito) e o teste unitário de
   `ProjetosService.excluir()` que garante a limpeza dos 5 módulos com dado por-projeto
   (Cronograma, Designações, Levantamento-resposta, DocConteudo, Documentos/Eventos —
   ver §6 item 9). Suíte e2e validada estável em múltiplas execuções consecutivas
   (inclusive repetindo cada spec novo isoladamente, para pegar corridas de
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
   enviar). **Disponibilidade externa/Consultas BD/Dashboards: nenhuma consulta rodou
   contra um Oracle/SICLA real nesta sessão** — não há instância acessível neste
   ambiente. Todos os testes (unitários e e2e) mockam `oracledb.getConnection` na
   fronteira de rede; a orquestração (config em disco, expansão de `:tecnicos`,
   tradução de erro DPY-3015/DPI-1047, cache com TTL, motor de dashboard) foi validada de
   ponta a ponta contra esse mock, mas **a normalização de case das colunas devolvidas
   pelo driver real (ver §6 item 18) e os textos exatos de erro do `oracledb` Node
   (DPY-3015 é um código do driver Python — o Node pode usar prefixos diferentes, ver
   comentário em `DisponibilidadeService.mensagemErro`) não puderam ser confirmados.**
   Antes de usar em produção: rodar `testar()` (Config → Disponibilidade) contra o SICLA
   de verdade e ajustar `mensagemErro`/`normalizarLinha` conforme o comportamento real
   observado. **Matriz de Conhecimento: o importador (`exceljs`) foi validado
   estruturalmente contra a planilha real do time** (`docs/Matriz de Conhecimento.xlsx`,
   local/não versionada) — confirmando o layout esperado (linha 7 = áreas, linha 8 =
   cabeçalhos, linha 9+ = técnicos) e revelando, ainda nesta sessão, o bug de
   `actualRowCount`/`actualColumnCount` descrito no §6 antes que chegasse a produção;
   **nenhum dado de nota individual foi lido ou exibido** neste processo (só
   contagens/metadados de estrutura), por ser dado de avaliação de pessoas. Nenhuma
   importação real foi persistida em um banco de produção nesta sessão — só contra SQLite
   de teste. **Monitoramento Operacional não foi convertido** (ver §8) — não se aplica
   validação aqui. **Usuários/Auto-cadastro/Designação: os e-mails de notificação (código
   de verificação, GCI/consultor designado) rodaram contra um `MailerService` trocado por
   um fake (`overrideProvider`), não contra um transporte SMTP/Gmail real nesta sessão** —
   mesma limitação de ambiente já registrada para o item de E-mail/IMAP/Gmail acima
   (nenhuma instância de e-mail real disponível neste ambiente). A geração do código de
   6 dígitos, sua expiração/lockout e o texto de cada e-mail foram validados; o envio de
   verdade (chegou na caixa de entrada, formatação correta em clientes de e-mail reais)
   não foi. **Linhas editáveis do Cronograma/Check List: `gerarPlanoAutomatico` foi
   validado com datas reais** (2026-08-10 é segunda-feira; testes conferem os +5 dias
   úteis exatos) **e contra o arquivo real `tools/data/catalogo_modulos.yaml`** (mesma
   estrutura `{codigo, abrev, descricao, area}` usada em produção); o seed do Check List
   foi validado contra o catálogo `ChecklistModelo` (banco), não contra o
   `checklist_modulos.yaml` bruto — ver a divergência de fontes documentada no §6 item
   21. Nenhuma linha foi gerada/testada contra um projeto real de produção nesta sessão
   — só dados sintéticos de teste. **Monitoramento Operacional: os 8 "setores" e o score
   de saúde foram validados contra cenários sintéticos cobrindo cada estado possível**
   (`normal`/`pendencias`/`sobrecarregado`/`aprovacao`/`espera`/`concluido`), mas nunca
   contra a carteira real de clientes em produção — os limiares fixos (ex.: `atrasadas >=
   2` para "sobrecarregado") vieram direto do Flask original sem ajuste; recomenda-se
   observar se fazem sentido na prática antes de divulgar o score de saúde como métrica
   oficial para a Coordenação.

## 13. Frontend Angular — as 11 telas do backlog + Documentos oficiais

Sessão seguinte à conversão do backend (§§1-12 acima): construção de TODAS as telas
Angular que ainda não existiam para as features já portadas ao NestJS, "1 a 1" (um commit
por tela/grupo de telas, com build + suíte + smoke test ao vivo contra o backend real
antes de cada commit) — Home, guard de perfil (`perfilGuard`, novo — não existia
equivalente client-side antes), Usuários (CRUD), auto-cadastro público, Designação
(definir-gci/agendar/consultores), Cronograma/Check List editáveis (tabela com
adicionar/remover/reordenar linha + seed + histórico), Matriz de Conhecimento (lista +
ficha + importar planilha), Painel de Coordenação + Capacidade da equipe, Atividade da
operação + Centro de Monitoramento Operacional (a tela mais densa), e Config →
Disponibilidade/Consultas BD/Dashboards (5 componentes). Cada tela foi validada por
componente-spec (Vitest/TestBed, mockando o service injetado) **e** por chamada `curl`
real contra um backend rodando de verdade (login real, dados reais criados via API),
comparando byte a byte a resposta JSON com o modelo TypeScript do frontend — sem
ferramenta de navegador disponível neste ambiente, essa combinação (build limpo + specs +
contrato validado ao vivo) foi o teste mais forte possível; **nenhuma tela foi vista
rodando visualmente num navegador real** (mesma limitação já registrada no §12 desta
sessão anterior — recomenda-se abrir `http://localhost:4200` manualmente antes de
considerar qualquer tela pronta do ponto de vista de UX/interação).

Na sequência, fechada a última pendência real do backend (§8 item 11 — geração do
Cronograma) e construída uma primeira tela de geração de documentos
(`DocumentosProjetoComponent`, `/projetos/:id/documentos`) — que faltava para TODOS os 4
slugs (Levantamento/Projeto/Cronograma/Termo), não só o novo. Ver §8 item 11 para o
detalhe técnico da geração do Cronograma. **Componente depois excluído** (sessão de
2026-07-16, ver §14): não existia página equivalente no Flask (`projeto_ficha.html` gera
cada documento inline, por botão, dentro da própria ficha, não numa tela à parte) — ao
espelhar a ficha com fidelidade 1:1 nessa sessão seguinte, os botões de geração migraram
para dentro de `ProjetoFormComponent` (mesmo lugar do Flask) e a tela avulsa deixou de ter
propósito.

**Pendências reais que sobram fora deste documento** (não fazem parte do backlog de
conversão de funcionalidade, são passos de entrega separados):

- ~~Script de migração de dados~~ — **pronto e já rodado com sucesso contra a produção
  real (2026-07-15)**: `backend/src/database/seeds/migrar-legado.ts`
  (`npm run migrar:legado`), as 25 tabelas do Postgres de produção do Flask → schema
  novo, com reset de senha obrigatório (hash incompatível — `werkzeug.security` vs.
  `bcrypt`, ver §9), dry-run por padrão, idempotente (upsert por id/slug conforme a
  tabela) e nunca escreve na origem. Testado ponta a ponta contra dois Postgres
  descartáveis em Docker antes de tocar produção — dois bugs reais encontrados e
  corrigidos nessa bateria: duplicação em reruns (`modelos_documento_versoes`/`campos`
  sem `id` preservado) e, mais grave, um bug de preservação de `id` que o TypeORM
  esconde silenciosamente para QUALQUER coluna `@PrimaryGeneratedColumn()` (`repository
  .save()` nunca escreve o `id` explícito no INSERT, mesmo setado no objeto) — só
  apareceu com o projeto real de produção (id 174, não sequencial) e corrompeu
  ~1150 linhas filhas órfãs no primeiro destino; corrigido com um helper de upsert por
  SQL bruto e revalidado antes de remigrar. Runbook operacional completo (o que migra, o
  que fica de fora, como rodar, como tratar arquivos físicos e senhas temporárias, e o
  writeup completo dos dois bugs) em
  [04-procedimento-migracao-dados.md](04-procedimento-migracao-dados.md). **Falta**:
  distribuir com segurança e apagar `dados/migracao-senhas-temporarias.csv`; e, no dia
  da virada, rodar de novo (`--continuar`) para capturar o que mudou na produção desde
  2026-07-15 — ver [05-plano-de-virada.md](05-plano-de-virada.md).
- **Merge para `main` / virada de produção** — decisão de negócio de alto risco (sistema
  real em uso pelo time de implantação), não deve ser feita sem confirmação explícita e
  fora do escopo de uma sessão de codificação autônoma; ver §10 (procedimento de
  rollback — nada em produção foi tocado até aqui).

## 14. Sessão seguinte — fecha as lacunas de tela que restavam (2026-07-16)

Depois de §13, um levantamento tela-a-tela contra os 51 templates reais de
`webapp/templates/` (excluindo `base.html`/`_ctx_projeto.html`, que são partials)
encontrou 10 telas sem nenhum equivalente Angular e uma pré-visualização de documento
(`doc_view.html`) que dependia de uma capacidade ainda não portada. Todas fechadas nesta
sessão — **as 51 telas do Flask agora têm equivalente Angular**. Resumo:

- **Perfil, Mapa mental do setor, Config → Modelos de E-mail (lista+form), Agenda →
  Acompanhamento, Levantamento (respostas do Índice de Tópicos), Doc editar
  (`doc-conteudo`), Protocolos de Treinamento (lista+ficha), Projeto origem (seleção de
  fonte da geração)** — só frontend, contra endpoints NestJS que já existiam. Mapa mental
  é dado 100% estático (sem tabela no banco, igual ao Flask); "Projeto origem" nasceu
  expondo só as fontes "tela" e "modelo em branco" — "levantamento importado"/"importar
  .docx agora" foram fechadas depois, ver §15.
- **Fluxo / Novo Projeto** (`fluxo.html`+`fluxo_confirmar.html`) — frontend novo +
  `FluxoService.criarComPacote` (backend, método novo — `criarDeCampos`/
  `criarDeFechamento`, usados pelo robô da caixa, não foram alterados): gera o pacote
  inicial (Mapeamento + Cronograma, via `GeracaoLayoutService`) e envia o e-mail-resumo
  com anexos (via `MailerService`), fechando a lacuna do §8 item 5/§2. O "Check List" do
  pacote inicial nasceu sem o gerador legado ligado — fechado depois, ver §15.
- **Projeto e-mail** (`projeto_email.html`, `/projetos/:id/email`) — endpoint novo:
  `ProjetoEmailController`/`ProjetoEmailService` (em `backend/src/fluxo/`, mesmo módulo
  fonte do Flask original — `routes_fluxo.py` já agrupava fluxo de fechamento + e-mail
  avulso por projeto no mesmo arquivo), reaproveitando `ModeloEmailService.renderizar()` +
  `MailerService.enviar()`, sem gate de perfil (igual ao Flask — qualquer autenticado
  envia).
- **Assistente administrativo legado** (`cliente.html`, `role.html`,
  `selecao_modulos.html`, `criar_templates.html`, `verbal.html`, `saude.html`,
  `action.html`) — ferramenta interna de QA/suporte para testar os geradores Office
  originais (`tools/gerar_*.py`, `catalogo.py`, `conversor_verbal.py`,
  `importar_mapeamento.py`), sem link nenhum no `base.html` do Flask (só alcançável
  digitando a URL — por isso ganhou um índice novo em `/legado` para ficar navegável).
  **Decisão de arquitetura importante**: em vez de estender o `docservice` (cujo escopo
  documentado em [02-decisao-arquitetura.md](02-decisao-arquitetura.md) é só geração fiel
  e transcrição), foi criada uma ponte de SUBPROCESSO isolada —
  `backend/src/legado/legado-cli.service.ts` chama `webapp/legado_cli.py` (novo, só
  encaixe de entrada/saída em JSON) via `child_process.spawn`, que por sua vez importa
  `webapp/runner.py`/`roles.py`/`forms.py` **tal como são**, sem reescrever nenhuma lógica
  de geração. `LegadoDownloadRegistry` (token opaco → caminho de arquivo, em memória)
  evita expor caminho de disco ao cliente. Catálogo de papéis (`roles.py`, estático)
  hardcoded em `frontend/.../legado.model.ts`, mesmo padrão do Mapa mental. 7 componentes
  Angular novos (`features/legado/`).
- **Pré-visualização de documento** (`doc_view.html`) — fechava a única lacuna real
  restante. `webapp/docview.py` copiado (não importado, mesma convenção do `gl_*.py`) para
  `docservice/docview.py`: `.docx` tenta conversão fiel para PDF via Word COM (`pywin32`,
  instalado no venv do docservice), com fallback em HTML; `.xlsx` sempre HTML. Endpoint
  novo `POST /preview` no docservice; `GeracaoDocumentosService.preview()` +
  `GET /documentos/:id/preview` no NestJS (devolve o PDF binário direto ou
  `{tipo:'html', html}`); `DocPreviewComponent` no Angular busca o PDF como blob
  autenticado (mesmo padrão do player de vídeo de Protocolos) e mostra num iframe, ou
  renderiza o HTML numa "folha A4" (`.folha`, movida para `styles.css` global — CSS
  aplicado via `[innerHTML]` não recebe o atributo de encapsulamento do Angular, então
  precisa ser global, não scoped ao componente).

**Validação**: build+typecheck limpos e suíte completa passando nos três stacks a cada
tela (docservice: pytest; backend: Jest; frontend: Vitest) — mesma disciplina das sessões
anteriores. Continua valendo a limitação de §13: **nenhuma tela nova foi vista rodando
num navegador real**: essa validação, e o restante do checklist operacional (Fases 1-6),
seguem em [05-plano-de-virada.md](05-plano-de-virada.md).

**Limitações propositais registradas no fim desta sessão** (o gerador legado de Check
List no pacote do Fluxo, e "importar levantamento .docx"/"importar .docx agora" em
Projeto origem) — **fechadas na sessão seguinte, mesmo dia**, ver §15.

## 15. Sessão seguinte — as 2 lacunas de código que restavam do §14 (2026-07-16)

Reaproveitando a mesma ponte de subprocesso do assistente administrativo legado
(`LegadoCliService`/`webapp/legado_cli.py`, ver §14), sem estender o `docservice` (mesmo
motivo arquitetural).

- **Check List no pacote inicial do Fluxo**: nova ação `gerar_do_projeto` no
  `legado_cli.py` (porta `runner.gerar_do_projeto(proj, tipo)` — usa só `cliente` +
  `modulos`, mais simples que `gerar_checklist_form`, que é a função usada pelo
  assistente administrativo para outro fluxo). `FluxoService.criarComPacote` passou a
  injetar `LegadoCliService` (via `FluxoModule` importando `LegadoModule`, que agora
  exporta `LegadoCliService`) e, quando `checklist` está entre os tipos pedidos, chama
  `gerar_do_projeto` e lê o arquivo do disco (`readFileSync`) para anexar — os outros
  tipos (`levantamento`/`cronograma`) continuam pela "layout fiel" nova, sem mudança.
  Default do pacote agora é `['levantamento', 'checklist', 'cronograma']`, igual ao Flask
  original.
- **Importar Levantamento (.docx) em Projeto origem**: nova ação `docx_paragrafos` no
  `legado_cli.py` — só EXTRAI o texto dos parágrafos do `.docx` (não toca em banco
  nenhum, nem o antigo nem o novo). O casamento tópico→resposta
  (`webapp/db.py:levantamento_importar_respostas`, a função `_depois`) foi reescrito em
  TypeScript puro — `LevantamentoRespostaService.importarDeParagrafos()` — porque essa
  parte só faz sentido operando nas linhas do `LevantamentoResposta` do schema NOVO
  (deixar o Python tocar ali violaria a mesma regra de isolamento de banco que já vale
  para o `docservice`). Endpoint novo em `DocumentosController` (não em
  `LevantamentoController`, para não criar um import circular
  `DocumentosModule`↔`LevantamentoModule` — mesma lição do §6 item 13):
  `POST /projetos/:projetoId/projeto/importar-levantamento` (multipart, arquivo
  opcional — com arquivo replica a fonte "importar" do Flask, sem arquivo reusa o último
  Levantamento importado, replicando a fonte "importado"; 422 se nenhum dos dois existir)
  e `GET /projetos/:projetoId/projeto/origem` (expõe se há um Levantamento importado, pro
  Angular decidir se mostra o card "Usar o Levantamento importado"). Resposta: o `.docx`
  do Projeto gerado direto (mesmo padrão de `gerar-layout`), com o número de respostas
  importadas no header `X-Respostas-Importadas`.

**Validação**: 8 testes novos para `importarDeParagrafos` (maiúsculas/minúsculas,
separadores, placeholder `<...>` do modelo em branco, não sobrescreve resposta já
preenchida) + suíte completa (docservice/backend/frontend) passando. Nenhuma lacuna de
código conhecida ficou registrada no fim desta sessão.
