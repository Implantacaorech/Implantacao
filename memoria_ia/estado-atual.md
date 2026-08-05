# Estado atual do projeto

> Atualizado: 2026-07-19 (virada para produção). Resumo curto — detalhes nos arquivos apontados.

## O que é
Repositório do **time de implantação** da Rech (ERP SIGER®): agentes/skills/docs **+** o
**Painel** — desde 2026-07-19, o Painel em produção é o stack **NestJS + Angular**
(`backend/` + `frontend/`), não mais o painel Flask.

## Como roda (produção)

- **NestJS serve o build do Angular direto** (`@nestjs/serve-static`) — um único
  processo/porta: **5100**, máquina `I7M1700-01-EVE` → `http://I7M1700-01-EVE:5100`.
- Sobe via `Iniciar_Painel_Novo.bat`; guardião (`Guardiao_Painel_Novo.vbs`) e verificação de
  integridade rodam como Tarefas Agendadas do Windows.
- Banco: **MariaDB 12.2 — serviço NATIVO do Windows na porta 3306** (banco `painel_novo`), via
  `MIGRACAO_DB_URL`. `/api/health` confirma (`"db":"mariadb"`).
- **docservice/** (Python, processo próprio) faz a geração fiel de documentos + transcrição
  de vídeos de treinamento — nunca exposto publicamente, chamado só pelo backend.
- **`webapp/legado_cli.py`** (+ `runner.py`/`roles.py`/`forms.py`) é uma ponte de
  subprocesso do backend para o assistente administrativo legado (roles/cliente/
  criar-templates/verbal/saúde) — reaproveita esse código Python tal como é.
- **`tools/`** continua vivo por completo — dependência real da ponte acima e usado por
  ambos os stacks para os geradores Office (.docx/.xlsx).

## O painel Flask legado (`webapp/` original)

**Desligado em 2026-07-19** (processo parado, Tarefas Agendadas do guardião/integridade
desabilitadas), arquivado em `projeto_old/` e **removido do repositório em 2026-07-29** —
fica no histórico do git. Deixou de ser rollback: o Postgres dele (`painel-db`) não existe e
o dump citado no plano de virada saiu na retenção de 14 dias. O Postgres já estava
inacessível há ~2 dias quando a
virada aconteceu (achado durante a checagem de segurança pré-virada, não uma decisão
planejada) — detalhe em `vault/22 - Troubleshooting/` e
`docs/migracao/05-plano-de-virada.md` §"Registro real da virada". Risco aceito, não
mitigado: dado gravado no Flask entre 15/07 e a queda (17/07 à noite) pode não estar no
stack novo.

## Módulos do painel (já existentes)
- Fluxo de 6 etapas: Agendamento → Levantamento → Projeto → Designação → Cronograma e Check-list → Encerramento.
- 5 perfis (ADM, Coordenador, Administrativo, GCI, Consultor) — **sem mais "senha mestra"**
  de emergência (existia no Flask, não existe no stack novo).
- Cadastros de referência (Sistema/ADM): Checklist, Índice de Tópicos, Modelos de Documentos.
- **Geração fiel** das fases via `docservice/` (cópia própria dos geradores, não importa de
  `webapp/`) + a ponte `legado_cli` para o assistente administrativo.
- Importação do e-mail de fechamento (IMAP), notificações por e-mail, robô da caixa — agora
  em `backend/src/email/`, `backend/src/fluxo/`.

## Processo de 21 passos (2026-07-30)

O fluxo operacional passou de **19 para 21 passos** (revisão do usuário). Entraram o **passo
5** ("Avançar para finalização da negociação", do **Comercial**, cuja descrição viaja no
e-mail do passo seguinte) e o **passo 12** ("Sinalizar Projeto assinado", do Administrativo).
De/para dos dados: `1–4` iguais · `5–10` → +1 · `11–19` → +2 — migration
`1784810000000-RenumerarPassos21.ts`. **O número do passo é a identidade no banco**
(`projeto_passos.passo`): mexer no mapa exige migrar junto.

- Três trilhas paralelas saem do passo 8: RNS (9), Projeto (10→11→12) e **Cronograma (13),
  que depende do 8** — não do 9 nem do 12.
- Passos **7 e 12** exigem marcação de assinatura + data (`marcado`/`data_marcada`);
  **11 e 19** exigem conferência; do **14** em diante é definitivo.
- Passos **4, 5, 11, 15–21**: a pessoa **redige o e-mail na tela** (chega pronto do modelo) e
  o Painel envia. Passo **9 não envia e-mail** e não tranca ninguém.
- **Consulta:** os e-mails ficam inteiros em **`emails_passo`** (inclusive os que falharam) e
  aparecem por passo junto com os documentos, para **qualquer** pessoa com acesso ao menu —
  com **download liberado a quem só tem consulta**.
- **Configurável em Sistema → Ferramentas:** *Modelos de E-mail* (a tela já existia, estava
  **órfã** — rota sem link; foi religada) agora tem um modelo por passo, slug `passo-N`;
  *Destinatários por Passo* (`destinatarios_passo`, novo) define grupos + **endereços fixos** —
  é por onde entram os dois grupos de e-mail da Rech avisados no passo 1.
- Detalhe completo em `vault/08 - Regras de Negócio/RN - Passos do Processo de Implantação.md`.

## Tipo de demanda no cadastro do cliente (2026-07-31)

O passo 1 (**Novo Cliente** → `/clientes/novo`) passou a exigir a escolha entre
**Levantamento** e **Demonstração** — os dois motivos pelos quais o Comercial aciona a
Implantação na pré-implantação (`docs/processo-implantacao.md` §2.1.1).

- Campo `projetos.tipo_demanda` (migration `1784870000000-TipoDemanda.ts`); lista em
  `TIPOS_DEMANDA` (backend `common/constants/perfis.ts`, frontend `core/models/projeto.model.ts`).
- **Obrigatório só no CADASTRO** (`CadastrarClienteDto`, `@IsIn`), não em `CreateProjetoDto` —
  projetos antigos e a edição da ficha não podem ser travados por um campo que nasceu depois.
  A combo começa **vazia** de propósito: um default classificaria a demanda errada calado.
  Guardado por `clientes-sicla/dto/cadastrar-cliente.dto.spec.ts` (a herança do DTO faria um
  `@IsOptional()` no pai revogar a obrigatoriedade aqui, sem ninguém perceber).
- A ficha do projeto só **exibe** o valor (aba Resumo). Nada no fluxo se ramifica ainda por
  Levantamento × Demonstração — se isso for desejado, é decisão nova.

## Auditoria de integridade dos 21 passos (2026-08-05)

Bateria de testes extremos (154 casos de API contra instância **isolada**) + auditoria de
código com verificação adversarial. **Nove defeitos reais, todos corrigidos**, com regressão
coberta em `e2e/` (Playwright, 29 casos) e no Jest (950 testes).

- **O grande achado: a RN-10 valia só dentro do `PassosController`.** Anexar um arquivo com
  `tipo=termo`, gerar o layout, reescrever `gci` por `PUT /projetos/:id` ou criar projeto por
  `POST /fluxo/criar` fechavam passos sem gate de designação — vários irreversíveis, gravados
  em nome de `"sistema"`. O gate desceu para `DocumentosService.registrarDocumento`, que
  consulta `PassosService.podeExecutarPasso` antes de concluir.
- **O processo travava no passo 5:** a rota de concluir exigia `carteira/alteracao` e o
  Comercial tem `consulta`; o passo 5 é dele e não tem caminho automático. A rota passou a
  exigir só `carteira` (o gate real é `podeExecutar`), e a tela mostra a ação quando
  `p.liberado` — antes `soConsulta()` escondia a coluna inteira.
- Gerar o Termo não fecha mais o passo 18 (RN-8: passo de e-mail redigido nunca conclui por
  efeito colateral); dois GCIs voltaram a receber o e-mail do passo 8 (`nomesDoCampo`); data
  de assinatura exige data real e não futura; cadastro recusa homônimo ativo; corpo grande
  responde 413 em vez de 404.
- ⚠️ **Como testar sem tocar em produção:** instância isolada na **5199**, SQLite descartável,
  `cwd` FORA de `backend/` — senão o `backend/dados/smtp.json` é encontrado e **e-mails saem
  de verdade**. Receita completa em [e2e/README.md](../e2e/README.md). O
  `playwright.config.ts` recusa a porta 5100 no boot.
- Segundo lote (os 54 achados únicos, todos verificados): a **RN-7 não se cumpria pela
  tela** — a prévia do e-mail do passo 5 era montada antes de a descrição existir, e a tela
  devolvia esse corpo, então o Administrativo recebia "Descrição do Comercial:" em branco;
  os **tokens do modelo saíam literais** ao CLIENTE (a tela oferece 25, o montador resolvia
  13); o **passo 8 fechava em nome do Administrativo**, sendo do Coordenador; o Gmail
  montava o MIME fora do `try` e o e-mail sumia do histórico; a tela deixava enviar com
  assunto/corpo vazios.
- **`ETAPAS` foi alinhado aos passos** (decisão do usuário): **Designação agora vem ANTES de
  Projeto**, no backend e no frontend. Antes o array tinha as duas invertidas e a macro-etapa
  **regredia** ao sair da Designação (stepper, funil, Kanban, `proxEtapa`). Não houve
  migração — `projetos.etapa` guarda o NOME. Junto foi preciso mover o que era indexado por
  nome e codificava a ordem antiga: `GATES.Designação` não exige mais o documento `projeto`,
  e `dataUsoOficial` passou de `CAMPOS_OBRIGATORIOS.Designação` para `.Projeto`.
  ⚠️ Ao mexer em `ETAPAS`, revise sempre `GATES`, `ACAO_ENTRADA` e `CAMPOS_OBRIGATORIOS`
  (`metricas.constants.ts`) — eles são por NOME e não acompanham a reordenação sozinhos.
- Dívida remanescente: designação casa por **nome**, não por id (`projeto_pessoas.pessoa`,
  `Projeto.gci`) — ver `docs/pendencias.md`.

## Gravação de reunião com transcrição ao vivo (2026-07-30)

O menu **Transcrição Áudio/Vídeo** ganhou uma terceira entrada, além do upload e do robô:
**gravar a reunião pelo painel** (`/protocolos/gravar`), presencial (microfone) ou remota
pelo **Teams** (áudio da aba/tela), ou as duas somadas. Atalho também na tela de
**Levantamento**, que abre em outra aba já com o cliente do projeto.

- O navegador captura, corta em trechos de 15–30 s **numa pausa da fala** (não no relógio) e
  envia; o docservice transcreve cada trecho com um worker que mantém o modelo **carregado**
  durante a reunião (`docservice/transcricao/vivo.py` + `worker_vivo.py`) — separado do
  pipeline de vídeo, que continua abrindo um subprocesso por transcrição.
- Ao encerrar: os trechos viram um `.wav` único em `PROTOCOLOS_DIR/Gravacoes/` e a
  transcrição entra no **mesmo pipeline** (IA + **resumo completo**).
- **Cliente vem da busca no SICLA** — a MESMA do Novo Cliente (passo 1), delegada ao
  `ClientesSiclaService` e reexposta em `GET /protocolos/clientes?termo=` sob a permissão
  'protocolos'. A carteira de projetos não serve: reunião acontece antes da implantação existir.
- Protocolo agora tem **`projeto_id` + `cliente` + `cliente_codigo`** (migrations
  `1784840000000` e `1784850000000`), status novo `Gravando` e origem nova `gravacao`.
- **Visibilidade nova:** a lista mostra **só o material do usuário logado**; ADM vê tudo e os
  vídeos do robô do SharePoint continuam comuns a todos
  (`backend/src/protocolos/protocolos.acesso.ts`, vale também nas rotas por id).
- **Separação de locutores (2026-07-31):** sherpa-onnx (44 MB ONNX, sem PyTorch). A tela
  pergunta **quantas pessoas** — automático inventou 7-10 vozes onde havia 2. Texto sai
  `[MM:SS] P1: ...`; o nome vive em `protocolos.mapa_locutores` e a substituição é na
  leitura (`backend/src/protocolos/locutores.ts`), então renomear é reversível. 3,3× tempo
  real com 8 threads.
- **HTTPS opcional no painel (2026-07-30):** `MIGRACAO_HTTPS_PFX`/`_SENHA`/`_PORT`; HTTP na
  5100 continua no ar em paralelo (HSTS fica desligado de propósito). Certificado pela **CA
  interna** `rechinfo-PR-ADCS-VS25-CA` — todo domínio já confia, nada a instalar nas
  máquinas (`Certificado_CA_Interna_Painel.bat`).
- **Guardião passou a vigiar os DOIS** (painel 5100 + docservice 8001) desde 2026-08-04:
  o painel reiniciou às 05:35 e o docservice ficou para trás, aparecendo horas depois como
  ECONNREFUSED na gravação. Antes ele só checava a 5100.
- ⚠️ **Reiniciar o painel NÃO reinicia o docservice** (processos separados; o Iniciar só
  sobe o docservice se a 8001 estiver livre). Ao mexer em `docservice/`, derrube os dois.
- ⚠️ **Bloqueio conhecido:** captura de áudio só funciona em **contexto seguro** (HTTPS/
  localhost) — o painel está em `http://I7M1700-01-EVE:5100`. Ver `docs/gravacao-reuniao.md`
  e `docs/pendencias.md`.

## Filtros salvos por usuário (2026-07-29)

Toda tela com filtro reabre no recorte que o usuário deixou. Base: tabela
**`preferencias_usuario`** (usuário × chave de tela → JSON) + `backend/src/preferencias/`
(`GET`/`PUT :chave`/`DELETE :chave`, escopo pelo `sub` do token, nunca por parâmetro). No
Angular, `core/services/preferencias.service.ts` (mapa carregado UMA vez pelo `authGuard`) e o
helper `core/utils/filtros-salvos.ts`, que as telas chamam no construtor — restauração
**síncrona**, gravação automática para filtro em signal e `salvar()` explícito para campo
comum de `ngModel`. 13 telas cobertas; tabela das chaves em `docs/painel-sistema.md` §5.21.
A Capacidade da equipe ganhou junto o **filtro por setor** (`usuarios.setor_atuacao`).

## Geradores Office (`tools/`)
Produzem .xlsx/.docx a partir de `tools/data/*.yaml`; saída em `exemplos/` (não versionado).
Usados tanto pela ponte `legado_cli` quanto (via cópia em `docservice/gerador/`) pelo
backend novo.

## Infra / sincronização
- GitHub: `Implantacaorech/Implantacao` (conta `Implantacaorech`). **Entrega = código no GitHub**;
  ao terminar, **commit + push** ("subir total sempre", respeitando `.gitignore`).
- Testes: `backend/` (Jest) + `frontend/` (Vitest) no CI (`.github/workflows/ci.yml`,
  jobs `backend-test`/`frontend-test`) + `tools-smoke` (best-effort).
- PR #8 (`feature/migracao-angular-backend-moderno` → `main`) ainda não mergeado; branch
  protection em `main` ainda não configurada — ver `vault/12 - DevOps/`.

## Governança de IA (esta camada)
- `.cloudignore`, `docs/guia-operacional-ia.md`, `docs/uso-eficiente-ia.md`,
  `docs/template-handoff-sessao.md`, `entrada_ia/`, `memoria_ia/`, `ia_admin/`.
- **Novo (2026-07-19):** `vault/` — Vault Obsidian, fonte de documentação técnica/
  arquitetural (Documentation as Code). Ver `vault/00 - Dashboard/`.

## ⚠️ Não confundir
O **painel operacional** (agora `backend/`+`frontend/`, clientes/projetos/cronogramas/RNS)
é **separado** da **área de governança de IA** (`ia_admin/`, `memoria_ia/`, `vault/`). Não
misturar os dois.

## ⚠️ Pendência conhecida, não corrigida nesta virada

As definições dos agentes de software em `.claude/agents/` (`painel-core`,
`documentos-geracao` etc.) ainda descrevem os caminhos do Flask antigo (`app.py`,
`routes_*`, `webapp/gl_*`) — precisam ser reescritas apontando para `backend/src/*`. Ver
`vault/19 - Roadmap/`.
