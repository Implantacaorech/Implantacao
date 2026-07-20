# Pendências

Priorizadas: **P0** = crítico/bloqueia · **P1** = importante · **P2** = desejável.
Backlog operacional do processo (não-IA) fica em [`docs/pendencias.md`](../docs/pendencias.md).

## P0 — crítico
- [x] ~~Rotacionar a senha real do Postgres no servidor~~ — **sem objeto desde 2026-07-19**:
  o Flask (e o Postgres dele, container `painel-db`) foi desligado e arquivado em
  `projeto_old/` na virada para o stack novo (NestJS/Angular/MariaDB). O container já não
  existia mais quando fomos checar (achado durante a própria checagem de segurança pré-
  virada — estava fora do ar há ~2 dias sem ninguém notar). Runbook §9 idem, mantido só
  como histórico. Ver `vault/22 - Troubleshooting/` e
  `docs/migracao/05-plano-de-virada.md` §"Registro real da virada".
- [x] ~~Definições dos agentes de software desatualizadas~~ — **RESOLVIDO em 2026-07-19**:
  os 6 agentes de software (`painel-core`/`qualidade`/`documentos-geracao`/
  `integracoes-operacao`/`documentacao-contexto`/`seguranca-permissoes`) reescritos
  apontando pro código real (`backend/src/*`, `docservice/`, ponte `legado_cli`).
  `docs/agentes-software.md` (mapa pré-virada) não foi reescrito, mantido só como histórico.
- [x] **Integridade do avanço:** RESOLVIDO por decisão (2026-06-24) — `_auto_avancar` é **permissivo de propósito** (checa só gate de documentos + ação de entrada). A versão estrita travava Agendamento/Designação. `consultor` saiu de `CAMPOS_OBRIGATORIOS["Projeto"]` (definido na Designação). Ver `decisoes.md`.

## P1 — importante
- [x] **Continuidade — Fila "Minhas próximas ações"** (2026-06-24): implementada na Home (`home()` monta `pendencias` com fase/atraso/url/cta, ordenadas por atraso).
- [ ] **Continuidade — "Gerar e avançar"** consistente: após gerar o documento obrigatório, avançar quando o gate fechar e destacar a próxima ação ao voltar à ficha.
- [x] **Enriquecer a geração fiel** (2026-06-24): Projeto (Detalhamento por área + tabelas), Levantamento (blocos contratados + usuários), Termo/Cronograma alimentados por `DocConteudo`. (Cronograma `.xlsx` por `cronograma_itens` segue como refinamento futuro.)
- [ ] **VALIDAR no painel** os documentos dos layouts fiéis e **ajustar os mapas módulo→área** `_SIGLA_BLOCOS` (Levantamento) e `_PROJ_AREAS` (Projeto) — *em curso, "validar primeiro"*.
- [ ] Confirmar se os **geradores programáticos antigos** (`runner.gerar_do_projeto`, `gerar_projeto_de_docx`) podem ser removidos depois da validação (hoje mantidos, só não chamados para as 4 fases).

## P2 — desejável
- [ ] Decidir se `.agents/` e `.codex/` (definições paralelas de skills/agents) devem ser consolidados com `.claude/` (hoje coexistem).
- [ ] Popular `ia_admin/uso-cloud.yaml` e `ia_admin/sessoes.md` com o histórico real de sessões.
- [ ] Avaliar mover mais conteúdo detalhado de docs para carregamento sob demanda.

> Atualize ao concluir/abrir pendências. Mantenha curto.
