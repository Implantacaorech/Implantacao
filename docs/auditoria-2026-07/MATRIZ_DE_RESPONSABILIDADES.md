# Matriz de responsabilidades (RACI)

> R = Responsável (executa) · A = Aprovador (aceita o resultado) · C = Consultado · I = Informado.
> Cobre só os agentes de **software** (mantêm o Painel) — os agentes de **negócio** têm sua
> própria matriz em `docs/papeis-responsabilidades.md` (processo de implantação, não é objeto
> desta auditoria técnica).

| Atividade | painel-core | qualidade | documentos-geracao | integracoes-operacao | documentacao-contexto | seguranca-permissoes | Usuário |
|---|---|---|---|---|---|---|---|
| Nova rota / regra de fluxo | R | C | I | I | I | C (se envolver permissão) | A |
| Alterar modelo/schema (`db.py`) | R | C | I | I | I | I | A |
| Bug em geração de documento fiel | I | C | R | I | I | I | A |
| Novo modelo de documento (layout Rech) | I | C | R | I | I | I | A |
| E-mail parou de enviar | I | I | I | R | I | I | A |
| Trocar senha do Postgres (M-01) | I | I | I | R | I | C | A |
| Configurar Dependabot (M-05) | I | R | I | I | I | I | A |
| Revisão de diff antes do push | C | R | C | C | I | C | A |
| Rodar/expandir suíte pytest | C | R | I | I | I | I | A |
| Smoke pós-pull do MANUS | C | R | I | I | I | I | I |
| Atualizar `docs/painel-sistema.md` | I | I | I | I | R | I | A |
| Atualizar `memoria_ia/*` | I | I | I | I | R | I | A |
| Auditar permissões por perfil | C | C | I | I | I | R | A |
| Vazamento de dado entre consultores | C | C | I | I | I | R | A |
| Backup do Postgres (execução/monitoria) | I | I | I | R | I | I | I |
| Restauração de backup (teste ou incidente) | C | I | I | R | I | I | A |
| Watchdog de uptime (`Guardiao_Painel.vbs`) | I | I | I | R | I | I | I |
| Robô de integridade diário | I | C | I | R | I | I | I |
| CI (`.github/workflows/ci.yml`) | C | R | I | I | I | I | A |
| Integração SICLA/RNS (futura) | C | C | I | R | I | C | A |
| Decisão de remover geradores antigos (M-07) | C | C | R (propõe) | I | I | I | A (decide) |
| Consolidar `.claude`/`.agents`/`.codex` (M-08) | I | I | I | I | R | I | A |

## Regras de aprovação

- **Toda alteração em `app.py`/`routes_*.py`/`db.py`** passa por `qualidade` (revisão + suíte)
  antes do push — já institucionalizado em `docs/agentes-software.md`.
- **Nenhum agente decide sozinho remover código** (ex.: M-07) — sempre volta para o usuário.
- **Alterações em produção** (trocar senha, restaurar backup) exigem confirmação explícita do
  usuário antes da execução — nenhum agente executa `docker exec`/restauração sem esse aceite.
- **`templates/` e CSS nunca são alterados por agente de software** — é território exclusivo do
  MANUS IA, regra já em vigor.
