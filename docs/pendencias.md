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

## 📐 Conformidade com os Padrões de Desenvolvimento da Rech
> Auditoria de 2026-07-21 contra o `PADRAO-RECH.md` rev. 2.0.0. Ver o relatório completo e o
> plano de adequação no histórico da sessão.

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

## ▶️ Próximo passo combinado
- [ ] Decidir "onde os dados moram" → **começar pelo Hub "Projetos por Cliente" com banco**.

---
## 🟢 Resolvidos (histórico)
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
