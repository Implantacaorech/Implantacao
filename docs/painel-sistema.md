# Painel de Implantação — Documentação do Sistema

> ⚠️ **Documento HISTÓRICO** — descreve o painel **Flask legado**, desligado em 2026-07-19 e
> removido do repositório em 2026-07-29. O sistema em produção é o NestJS + Angular
> (porta 5100). A visão atual, em nível de usuário, está em
> **[manual-usuario-painel.md](manual-usuario-painel.md)**.
>
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

**Preencher a partir da reunião gravada — *2026-08-11*.** Fecha o ciclo com a gravação
(§5.17.1): a mesma tela que oferece *Gravar reunião* passa a oferecer **“Preencher a partir
de uma reunião”**. O painel lê a transcrição de uma reunião já gravada do cliente e **propõe**
a resposta das perguntas em branco, cada uma com a marca de tempo (`[12:35]`) de onde o
assunto aparece — para conferir a origem em um clique.

- ⚠️ **Nada é gravado sozinho.** A sugestão aparece ao lado da pergunta e espera **Usar** ou
  **Descartar**. Ao aceitar, o texto entra pelo mesmo caminho da digitação — autosave, versão
  e **autoria de quem aceitou**. O Levantamento é assinado pelo cliente: “quem escreveu
  isto?” não pode ter como resposta “a IA, sozinha”.
- Só entram perguntas **em branco**: resposta já digitada e *“Não será utilizado.”* são
  decisão humana e não são colocadas em dúvida.
- A gravação é casada por **projeto ou nome do cliente** — a reunião de levantamento costuma
  acontecer antes de a ficha existir (o cliente vem da busca no SICLA).
- Silêncio é resposta válida: o que a reunião não tratou volta sem sugestão. É comum uma
  gravação render 5 sugestões, não 50.
- Configuração: finalidade **“Levantamento a partir da reunião”** em **Config → IA** (chave
  própria, separada de Protocolos e Dicionário). Sem ela, a tela explica o que fazer em vez
  de oferecer o botão.

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
- **Consulta (base de conhecimento):** filtros por módulo, menu, status, origem, **cliente** e
  palavra-chave (busca em resumo, passo a passo, configurações, regras e dependências).
- **Visibilidade (regra de 2026-07-30):** cada pessoa vê **apenas o que ela mesma gravou ou
  enviou**. Exceções: **ADM** vê tudo (administra e aprova) e os **vídeos do robô do
  SharePoint** continuam visíveis para todos (pasta compartilhada, sem dono). Vale na lista
  **e** em toda rota por id — `backend/src/protocolos/protocolos.acesso.ts`.
- **Dá para desistir e dá para destravar (2026-08-11):** enquanto o protocolo está
  *Transcrevendo*/*Analisando*, a ficha oferece **Cancelar processamento** — o subprocesso do
  transcritor é **morto de verdade** no docservice (antes ele seguia moendo o vídeo inteiro,
  a 377% de CPU, mesmo depois de cancelado), e o registro volta para **Erro**, que é de onde
  *Processar agora* funciona. Excluir um protocolo em processamento faz o mesmo antes de
  apagar a linha. E, se o **painel for reiniciado no meio**, uma varredura no boot religa o
  que dá para aproveitar (transcrição já gravada, ou pronta/em andamento no docservice) e
  deixa o resto em *Erro* com a explicação — **nunca retranscreve do zero por conta própria**,
  porque um vídeo de treinamento custa horas de máquina.
- Config: `PROTOCOLOS_DIR` (pasta raiz), `PROTOCOLOS_POLL_MIN` (robô, padrão 10 min),
  `PROTOCOLOS_WHISPER` (modelo, padrão `base` — rápido; use `small`/`medium` p/ mais
  precisão) e `PROTOCOLOS_THREADS` (0 = automático/todos os núcleos, o mais rápido).

### 5.17.1 Gravar reunião com transcrição ao vivo (`/protocolos/gravar`)
Terceira entrada da mesma tela (além do upload e do robô): **gravar a reunião pelo próprio
painel** e ver a transcrição sendo escrita enquanto ela acontece.
- **Fontes de áudio:** *presencial* (microfone da máquina/sala), *remota* (áudio da aba/tela
  compartilhada — reunião do **Teams**) ou *híbrida* (as duas somadas num mixer só).
- **Direcionamento a cliente:** a gravação é vinculada a um **projeto/cliente** do painel
  (opcional — dá para gravar conteúdo genérico). O nome do cliente fica gravado no registro
  e vira **coluna e filtro** na lista de transcrições.
- **Como funciona:** o navegador captura o áudio, corta em trechos de 15–30 s **numa pausa da
  fala** (não no relógio, para não partir palavra ao meio) e envia; o docservice transcreve
  cada trecho na hora com um worker que mantém o modelo **carregado** durante toda a reunião.
- **Ao encerrar:** os trechos viram um único `.wav` em `PROTOCOLOS_DIR/Gravacoes/`, a
  transcrição completa entra no **mesmo pipeline** dos vídeos (análise de IA + **resumo
  completo**) e o registro segue para revisão. A opção *"transcrever o áudio inteiro de novo"*
  troca velocidade por precisão — é ligada sozinha se a transcrição ao vivo vier vazia.
- **Requisito do navegador:** captura de áudio só existe em **contexto seguro** (HTTPS ou
  `localhost`). Como o painel roda em `http://I7M1700-01-EVE:5100`, a tela avisa e explica o
  que fazer — ver **[docs/gravacao-reuniao.md](gravacao-reuniao.md)**.
- Config adicional: `PROTOCOLOS_WHISPER_VIVO` (modelo do ao vivo; cai no `PROTOCOLOS_WHISPER`)
  e `PROTOCOLOS_THREADS_VIVO`.

### 5.17.2 Saúde do sistema (bloco no Centro de Monitoramento) — *2026-08-11*
Vigilância da **infraestrutura do próprio Painel** (`GET /api/saude`, permissão
`centro_operacional`). Seis checagens, cada uma com o que fazer:

| Item | Fica crítico quando |
|---|---|
| **Banco de dados** | a conexão não responde |
| **Backup do banco** | não há zip, o último tem **< 100 KB** ou é de **≥ 48 h** atrás |
| **Estabilidade (Guardião)** | **3 ou mais** reinícios em 24 h (1–2 é aviso) |
| **Serviço de documentos e transcrição** | o docservice (8001) não responde |
| **Transcrições em andamento** | *(aviso)* registro diz "Transcrevendo" e não há trabalho rodando |
| **Envio de e-mail** | *(aviso)* e-mails do processo falharam nas últimas 24 h |

Cada limiar veio de um incidente real — os zips de **176 bytes** por 3 dias (o script logava
`ok`), os **4 dias sem dump** por uma senha obsoleta no ambiente, e o Guardião reiniciando o
painel **159 vezes em 13 h**. Em todos, o painel continuava no ar e ninguém foi avisado.

Por isso o resultado sai por **dois canais**: o bloco no Centro de Monitoramento e uma seção
no **digest diário** — este é o que fecha o buraco de verdade, porque em todos os casos
ninguém estava abrindo o painel. Quando está tudo certo o e-mail traz uma linha só, de
propósito. Detalhe do módulo em `backend/src/saude/docs/`.
Config: `MIGRACAO_BACKUP_DIR` (padrão `C:\PainelBackups`).

### 5.18 Matriz de Conhecimento (`/matriz`)
Cadastro das notas de conhecimento (1–10) por **técnico × competência** (153 competências em
8 áreas — Controladoria, Folha, Negócios, Finanças, Produção, Gerais, Outras, Formulários),
importado da planilha `docs/Matriz de Conhecimento.xlsx` (botão **Importar** — aditivo,
preserva quem já existe). Permissões:
- **ADM (Administrador):** vê tudo e altera qualquer linha (+ importar planilha);
- **Administrativo e Coordenador:** veem tudo, somente consulta;
- **Consultor e GCI:** veem e alteram **apenas a própria linha** (casada pelo Código
  SICLA/nome do cadastro de usuários).
Cada linha guarda quem alterou e quando; escala visual das notas (verde 9–10, amarelo 6–8,
vermelho 1–5).

### 5.19 Capacidade da equipe (`/coordenacao/capacidade`)
Responde ao Comercial **"dá para receber um cliente novo? quem atende? a partir de quando?"**
cruzando, por Consultor/GCI ativo: **módulos** do cliente novo × **Matriz de Conhecimento**
(nota média nos módulos) × **agenda** (alocações do agendador do Painel + compromissos do
SICLA, janela de 4–12 semanas) × **go-live previsto** (quando libera). Mostra ranking com
score explicável (45% conhecimento + 35% folga de agenda + 20% carga de clientes), veredito
(✅ Pronto / 🟡 Parcial / 🔴 sem janela), mini-gráfico de turnos livres por semana e o bloco
**"Resposta ao Comercial"** pronto (quem + data de início). Acesso: perfis de gestão, pelo
botão **Capacidade da equipe** na Coordenação.

Tem **filtro por setor** (`usuarios.setor_atuacao`, vindo de `SICLA.LISTA_TECNICOS.SETORDES`):
o select lista os setores existentes na equipe, mais **"(sem setor)"** quando há técnico sem
setor no cadastro. O recorte reduz também a consulta de agenda ao SICLA (só os códigos que
sobraram). Os **selects filtram na hora**; o campo de módulos, por ser texto, espera o
**Avaliar**. Módulos, setor e janela ficam **salvos no usuário** (ver 5.21).

### 5.20 Autocadastro e usuários
- **Autocadastro** (`/cadastro`) com **validação por código enviado por e-mail**.
- **Usuários** (`/usuarios`, só ADM) — gestão de perfis, e-mail e hierarquia.
- **Código SICLA** obrigatório no cadastro (autocadastro e `/usuarios`, todos os perfis) — é o
  elo do usuário com a sua agenda no SICLA, usado pela Disponibilidade (5.9).
- **Perfil** (`/perfil`) do usuário logado.

### 5.21 Filtros salvos por usuário logado

Toda tela com filtro **reabre no recorte que a pessoa deixou**. A seleção é gravada **no banco,
por usuário** (`preferencias_usuario`, um registro por usuário × tela, com o estado em JSON) —
não no `localStorage`: ela segue a PESSOA, não a máquina, então quem entra de outro computador
encontra a tela como deixou. Nada de botão "salvar": a gravação é automática (agrupada, ~0,4 s
depois da última mexida) e o **"Limpar"**, onde existe, *esquece* a preferência e devolve a tela
aos padrões dela.

| Tela | Chave | O que fica salvo |
|---|---|---|
| Capacidade da equipe | `capacidade` | módulos, setor, janela (semanas) |
| Carteira de projetos | `carteira` | vista (quadro/tabela/grade), busca, situação, etapa |
| Matriz de Conhecimento | `matriz` | busca por nome/setor |
| Matriz por Menu (SIGER) | `matriz-detalhada` | busca de módulos |
| Matriz por Menu (Funções SICLA) | `matriz-funcoes` | busca de módulos |
| Usuários | `usuarios` | setor, nome, filtro do SICLA, "só novos" |
| Cadastros | `cadastros` | módulo e busca do Check List e do Índice de Tópicos |
| Dicionário Inteligente | `dicionario` | termo, tipo, sigla (e já traz o resultado ao abrir) |
| Transcrição Áudio/Vídeo | `protocolos` | módulo, menu, status, origem, busca |
| Agenda — acompanhamento | `agenda-acompanhamento` | status, data, técnico |
| BI Implantação (painéis) | `bi-implantacao-painel` | período, situações, atalho de mês |
| BI Implantação (Indicadores) | `bi-indicadores` | competências, posição, tipo, área, suporte, responsável, grupo, busca |
| BI Clientes SIGER (4 abas) | `bi-clientes-siger` | período/mês, grupo, RNS, status, técnico, cliente, sigla, ativo, tipo, validada, busca |

**Ficam de fora, de propósito:** a aba/rota aberta (é o link, que se compartilha), o painel de
filtros aberto/fechado (nasce fechado, mostrando resultado e não configuração), o rascunho de
busca *dentro* de um bloco de filtro do BI, e o técnico selecionado nas Matrizes (o padrão é
"eu", e fixar a ficha de outra pessoa seria pior). Na Agenda—acompanhamento, que é **por
projeto**, data e técnico salvos são descartados quando não existem na agenda do projeto
aberto — manter deixaria a tabela vazia sem explicação.

Como funciona: `authGuard` pré-carrega o mapa de preferências numa chamada só ao entrar; com
ele em memória, cada tela restaura os filtros de forma **síncrona** no construtor, e a primeira
carga de dados já sai filtrada (sem consulta jogada fora nem piscada de conteúdo). A leitura é
tolerante — filtro que não existe mais, ou cujo formato mudou, é ignorado. Código:
`frontend/src/app/core/utils/filtros-salvos.ts`, `core/services/preferencias.service.ts` e
`backend/src/preferencias/`.

### 5.22 Apresentação pública dos recursos (`/apresentacao`)

Página **aberta, sem login** — junto do login e do "esqueci minha senha", é a terceira tela
que roda fora do shell. Alcançada pelo botão **"Conheça os recursos do Painel"** no cartão de
acesso, e com um botão **"Entrar no Painel"** fixo no topo da própria página (mais um no fim).

Serve para apresentar o Painel a quem ainda não usa (Comercial, Coordenação, direção, gente
nova no time). O texto é de **nível usuário**: fala do que a pessoa faz e do que ganha, sem
citar tecnologia, rota ou nome de arquivo. Cobre visão geral, os 21 passos, carteira,
levantamento → documentos, agenda de visitas, transcrição/gravação, matriz + dicionário,
capacidade da equipe, BI, monitoramento e perfis de acesso.

As imagens são **ilustrações do Painel** desenhadas à mão em `frontend/public/apresentacao/*.svg`
— não são capturas de tela reais, de propósito: a página é pública e uma captura exporia dados
de cliente. Ao mudar uma tela de verdade, vale rever a ilustração correspondente.

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

### 10.1 IA por finalidade — e onde o dado vai parar *(2026-08-11)*

Cada uso de IA é uma **finalidade** com chave, provedor e modelo **próprios** (Transcrição
Áudio/Vídeo · Dicionário · Levantamento a partir da reunião). Provedores aceitos:

| Provedor | Chave | Modelo | Observação |
|---|---|---|---|
| `anthropic` | `sk-ant-…` | `claude-opus-4-8` | SDK oficial |
| `openrouter` | `sk-or-…` | `anthropic/claude-sonnet-4` | catálogo no combo da tela |
| **`local`** | **opcional** | `qwen2.5:14b` | URL do serviço, ex. `http://192.168.1.50:11434/v1` |

**O provedor `local` existe por privacidade, não por preço.** Vale para qualquer endpoint
compatível com a API da OpenAI: **Ollama** (porta 11434), **LM Studio** (1234), vLLM. Informe
a URL **com o `/v1`**; a chave fica em branco (Ollama e LM Studio não pedem nenhuma) e só é
preenchida quando há um proxy autenticado na frente.

Por que isso importa aqui: **Protocolos e Levantamento leem transcrição de reunião de
cliente**. A transcrição do áudio já roda na própria rede de propósito (faster-whisper local,
"o áudio não sai da rede") — mandar o **texto** para um modelo gratuito de provedor externo
desfaria essa decisão pela porta dos fundos, porque endpoint gratuito costuma ser gratuito
justamente por treinar com o que recebe. Com `local`, o dado não sai da rede em etapa nenhuma.
O **Dicionário** é outro caso: lê documentação do SIGER, conteúdo nosso — ali um modelo
externo é uma escolha razoável. É exatamente para permitir essa separação que as chaves são
por finalidade.

Espera do serviço local: teto de **10 minutos** por chamada. Generoso porque um modelo grande
em CPU lendo 13 mil tokens leva minutos; existe porque sem teto um servidor engasgado
penduraria o pipeline de transcrição.

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

**Núcleo / acesso:** `/login` · `/apresentacao` (público) · `/logout` · `/cadastro` · `/cadastro/confirmar` · `/perfil` ·
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
