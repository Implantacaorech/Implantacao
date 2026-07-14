# Inventário técnico — Painel de Implantação (estado ANTES da migração)

> Levantamento de referência para a migração Angular + NestJS, feito por leitura direta do
> código em `webapp/` e `tools/` em 2026-07-13, na branch `feature/migracao-angular-backend-moderno`.
> Nenhum arquivo do app Flask foi alterado para produzir este documento. Serve de checklist:
> nada aqui pode "desaparecer" na conversão sem virar uma decisão registrada em
> [03-documento-conversao.md](03-documento-conversao.md).

## 1. Rotas / endpoints

Montadas em `webapp/app.py` (rotas próprias) + 11 módulos `routes_*.py` registrados via
`register(app, **deps)` (injeção de dependência — cada módulo já é, na prática, um
"controller" isolado, o que facilita o mapeamento 1:1 para módulos NestJS).

### `app.py`
`/login` `/logout` `/cadastro` `/cadastro/confirmar` `/digest/enviar` `/papel/<rid>`
`/acao/<rid>/<aid>` `/perfil` `/usuarios` `/cliente` `/projetos` `/projetos/novo`
`/projetos/<pid>` `/projetos/<pid>/excluir` `/projetos/<pid>/avancar` `/projetos/<pid>/anexar`
`/projetos/<pid>/doc/<id>/excluir` `/projetos/<pid>/nota` `/download` `/health`

### `routes_agenda.py` — Agendador de Visitas
`/projetos/<pid>/agenda` (calendário), `/alocar`, `/alocar_visita`, `/distribuir`,
`/redistribuir`, `/desfazer_tudo`, `/horario`, `/tecnico_modulo`, `/config_distribuicao`,
`/periodo_bloqueado`, `/status`, `/acompanhamento`, `/gerar`, `/postergar`,
`/postergar_visita`, `/atividade_excluir`, `/reorganizar_modulo`.

### `routes_cadastros.py` — Catálogos (ADM/sistema)
Checklist por módulo, Índice de Tópicos, Modelos de Documentos (versões + campos).

### `routes_config.py` — Configuração
IA (Anthropic), E-mail (SMTP), Disponibilidade (Oracle/SICLA), Consultas BD (só ADM),
Modelos de e-mail (só ADM), IMAP, Gmail OAuth.

### `routes_cronograma.py`
`/cronograma` (tabela editável + seed + gerar), `/checklist` (idem).

### `routes_dashboards.py`
`/dashboards` — "Previsão Início Oficial" via Consultas BD + Chart.js.

### `routes_designacao.py`
`/designar`, `/definir_gci`, `/agendar`, `/consultores`.

### `routes_fluxo.py`
`/email`, `/fluxo`, `/fluxo/parse`, `/fluxo/inbox`, `/fluxo/criar`, `/mapa`, `/doc/<id>/ver`, `/pdf`.

### `routes_geracao.py`
`/gerar_pendentes`, `/gerar/<tipo>`, `/gerar-layout/<slug>`, `/gerar_projeto`,
`/projeto/origem`, `/levantamento`, `/editar/<doc>`.

### `routes_matriz.py`
`/matriz`, `/matriz/importar`, `/matriz/<tid>`, `/matriz/<tid>/salvar`.

### `routes_painel.py` — telas executivas
`/` (home/KPIs), `/coordenacao`, `/coordenacao/capacidade`, `/atividade`, `/monitoramento`.

### `routes_protocolos.py` — Protocolos de Treinamento
`/protocolos`, `/protocolos/novo`, `/protocolos/<id>`, `/salvar`, `/processar`, `/aprovar`,
`/reprovar`, `/status`, `/video` (streaming com range).

## 2. Modelos de dados (`webapp/db.py`)

24 classes SQLAlchemy `Base`. **Importante**: nenhuma usa `ForeignKey` declarado — o vínculo
é sempre um `projeto_id` "solto"; a integridade referencial é garantida na camada de aplicação
(ex.: `projeto_excluir` apaga manualmente 9 tabelas filhas). Na migração para TypeORM, isso
**deve** virar `@ManyToOne`/`@JoinColumn` reais com `onDelete: 'CASCADE'`.

| Classe | Tabela | Papel |
|---|---|---|
| `Projeto` | `projetos` | Entidade raiz (cliente, etapa, situação, datas, módulos contratados) |
| `Documento` | `documentos` | Documentos gerados/importados por projeto |
| `Evento` | `eventos` | Timeline (nota/etapa/documento/email/alerta) |
| `Usuario` | `usuarios` | Login, perfil, Código SICLA |
| `CadastroPendente` | `cadastros_pendentes` | Auto-cadastro com código de confirmação |
| `ModeloEmail` | `modelos_email` | Templates de e-mail por etapa |
| `Designacao` | `designacoes` | Técnico/ordem/analista por módulo do projeto |
| `CronogramaItem` | `cronograma_itens` | Plano de cronograma (fase antiga) |
| `ChecklistItem` | `checklist_itens` | Plano de check-list |
| `Modificacao` | `modificacoes` | Auditoria de alteração de cronograma/checklist |
| `ChecklistModelo` | `checklist_modelo` | Catálogo mestre de checklist |
| `IndiceTopico` | `indice_topicos` | Catálogo mestre de tópicos |
| `ModeloDocumento` / `...Versao` / `...Campo` | `modelos_documento*` | Layouts oficiais + versionamento + placeholders |
| `LevantamentoResposta` | `levantamento_respostas` | Respostas do Levantamento por tópico |
| `AtividadeCronograma` | `cronograma_atividades` | Atividade do Agendador de Visitas |
| `SlotCronograma` | `cronograma_slots` | Horário de turno (global ou por dia) |
| `CronogramaConfig` | `cronograma_config` | Config de distribuição automática (1:1 com projeto) |
| `CronogramaPeriodoBloqueado` | `cronograma_periodos_bloqueados` | Períodos sem agenda (por técnico) |
| `DocConteudo` | `doc_conteudo` | Conteúdo estruturado editável dos documentos |
| `Protocolo` | `protocolos` | Base de conhecimento (vídeo + transcrição + IA) |
| `MatrizCompetencia` / `MatrizTecnico` | `matriz_*` | Matriz de Conhecimento da equipe |
| `ConsultaBD` | `consultas_bd` | Consultas SQL nomeadas (Dashboards/Disponibilidade) |

Padrão de auto-migração aditiva (`_auto_migrar()`): adiciona colunas/índices que faltarem a
cada boot, nunca remove nada. Na migração, isso vira **migrations TypeORM versionadas**
(uma por mudança de schema, com down() de rollback) — ver decisão em
[02-decisao-arquitetura.md](02-decisao-arquitetura.md).

`ETAPAS` (6): Agendamento → Levantamento → Projeto → Designação → Cronograma e Check-list →
Encerramento. `SITUACOES`: Em andamento / Em risco / Pausado / Concluído.
`PERFIS`: ADM, Coordenador, Administrativo, GCI, Consultor.

## 3. Autenticação e permissões

- Sessão Flask (cookie `HttpOnly` + `SameSite=Lax`), sem CSRF token explícito hoje.
- Dois mecanismos de login: usuário/senha (hash `werkzeug.security`) OU senha mestra de
  emergência (`PAINEL_SENHA`/`acesso.txt`) — sempre loga como perfil `ADM`.
- "Login desabilitado" quando não há usuários nem senha mestra → acesso total (modo instalação
  nova). **Este modo não deve ser replicado tal qual em produção** — vira uma decisão de
  segurança na migração (ver seção de segurança do documento de conversão).
- Auto-cadastro com código de 6 dígitos por e-mail, exige Código SICLA.
- Controle de acesso: `pode_ver(area)` ("gestao"/"sistema"), `pode_gerar(tipo)` (por tipo de
  documento), `pode_designar()`, `_e_adm()`, `_so_meus(projetos)` (GCI só vê onde é GCI,
  Consultor só onde é designado). Regras ad hoc extras em `routes_designacao`, `routes_matriz`,
  `routes_protocolos`.

## 4. Integrações externas

| Integração | Arquivo atual | Observação para a migração |
|---|---|---|
| SMTP | `mailer.py` | Direto — `nodemailer` no NestJS |
| Gmail API (OAuth2) | `gmail_api.py` | Direto — SDK `googleapis` no Node |
| IMAP (robô de caixa) | `imap_intake.py` | Direto — lib `imapflow`/`node-imap` |
| Oracle/SICLA (disponibilidade + Consultas BD) | `disponibilidade.py` | Driver `oracledb` tem binding Node oficial — direto |
| IA (Anthropic Claude) | `tools/ia.py`, `protocolo_ia.py` | Direto — SDK `@anthropic-ai/sdk` |
| **Word COM (docx→PDF fiel)** | `docview.py` (`pywin32`) | **Sem equivalente Node/Java nativo** — decisão: manter microsserviço Python (ou trocar por LibreOffice headless) |
| **Transcrição local (faster-whisper)** | `transcritor.py` | **Python-only** — decisão: manter microsserviço Python |

## 5. Geração de documentos

- **Geração "fiel" por layout** (`gerar_layout.py` + `gl_*.py`): Levantamento, Projeto de
  Implantação, Termo de Encerramento (`.docx`, `python-docx`) e Cronograma/Cronograma de
  Visitas (`.xlsx`, `openpyxl`), a partir de modelos reais cadastrados (`ModeloDocumento`).
- **14 geradores "clássicos"** em `tools/gerar_*.py` (Kit de Mudança, Roteiros SIT/UAT,
  Reconciliação de Conversão, Painel de Hypercare, RAID, KPIs, Dossiê do Cliente etc.),
  todos `python-docx`/`openpyxl` a partir de YAML.
- Ambas as trilhas dependem de `python-docx`/`openpyxl` (Python) — **não há biblioteca
  Node/Java madura equivalente para editar `.docx` fiel ao layout Word** com a mesma
  fidelidade. Decisão registrada em 02-decisao-arquitetura.md: manter a geração de documentos
  como um serviço Python interno, chamado pela API NestJS.

## 6. Processos em segundo plano / agendados

Hoje 100% threads daemon dentro do processo Flask (sem fila): digest diário, robô de caixa
IMAP, robô de protocolos, notificação assíncrona de eventos. Fora do processo: `Guardiao_Painel.vbs`
(Tarefa Agendada, restart via `/health`) e `robo_integridade.py` (roda a suíte de testes e
verificações diárias). Na migração, isso vira **NestJS `@nestjs/schedule` (cron in-process)**
— sem necessidade de fila externa (BullMQ) dado o volume atual (times pequenos, poucos jobs).

## 7. Uploads / downloads

`webapp/_uploads/`, teto de 4 GB (vídeos de treinamento). Tipos: `.docx`/`.yaml` (import),
vídeo/áudio (Protocolos), anexo livre, modelos de documento. Download por rota genérica com
checagem de diretório permitido (`ALLOWED_DIRS`) contra path traversal — replicar essa
validação explicitamente no NestJS (não confiar em normalização automática do `path`).

## 8. Templates / telas

54 templates Jinja2 — mapeados 1:1 para futuras rotas/páginas Angular em
[02-decisao-arquitetura.md](02-decisao-arquitetura.md) §Frontend. Lista completa preservada
no histórico de pesquisa desta migração; qualquer tela convertida deve ser riscada do
checklist em [03-documento-conversao.md](03-documento-conversao.md).

## 9. Configuração / ambiente

Variáveis principais: `PAINEL_DB_URL`, `PAINEL_SECRET`, `PAINEL_SENHA`, `PAINEL_MAX_UPLOAD_MB`,
`PAINEL_HOST`/`PORT`, `DIGEST_PARA`/`HORA`, `IMAP_*`, `SMTP_*`, `PROTOCOLOS_*`,
`ANTHROPIC_API_KEY`, `INTEGRIDADE_PARA`, `PAINEL_DB_SENHA`. Produção: Postgres via Docker
Compose. Dev/teste: SQLite.

## 10. Testes existentes

128 testes em `webapp/test_painel.py` (2531 linhas). Cobertura forte: Agendador de Visitas
(~25), fluxo de etapas/gates, Protocolos (~9), Cadastros (~8), Consultas
BD/Disponibilidade/Dashboards (~15), geração de documentos (~15). Cobertura fraca/ausente:
envio real de e-mail (SMTP/Gmail/IMAP), robô de integridade, importador de matriz/capacidade
(2 testes cada), chamada real à IA.

## 11. Dependências (`tools/requirements.txt`)

`python-docx`, `openpyxl`, `Pillow`, `PyYAML`, `Flask`, `anthropic`, `SQLAlchemy`,
`psycopg2-binary`, `waitress`, `google-auth(-oauthlib)`, `httpx`, `pywin32` (Windows only),
`faster-whisper`.
