# Relatório de falhas e riscos

> Auditoria técnica — 2026-07-10. Cada item tem evidência real (arquivo/linha) — nenhum item
> especulativo sobre infraestrutura que não existe (containers de app, K8s, filas, etc.).

## Legenda

Severidade: **Crítico** · **Alto** · **Médio** · **Baixo** · **Melhoria preventiva**.

---

### F-01 — Senha padrão do Postgres em texto plano no repositório

- **Severidade:** Crítico
- **Descrição:** o container do banco usa a senha padrão `painel2026` se
  `PAINEL_DB_SENHA` não for definida, e o script de backup tem `PGPASSWORD=painel2026`
  hardcoded.
- **Local:** [`docker-compose.yml:12`](../../docker-compose.yml), [`tools/painel-backup.sh:12`](../../tools/painel-backup.sh)
- **Evidência:** `POSTGRES_PASSWORD: ${PAINEL_DB_SENHA:-painel2026}` /
  `docker exec -e PGPASSWORD=painel2026 painel-db pg_dump …`
- **Impacto:** qualquer pessoa com acesso ao repositório (ou a um clone antigo) conhece a
  credencial do banco de produção, caso ela nunca tenha sido trocada.
- **Probabilidade:** alta (a senha já está exposta; só não foi ainda usada indevidamente).
- **Prioridade:** imediata.
- **Correção recomendada:** já existe procedimento documentado
  (`docs/runbooks-operacao.md` §9) — trocar nos 3 lugares (banco, `PAINEL_DB_URL`,
  `painel-backup.sh`) e usar uma env/segredo local (não string no script) para o backup.
- **Risco da correção:** baixo — reinício simples do container + reconfiguração de env.
- **Testes necessários:** rodar `tools/painel-backup.sh` uma vez após a troca; confirmar
  `/health` após reiniciar o painel.
- **Dependências relacionadas:** nenhuma (autocontido).
- **Status:** **código corrigido em 2026-07-10** (`docker-compose.yml` exige `PAINEL_DB_SENHA`
  sem padrão; `painel-backup.sh` lê a senha de `/usr/local/etc/painel-db.env`, fora do repo).
  Falta rotacionar a senha real no servidor (`docs/runbooks-operacao.md` §9) — rastreado em
  `memoria_ia/pendencias.md` P0.

---

### F-02 — Ponto único de falha operacional (notebook + sessão de usuário)

- **Severidade:** Alto
- **Descrição:** o guardião de uptime (`Guardiao_Painel.vbs`) e o banco (Docker/WSL2) só
  funcionam com a máquina do usuário `everton` ligada e logada. Sem redundância.
- **Local:** `Guardiao_Painel.vbs`, `docs/runbooks-operacao.md` §1c.
- **Evidência:** "Roda no contexto do usuário `everton`… Ainda cai? O guardião só age
  enquanto o `everton` está logado."
- **Impacto:** indisponibilidade total do painel fora do horário/presença do usuário
  (fim de semana, notebook desligado, Windows Update com reinício).
- **Probabilidade:** média (depende do padrão de uso da máquina).
- **Prioridade:** alta, mas depende de decisão de negócio (custo de servidor dedicado).
- **Correção recomendada:** migrar para uma máquina/servidor sempre ligado (mesmo que
  seja outro desktop dedicado), mantendo o mesmo modelo de deploy por `.bat`.
- **Risco da correção:** baixo tecnicamente; médio organizacionalmente (requer decisão/compra).
- **Testes necessários:** validar `/health` e reconexão do Postgres a partir da nova máquina.
- **Dependências relacionadas:** F-01 (trocar a senha antes de expor o serviço em rede nova).

---

### F-03 — Fallback fraco e previsível de `secret_key`

- **Severidade:** Médio
- **Descrição:** se `PAINEL_SECRET` não estiver definida e a escrita do arquivo
  `secret.key` falhar, o Flask usa a string fixa `"painel-implantacao-rech"`.
- **Local:** [`webapp/app.py:42-60`](../../webapp/app.py)
- **Evidência:** bloco `_carrega_secret()`, `except Exception: return "painel-implantacao-rech"`.
- **Impacto:** sessões assinadas com uma chave previsível se o disco estiver read-only ou sem
  espaço no momento do boot — abre porta para forjar cookies de sessão.
- **Probabilidade:** baixa (exige falha de I/O específica no boot).
- **Prioridade:** média.
- **Correção recomendada:** falhar explicitamente (log crítico + não subir) em vez de usar um
  valor fixo, ou gerar um valor aleatório em memória (perde sessões no restart, mas não é
  previsível).
- **Risco da correção:** baixo.
- **Testes necessários:** teste unitário simulando falha de escrita em `secret.key`.
- **Status:** **corrigido em 2026-07-10** — `_carrega_secret()` agora gera uma chave aleatória
  em memória (`secrets.token_hex(32)`) e loga `CRITICAL` em vez de usar a string fixa.

---

### F-04 — Sem token CSRF (mitigação apenas por `SameSite`)

- **Severidade:** Médio
- **Descrição:** o app depende só de `SESSION_COOKIE_SAMESITE=Lax` para mitigar CSRF; não há
  token por formulário.
- **Local:** [`webapp/app.py:63-65`](../../webapp/app.py)
- **Evidência:** comentário no próprio código reconhece a decisão: "Cookie de sessão: SameSite
  mitiga CSRF vindo de outros sites (app é POST sem token)."
- **Impacto:** `SameSite=Lax` não cobre 100% dos cenários (ex.: navegadores antigos, subdomínios
  compartilhados); ataques direcionados a um usuário autenticado continuam tecnicamente possíveis
  em cenários específicos.
- **Probabilidade:** baixa (app é uso interno, rede corporativa).
- **Prioridade:** média — aceitável como risco assumido para app interno, mas deve ficar
  formalmente registrado (ver `PLANO_DE_SEGURANCA.md`) em vez de implícito em comentário.
- **Correção recomendada:** avaliar `Flask-WTF`/token CSRF simples nas rotas que alteram estado,
  priorizando login/permissões/geração de documento.
- **Risco da correção:** baixo–médio (toca vários templates; fronteira de `templates/` é do
  MANUS IA — coordenar antes de mexer).

---

### F-05 — Upload sem teto prático (`MAX_CONTENT_LENGTH` = 4 GB)

- **Severidade:** Baixo/Médio
- **Descrição:** o limite de upload é 4.096 MB por padrão (justificado por vídeos de
  treinamento).
- **Local:** [`webapp/app.py:61-62`](../../webapp/app.py)
- **Evidência:** `app.config["MAX_CONTENT_LENGTH"] = int(os.environ.get("PAINEL_MAX_UPLOAD_MB",
  "4096")) * 1024 * 1024`
- **Impacto:** um usuário autenticado (ou uma conta comprometida) pode esgotar disco do servidor
  com uploads repetidos.
- **Probabilidade:** baixa (uso interno, poucos usuários).
- **Prioridade:** baixa — melhoria preventiva.
- **Correção recomendada:** monitorar espaço em disco de `_uploads/` (ver
  `PLANO_DE_MONITORAMENTO.md`) e considerar quota por usuário/dia se o volume crescer.

---

### F-06 — Concentração de responsabilidade em `db.py` e `app.py`

- **Severidade:** Médio
- **Descrição:** `db.py` tem 2.266 linhas (modelos + seeds + migração + helpers) e `app.py` tem
  940 linhas — maiores arquivos do projeto, sem divisão por domínio.
- **Local:** [`webapp/db.py`](../../webapp/db.py), [`webapp/app.py`](../../webapp/app.py)
- **Impacto:** custo crescente de manutenção; risco de regressão ao editar qualquer parte, pois
  o "blast radius" de uma mudança é difícil de isolar visualmente num arquivo desse tamanho.
- **Probabilidade:** certa ao longo do tempo (tendência natural de crescimento).
- **Prioridade:** média — não bloqueia nada hoje, mas piora com o tempo.
- **Correção recomendada:** dividir `db.py` por domínio (ex.: modelos de projeto, modelos de
  cadastro, seeds) mantendo a fachada pública estável; feito pelo agente **painel-core**, com
  testes de regressão completos antes/depois.
- **Risco da correção:** médio (refactor extenso, precisa de suíte verde antes e depois).

---

### F-07 — Definições de agentes/skills duplicadas (`.claude/` vs `.agents/`/`.codex/`)

- **Severidade:** Baixo
- **Descrição:** três diretórios paralelos definem agentes/skills para ferramentas de IA
  diferentes, sem processo formal de sincronização.
- **Local:** `.claude/`, `.agents/`, `.codex/` (raiz do repositório).
- **Evidência:** `memoria_ia/pendencias.md` P2: "Decidir se `.agents/` e `.codex/` … devem ser
  consolidados com `.claude/` (hoje coexistem)."
- **Impacto:** divergência silenciosa entre ferramentas de IA (uma reflete mudanças, outra não).
- **Probabilidade:** média, cresce a cada atualização de agente feita em só um dos três.
- **Prioridade:** baixa — não afeta o painel em produção, só a camada de tooling de IA.
- **Correção recomendada:** decidir uma fonte única (`.claude/`) e gerar os outros dois por
  script, ou descontinuar os que não são usados ativamente.

---

### F-08 — Sem paridade formal de ambiente (SQLite dev vs. Postgres prod)

- **Severidade:** Médio
- **Descrição:** desenvolvimento roda em SQLite local; produção roda em Postgres — sem ambiente
  de homologação intermediário nem CI rodando contra Postgres.
- **Local:** `docs/runbooks-operacao.md` §6, `tools/requirements.txt` (`psycopg2-binary`).
- **Impacto:** diferenças de tipo/comportamento entre SQLite e Postgres (ex.: `NULL`/`UNIQUE`,
  concorrência) só aparecem em produção.
- **Probabilidade:** baixa a média — SQLAlchemy abstrai a maior parte, mas não tudo.
- **Prioridade:** média.
- **Correção recomendada:** adicionar um job opcional no CI rodando a suíte contra um Postgres
  de serviço (`services: postgres:` no GitHub Actions) — infraestrutura já disponível
  gratuitamente no runner, sem custo adicional.
- **Risco da correção:** baixo (só adiciona um job, não altera o existente).

---

### F-09 — Geradores Office "antigos" ainda presentes sem uso confirmado

- **Severidade:** Baixo
- **Descrição:** `runner.gerar_do_projeto` e `gerar_projeto_de_docx` são mantidos mas não
  chamados pelas 4 fases de geração fiel atuais.
- **Local:** `webapp/runner.py`.
- **Evidência:** `memoria_ia/pendencias.md` P1: "mantidos, só não chamados para as 4 fases."
- **Impacto:** código morto candidato; aumenta superfície de manutenção e confusão para quem lê
  o código pela primeira vez.
- **Probabilidade:** certa (já confirmado como não utilizado nas fases atuais).
- **Prioridade:** baixa — aguardando validação formal antes de remover (decisão já registrada
  como pendente, não é decisão desta auditoria).
- **Correção recomendada:** confirmar em produção que os 4 fluxos fiéis cobrem 100% dos casos,
  então remover com testes de regressão.

---

### F-10 — Sem scanner de dependências / CVE

- **Severidade:** Médio
- **Descrição:** `requirements.txt` usa `>=` sem teto superior; não há Dependabot nem
  `pip-audit` no CI.
- **Local:** [`tools/requirements.txt`](../../tools/requirements.txt), `.github/workflows/`
  (só `ci.yml`, sem `dependabot.yml`).
- **Impacto:** vulnerabilidades conhecidas em dependências (Flask, SQLAlchemy, python-docx etc.)
  não são sinalizadas automaticamente; atualizações podem quebrar silenciosamente por falta de
  teto de versão.
- **Probabilidade:** média (depende do ciclo de vida das libs usadas).
- **Prioridade:** média — correção de custo muito baixo (config declarativa, zero infra nova).
- **Correção recomendada:** adicionar `.github/dependabot.yml` (ecosystem `pip`, weekly).
- **Risco da correção:** nenhum — é só configuração, não muda código.

---

### F-11 — Sem rate limiting em rotas sensíveis (login/senha mestra)

- **Severidade:** Médio
- **Descrição:** não há `Flask-Limiter` nem throttling caseiro nas rotas de autenticação/senha
  mestra (break-glass).
- **Local:** `webapp/app.py` (permissões/login), sem biblioteca de rate limit em
  `tools/requirements.txt`.
- **Impacto:** tentativa de força bruta contra a senha mestra não é limitada por taxa.
- **Probabilidade:** baixa (app interno, rede corporativa, não exposto à internet pública).
- **Prioridade:** média — melhoria preventiva antes de qualquer exposição externa.
- **Correção recomendada:** `Flask-Limiter` (biblioteca leve, sem infra externa necessária) nas
  rotas de login/senha mestra.

---

## Resumo por severidade

| Severidade | Itens |
|---|---|
| Crítico | F-01 |
| Alto | F-02 |
| Médio | F-03, F-04, F-06, F-08, F-10, F-11 |
| Baixo | F-05, F-07, F-09 |

Nenhum item de severidade crítica além de F-01 foi encontrado — reflexo de um projeto pequeno,
de uso interno, já com práticas de operação acima da média para o porte (ver
`DIAGNOSTICO_GERAL_DO_PROJETO.md` §6).
