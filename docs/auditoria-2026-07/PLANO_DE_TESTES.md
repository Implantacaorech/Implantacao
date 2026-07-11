# Plano de testes

> Estado real: suíte pytest já existe (`webapp/test_painel.py`, ~98 funções, 1.899 linhas) e
> roda no CI. Este plano organiza o que já existe e fecha as lacunas reais (não recria do zero).

## 1. Inventário atual

| Camada | Ferramenta | Onde | Roda no CI? |
|---|---|---|---|
| Sintaxe | `python -m compileall` | `.github/workflows/ci.yml` | Sim |
| Smoke (rotas registradas) | `webapp/verificar_app.py` | CI + robô diário | Sim |
| Unitário/integração (Flask + banco) | `pytest webapp/test_painel.py` | CI + robô diário (07:30) | Sim |
| Smoke dos geradores Office | `tools/verificar.py` | CI (`continue-on-error: true`) | Sim, best-effort |
| Operação (rotas+banco+e-mail+disponibilidade+backup) | `webapp/verificar_tudo.py` | Manual + robô diário | Não (roda fora do CI, precisa de infra local) |

## 2. Ordem de execução recomendada (antes de todo push)

1. `python -m compileall -q webapp tools` — falha rápido em erro de sintaxe.
2. `python webapp/verificar_app.py` — segundos, confirma que os 8 módulos de rota registram.
3. `pytest webapp/test_painel.py -q` — ~4 min, cobre regras de negócio e fluxo.
4. `cd tools && python verificar.py` — geradores Office (best-effort, templates são locais).
5. **Se a mudança tocar integrações** (e-mail/disponibilidade/Postgres): `python
   webapp/verificar_tudo.py` local, antes do push.

Esta ordem já é a praticada (`docs/agentes-software.md` §"Ordem de implantação" +
`CLAUDE.md` "Antes de todo push").

## 3. Lacunas identificadas e fechamento

| Lacuna | Ação | Dono |
|---|---|---|
| Sem medição de cobertura | Adicionar `pytest-cov` ao CI, só relatório (M-13) | `qualidade` |
| Sem teste contra Postgres real no CI (só SQLite local no dev) | Job opcional com `services: postgres:16` no `ci.yml` (M-09) | `qualidade` |
| Sem teste de carga/concorrência | Não recomendado agora — sem indício de gargalo; reavaliar se houver reclamação de lentidão | — |
| Sem teste de UI automatizado | Não recomendado — `templates/` é do MANUS; testar UI manualmente ao aceitar uma entrega do MANUS | Usuário |
| Sem teste de restauração de backup automatizado | Ver `PLANO_DE_BACKUP_E_RECUPERACAO.md` — teste manual periódico, não automatizável sem ambiente descartável | `integracoes-operacao` |

## 4. Critério de aceite para qualquer PR/push

- Suíte pytest 100% verde (nenhum teste "flaky" tolerado — se um teste for instável,
  corrigir o teste, não ignorá-lo).
- `verificar_app.py` sem erro.
- Se a mudança alterar `db.py`/modelos: confirmar que a migração aditiva não quebra bancos
  existentes (testar contra uma cópia do banco de desenvolvimento, se disponível).
- Nenhuma credencial nova em texto plano introduzida (checar diff manualmente antes do commit).

## 5. Regressão

Não há suíte de regressão separada — a suíte única (`test_painel.py`) cumpre esse papel por
cobrir o fluxo de 6 etapas ponta a ponta. Ao alterar uma etapa, rodar a suíte completa (não só
os testes da etapa alterada) — é o comportamento já praticado pelo agente `qualidade`.
