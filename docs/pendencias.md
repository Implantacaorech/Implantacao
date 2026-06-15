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

## 🖥️ Infra / Banco em Docker
- [x] **Feito:** suporte a **Postgres em Docker** (`docker-compose.yml` + `psycopg2` no build) — app agnóstico via `PAINEL_DB_URL`.
- [x] **Feito:** **Docker Engine no WSL2** instalado; Postgres 16 (container `painel-db`) no ar; painel cria as tabelas; auto-start via pasta de Inicialização + keep-alive da VM (`painel-keepalive.sh`).
- [x] **Feito:** persistência do keep-alive validada (VM viva 8 min ociosa) e **dados reais migrados** SQLite → Postgres. Painel aponta para o Postgres via `PAINEL_DB_URL` (variável de usuário); `.exe` confirmado lendo do banco.
- [x] **Feito:** **backup automático** do Postgres — `pg_dump` diário (22:00) via cron do WSL para `C:\PainelBackups` (gzip, mantém 14 dias). Restauração documentada em `tools/painel-backup.sh`.
- [ ] **Trocar a senha padrão** do Postgres (`painel2026`) no `docker run`, na `PAINEL_DB_URL` e no `painel-backup.sh`.

## ⚙️ Dependências / pré-requisitos honestos
- [ ] Acesso ao SICLA/SIGER (API ou banco) para a integração.
- [ ] Chave da API da IA + teto de custo definido.
- [ ] Estruturar dados que hoje estão soltos (YAMLs por cliente).

## ▶️ Próximo passo combinado
- [ ] Decidir "onde os dados moram" → **começar pelo Hub "Projetos por Cliente" com banco**.

---
## 🟢 Resolvidos (histórico)
- Levantamento passa a **preencher o modelo real** (não reconstrói do zero) — 2026-06-10.
- Tela "Criação dos Templates" (abas) · Mapa mental do setor · espaçamento 1.15 — 2026-06-10.
- Modo IA (reconferência verbal + ortografia) e Conversões com "horas" automático — 2026-06-10.
