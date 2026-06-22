# Pendências

Priorizadas: **P0** = crítico/bloqueia · **P1** = importante · **P2** = desejável.
Backlog operacional do processo (não-IA) fica em [`docs/pendencias.md`](../docs/pendencias.md).

## P0 — crítico
- [ ] **Integridade do avanço:** `_auto_avancar` (app.py) checa só documentos+ação e **ignora `campos_faltantes`**, enquanto o `avancar` manual os exige. Um projeto pode pular de fase com campo obrigatório vazio (ex.: `data_uso_oficial`) pelo caminho automático. → alinhar as duas regras. (achado em 2026-06-19, robô de fluxo e2e)

## P1 — importante
- [ ] **Continuidade — Fila "Minhas próximas ações"** na Home/Carteira (por perfil, reaproveitando `db.cabecalho` + `_so_meus`), com botão que leva direto à ação. Hoje a Home mostra só 1 "Projeto em foco".
- [ ] **Continuidade — "Gerar e avançar"** consistente: após gerar o documento obrigatório, avançar quando o gate fechar e destacar a próxima ação ao voltar à ficha.
- [ ] **Enriquecer a geração fiel:** Projeto (módulos por área), Cronograma `.xlsx` (consultor/horas/linhas a partir de `cronograma_itens`), Termo (grade de módulos/status). Hoje só escalares (cliente/cnpj/horas) entram.
- [ ] Validar no painel os documentos gerados pelos **layouts fiéis** e ajustar mapas de campos se necessário.
- [ ] Confirmar se os **geradores programáticos antigos** (`runner.gerar_do_projeto`, `gerar_projeto_de_docx`) podem ser removidos depois da validação (hoje mantidos, só não chamados para as 4 fases).

## P2 — desejável
- [ ] Decidir se `.agents/` e `.codex/` (definições paralelas de skills/agents) devem ser consolidados com `.claude/` (hoje coexistem).
- [ ] Popular `ia_admin/uso-cloud.yaml` e `ia_admin/sessoes.md` com o histórico real de sessões.
- [ ] Avaliar mover mais conteúdo detalhado de docs para carregamento sob demanda.

> Atualize ao concluir/abrir pendências. Mantenha curto.
