---
titulo: "Roadmap"
tipo: indice
status: em-andamento
criado: 2026-07-19
atualizado: 2026-07-19
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - roadmap
relacionados:
  - "[[18 - Histórico]]"
  - "[[20 - Releases]]"
  - "[[01 - Projeto]]"
---

# Roadmap

> [!info] Sobre esta seção
> Planejamento futuro do projeto: próximas fases da migração e evolução do ecossistema de
> documentação.

## Backlog do ecossistema Vault + IA (consolidado em 2026-07-19)

O Prompt Mestre original ([[ADR-0001 - Adocao do ecossistema Vault + IA]]) pede itens que
são, cada um, projetos de semanas — não algo pra construir de forma unilateral numa
sessão. Esta tabela é o backlog honesto: o que já saiu do papel nesta sessão vs. o que
ainda depende de decisão/trabalho maior.

| Item | Status | Detalhe |
| --- | --- | --- |
| Vault Obsidian (26 seções) | ✅ Feito | Esqueleto completo; várias seções já com conteúdo real |
| DER + Dicionário de Dados | ✅ Feito | [[05 - Banco de Dados]] — 26 entidades documentadas do código real |
| Diagramas Mermaid (etapas, sequência, dependência) | ✅ Feito | [[10 - Fluxogramas]] |
| Auditoria de arquitetura (Clean/SOLID/DDD/Repository) | ✅ Feito (auditoria, não refactor) | [[02 - Arquitetura]] — decisão de reestruturar ou não fica em aberto |
| CI cobrindo backend/frontend | ✅ Feito | [[11 - Testes]], [[12 - DevOps]] — 364+111 testes reais |
| Lint no CI (backend) | ✅ Feito, best-effort | 1212 achados pré-existentes documentados, não corrigidos em massa |
| Casos de Uso + Base de Conhecimento reais | ✅ Feito (6 casos de uso, FAQ real) | [[09 - Casos de Uso]], [[21 - Conhecimento]] |
| Busca semântica (RAG-lite) | ✅ Feito, testado ponta a ponta | [[14 - IA]] |
| PR obrigatório aberto (PR #8) | ✅ Feito | Falta só a branch protection (abaixo) |
| **Branch protection em `main`** | ❌ Bloqueado — precisa de ação do usuário | Token sem permissão "Administration" — [[22 - Troubleshooting]] |
| **Nano Banana (geração de imagem)** | ❌ Bloqueado — precisa de ação do usuário | Quota de imagem em 0 mesmo com billing — [[22 - Troubleshooting]] |
| ESLint no frontend (do zero) | ❌ Não iniciado | Não existe config nem dependência; é instalar (`@angular-eslint`), não só plugar |
| Testes E2E de frontend | ❌ Não iniciado | Só backend tem `test:e2e` (Jest) |
| Cobertura mínima obrigatória (threshold) | ❌ Não iniciado | Nenhum job falha por queda de cobertura hoje |
| Repository Pattern formal / DDD em camadas | ⏸️ Decisão pendente, não técnica | Tabela de custo/benefício em [[02 - Arquitetura]] |
| Dashboards (saúde/arquitetura/cobertura/dívida técnica/segurança) | ❌ Não iniciado | Precisa decidir onde vive (painel Flask? Grafana? página estática?) antes de construir |
| RAG "de verdade" (banco vetorial, Knowledge Graph, indexação incremental automática) | ❌ Não iniciado além do RAG-lite | RAG-lite em [[14 - IA]] prova o conceito; produção exigiria decidir hospedagem/custo recorrente da API de embeddings |
| Automação contínua (toda mudança de código atualiza doc/diagrama sozinha) | ❌ Não iniciado | Exigiria hook de CI que gera/valida Vault a cada PR — próximo passo natural depois deste backlog |
| Auditoria contínua (código×doc, banco×entidade, API×Swagger) gerando tarefa sozinha | ❌ Não iniciado | Depende da automação contínua acima existir primeiro |
| **Virada para produção (Flask → stack novo)** | ✅ Feito, com ressalva | 2026-07-19 — ver [[18 - Histórico]]. Fases 3/4 formais do plano puladas (Postgres do Flask já estava inacessível há 2 dias); risco de dado não reconciliado aceito pelo responsável do projeto, não mitigado |
| **Definições dos agentes de software desatualizadas** | ✅ Feito | 2026-07-19 — os 6 agentes reescritos apontando pro código real (`backend/src/*`, `docservice/`, ponte `legado_cli`). `docs/agentes-software.md` (mapa pré-virada) não reescrito, só histórico |
| **Telemetria real de execução de agentes ("rede neural")** | ✅ Feito, com dado real | 2026-07-19 — entity+migration+API+frontend+testes, provado com 4 execuções reais em produção. Ver [[14 - IA]]. Não é WebSocket (polling 4s) — decisão consciente, não limitação |
| **Agentes reportando via API de testes (Jest/Vitest)** | ✅ Feito | 4 testes e2e reais (`backend/test/agentes.e2e-spec.ts`) provam o pipeline; 6 unitários (`agentes.service.spec.ts`) cobrem a lógica; 4 testes Vitest cobrem o componente do grafo |

### Por que os itens ❌ não foram "só feitos"

- **Dashboards:** exigem decidir uma plataforma (tela dentro do próprio Angular? Grafana?
  página estática no Vault?) — decisão de produto, não implementação.
- **RAG de produção / Knowledge Graph:** envolve custo recorrente de API (embeddings a
  cada mudança de doc) e escolha de onde persistir — não dá pra introduzir num sistema de
  produção sem alguém decidir isso conscientemente.
- **Automação contínua + auditoria contínua:** ambas dependem uma da outra e de decidir
  QUEM aprova o que a IA gera automaticamente antes de virar hábito — risco real de gerar
  ruído (PRs automáticos incorretos) se ligado sem supervisão.

## Relacionados no Vault

- [[18 - Histórico]]
- [[20 - Releases]]
- [[01 - Projeto]]
- [[22 - Troubleshooting]]
- [[02 - Arquitetura]]

## Aponta para (conteúdo real do repositório)

- `../vault/17 - ADR/ADR-0001 - Adocao do ecossistema Vault + IA.md`

## Status

Backlog consolidado e priorizado em 2026-07-19. Ver [[00 - Dashboard]].
