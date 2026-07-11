# Diagnóstico geral do projeto

> Auditoria técnica — 2026-07-10. Escopo: repositório `Implantacao` (agentes/skills de negócio +
> painel Flask `webapp/` + geradores `tools/`). Adaptado à realidade real do projeto (monolito
> Flask único, sem containers/K8s além do banco) — não ao template genérico de infraestrutura
> corporativa que originou esta auditoria.

## 1. Resumo executivo

O repositório tem **duas camadas coexistindo por design**: (1) uma camada de **governança de IA**
(agentes/skills em `.claude/`, docs de processo, memória em `memoria_ia/`) que padroniza o
processo de implantação do ERP SIGER®, e (2) um **painel operacional Flask** (`webapp/`) que
conduz o fluxo real de implantação por cliente, com banco Postgres, geração fiel de documentos
Office e integrações (e-mail, disponibilidade Oracle).

O painel é um **monolito Flask pequeno-médio** (~7.400 linhas em `webapp/`, banco único,
um servidor Windows), operado por uma equipe pequena, sem ambientes formais (dev/homologação/
produção) além de "notebook do desenvolvedor" vs "servidor". Já existem mecanismos de
resiliência acima da média para o porte do projeto: CI no GitHub Actions, suíte pytest
(~98 testes), smoke checks dedicados, backup diário do Postgres, um "robô de integridade"
diário e um guardião de uptime (`Guardiao_Painel.vbs`) — adicionado nesta mesma semana
(commit `1645949`). A maior fragilidade não é ausência de prática, é a **concentração em uma
única máquina/pessoa** (notebook do usuário `everton`) sem redundância.

O risco mais crítico e mais fácil de eliminar é a **senha padrão do Postgres em texto plano
no repositório** (`docker-compose.yml` e `tools/painel-backup.sh`, valor `painel2026`) —
já reconhecida como pendência conhecida em `docs/runbooks-operacao.md` §9, mas ainda não
executada.

## 2. Arquitetura atual

```
Implantacao/
├── webapp/                 painel Flask (monolito): app.py (rotas core) + routes_*.py
│                            (8 módulos de rota registrados via register(app, **deps))
│                            + db.py (SQLAlchemy, 2266 linhas: modelos + seeds + migração aditiva)
│                            + gl_*.py (geração fiel de documentos: comum/levantamento/projeto/termo/xlsx)
│                            + integrações: mailer, imap_intake, gmail_api, disponibilidade
│                            + robo_integridade.py, verificar_app.py, verificar_tudo.py (smoke/saúde)
├── tools/                  geradores Office standalone (python-docx/openpyxl) a partir de YAML
│                            + scripts de infra: painel-backup.sh, painel-backup-setup.sh, painel-keepalive.sh
├── docker-compose.yml      Postgres 16 único container (painel-db)
├── Iniciar_Servidor.bat    sobe o painel a partir da fonte (waitress); SEM build de .exe
├── Guardiao_Painel.vbs     watchdog: sobe o servidor se /health não responder (Tarefa Agendada, 5 min)
├── .claude/agents/         13 agentes: 7 de NEGÓCIO (papéis do processo) + 6 de SOFTWARE
│                            (painel-core, qualidade, documentos-geracao, integracoes-operacao,
│                             documentacao-contexto, seguranca-permissoes)
├── .claude/skills/         24 skills (uma por etapa do processo de implantação)
├── docs/, memoria_ia/      fonte de verdade do processo + memória de contexto para IA
└── .github/workflows/ci.yml  compileall + verificar_app.py + pytest + smoke dos geradores
```

**Padrão arquitetural:** monolito modular por rota (`routes_*.py` com `register(app, **deps)`,
nunca `from app import …`), fronteira de território já formalizada entre agentes de software
(ver `docs/agentes-software.md`). Sem microsserviços, sem containers de aplicação (só o banco
roda em container), sem fila de mensagens, sem cache distribuído.

**Persistência:** Postgres 16 em Docker/WSL2 em produção (`PAINEL_DB_URL`); SQLite local
(`dados/painel.db`, não versionado) em desenvolvimento — SQLAlchemy agnóstico de dialeto, mas
**sem paridade de ambiente formal** (ver risco R-04 no relatório de falhas).

**Deploy:** a partir da fonte via `waitress` (WSGI de produção), disparado por `.bat`;
fluxo `PyInstaller` (`build_painel_exe.py`) é **legado explícito** — não gerar `.exe` salvo
pedido explícito (regra em `CLAUDE.md`).

## 3. Tecnologias encontradas

| Categoria | Tecnologia | Observação |
|---|---|---|
| Linguagem | Python 3.12 | fixado no CI (`actions/setup-python@v5`) |
| Web framework | Flask ≥3.0 | sem Flask-Login/Flask-WTF/Flask-Limiter — auth e CSRF são caseiros |
| ORM | SQLAlchemy ≥2.0 | migração **aditiva automática** (`_auto_migrar`), sem Alembic |
| Banco | PostgreSQL 16 (prod, Docker) / SQLite (dev) | driver `psycopg2-binary` |
| Servidor WSGI | `waitress` ≥3.0 | substitui `app.run` de desenvolvimento |
| Documentos Office | `python-docx`, `openpyxl` | motor de substituição fiel (`tools/preencher_layout.py`) |
| IA opcional | `anthropic` ≥0.40 | só ativa com chave local (`tools/data/anthropic_key.txt`, gitignored) |
| E-mail | SMTP nativo + Gmail API (`google-auth*`, `httpx`) | fallback quando SMTP é bloqueado na rede |
| Transcrição | `faster-whisper` | local, CPU, para Protocolos de Treinamento |
| Windows | `pywin32` (condicional `win32`) | preview fiel via Word COM |
| CI | GitHub Actions (`ci.yml`) | compileall → smoke → pytest → smoke dos geradores (best-effort) |
| Orquestração de IA | Claude Code (`.claude/agents`, `.claude/skills`) | camada de processo, não de runtime |

Sem: Docker para a aplicação (só o banco), Kubernetes, filas (Celery/RabbitMQ), cache
(Redis/Memcached), CDN, load balancer, WAF, SSO/OAuth para login do painel, ferramenta de
observabilidade (APM/Sentry), scanner de dependências (Dependabot/pip-audit) configurado.

## 4. Módulos existentes

- **Núcleo do painel** (`app.py`, 940 linhas): bootstrap, secret key, permissões por perfil,
  rota `/health`.
- **8 módulos de rota** (`routes_agenda`, `routes_cadastros`, `routes_config`,
  `routes_cronograma`, `routes_designacao`, `routes_fluxo`, `routes_geracao`,
  `routes_matriz`, `routes_protocolos`) — 2.058 linhas somadas.
- **Modelo de dados** (`db.py`, 2.266 linhas): maior arquivo do projeto — concentra modelos,
  seeds e helpers.
- **Geração fiel de documentos** (`gerar_layout.py` fachada + `gl_comum/gl_levantamento/
  gl_projeto/gl_termo/gl_xlsx`): troca placeholders dos layouts oficiais Rech.
- **Integrações** (`mailer.py`, `imap_intake.py`, `gmail_api.py`, `disponibilidade.py`,
  `matriz.py`, `capacidade.py`, `protocolo_ia.py`, `transcritor.py`).
- **Saúde/operação** (`verificar_app.py`, `verificar_tudo.py`, `robo_integridade.py`) — únicos
  do porte do projeto, bem além do usual para uma equipe pequena.
- **Geradores Office standalone** (`tools/gerar_*.py`, 13 scripts) — trilha paralela aos
  geradores "fiéis" do painel; parte é legado ainda não descontinuado (ver pendência P1
  em `memoria_ia/pendencias.md`).
- **Camada de processo/IA**: 13 agentes (`.claude/agents/`) + 24 skills (`.claude/skills/`) +
  definições **duplicadas** em `.agents/` e `.codex/` (pendência P2 conhecida, não resolvida).

## 5. Dependências internas e externas

**Internas:** `routes_*` → `app.py`/`db.py` via injeção de dependência (`register`); `gl_*` →
`gerar_layout.py` (fachada) → `routes_geracao.py`; `tools/preencher_layout.py` é o motor comum
entre painel e geradores standalone.

**Externas:** Postgres (Docker/WSL2, único ponto de dado transacional), rede interna da Rech
(SICLA — ainda sem integração automatizada, é o item nº1 de "Informações que melhorariam a
estrutura" em `docs/agentes-software.md`), base Oracle/SQL de disponibilidade dos consultores
(via driver configurável), SMTP/Gmail API (envio de e-mail), OneDrive/SharePoint (pasta de
vídeos de treinamento, `PROTOCOLOS_DIR`), Anthropic API (opcional).

## 6. Pontos fortes

1. **Fronteiras de agente já formalizadas** — `docs/agentes-software.md` define território por
   arquivo, evitando sobreposição; regra "nunca `from app import …` num módulo de rota" já
   institucionalizada.
2. **CI real e funcional** (compileall + smoke + pytest), não decorativo.
3. **Suíte de testes robusta para o porte** (~98 funções de teste, 1.899 linhas).
4. **Operação com múltiplas camadas de verificação**: smoke (`verificar_app.py`, segundos),
   operação (`verificar_tudo.py`: rotas+banco+e-mail+disponibilidade+idade do backup), robô
   diário (`robo_integridade.py`, 07:30, roda a suíte inteira e alerta por e-mail em falha).
5. **Backup automatizado com retenção** (14 dias, diário, cron do WSL) e **procedimento de
   restauração documentado e testável** (`docs/runbooks-operacao.md` §6).
6. **Watchdog de uptime** (`Guardiao_Painel.vbs`, Tarefa Agendada a cada 5 min) — item novo
   (commit mais recente do branch), reduz indisponibilidade não detectada.
7. **Runbooks de operação já escritos e específicos** (`docs/runbooks-operacao.md`) — cobrem
   e-mail, IMAP, disponibilidade/Oracle, Postgres, robôs, variáveis de ambiente — em vez de
   conhecimento tribal.
8. **Cookies de sessão com `HttpOnly` + `SameSite=Lax`** já configurados conscientemente
   (comentário no código justifica a escolha).
9. **`.gitignore` disciplinado**: credenciais, `.env`, chaves, dados de cliente e binários
   gerados já são excluídos por padrão.

## 7. Pontos frágeis

1. **Senha padrão do Postgres em texto plano no repositório** (`painel2026`, em
   `docker-compose.yml` e hardcoded em `tools/painel-backup.sh`) — já reconhecida
   (`docs/runbooks-operacao.md` §9) mas **ainda não trocada**.
2. **Ponto único de falha operacional**: o guardião e o banco só funcionam com a máquina
   `everton` ligada e logada (documentado em `docs/runbooks-operacao.md` §1c: "é o limite de
   rodar no notebook"). Sem servidor dedicado, sem failover.
3. **Sem ambientes formais** (dev/homologação/produção) — só "notebook" vs "servidor", com
   SQLite em dev e Postgres em produção (risco de divergência de tipos/comportamento).
4. **Sem proteção CSRF por token** — mitigada apenas por `SameSite=Lax` (decisão consciente,
   mas ainda assim uma lacuna formal para POSTs autenticados).
5. **Arquivos "god file"**: `db.py` (2.266 linhas) e `app.py` (940 linhas) concentram
   responsabilidades — risco de manutenção conforme o painel cresce.
6. **Sem migração de schema versionada** (Alembic ou equivalente) — `_auto_migrar` é aditivo e
   silencioso; não há histórico nem rollback formal de schema.
7. **Sem scanner de dependências** (Dependabot/pip-audit) — `requirements.txt` usa `>=` sem
   teto, sem processo de verificação de CVE.
8. **Duplicação de definições de agentes/skills** entre `.claude/`, `.agents/`, `.codex/` —
   pendência P2 conhecida, não resolvida, risco de divergência silenciosa.
9. **Geradores Office "antigos" ainda no repositório** sem uso confirmado
   (`runner.gerar_do_projeto`, `gerar_projeto_de_docx`) — candidatos a código morto, pendência
   P1 conhecida em `memoria_ia/pendencias.md`.
10. **Upload sem limite prático** (`MAX_CONTENT_LENGTH` = 4 GB, justificado por vídeos de
    treinamento) — vetor de esgotamento de disco se abusado.

## 8. Riscos técnicos

- Divergência SQLite↔Postgres não testada automaticamente (CI roda só contra o padrão do
  ambiente do runner, não valida ambos os dialetos).
- Migração aditiva sem rollback: uma coluna adicionada incorretamente em produção exige
  correção manual.
- Concentração de lógica em `db.py`/`app.py` aumenta o custo de mudança e o risco de regressão
  ao alterar regras de fluxo.

## 9. Riscos operacionais

- Guardião e robô de integridade dependem de sessão de usuário local — falha de energia,
  logoff, ou Windows Update podem derrubar o painel sem redundância.
- Robô de protocolos depende de sincronização OneDrive/SharePoint — falha silenciosa de
  sincronização não é monitorada além da varredura da pasta.
- Processo do MANUS IA sobrescrevendo `db.py`/`app.py` é um risco operacional já conhecido e
  mitigado por processo (`painel-core` reaplica invariantes), mas depende de execução manual
  disciplinada.

## 10. Riscos de segurança

- Credencial padrão do banco em texto plano no repositório (crítico, fácil de corrigir).
- Ausência de rate limiting em rotas de login/senha mestra (break-glass) — sem proteção
  contra força bruta.
- Sem auditoria formal de quem acessou/alterou dados de cliente (LGPD) além do que
  `seguranca-permissoes` cobre pontualmente.
- Fallback hardcoded de `secret_key` (`"painel-implantacao-rech"`, `app.py:57`) se a escrita em
  disco falhar — previsível e fraco, ainda que baixa probabilidade de ocorrência.

## 11. Débitos técnicos

- Geradores Office duplicados (fiéis vs. antigos) — decisão de remoção pendente de validação.
- `.agents/`/`.codex/` paralelos a `.claude/` sem consolidação.
- Falta de cobertura de testes explicitamente medida (sem `coverage.py`/relatório no CI).

## 12. Recomendações (visão geral — detalhe em `PLANO_DE_MELHORIAS.md`)

1. Trocar a senha do Postgres (já roteirizado, só falta executar) — maior risco/menor esforço.
2. Mover o secret_key fallback para falhar de forma explícita em vez de usar valor fraco fixo.
3. Avaliar migração do guardião/servidor para uma máquina dedicada (elimina o SPOF de notebook).
4. Introduzir Alembic (ou equivalente leve) para migrações versionadas antes que o schema cresça mais.
5. Configurar Dependabot (é gratuito, zero-infra, resolve o débito de dependências sem pin).
6. Consolidar `.agents`/`.codex` em `.claude` (pendência já mapeada).

## 13. Ordem de prioridade

**Imediato (dias):** trocar senha do Postgres · configurar Dependabot.
**Curto prazo (2–4 semanas):** fallback de secret_key · avaliar SPOF do notebook · medir
cobertura de testes.
**Médio prazo (1–3 meses):** Alembic · quebrar `db.py`/`app.py` em módulos menores ·
consolidar `.agents`/`.codex`.
**Longo prazo (>3 meses):** ambiente de homologação formal (se o volume do time justificar);
observabilidade (se o volume de incidentes justificar).

## 14. Plano de evolução

Ver `ROADMAP_TECNICO.md` para o detalhamento em ondas (imediato/curto/médio/longo) com
esforço, risco e critério de aceite por item.
