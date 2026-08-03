# Pendências — Evolução do Painel de Implantação

> Backlog vivo dos assuntos em aberto (estratégia de automação, arquitetura e próximos passos).
> Digite **"Pendências"** a qualquer momento para ver esta lista. — Atualizado em 2026-06-14.

## 🔑 Decisão que destrava a arquitetura
- [x] **Onde os dados moram?** → **DECIDIDO: rede INTERNA** (servidor na rede; app agnóstico de
  banco — SQLite agora, Postgres/nuvem depois trocando só a conexão). *(2026-06-10)*

## 🏗️ Tela "Projetos por Cliente" (espinha dorsal — o "Dossiê vivo")
- [x] **Fase 1 feita:** banco SQLite/SQLAlchemy (agnóstico) + carteira (status/etapa) + ficha CRUD por cliente + modo servidor interno (`PAINEL_HOST=0.0.0.0`).
- [x] **Feito:** status por etapa com **gates** dos documentos obrigatórios — painel na ficha (✅/⬜), aviso ao mudar de etapa sem os docs e anexo manual (ex.: Cronograma). Tríade Projeto·Cronograma·Termo encadeada.
- [x] **Feito:** gerar Mapeamento/Check List/Termo a partir da ficha + anexar (histórico + download). *(Projeto e links Drive/SICLA/RNS: depois.)*
- [x] **Feito:** **Timeline/histórico** por projeto (na ficha) — registra mudança de etapa/situação, geração/anexo de documentos e e-mails enviados; + nota manual assinada pelo perfil.
- [ ] Contatos/stakeholders por cliente (campo texto já existe; estruturar depois).
- [x] **Feito:** gerar o **Projeto** a partir da ficha — anexa o Mapeamento (.docx) preenchido e gera o Projeto (verbal+ortografia), anexando-o ao cliente.
- [x] **Feito:** **Perfis/permissões** — seletor Coordenação (vê tudo) / Consultor (vê os seus); filtra carteira e Painel Coordenação; assina a timeline. *(Filtro de visão, não login.)*
- [x] **Feito:** **Painel Coordenação** (`/coordenacao`) — KPIs (total/ativos/no prazo/atrasados/em risco/docs pendentes/time-to-value/horas), funil por etapa, situação, atrasados (uso oficial vencido) e ocupação por consultor.
- [x] **Feito:** `Iniciar_Servidor.bat` (modo servidor interno) e `.exe` no Desktop.

## ✉️ E-mail interno ("comunicação registrada")
- [x] **Feito:** conta SMTP (Config → E-mail) com senha guardada localmente (`smtp.json`, gitignored; env `SMTP_*` no servidor).
- [x] **Feito:** templates prontos — encaminhamento, compartilhamento do cronograma, encerramento.
- [x] **Feito:** disparo pela ficha (`/projetos/<id>/email`) com modelo + destinatário.
- [x] **Feito:** log de cada e-mail (envio e falha) na timeline do projeto.
- [ ] *Próximo:* disparo automático por evento (gerou Projeto → e-mail; critério de saída → encerramento).

## 🤖 Frentes de automação (roadmap)
- [x] **Feito:** **Fluxo automático de onboarding** (`/fluxo`) — começa pelo e-mail de fechamento do Comercial (modelo padrão + IMAP/colar), extrai os dados, cria a ficha, gera o pacote (Mapeamento/Check List/Cronograma), registra na timeline e **envia o pacote + resumo por e-mail aos responsáveis**. Únicos pontos manuais: designar GCI e técnico(s).
- [x] **Feito:** **Cronograma automático** — distribui as agendas pelas horas (cobradas+bonificadas), macro tópicos por etapa/módulo, datas em dias úteis; gerado pela ficha e anexado (satisfaz o gate). Fecha a tríade obrigatória.
- [ ] Integração **SICLA + RNS** (abrir/atualizar RNS(I), atividades 12/13/84). *Depende de API/banco.*
- [ ] **Dossiê vivo + Painel de portfólio** (= a própria tela Projetos por Cliente).
- [ ] **Copiloto do Consultor (IA)**: redigir rotinas, sugerir próximo passo, rascunhar e-mails, apontar riscos (RAID).
- [ ] **Pipeline de Conversão + gate de virada** (reconciliação origem×destino, SIT/UAT, pendências, docs obrigatórios).
- [ ] **Disparadores de fim de fluxo** (critério de saída do hypercare → Termo + e-mails + RNS para manutenção).
- [x] **Feito:** **Alertas proativos** — uso oficial vencido, SLA de 5 dias úteis do Cronograma, Em risco, Hypercare prolongado e projeto parado; painel no Coordenação + badge no menu (respeita o perfil).

## 🎨 UX / Navegação (redesenho)
- [x] **Feito:** redesenho da **ficha** (4 fases) — cabeçalho com stepper + KPIs + "Próxima ação"; abas Resumo/Dados/Documentos/Comunicação/Histórico; **Avançar fase** (gated) + **Gerar pendentes**; nomenclatura (Fase/Status/Go-live/GCI).
- [x] **Feito:** **Home** orientada ao fluxo (1 Onboarding → 2 Projetos → 3 Coordenação) + KPIs + ferramentas/config em cards; nav enxuta.
- [x] **Redesenho premium (identidade Rech) — Fases 1→4:**
  - **F1 · Tokens + tipografia:** paleta Rech em variáveis (brand `#163E66` / accent `#2563EB` / semânticas), fonte `Inter → Segoe UI Variable` (offline-safe), numerais tabulares, foco acessível.
  - **F2 · App shell:** menu lateral categorizado (Operação/Gestão/Sistema) + topbar (busca global, alertas, perfil) no lugar da nav horizontal; responsivo (drawer).
  - **F3 · Home "Visão geral":** dashboard de entrada — KPIs + projeto em foco (stepper) + próximas ações + alertas.
  - **F4 · Kanban por fase:** carteira com vista Kanban (4 colunas) ⇄ Tabela, filtro nas duas vistas.

## 🖥️ Infra / Banco em Docker
- [x] **Feito:** suporte a **Postgres em Docker** (`docker-compose.yml` + `psycopg2` no build) — app agnóstico via `PAINEL_DB_URL`.
- [x] **Feito:** **Docker Engine no WSL2** instalado; Postgres 16 (container `painel-db`) no ar; painel cria as tabelas; auto-start via pasta de Inicialização + keep-alive da VM (`painel-keepalive.sh`).
- [x] **Feito:** persistência do keep-alive validada (VM viva 8 min ociosa) e **dados reais migrados** SQLite → Postgres. Painel aponta para o Postgres via `PAINEL_DB_URL` (variável de usuário); `.exe` confirmado lendo do banco.
- [x] **Feito:** **backup automático** do Postgres — `pg_dump` diário (22:00) via cron do WSL para `C:\PainelBackups` (gzip, mantém 14 dias). Restauração documentada em `tools/painel-backup.sh`.
- [ ] **Trocar a senha padrão** do Postgres (`painel2026`) no `docker run`, na `PAINEL_DB_URL` e no `painel-backup.sh`.

## 🚀 Evolução — visual, tecnologia e observabilidade (jun/2026)
- [x] **Robustez:** servidor de produção **waitress**, `secret_key` por env/token, rota **/health**, logging em arquivo.
- [x] **Observabilidade:** tela **Atividade** (`/atividade`) — feed global de tudo + métricas de uso (30 dias) + funil por fase.
- [x] **Visual:** **gráficos Chart.js** no Coordenação (bundlado offline), favicon + versão, **toasts + spinners**, **busca/filtro** na carteira, responsivo (celular).
- [x] **Qualidade/Segurança:** **login** opcional por senha, **suíte pytest** (7 testes), **CI GitHub Actions**, **auto-migração** aditiva de schema (no lugar do Alembic).
- [x] **Notificações:** **digest diário por e-mail** (resumo de alertas) + agendador interno (DIGEST_HORA) + botão manual.
- [ ] *Parcial/adiado:* consolidação ampla das cores em variáveis CSS (baixo ROI × risco); Alembic completo (substituído pela auto-migração).

## 🏛️ Fluxo governado (proposta de estruturação — jun/2026)
- [x] **F1 — Perfis + permissões:** login por usuário (senha hash), 4 perfis (ADM/Coordenador/GCI/Consultor), gestão de usuários (`/usuarios`, só ADM), permissões por perfil (UI + backend 403), filtro de visão (GCI/Consultor veem os seus).
- [x] **F2 — 4 etapas:** Levantamento → Projeto → Cronograma e Check-list → Encerramento (gates encadeados + migração automática das etapas antigas).
- [x] **F3 — Designação:** Coordenador designa GCI e Consultores **por módulo** (selects de usuários) → notifica os designados + timeline.
- [x] **F4 — Notificações por evento:** os 10 eventos disparam e-mail à Coordenação (fechamento, conclusões de etapa, documentos gerados, encerramento) — usa o envio configurado (Gmail/SMTP).
- [x] **A — Robô da caixa:** thread em segundo plano (a cada `IMAP_POLL_MIN`, default 10 min) lê os e-mails NÃO LIDOS marcados `[IMPLANTA…]`, **cria a ficha automaticamente**, marca o e-mail como lido (não reprocessa) e notifica a Coordenação. Liga sozinho no modo servidor quando o IMAP está configurado.
- [x] **B — Levantamento ao designar:** ao designar o **GCI**, o sistema **gera o Levantamento automaticamente** (documento para o GCI preencher) e anexa à ficha.
- [x] **C — Auto-avanço de etapa:** ao gerar o deliverable da etapa, o projeto **avança sozinho** (Projeto→Cronograma, Cronograma+Check-list→Encerramento). O **Levantamento** é a única conclusão confirmada pelo humano (botão Avançar), pois o documento é preenchido fora do sistema.
- [x] **D — Geração só na etapa certa:** a geração de um documento é **bloqueada fora da sua etapa** (ex.: não gera Termo no Levantamento), com aviso amigável — reforça a sequência além do perfil.
- [x] **E — Pré-visualização (WYSIWYG):** visualizador embutido (`/projetos/<id>/doc/<doc_id>/ver`) renderiza o documento gerado (.docx/.xlsx) como **folha A4 na tela** — botão **👁 Ver** em cada documento da ficha. Serve para Projeto, Levantamento, Cronograma e Termo; sem precisar baixar/abrir o Office.
- [x] **F — Cronograma e Check-list editáveis + histórico:** tabelas editáveis no painel (`/projetos/<id>/cronograma` e `/checklist`) — adicionar/remover/editar linhas, **seed** pelo plano automático/roteiro dos módulos, **histórico de modificações linha-a-linha** (quem mudou o quê, de→para) e botão **gerar o .docx do cronograma editado** (anexa e satisfaz o gate).

## ✉️ E-mail / Integração Gmail
- [x] **Feito:** envio pela **API do Gmail (OAuth/HTTPS)** — contorna o bloqueio de SMTP da rede (porta 443). Config → Gmail API.
- [x] **Feito:** IMAP do Gmail (entrada) funcionando com senha de app; SMTP da rede bloqueado (usar a API).
- [ ] *Você:* autorizar a API do Gmail (criar credencial OAuth + Autorizar) para o envio sair de verdade.

## ⚙️ Dependências / pré-requisitos honestos
- [ ] Acesso ao SICLA/SIGER (API ou banco) para a integração.
- [ ] Chave da API da IA + teto de custo definido.
- [ ] Estruturar dados que hoje estão soltos (YAMLs por cliente).
- [ ] **HTTPS (ou origem liberada) para a gravação de reuniões** — *bloqueio real, 2026-07-30.*
  A gravação com transcrição ao vivo (`/protocolos/gravar`) usa `getUserMedia`/
  `getDisplayMedia`, que **só existem em contexto seguro**. O painel é servido em
  `http://I7M1700-01-EVE:5100` (origem insegura), então a tela sobe mas os botões ficam
  bloqueados, com a explicação na própria página. Caminhos: (a) publicar em **HTTPS**;
  (b) política do Edge/Chrome `OverrideSecurityRestrictionsOnInsecureOrigin` com essa origem
  (distribuível por GPO); (c) usar `http://localhost:5100` na própria máquina do servidor.
  Detalhe em [gravacao-reuniao.md](gravacao-reuniao.md). Enquanto isso, o upload manual da
  mesma tela continua entregando o mesmo resultado (só sem transcrição durante a reunião).

## 📐 Conformidade com os Padrões de Desenvolvimento da Rech
> Auditoria de 2026-07-21 contra o `PADRAO-RECH.md` rev. 2.0.0. Ver o relatório completo e o
> plano de adequação no histórico da sessão. **Revisitado em 2026-07-29** (auditoria da stack
> obrigatória — linguagens e banco); o que mudou está nos três itens marcados abaixo.

### Banco de dados (§4.8) — conforme, com a documentação corrigida
- [x] **MariaDB confirmado em produção** (2026-07-29): `12.2.2-MariaDB`, utf8mb4, db
  `painel_novo`. **Mas não roda em Docker** — é serviço **NATIVO** do Windows na porta 3306.
  O container `painel-db-mariadb`, citado no CLAUDE.md/Vault/runbooks, não existe mais nesta
  máquina (o Docker Desktop nem responde). CLAUDE.md e o Vault foram corrigidos.
- [x] **MariaDB virou o único dialeto aceito** — `MIGRACAO_DB_URL` com prefixo de outro banco
  agora **falha o boot** (`configuration.ts:exigirMariaDb`), em vez de virar Postgres em
  silêncio; o caminho Postgres saiu de `configuration.ts`, `data-source.ts` e
  `database.module.ts`. SQLite fica só como banco descartável de dev/teste.
- [x] **Guarda automática** — `backend/src/common/conformidade-stack.spec.ts` (10 testes, roda
  em `npm test` e no CI): recusa driver de banco fora da lista permitida, Python fora das
  pastas declaradas e regressão do Postgres no config.
- [x] **Backup do MariaDB consertado** — `tools/Painel_Novo_Backup_MariaDB.ps1` chamava
  `docker exec painel-db-mariadb mysqldump`; sem Docker, o comando falhava, o `Out-File`
  gravava **0 byte** e o script ainda logava `ok`. **Janela exata da falha: 27, 28 e 29/07**
  (zips de 176 bytes), que é quando o MariaDB saiu do Docker para instalação nativa. O
  **último dump bom é o de 23/07** (1.012.729 bytes); 20/07 e 22/07 também estão lá, mas
  vencem na retenção de 14 dias em 03/08 e 05/08. Agora usa o cliente local `mariadb-dump`, grava com
  `--result-file` (sem o pipe da PS 5.1, que mete BOM) e **valida o dump** (código de saída,
  tamanho mínimo, rodapé `Dump completed`, presença de `CREATE TABLE`) antes de compactar.
- [x] **Backup rodado e consertado de novo em 2026-08-02** — zip de **1.085.739 bytes**
  (dump de 4,15 MB). A correção de 29/07 não bastava: **nenhum backup do `painel_novo`
  saiu entre 30/07 e 02/08**, e o último bom era o de **23/07**. Duas causas encadeadas,
  ambas invisíveis porque o painel continuava no ar (ele usa a `MIGRACAO_DB_URL`):
  1. **Senha obsoleta no ambiente.** Havia um `PAINEL_NOVO_MARIADB_SENHA` antigo (32
     caracteres) e o script deixava o override VENCER a URL da aplicação (24). Resultado:
     `Access denied for user 'painel'@'localhost'` todo dia. Agora os `PAINEL_NOVO_*` só
     **preenchem o que a URL não trouxe**, e o script AVISA no log quando divergem —
     backup que autentica diferente da aplicação é alarme falso esperando acontecer.
  2. **`MYSQL_PWD` deixou de funcionar** no cliente do MariaDB 12.2 (ignora a variável e
     tenta conexão sem senha, com o aviso contraditório "insecure passwordless login").
     Trocado por `--defaults-extra-file` temporário — mantém a senha fora da linha de
     comando, que era a razão de usar `MYSQL_PWD`.
- [ ] **Remover a variável de ambiente `PAINEL_NOVO_MARIADB_SENHA`** — hoje ela é ignorada
  (a URL vence) e só gera o aviso no log. É lixo de uma troca de senha antiga.
- [ ] **`C:\PainelBackups\backup_novo_mariadb.log` está com encoding misturado** — as linhas
  de ERRO saíram ilegíveis (UTF-16 lido como UTF-8), o que ajudou os 4 dias de falha a
  passarem despercebidos. O `Log()` usa `Out-File -Encoding utf8`; padronizar e reescrever.
- [ ] **Nada monitora o backup.** Ninguém foi avisado em 4 dias de falha consecutiva. Ligar
  ao digest diário ou ao /api/health uma checagem de "último zip < 48 h e > 100 KB".
- [x] **Sobra do Postgres removida do repositório** (2026-07-29): `migrations/` (10 migrations
  de DDL Postgres), `seeds/migrar-legado.ts` (+ script `migrar:legado` — migração do Flask,
  concluída em 2026-07-19, e único consumidor de `pg`), as dependências `pg`/`@types/pg` e o
  `docker-compose.yml` (Postgres 16, container `painel-db`). A guarda passou a reprovar a
  volta de qualquer uma.
- [x] **`projeto_old/` removido** (2026-07-29) — 116 arquivos, 1,4 MB, painel Flask desligado.
  O rollback que justificava a pasta **já não era possível**: o Postgres do Flask não existe e
  o dump que o plano de virada citava (`painel_20260717_220001.sql.gz`) saiu na retenção.
  Recuperável pelo histórico do git.

### Linguagens (§4.2/§4.7) — o porte do Python está pela metade
- [!] **Achado de 2026-07-29:** os 14 geradores Office em TypeScript (`backend/src/geradores/`,
  com 104 testes de equivalência) **não são chamados por ninguém** — `grep` por importação
  em `backend/src` não acha um único consumidor. A geração real de documentos em produção
  continua 100% em Python: `docservice/` (FastAPI: `/gerar/documento-fiel`,
  `/gerar/cronograma-visitas`, `/preview`, `/transcrever`) e a ponte `webapp/legado_cli.py`
  (chamada por `documentos.controller.ts` e `fluxo.service.ts`). Ou seja: o item "14 de 14
  portados" abaixo é verdade quanto ao **código escrito**, não quanto ao **código em uso**.
- Python que resta hoje, por pasta: `docservice/` (20 arquivos versionados), `tools/` (29),
  `webapp/` (4), `ia_admin/` (1 — o mais barato de portar) e `projeto_old/` (39, morto).

- [ ] **Migrar o repositório para o GitLab interno** (`rech/javascript`) — **adiado por decisão
  do usuário em 2026-07-21, a tratar depois.** Hoje o remoto é
  `github.com/Implantacaorech/Implantacao`, o que viola §3/§3.3/§3.4 (GitHub só para open source
  aprovado pela direção). É o achado de maior risco de governança: código corporativo fora do
  repositório oficial, sem o backup e a auditoria corporativos.
  Procedimento (§3.6): criar o projeto no GitLab, depois
  `git remote set-url origin https://gitlab.rech.com.br/gitlab/rech/javascript/<projeto>.git && git push -u origin --all`.
- [ ] **Exceção §4.3 para a transcrição** (`docservice/transcricao`, faster-whisper) — validar com
  o **DevTools**, declarando a verificação das alternativas em Rust (`whisper-rs`, `candle`, `ort`)
  e registrando a justificativa no README.
- [ ] **Homologar o pipeline Node/TS com o DevTools** (§7.1) — não há template compartilhado ainda.
- [ ] **Publicar a rev. 2.0.0 do padrão na URL canônica** — a cópia local está à frente da canônica
  (que ainda responde 1.0.0, sem a §4.8 de aplicações web).
- [ ] **Acessibilidade: 16 avisos do ESLint nos templates** (`npm run lint` no frontend) —
  `autofocus` (3), `label` sem controle associado (4), clique sem equivalente de teclado (4) e
  correlatos. Entraram como **aviso** para não bloquear o pipeline com dívida antiga; corrigir
  muda comportamento de UI e deve ser mudança própria. 3 são auto-corrigíveis (`--fix`).
- [ ] **Porte dos componentes Python para Node/TS** (§4.2/§4.7) — `tools/` (28 arquivos),
  `docservice/gerador/` (11) e a ponte `webapp/` (4). Aprovado em 2026-07-21; fazer com testes
  de caracterização antes (§4.7 passo 1) e equivalência de saída dos .xlsx/.docx confirmada
  antes de desativar o original.
  - [x] **Geradores Office: 14 de 14 portados** (2026-07-21), em `backend/src/geradores/` —
    104 testes. Cada um prova equivalência contra o snapshot do original em
    `tools/caracterizacao/`, e os `.docx` gerados pelo TS foram conferidos também com
    python-docx (parser independente do extrator próprio).
  - [ ] **Desativar o lado Python dos geradores.** Nada foi removido: os dois lados convivem.
    Antes de desligar, decidir quem passa a chamar os geradores novos (hoje a ponte
    `webapp/legado_cli.py` chama os Python) e conferir um documento de cada tipo ABERTO NO
    WORD — o contrato de caracterização cobre texto de corpo, tabelas e timbre, não a
    formatação inteira.
  - [ ] Restam os demais componentes Python previstos no item acima: `docservice/gerador/`
    (11 arquivos) e a ponte `webapp/` (4).

## 🏛️ Adequação ao Guia Mestre de Arquitetura (ADR-0002 — 2026-07-31)
> Norma adotada: [`vault/23 - Padrões/Guia Mestre de Arquitetura de Desenvolvimento.md`](<../vault/23 - Padrões/Guia Mestre de Arquitetura de Desenvolvimento.md>)
> (Controller → Service → Repository). Decisão e contexto no
> [ADR-0002](<../vault/17 - ADR/ADR-0002 - Adocao do Guia Mestre de Arquitetura.md>).
> Aplicação **faseada**: o backend tem 446 arquivos e está em produção desde 19/07 — a
> reescrita de uma vez não se paga. Cada fase termina com a guarda do CI travando o ganho.

### Fase 1 — norma, guardas e piloto *(concluída em 2026-07-31)*
- [x] **Guia registrado como norma** no Vault + ADR-0002, com a tradução das camadas para
  cada frente (NestJS · Angular · FastAPI) e a regra de onde cada repository mora.
- [x] **Módulo-piloto `plano-cronograma`** — corrigida a **única violação real de camada do
  backend**: o controller injetava `Repository<Projeto>`/`Repository<Evento>` e fazia
  `findOne`/`save`. Agora tem `repositories/` (3), `PlanoCronogramaService` de orquestração
  e controller só de entrada/saída. **38 → 46 testes** (as regras que viviam no controller —
  404, timeline, releitura do estado — não tinham teste; só eram alcançáveis por HTTP).
- [x] **`RepositoriosModule`** (`database/repositories/`) — ponto único de acesso às
  entidades transversais `Projeto` e `Evento`, no lugar de repetir
  `TypeOrmModule.forFeature([Projeto])` em cada módulo.
- [x] **6 documentos do guia** escritos para o piloto (`backend/src/plano-cronograma/docs/`).
- [x] **Rate Limit** (`@nestjs/throttler`) — 300 req/min por IP, ajustável por
  `MIGRACAO_RATE_LIMIT`/`MIGRACAO_RATE_LIMIT_TTL`. `/api/health` fica de fora: o Guardião
  consulta em intervalo curto do mesmo IP, e um 429 ali o faria reiniciar um painel saudável.
- [x] **`SELECT 1` do healthcheck saiu do controller** para um `HealthService` — sem isso a
  regra "controller não acessa banco" nasceria com exceção.
- [x] **3 guardas no CI** — `backend/src/common/conformidade-arquitetura.spec.ts` (14 testes),
  `frontend/src/app/conformidade-arquitetura.spec.ts` (6) e
  `docservice/tests/test_conformidade_arquitetura.py` (5). O docservice **não tinha nenhum
  teste rodando no CI** até aqui; ganhou job próprio.
- [x] **Gate de cobertura ligado** no patamar medido, com **1 ponto de folga** (statements 59
  / branches 52 / functions 62 / lines 59, contra os 60,2 / 53,2 / 63,3 / 60,2 reais). A
  folga é deliberada: no fio do medido, qualquer commit pequeno derruba o CI por ruído e o
  time aprende a ignorar o gate. O CI passou a rodar o backend com `--coverage`, porque o
  `coverageThreshold` só é avaliado quando a cobertura é coletada.
- [x] **Piloto do frontend** — `permissoes.component.ts` deixou de falar HTTP direto (virou
  `PermissoesAdminService`). É a tela de controle de acesso, onde a separação importa mais.
- [x] **Correção de segurança junto** — uma rota do docservice devolvia `str(e)` num **500**
  (podia expor caminho de arquivo e detalhe de ambiente). Agora responde mensagem genérica,
  e a guarda impede a volta. 4xx com `str(e)` continua permitido: é mensagem de domínio.

### Fase 2 — espalhar a camada Repository *(a fazer)*
- [ ] **36 módulos restantes** — hoje 46 arquivos ainda injetam `Repository<T>` direto no
  Service. Ordem sugerida, pelos que mais concentram acesso: `painel` (5), `passos` (4),
  `cronograma` (3), `catalogos` (3), depois os de 1–2. Copiar do piloto.
- [ ] **Docs de módulo** conforme os módulos forem adequados (6 arquivos cada). Escrever
  junto com o porte — doc gerada em lote vira esqueleto e não é lida.
- [x] **Componentes Angular com `HttpClient`: dívida ZERADA** (2026-08-02). Os três viraram
  services em `core/services/`: `permissoes` → `PermissoesAdminService` (piloto),
  `matriz-detalhada` → `MatrizDetalhadaService`, `matriz-funcoes` → `MatrizFuncoesService`.
  A catraca `COMPONENTES_COM_HTTP_PENDENTES` ficou **vazia** — a regra agora vale para todo
  componente, sem exceção, e um novo com HTTP direto quebra o CI.
  > Efeito colateral nos testes, registrado porque volta a aparecer a cada extração: a
  > chamada passou a atravessar duas camadas de promise (componente → service → HttpClient),
  > e os specs que faziam um único `await fixture.whenStable()` entre duas requisições
  > passaram a falhar com "found none". Daí o helper `assentar()` nos specs de matriz.
- [ ] Ao adequar cada módulo, **apertar a guarda**: promover a regra de "só o piloto" para
  "todo módulo já portado".

### Fase 3 — estrutura de pastas *(a fazer — a mais invasiva)*
- [ ] **`src/modules/`** — os 37 módulos estão na raiz de `src/`. É mecânico e o compilador
  valida, mas toca centenas de imports; fazer numa mudança própria, sem nada junto.
- [ ] **Entidades por módulo** — as 38 estão centralizadas em `database/entities/`. Depende
  de rever `index.ts`, `data-source.ts` e o caminho das migrations. Entidade transversal
  (`Projeto`, `Evento`) continua central por decisão, não por omissão.

### Dívida do harness de equivalência *(aberta)*
- [x] **`comparacao.ts` (.xlsx) corrigido** (2026-08-02): a máscara `<HOJE>` trocava QUALQUER
  célula igual à data de hoje, inclusive data de NEGÓCIO — o oposto do que o próprio
  comentário do arquivo dizia. Em 02/08 o dia 2 do hypercare da fixture (janela desde
  01/08) virou `<HOJE>` e a suíte quebrou **sozinha**, sem ninguém tocar em código. Agora a
  máscara casa o rótulo ("gerado em"/"Atualizado em"). Travado por `comparacao.spec.ts`.
- [ ] **`comparacao-docx.ts` tem o mesmo padrão** — não quebrou hoje e **não pode receber a
  mesma correção**: no `gerar_aceite_uat` a célula "Data do aceite" é a data de geração
  sozinha, sem rótulo na mesma string (o rótulo está na célula anterior). Ali mascarar a
  célula inteira está certo. Precisa de critério por POSIÇÃO/contexto, não por conteúdo —
  mudança própria, com o snapshot em mãos.
- [ ] **`tools/caracterizacao.py` idem** — é quem GERA os snapshots. Não roda no CI, então o
  defeito só aparece se alguém regenerar num dia que colida, produzindo um snapshot errado.
  Mesma decisão de critério do item acima.

### Fase 4 — cobertura até 80% *(a fazer)*
- [ ] Hoje: **60,07% statements · 53,03% branches · 63,63% functions** (886 testes verdes).
- [ ] Subir o gate a cada fase, **nunca baixar**. Priorizar o que a fase 2 tocar: módulo
  portado sai com teste do repository e do service, como no piloto.
- [ ] Frontend: 440 testes em 58 arquivos, **sem gate de cobertura ainda** — o builder
  `@angular/build:unit-test` precisa de configuração própria; avaliar junto da fase 2.

## 🔁 Processo de 18 passos (revisão de 2026-07-22)
- [x] Mapa dos 18 passos, vínculo pessoa×papel (vários levantadores/consultores), RNS de
  quantidade livre, gates por responsável, paralelismo (10 não espera o 8), conferência
  (9 e 16) e irreversibilidade (11 em diante). Backend + tela, 24 testes.
- [x] Passo 6 passou do Administrativo/GCI para o **Coordenador** (indica GCI e técnicos).
- [x] **Disparo automático dos e-mails de cada passo** — 12 e-mails, com destinatário
  resolvido por perfil, por vínculo de papel ou por campo do projeto.
- [x] **E-mail do Comercial**: campo novo `comercialEmail`, preenchido com o REMETENTE do
  e-mail de fechamento (era o bloqueio do passo 3).
- [x] **Anexar e-mail encaminhado do Outlook** (.msg/.eml) nos passos 3 e 4.
- [x] **Passo 14 grava `dataEncerramento`** (só quando ainda está vazio).
- [x] Telas de Designação migradas: `agendar` aceita vários levantadores e
  `designarConsultores` grava o vínculo por papel.
- [ ] **ANEXOS nos e-mails.** O passo 18 diz "Termo de Encerramento em anexo" e o 12
  menciona vídeos/BI, mas o envio ainda não anexa arquivo — o texto sai, o anexo não.
- [ ] **Teste e2e intermitente.** Em 1 de 4 execuções, `email-fluxo.e2e-spec` › "criar
  registra o projeto e a timeline recebe o evento de etapa" falhou; não reproduziu nas
  outras três, nem com `--runInBand`. Causa não isolada. Não toca em passos, mas
  apareceu na mesma sessão em que o módulo foi criado — investigar antes de confiar.

## ▶️ Próximo passo combinado
- [ ] Decidir "onde os dados moram" → **começar pelo Hub "Projetos por Cliente" com banco**.

---
## 🟢 Resolvidos (histórico)
- **INCIDENTE: Painel fora do ar ~13h (22/07/2026, 00:00→13:21).** O container
  `painel-db-mariadb` estava com `restart=no`: quando o Docker parou, o banco não voltou
  e o Painel passou a falhar com `ECONNREFUSED 127.0.0.1:3307`. O guardião funcionou —
  reiniciou 159 vezes no dia — mas ninguém foi avisado, porque **não há alerta de queda
  prolongada**. Corrigido: container agora é `restart=unless-stopped`.
  - [ ] **Alertar quando o guardião falhar N vezes seguidas.** Reiniciar em laço por 13h sem
    avisar ninguém é o verdadeiro defeito; o `restart=no` foi só o gatilho.
  - [ ] **Backup do banco não rodou em 21/07** (último: 20/07 22:00). Verificar por que a
    tarefa pulou — provavelmente máquina desligada às 22:00, sem reagendamento.
- **CAUSA RAIZ do incidente recorrente: o Docker Desktop não sobe sozinho** — repetiu em
  27/07/2026. O container é `restart=unless-stopped`, mas isso só o reergue DEPOIS que o
  engine sobe. Diagnóstico: `com.docker.service` está em StartType=Manual e parado;
  `AutoStart=False`; sem entrada de autostart no login. Se o Docker inteiro para (reboot ou
  ele mesmo encerra), o MariaDB não volta e o Painel fica em `ECONNREFUSED 3307`. Restaurado
  à mão nas duas vezes.
  - [ ] **Decidir como o Docker sobe no boot** (decisão do usuário — envolve como a máquina
    opera): (a) marcar "Start Docker Desktop when you sign in" + auto-login da máquina; ou
    (b) rodar o banco como serviço Windows headless (não depende de sessão de usuário). Sem
    isso, todo reboot sem login manual = Painel fora do ar até alguém subir o Docker.
- **Porte dos 14 geradores Office de Python para Node/TS** — 2026-07-21. Rede de segurança
  primeiro (§4.7): `tools/caracterizacao.py` fotografa o conteúdo observável de cada gerador
  e cada porte prova equivalência contra esse snapshot. Dois furos foram encontrados NA
  PRÓPRIA rede durante o trabalho: o harness comparava o último arquivo em ordem alfabética
  de `exemplos/` (5 snapshots eram de artefatos de outros clientes, de semanas antes) e o
  extrator ignorava tabulação, `gridSpan` e `vMerge`. Os dois consertados e revalidados.
- **Bug de fuso: "hoje" era calculado em UTC** — 2026-07-21. `hojeIso()` e 4 cópias inline
  usavam `toISOString()`; como o Brasil é UTC-3, das 21h à meia-noite o Painel considerava
  hoje = amanhã, todo dia. O efeito visível: agendar para o DIA CORRENTE era recusado com
  "não é possível agendar em data passada"; a data de início do projeto criado pelo robô da
  caixa saía com um dia a mais; as janelas de disponibilidade descartavam o próprio dia.
  Apareceu sozinho, quando o relógio cruzou as 21h durante a sessão e um teste virou.
- **Dívida de lint zerada e passo do CI voltou a bloquear** — 2026-07-21. Eram 1243 achados
  (1152 de formatação); o passo estava `continue-on-error` desde que foi criado, então
  achado novo se perdia no meio dos velhos. Entre os 73 de código havia defeito real (o de
  fuso acima e um helper de teste que descartava seus overrides) e 15 falsos positivos que,
  "corrigidos" ingenuamente, fariam a **senha voltar a sair no JSON** da API — eram o idioma
  `const { senha: _senha, ...cfg }`; a configuração passou a respeitar o prefixo `_`.
- Levantamento passa a **preencher o modelo real** (não reconstrói do zero) — 2026-06-10.
- Tela "Criação dos Templates" (abas) · Mapa mental do setor · espaçamento 1.15 — 2026-06-10.
- Modo IA (reconferência verbal + ortografia) e Conversões com "horas" automático — 2026-06-10.
