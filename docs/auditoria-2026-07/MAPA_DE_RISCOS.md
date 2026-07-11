# Mapa de riscos

> Consolidação de `RELATORIO_DE_FALHAS_E_RISCOS.md` numa matriz probabilidade × impacto.

## Matriz

| ID | Risco | Probabilidade | Impacto | Severidade | Mitigação |
|---|---|---|---|---|---|
| F-01 | Senha padrão do Postgres exposta | Alta | Alto | **Crítico** | M-01 (trocar senha) |
| F-02 | SPOF de notebook (servidor + watchdog + backup na mesma máquina/sessão) | Média | Alto | **Alto** | M-11 (máquina dedicada) |
| F-06 | `db.py`/`app.py` concentrados, custo de manutenção crescente | Certa (tendência) | Médio | Médio | M-06 (dividir por domínio) |
| F-08 | Divergência SQLite (dev) × Postgres (prod) não testada | Baixa-Média | Médio | Médio | M-09 (CI com Postgres) |
| F-10 | Sem scanner de CVE em dependências | Média | Médio | Médio | M-05 (Dependabot) |
| F-11 | Sem rate limiting em login/senha mestra | Baixa | Médio | Médio | M-03 (Flask-Limiter) |
| F-03 | Fallback fraco de `secret_key` | Baixa | Médio | Médio | M-02 (falhar explícito) |
| F-04 | CSRF só por `SameSite` | Baixa | Médio | Médio | M-04 (token CSRF) |
| F-07 | `.claude`/`.agents`/`.codex` duplicados (divergência de tooling de IA) | Média | Baixo | Baixo | M-08 (consolidar) |
| F-09 | Geradores antigos como código morto | Certa | Baixo | Baixo | M-07 (remover após validação) |
| F-05 | Upload sem teto prático (4 GB) | Baixa | Baixo | Baixo | Monitorar disco (§4 do plano de monitoramento) |
| — | Backup só local (mesma máquina), sem cópia externa | Baixa-Média | Alto (se coincidir com falha de máquina) | Médio | Ver `PLANO_DE_BACKUP_E_RECUPERACAO.md` §4 |
| — | Migração de schema sem rollback formal | Baixa | Médio | Médio | M-10 (avaliar Alembic) |

## Leitura do mapa

- **Nenhum risco fora do quadrante "crítico isolado"** (F-01) — é o único item que exige ação
  imediata sem depender de decisão de negócio.
- **F-02 é o risco estrutural mais relevante** a médio prazo: não é um bug, é uma escolha de
  infraestrutura (rodar em notebook) que a equipe já reconhece nos próprios runbooks.
- **A maioria dos demais riscos é "médio, baixa probabilidade"** — reflexo de um app interno,
  pequeno, sem exposição externa. Isso não significa ignorar, significa que a prioridade real
  é F-01 e F-02; o resto pode seguir o ritmo do `PLANO_DE_MELHORIAS.md`.

## Risco não técnico observado

O maior risco "silencioso" do projeto não está no código: é a **dependência operacional em uma
única pessoa** (`everton`) para runtime (sessão logada), backup (cron do WSL na mesma conta) e,
presumivelmente, desenvolvimento. Isso não é uma falha de engenharia corrigível por código — é
um risco de continuidade de negócio que só se resolve com decisão organizacional (documentado
como tal em F-02, sem inflar artificialmente como "bug").
