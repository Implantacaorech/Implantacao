# Painel de Implantação — Documentação do Sistema

> Aplicação web (Flask) que conduz, controla e automatiza a implantação do ERP **SIGER®**
> na Rech Informática. Centraliza a carteira de projetos por cliente, o fluxo de etapas,
> a geração fiel de documentos, o agendamento de visitas e o monitoramento da operação.
>
> Versão do app: **1.1 · jun/2026** · Repositório: `Implantacaorech/Implantacao` ·
> Documento gerado a partir do código-fonte (`webapp/`).

---

## Índice

1. [Visão geral](#1-visão-geral)
2. [Como executar](#2-como-executar)
3. [Perfis de acesso e permissões](#3-perfis-de-acesso-e-permissões)
4. [O fluxo de implantação (6 etapas)](#4-o-fluxo-de-implantação-6-etapas)
5. [Recursos entregues](#5-recursos-entregues)
6. [Documentos gerados](#6-documentos-gerados)
7. [Automações](#7-automações)
8. [Notificações por e-mail](#8-notificações-por-e-mail)
9. [Cadastros de referência](#9-cadastros-de-referência)
10. [Configurações](#10-configurações)
11. [Segurança](#11-segurança)
12. [Persistência (banco de dados)](#12-persistência-banco-de-dados)
13. [Arquitetura de código](#13-arquitetura-de-código)
14. [Mapa de telas (rotas)](#14-mapa-de-telas-rotas)
15. [Qualidade (testes)](#15-qualidade-testes)

---

## 1. Visão geral

O Painel de Implantação substitui planilhas e e-mails soltos por um **hub único por cliente**.
Cada cliente vira um **Projeto** que percorre 6 etapas controladas por *gates* de qualidade
(documentos e ações obrigatórias). O sistema entrega, em um só lugar:

- **Carteira de projetos** com cabeçalho de fase, atrasos e alertas.
- **Fluxo guiado** etapa a etapa, com avanço automático quando os requisitos são cumpridos.
- **Geração fiel de documentos** (.docx/.xlsx) a partir dos layouts oficiais cadastrados.
- **Levantamento respondido em tela**, que alimenta o Projeto sem redigitação.
- **Agendador de visitas** (calendário por dia/turno, arrastar-e-soltar).
- **Disponibilidade dos consultores** consultada de uma base externa.
- **Monitoramento operacional** por setor + visão executiva.
- **Automação por e-mail**: abertura por e-mail de fechamento, notificações de evento e
  resumo diário.

Públicos: **Coordenação**, **Setor Administrativo**, **GCI** (Consultor de Implantação que
faz o Levantamento) e **Consultores** da implantação.

---

## 2. Como executar

Roda **a partir do código-fonte** (não há .exe). Servidor de produção: **waitress**.

```bat
:: a partir da pasta Implantacao
Iniciar_Servidor.bat        :: ou: python webapp\app.py
```

- URL padrão: **http://127.0.0.1:5000**
- `PAINEL_HOST` / `PAINEL_PORT` controlam endereço e porta (use `0.0.0.0` para servir à rede interna).
- Ao subir em localhost, abre o navegador automaticamente.
- Threads de fundo (digest diário e robô da caixa) iniciam sozinhas quando configuradas.

| Variável | Função |
|---|---|
| `PAINEL_DB_URL` | URL SQLAlchemy (ex.: PostgreSQL). Se ausente, usa SQLite. |
| `PAINEL_DB` | Caminho do arquivo SQLite (padrão: `painel.db` na pasta gravável). |
| `PAINEL_HOST` / `PAINEL_PORT` | Endereço/porta (padrão `127.0.0.1:5000`). |
| `PAINEL_SENHA` | Senha mestra de 1º acesso (break-glass). |
| `DIGEST_PARA` / `DIGEST_HORA` | Destinatários e hora do resumo diário. |
| `IMAP_POLL_MIN` | Intervalo do robô da caixa (min). |

---

## 3. Perfis de acesso e permissões

Cinco perfis (`PERFIS`): **ADM**, **Coordenador**, **Administrativo**, **GCI**, **Consultor**.

### Visibilidade de áreas

| Área do menu | Quem vê |
|---|---|
| **gestao** (Coordenação, Atividade, Monitoramento) | ADM · Coordenador · Administrativo · GCI |
| **sistema** (Cadastros, Usuários, Configurações, Mapa) | só **ADM** |

### Quem faz o quê

| Ação | Perfis autorizados |
|---|---|
| **Designar** GCI/Consultores | ADM · Coordenador · Administrativo |
| **Gerar** Levantamento / Projeto | ADM · Coordenador · Administrativo · GCI |
| **Gerar** Cronograma / Check-list | ADM · Coordenador · Administrativo · Consultor |

### Visão filtrada por perfil ("só meus")

- **ADM / Coordenador / Administrativo** → veem todos os projetos.
- **GCI** → vê os projetos onde é o GCI.
- **Consultor** → vê os projetos onde é consultor designado.

> Sem login configurado (nenhum usuário e sem senha mestra), o acesso é total — modo
> "instalação inicial". Assim que existir usuário ou `PAINEL_SENHA`, o login passa a ser exigido.

---

## 4. O fluxo de implantação (6 etapas)

Etapas (`ETAPAS`), em ordem:

1. **Agendamento**
2. **Levantamento**
3. **Projeto**
4. **Designação**
5. **Cronograma e Check-list**
6. **Encerramento**

Situações (`SITUACOES`): **Em andamento · Em risco · Pausado · Concluído**.

### Gates — o que cada etapa exige

Os *gates* impedem o avanço enquanto faltarem **documentos** e/ou **ações** obrigatórias.
A tríade obrigatória (Projeto · Cronograma · Termo) é acumulativa.

| Etapa | Documentos exigidos (acumulativo) | Ação obrigatória para entrar |
|---|---|---|
| Agendamento | — | — |
| Levantamento | — | **GCI definido + Data do Levantamento** (sequenciais) |
| Projeto | Levantamento | — |
| Designação | Levantamento, Projeto | **Designar Consultores por módulo** |
| Cronograma e Check-list | Levantamento, Projeto | **Consultores designados** |
| Encerramento | Levantamento, Projeto, Cronograma, Check-list | — |

### Campos obrigatórios por etapa

Cada etapa cobra um conjunto de campos da ficha (bloqueiam o avanço manual se vazios). Ex.:
Agendamento/Levantamento exigem `cliente, cnpj, nº do projeto, módulos, horas, GCI, data do levantamento`;
Designação em diante passam a exigir `consultor` e `go-live previsto`.

---

## 5. Recursos entregues

### 5.1 Visão geral (Home `/`)
Painel de entrada com os indicadores do dia (ativos, no prazo, atrasados, em risco, gate
pendente), a lista de **pendências priorizadas** (atrasos no topo) com botão de ação direta
(Definir GCI, Definir data, Designar, Gerar, Avançar) e o **projeto em foco** (o mais recente).

### 5.2 Carteira de projetos (`/projetos`)
Lista de todos os projetos (filtrada por perfil) com etapa e situação, ordenada por
atualização. Ponto de partida para abrir a ficha.

### 5.3 Ficha do projeto (`/projetos/<id>`)
Tela central de cada cliente: dados cadastrais, cabeçalho de fase com atraso, *gate* da
etapa atual (o que falta), documentos anexados, linha do tempo de eventos, e ações
contextuais (gerar pendentes, anexar, nota, avançar, excluir). Inclui:
- **Gerar pendentes** — gera de uma vez os documentos da fase que faltam (respeitando perfil e etapa).
- **Anexar** documento manualmente (para satisfazer o gate).
- **Excluir documento gerado** (para regerar), **respeitando o fluxo**: um documento só pode ser
  excluído se nenhum documento posterior existir (ex.: exclua o Projeto antes do Levantamento);
  a cadeia é `levantamento < projeto < cronograma/checklist < termo`.
- **Nota** — registro livre na timeline.
- **Avançar** etapa manualmente (com checagem de campos obrigatórios).

### 5.4 Levantamento em tela (`/projetos/<id>/levantamento`)
As perguntas do **Índice de Tópicos** dos módulos contratados viram um formulário, agrupado
por área (como no documento). As respostas são salvas e **alimentam o Projeto** sem redigitar.

### 5.5 Gate de origem do Projeto (`/projetos/<id>/projeto/origem`)
O Projeto **nasce do Levantamento**. A tela oferece três origens:
- **Dados em tela** — usa as respostas preenchidas no painel;
- **Levantamento importado (.docx)** — importa um documento e extrai as respostas;
- **Modelo manual** — gera um Projeto pré-preenchido pelos cadastros/Índice, para completar à mão.

### 5.6 Geração fiel de documentos
Os documentos de fase são gerados **fielmente pelos layouts oficiais cadastrados** (troca só
os marcadores/placeholders, preservando o template Rech). Atalhos:
- `/projetos/<id>/gerar/<tipo>` — gera respeitando o gate de etapa;
- `/projetos/<id>/gerar-layout/<slug>` — gera pelo layout vigente, independente da fase;
- O **Projeto** sempre passa pelo gate de origem (5.5).

### 5.7 Cronograma e Check-list editáveis
Planos em tabela editável, com histórico de modificações:
- **Cronograma** (`/projetos/<id>/cronograma`) — agendas (etapa, tópicos, horas, data,
  modalidade, status). Botão **seed** carrega o plano automático; botão **gerar** produz o `.xlsx`.
- **Check-list** (`/projetos/<id>/checklist`) — roteiro dos módulos contratados (item, responsável, status, obs),
  com **seed** a partir do catálogo.

### 5.8 Agendador de Visitas (`/agenda`)
Calendário das visitas de implantação por **dia** e **turno** (manhã/tarde), com
**arrastar-e-soltar**. As visitas derivam da **sequência** do Check-list (coluna de sequência =
nº da visita; módulo = sigla). Recursos:
- **Alocar** uma visita ou **o bloco inteiro** da visita num dia/turno;
- **Técnico por módulo** (central) que sincroniza a Designação;
- **Horário global por turno** (padrão manhã 08:00–12:00, tarde 13:00–17:00);
- **Status** de cada agenda: *Solicitada · Agendada · Realizada · Não Realizada · Postergada · Cancelada*,
  com filtros e contadores;
- **Postergar** cria uma **nova ocorrência** (a original vira histórico);
- **Acompanhamento** (`/agenda/acompanhamento`) — visão de status e ocupação;
- **Gerar** a agenda em `.xlsx`.

### 5.9 Disponibilidade dos consultores
Cruza o calendário com a **ocupação real** dos técnicos, lida de uma **base externa**
(conexão + SELECT configuráveis pelo ADM). Bloqueia dias/turnos em que os técnicos
envolvidos estão ocupados, com dois modos: **análise conjunta** (todos livres) e
**análise individual** (por técnico).

O vínculo entre o consultor do painel e a sua agenda é feito pelo **Código SICLA** do
cadastro de usuário: a coluna `tecnico` do SELECT deve trazer esse código. Na **montagem do
cronograma**, a alocação de uma visita só é aceita em **dias/turnos livres** e **de hoje em
diante** — datas passadas e slots ocupados são recusados (no calendário e no servidor).

### 5.10 Agendamento e Designação
- **Definir GCI** (`/projetos/<id>/definir_gci`) — etapa 1 do Agendamento; aceita mais de um GCI.
- **Agendar** (`/projetos/<id>/agendar`) — etapa 2; define a **data do Levantamento**, notifica
  os GCIs e avança para Levantamento.
- **Designar** (`/projetos/<id>/designar`) — GCI + consultores por módulo de uma vez (com e-mail);
  ao definir o GCI, **gera o Levantamento automaticamente** para ele preencher.
- **Consultores** (`/projetos/<id>/consultores`) — o GCI designa os consultores da implantação
  por módulo e os avisa por e-mail.

### 5.11 Coordenação e monitoramento
- **Coordenação** (`/coordenacao`) — métricas e alertas da carteira, com botão de envio do digest.
- **Atividade** (`/atividade`) — feed cronológico de eventos, métricas de uso e funil macro.
- **Monitoramento operacional** (`/monitoramento`) — visão executiva por **setor**
  (Comercial, Administrativo, Coordenação, GCI, Consultoria, Implantação, Suporte,
  Desenvolvimento) com estado (normal/sobrecarregado/pendências/…), saúde geral (0–100),
  carga por colaborador, próximas entregas e mapa de projetos.

### 5.12 E-mail por projeto (`/projetos/<id>/email`)
Envio de e-mail ao contato do cliente usando **modelos** cadastrados (assunto/corpo com
variáveis preenchidas com os dados do projeto). Registra o envio na timeline.

### 5.13 Fluxo de fechamento (`/fluxo`)
Início do processo a partir do **e-mail de fechamento do Comercial**:
- **Colar** o texto do e-mail ou **buscar na caixa** (IMAP);
- Confirmar os dados extraídos e **criar a ficha** já gerando os documentos iniciais
  (Levantamento, Check-list, Cronograma) e enviando o pacote aos responsáveis.

### 5.14 Mapa mental do setor (`/mapa`)
Visão em árvore de papéis, fases, itens de qualidade e convenções da implantação SIGER.

### 5.15 Pré-visualização de documentos (`/projetos/<id>/doc/<id>/ver`)
Mostra o documento gerado na tela, só leitura. Para `.docx`, exibe um **espelho fiel** — o próprio
documento renderizado em **PDF pelo Word** (layout, quebras de linha e formatação idênticos),
convertido em segundo plano e **cacheado** (rápido a partir do 2º acesso). Sem Word disponível ou
para `.xlsx`, cai numa visualização HTML do conteúdo. O arquivo oficial continua sendo o do "Baixar".

### 5.16 Papéis / Ferramentas (`/papel/<id>` · `/acao/...`)
Atalhos por papel (Coordenação, Setor Adm, Consultor) para ferramentas de apoio:
- **Saúde do sistema** (verificador);
- **Criação de templates** (Termo + Mapeamento em uma tela);
- **Importar Levantamento → tudo** (gera Projeto, Check-list e Termo em sequência);
- **Tempo verbal e ortografia** (Presente→Futuro + correção, offline).

### 5.17 Protocolos de Treinamento (`/protocolos`) — vídeos/áudios → base de conhecimento
Transforma **vídeos ou áudios de treinamento** (o Whisper transcreve ambos — vídeo
`.mp4/.mkv/.mov/...` ou áudio `.mp3/.wav/.m4a/.ogg/.opus/.flac/...`) em **registros de
protocolo** revisáveis:
- **Entrada:** upload manual na tela OU o **robô da pasta do SharePoint** (sincronizada pelo
  OneDrive): `PortalImplantacao/Treinamentos/Videos Pendentes` → após processar, o vídeo vai
  para `Videos Processados` (ou `Videos Com Erro`). Dedup por hash (não processa 2×).
- **Transcrição local** (faster-whisper, CPU, subprocesso isolado — o áudio não sai da rede),
  com timestamps por bloco de fala.
- **Análise IA** (Claude, mesma chave do Config → IA): identifica título, **módulo**, **menu**,
  resumo, objetivo, quando utilizar, pré-requisitos, **passo a passo numerado**, configurações,
  dependências, regras de negócio, pontos de atenção e exemplos. **Remove** conversas paralelas
  e assuntos irrelevantes, **listando-os para auditoria**; nunca inventa (`Módulo a validar`,
  `Menu não identificado - revisar manualmente`, `Informação não detalhada no vídeo`).
- **Revisão humana:** tela com o vídeo (player), a transcrição completa, todos os campos
  editáveis, pendências destacadas, histórico e decisão (**Aprovar e publicar** /
  **Reprovar / Ajustar** — ADM/Coordenador).
- **Consulta (base de conhecimento):** filtros por módulo, menu, status, origem e palavra-chave
  (busca em resumo, passo a passo, configurações, regras e dependências).
- Config: `PROTOCOLOS_DIR` (pasta raiz), `PROTOCOLOS_POLL_MIN` (robô, padrão 10 min),
  `PROTOCOLOS_WHISPER` (modelo, padrão `base` — rápido; use `small`/`medium` p/ mais
  precisão) e `PROTOCOLOS_THREADS` (0 = automático/todos os núcleos, o mais rápido).

### 5.18 Autocadastro e usuários
- **Autocadastro** (`/cadastro`) com **validação por código enviado por e-mail**.
- **Usuários** (`/usuarios`, só ADM) — gestão de perfis, e-mail e hierarquia.
- **Código SICLA** obrigatório no cadastro (autocadastro e `/usuarios`, todos os perfis) — é o
  elo do usuário com a sua agenda no SICLA, usado pela Disponibilidade (5.9).
- **Perfil** (`/perfil`) do usuário logado.

---

## 6. Documentos gerados

| Documento | Slug | Formato | Como nasce |
|---|---|---|---|
| Mapeamento (Levantamento) | `levantamento` | .docx | Layout fiel; respostas do Levantamento em tela ou importado |
| Projeto de Implantação | `projeto` | .docx | Layout fiel; via gate de origem (tela/importado/modelo) |
| Cronograma | `cronograma` | .xlsx | Do plano editável de cronograma |
| Check List | `checklist` | .xlsx | Roteiro dos módulos contratados |
| Termo de Encerramento | `termo` | .docx | Layout fiel |

A geração fiel vive em `gerar_layout.py` (fachada) + `gl_comum/gl_levantamento/gl_projeto/gl_termo/gl_xlsx`.
Há ainda um conjunto de **geradores Office** de apoio em `tools/` (Kit de Gestão da Mudança,
Roteiros SIT/UAT, Aceite UAT, Reconciliação de Conversão, Hypercare, Fit/Gap, KPIs, RAID,
Dossiê do cliente) — ver `README.md`.

---

## 7. Automações

- **Avanço automático de etapa** — sempre que os *gates* (documentos + ação) da próxima etapa
  estiverem satisfeitos, o projeto avança sozinho e registra o evento. (A conclusão do
  **Levantamento** é confirmada manualmente pelo GCI.)
- **Geração ao designar** — definir o GCI já gera o Levantamento para ele preencher.
- **Robô da caixa (IMAP)** — a cada `IMAP_POLL_MIN` minutos, lê novos e-mails de fechamento e
  **cria a ficha automaticamente** (sem duplicar clientes já cadastrados).
- **Resumo diário (digest)** — thread que envia, na hora `DIGEST_HORA`, um e-mail com os
  indicadores e alertas da carteira aos destinatários `DIGEST_PARA`.

---

## 8. Notificações por e-mail

Eventos do fluxo notificam automaticamente a **Coordenação** (ADM + Coordenadores, ou os
destinatários do digest):

| Evento | Quando dispara |
|---|---|
| `fechamento` | Novo processo recebido (manual ou robô) — "designe o GCI" |
| `levantamento_ok` | Levantamento concluído — "siga para o Projeto" |
| `projeto_ok` | Projeto gerado — "designe os Consultores" |
| `cronograma_ok` | Cronograma concluído |
| `checklist_ok` | Check-list concluído |
| `termo_ok` | Termo de Encerramento gerado |
| `encerrado` | Implantação encerrada |

Além desses, **Designação/Agendamento/Consultores** notificam diretamente os GCIs e
consultores envolvidos. Todo envio é registrado na timeline do projeto (mesmo quando o SMTP
não está configurado, fica registrado como pendente).

---

## 9. Cadastros de referência

Telas de administração (só ADM) que alimentam a geração e o Levantamento:

- **Check-list** (`/cadastros/checklist`) — catálogo de itens/ações por módulo (com paginação e busca).
- **Índice de Tópicos** (`/cadastros/indice`) — perguntas do Levantamento por módulo.
- **Modelos de Documentos** (`/cadastros/modelos`) — os layouts oficiais (Levantamento, Projeto,
  Cronograma, Termo): versões enviadas (.docx/.xlsx) + campos/marcadores, com download da versão vigente.

Os catálogos têm botão de **reimportação** a partir do modelo/planilha de origem.

---

## 10. Configurações

Todas restritas ao ADM:

| Tela | O que configura |
|---|---|
| `/config` | Parâmetros de IA |
| `/config/email` | SMTP (envio) |
| `/config/imap` | Caixa de entrada (robô de fechamentos) |
| `/config/gmail` | Integração Gmail |
| `/config/disponibilidade` | Conexão + SELECT da base externa de ocupação dos técnicos |
| `/config/modelos-email` | CRUD de modelos de e-mail (assunto/corpo com variáveis) |

---

## 11. Segurança

- **Login obrigatório** quando há usuários ou senha mestra; rotas públicas só `login`,
  `cadastro`, `cadastro_confirmar`, `health` e estáticos.
- **Senha mestra (break-glass)** via `PAINEL_SENHA` ou `acesso.txt` para o 1º acesso.
- **Permissões no backend** (não só no menu): cada rota sensível checa `pode_ver` / `pode_gerar` /
  `pode_designar` e devolve 403 quando não autorizado.
- **Download protegido** — só serve arquivos dentro das pastas permitidas (`ALLOWED_DIRS`).
- **Autocadastro validado por e-mail** (código de confirmação).
- Segredos (ex.: conexão de disponibilidade) ficam fora do versionamento (`tools/data/*.json`).

---

## 12. Persistência (banco de dados)

Camada de dados **agnóstica** via SQLAlchemy (`db.py`):
- **SQLite** por padrão (arquivo local ou de rede), ou
- **PostgreSQL/qualquer banco** definindo `PAINEL_DB_URL` — sem reescrever código.

Há **auto-migração** leve (cria tabelas e adiciona colunas novas) no start. Principais entidades:
`Projeto`, `Documento`, `Evento` (timeline), `Usuario`/`CadastroPendente`, `Designacao`,
`CronogramaItem`/`ChecklistItem` (planos), `AtividadeCronograma`/`SlotCronograma` (agendador),
`LevantamentoResposta`, `DocConteudo` (edição estruturada), `ModeloEmail`, e os cadastros
`ChecklistModelo`/`IndiceTopico`/`ModeloDocumento`.

---

## 13. Arquitetura de código

`webapp/` — aplicação Flask servida por waitress. O `app.py` mantém o **núcleo** (criação do
app, login/`before_request`, perfis/permissões, notificações, robôs) e registra **8 módulos de
rotas**, cada um com `register(app, **deps)` + `add_url_rule`:

| Módulo | Conteúdo |
|---|---|
| `routes_agenda.py` | Agendador de Visitas |
| `routes_config.py` | Configurações |
| `routes_cadastros.py` | Check-list, Índice, Modelos |
| `routes_cronograma.py` | Planos editáveis Cronograma/Check-list |
| `routes_geracao.py` | Geração de docs, Levantamento, gate de origem |
| `routes_designacao.py` | Agendamento e Designação |
| `routes_fluxo.py` | Fluxo de fechamento, e-mail, mapa, doc-view |
| `routes_painel.py` | Home, coordenação, atividade, monitoramento |

Apoio: `db.py` (dados), `gerar_layout.py` + `gl_*` (geração fiel), `mailer.py`/`imap_intake.py`/
`gmail_api.py` (e-mail), `disponibilidade.py` (base externa), `docview.py` (pré-visualização),
`doc_edit.py` (edição estruturada), `runner.py` (geradores), `roles.py` (papéis/ferramentas).
Índice de navegação do código: [memoria_ia/mapa-codigo.md](../memoria_ia/mapa-codigo.md).

---

## 14. Mapa de telas (rotas)

**Núcleo / acesso:** `/login` · `/logout` · `/cadastro` · `/cadastro/confirmar` · `/perfil` ·
`/usuarios` · `/cliente` · `/health` · `/download`

**Painel:** `/` (home) · `/coordenacao` · `/atividade` · `/monitoramento` · `/mapa`

**Carteira/ficha:** `/projetos` · `/projetos/novo` · `/projetos/<id>` · `/excluir` · `/avancar` ·
`/anexar` · `/nota` · `/doc/<id>/ver`

**Etapas:** `/definir_gci` · `/agendar` · `/designar` · `/consultores` · `/levantamento` ·
`/projeto/origem` · `/gerar/<tipo>` · `/gerar-layout/<slug>` · `/gerar_pendentes` · `/editar/<doc>`

**Planos:** `/cronograma` (+`/seed`,`/gerar`) · `/checklist` (+`/seed`)

**Agenda:** `/agenda` · `/agenda/alocar` · `/agenda/alocar_visita` · `/agenda/horario` ·
`/agenda/tecnico_modulo` · `/agenda/status` · `/agenda/postergar` · `/agenda/gerar` ·
`/agenda/acompanhamento`

**E-mail/fluxo:** `/projetos/<id>/email` · `/fluxo` (+`/parse`,`/inbox`,`/criar`) · `/digest/enviar`

**Cadastros/config:** `/cadastros/checklist|indice|modelos*` · `/config*`

**Papéis/ferramentas:** `/papel/<id>` · `/acao/<id>/<aid>`

---

## 15. Qualidade (testes)

Suíte automatizada em `webapp/test_painel.py` (~70 testes) cobrindo fluxo, gates, geração,
agendador e continuidade ponta-a-ponta:

```bat
cd webapp
set PYTHONUTF8=1 && python -m pytest test_painel.py -q
```

---

*Documento mantido junto ao código. Ao adicionar telas/recursos, atualize as seções 5, 13 e 14.*
