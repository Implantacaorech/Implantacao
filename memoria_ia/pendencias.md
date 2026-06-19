# Pendências

Priorizadas: **P0** = crítico/bloqueia · **P1** = importante · **P2** = desejável.
Backlog operacional do processo (não-IA) fica em [`docs/pendencias.md`](../docs/pendencias.md).

## P0 — crítico
- _(nenhuma aberta no momento)_

## P1 — importante
- [ ] Validar no painel os documentos gerados pelos **layouts fiéis** (Levantamento, Projeto, Cronograma, Termo) e ajustar mapas de campos se necessário.
- [ ] Confirmar se os **geradores programáticos antigos** (`runner.gerar_do_projeto`, `gerar_projeto_de_docx`) podem ser removidos depois da validação (hoje mantidos, só não chamados para as 4 fases).

## P2 — desejável
- [ ] Decidir se `.agents/` e `.codex/` (definições paralelas de skills/agents) devem ser consolidados com `.claude/` (hoje coexistem).
- [ ] Popular `ia_admin/uso-cloud.yaml` e `ia_admin/sessoes.md` com o histórico real de sessões.
- [ ] Avaliar mover mais conteúdo detalhado de docs para carregamento sob demanda.

> Atualize ao concluir/abrir pendências. Mantenha curto.
