# Plano de melhorias

> Cada item resolve uma falha real de `RELATORIO_DE_FALHAS_E_RISCOS.md` ou um débito técnico
> de `DIAGNOSTICO_GERAL_DO_PROJETO.md`. Nenhuma melhoria "especulativa" (não há item de
> containers/K8s/microsserviço porque o projeto não usa nem precisa disso hoje).

## Como ler a tabela

Complexidade e esforço são relativos ao porte do projeto (1 dev principal, monolito pequeno).

---

## 1. Segurança

| # | Problema atual | Solução proposta | Benefício | Complexidade | Esforço | Risco | Prioridade | Status |
|---|---|---|---|---|---|---|---|---|
| M-01 | F-01: senha padrão do Postgres em texto plano | Trocar nos 3 lugares conforme `docs/runbooks-operacao.md` §9; mover `PGPASSWORD` do script para variável de ambiente do WSL | Elimina credencial exposta | Baixa | 30 min | Baixo | **Imediata** | **Código feito 2026-07-10** (`docker-compose.yml` exige `PAINEL_DB_SENHA`; `painel-backup.sh` lê de `painel-db.env`). Falta rotacionar a senha real em produção (pendência em `memoria_ia/pendencias.md`) |
| M-02 | F-03: fallback fraco de `secret_key` | Gerar chave aleatória em memória + log crítico se `PAINEL_SECRET`/`secret.key` falharem (em vez de string fixa) | Remove chave previsível | Baixa | 1h | Baixo | Alta | **Feito 2026-07-10** (`webapp/app.py`) |
| M-03 | F-11: sem rate limiting em login/senha mestra | Adicionar `Flask-Limiter` nas rotas de autenticação | Reduz risco de força bruta | Baixa | meio dia | Baixo | Média | Pendente |
| M-04 | F-04: CSRF só por `SameSite` | Avaliar token CSRF nas rotas POST que alteram estado, priorizando login/permissões/geração | Fecha lacuna formal de CSRF | Média (toca vários formulários) | 2-3 dias | Médio (coordenar com MANUS, dono de `templates/`) | Média | Pendente |
| M-05 | F-10: sem scanner de dependências | Adicionar `.github/dependabot.yml` (pip, weekly) | Alerta automático de CVE | Baixa | 15 min | Nenhum | Alta | **Feito 2026-07-10** |

**Critérios de aceite:** M-01 valida com `/health` OK + backup rodando após troca. M-02/M-03
cobertos por teste unitário/manual dedicado. M-05 valida com um PR automático do Dependabot
aparecendo em até 1 semana.

## 2. Arquitetura e código

| # | Problema atual | Solução proposta | Benefício | Complexidade | Esforço | Risco | Prioridade |
|---|---|---|---|---|---|---|---|
| M-06 | F-06: `db.py` (2.266 linhas) concentra tudo | Dividir por domínio (modelos de projeto / cadastros / seeds) mantendo import público estável | Reduz blast radius de mudanças | Alta | 3-5 dias | Médio (exige suíte verde antes/depois) | Média |
| M-07 | F-09: geradores antigos sem uso confirmado | Confirmar cobertura 100% pelas 4 fases fiéis, depois remover `runner.gerar_do_projeto`/`gerar_projeto_de_docx` | Reduz código morto | Baixa | 1 dia (+ validação em produção) | Baixo | Baixa (aguarda validação já pendente) |
| M-08 | F-07: `.claude`/`.agents`/`.codex` duplicados | Escolher `.claude/` como fonte única; gerar os outros via script ou descontinuar | Elimina divergência silenciosa | Baixa | meio dia | Baixo | Baixa |

**Critérios de aceite:** M-06 passa pela suíte completa (`pytest webapp/test_painel.py`) sem
alteração de comportamento; M-07 só após confirmação explícita do usuário (regra de negócio,
não decisão técnica).

## 3. Banco de dados

| # | Problema atual | Solução proposta | Benefício | Complexidade | Esforço | Risco | Prioridade | Status |
|---|---|---|---|---|---|---|---|---|
| M-09 | F-08: sem paridade SQLite↔Postgres testada | Job opcional no CI com `services: postgres:16` | Detecta divergência de dialeto cedo | Baixa | meio dia | Nenhum (job adicional, não substitui o atual) | Média | **Feito 2026-07-10** — job `test-postgres` em `.github/workflows/ci.yml` roda `tools/ci_postgres_smoke.py` (create_all + `_auto_migrar` contra Postgres real; não substitui a suíte SQLite, que segue isolada de propósito) |
| M-10 | Migração aditiva sem versionamento (`_auto_migrar`) | Avaliar Alembic (ou registro manual de migrações aplicadas) antes que o schema cresça mais | Rollback formal de schema | Média | 2-3 dias | Médio (muda o mecanismo de boot do banco) | Média (médio prazo) | Pendente |

## 4. Operação e infraestrutura

| # | Problema atual | Solução proposta | Benefício | Complexidade | Esforço | Risco | Prioridade |
|---|---|---|---|---|---|---|---|
| M-11 | F-02: SPOF de notebook | Avaliar migração do painel para máquina/servidor dedicado sempre ligado | Elimina indisponibilidade por logoff/desligamento | Baixa tecnicamente | 1 dia de setup | Baixo | Alta (decisão de negócio) |
| M-12 | F-05: upload sem teto prático | Monitorar espaço em disco de `_uploads/` e considerar quota se volume crescer | Evita esgotamento de disco | Baixa | 2h (monitoramento) | Nenhum | Baixa |

## 5. Qualidade e testes

| # | Problema atual | Solução proposta | Benefício | Complexidade | Esforço | Risco | Prioridade | Status |
|---|---|---|---|---|---|---|---|---|
| M-13 | Sem medição explícita de cobertura | Adicionar `pytest-cov` ao CI (só relatório, sem gate de bloqueio inicialmente) | Visibilidade de lacunas de teste | Baixa | 1h | Nenhum | Média | **Feito 2026-07-10** — `pytest --cov=webapp --cov-report=term-missing` no job `test` |

---

## Ordem de execução recomendada

1. **M-01, M-05** (imediato — zero risco, alto retorno).
2. **M-02, M-03, M-13** (curto prazo — baixo esforço).
3. **M-09, M-04** (médio prazo — precisam de coordenação/teste extra).
4. **M-06, M-10, M-08** (médio-longo prazo — mudanças estruturais, exigem janela dedicada).
5. **M-11** (depende de decisão de negócio, não de esforço técnico).
6. **M-07** (aguarda validação de negócio já registrada como pendência).

Nenhum item aqui deve ser executado sem: backup válido, testes antes/depois, e — para itens
que tocam `db.py`/`app.py`/rotas — passagem pelo agente **painel-core** com revisão do agente
**qualidade** antes do push, conforme já estabelecido em `docs/agentes-software.md`.
