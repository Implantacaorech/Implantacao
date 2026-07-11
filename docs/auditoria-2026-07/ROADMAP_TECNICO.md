# Roadmap técnico

> Consolida `PLANO_DE_MELHORIAS.md` em ondas de execução. Nenhum item aqui é novo — todos
> rastreiam a um achado de `RELATORIO_DE_FALHAS_E_RISCOS.md`.

## Imediato (esta semana)

| Item | O quê | Esforço | Dono |
|---|---|---|---|
| M-01 | Trocar senha padrão do Postgres (F-01, crítico) | 30 min | `integracoes-operacao` |
| M-05 | Configurar Dependabot (`.github/dependabot.yml`) | 15 min | `qualidade` |

## Curto prazo (2-4 semanas)

| Item | O quê | Esforço | Dono |
|---|---|---|---|
| M-02 | `secret_key`: falhar explícito em vez de fallback fraco | 1h | `painel-core` + `seguranca-permissoes` |
| M-03 | Rate limiting em login/senha mestra (`Flask-Limiter`) | meio dia | `painel-core` |
| M-13 | `pytest-cov` no CI (visibilidade de cobertura) | 1h | `qualidade` |
| — | Decisão de negócio: avaliar máquina dedicada para o servidor (F-02) | — (decisão, não código) | Usuário |

## Médio prazo (1-3 meses)

| Item | O quê | Esforço | Dono |
|---|---|---|---|
| M-09 | Job de CI com Postgres de serviço (paridade dev/prod) | meio dia | `qualidade` |
| M-04 | Avaliar/implementar token CSRF nas rotas críticas | 2-3 dias | `painel-core` + `seguranca-permissoes` (coordenar com MANUS se tocar `templates/`) |
| M-10 | Avaliar Alembic para migração versionada | 2-3 dias | `painel-core` |
| M-08 | Consolidar `.claude`/`.agents`/`.codex` | meio dia | `documentacao-contexto` |
| M-11 | Executar migração para máquina dedicada (se aprovado) | 1 dia de setup | `integracoes-operacao` |

## Longo prazo (>3 meses, condicional a crescimento)

| Item | O quê | Gatilho para reavaliar |
|---|---|---|
| M-06 | Dividir `db.py`/`app.py` por domínio | Quando o custo de mudança começar a doer na prática (não antecipar) |
| M-07 | Remover geradores Office antigos | Após validação em produção dos 4 fluxos fiéis (pendência já registrada) |
| Ambiente de homologação formal | Só se o volume/risco de mudanças justificar (hoje: 1 dev, deploy direto) | Equipe crescer ou incidentes de deploy aumentarem |
| Observabilidade (APM) | Só se houver reclamação recorrente de lentidão | Sinal real de performance, não hoje |

## Não recomendado no roadmap (justificativa explícita)

- **Containers para a aplicação** — monolito único, sem ganho de isolamento que justifique a
  complexidade operacional adicional para 1 servidor.
- **Kubernetes/orquestração** — desproporcional ao porte; nenhum indício de necessidade.
- **Múltiplos ambientes formais agora** — o gap real (F-08) é resolvido por um job de CI, não
  por infraestrutura paralela completa.
- **Ferramenta de observabilidade paga** — os scripts de verificação já existentes
  (`verificar_tudo.py`, robô diário) cobrem o essencial sem custo adicional.

## Critério de revisão do roadmap

Revisar esta lista a cada trimestre ou quando um dos gatilhos de "longo prazo" acima ocorrer.
Nenhum item deve avançar sem: teste antes/depois, backup válido (se tocar banco), e revisão do
agente `qualidade` (ver `docs/agentes-software.md`).
