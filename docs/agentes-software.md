# Agentes de software do Painel de Implantação

> Estrutura **enxuta** de agentes de IA (Claude Code) para apoiar **desenvolvimento, manutenção,
> evolução, suporte e operação** do Painel. Definidos em `.claude/agents/`.
>
> **Não confundir** com os agentes de **negócio/processo** já existentes (`consultor-implantacao`,
> `coordenador-implantacao`, etc.), que ajudam a *executar implantações*. Estes aqui ajudam a
> *construir e manter o sistema*.

## Os agentes

| Agente | Classe | Território (arquivos) | Prioridade |
|---|---|---|---|
| **painel-core** | Obrigatório | `app.py`, `routes_*.py`, `db.py`, regras de fluxo/permissão | Alta |
| **qualidade** | Obrigatório | `test_painel.py`, revisão de diff, checagem de endpoints | Alta |
| **documentos-geracao** | Recomendado | `gerar_layout`/`gl_*`, `tools/gerar_*`, modelos, `doc_edit`, `docview` | Média-Alta |
| **integracoes-operacao** | Recomendado | `mailer`/`imap_intake`/`gmail_api`/`disponibilidade`, Docker/Postgres/backup, robôs, SICLA | Média |
| **documentacao-contexto** | Opcional | `docs/`, `memoria_ia/`, `README` | Baixa-Média |
| **seguranca-permissoes** | Opcional | permissões, login, segredos, LGPD | Baixa |

## Regra de ouro — fronteira por módulo (evita sobreposição)

| Território | Dono |
|---|---|
| `app.py` · `routes_*.py` · `db.py` · regras de fluxo | **painel-core** |
| `gerar_layout`/`gl_*` · `tools/gerar_*` · modelos · `doc_edit` · `docview` | **documentos-geracao** |
| `mailer`/`imap_intake`/`gmail_api`/`disponibilidade` · infra/robôs/SICLA | **integracoes-operacao** |
| `templates/` + CSS | **MANUS IA (externo)** — nenhum agente de software escreve aqui |
| `test_painel.py` · revisão · verificação de regressão | **qualidade** |
| `docs/` · `memoria_ia/` | **documentacao-contexto** (ou passo final de quem implementa) |
| permissões · segredos · LGPD | **seguranca-permissoes** |

## Fluxo de colaboração

1. **Demanda** (bug / feature / push do MANUS / incidente) — iniciada pelo usuário.
2. **Triagem técnica:** painel-core (ou integracoes-operacao se for externo; documentos-geracao se for fidelidade de documento).
3. **Análise de requisito de negócio:** usuário + agentes de negócio existentes.
4. **Implementação:** o agente dono do território (painel-core / documentos-geracao / integracoes-operacao). Frontend = **MANUS**.
5. **Revisão + testes:** **qualidade** (obrigatório antes de todo push).
6. **Documentação:** passo final de quem implementou, ou **documentacao-contexto**.
7. **Pós-push do MANUS:** **qualidade** roda o smoke `python webapp/verificar_app.py` (segundos) + a suíte; **painel-core** reaplica invariantes se algo foi sobrescrito.

> **Smoke check:** `python webapp/verificar_app.py` confirma em segundos que o app importa e que
> os 8 módulos de rota continuam registrados (`url_for` ok). Roda também como passo da CI, antes do pytest.

## Ordem de implantação

- **Fase 1 — Base essencial:** `painel-core` + `qualidade`. Cobrem o grosso do trabalho e blindam contra regressões já no dia 1.
- **Fase 2 — Qualidade e escala:** `documentos-geracao` + `documentacao-contexto`. Protegem o ativo de maior valor (documentos oficiais) e mantêm docs/memória em dia.
- **Fase 3 — Operação e automação:** `integracoes-operacao` (+ `seguranca-permissoes` se necessário). Entram com a operação contínua e a integração SICLA/RNS.

## NÃO recomendados (agora)

- **Front-end/UX dedicado** — o MANUS IA já é dono; criaria conflito de escrita.
- **Arquitetura dedicado** — baixa recorrência; absorvido por painel-core.
- **Requisitos dedicado** — coberto pelo usuário + agentes de negócio existentes.
- **Suporte interno / DevOps isolados** — volume baixo; dentro de integracoes-operacao.

## Informações que melhorariam a estrutura

CI/CD real (a suíte bloqueia merge?) · futuro/escopo do MANUS · crescimento da equipe ·
exigência de LGPD · SLA de operação · orçamento de IA · acesso ao SICLA/SIGER.

---
*Análise completa e justificativas no histórico do projeto. Atualize esta tabela ao criar/retirar agentes.*
