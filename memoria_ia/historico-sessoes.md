# Histórico de sessões

Registro resumido por sessão (mais recente no topo). Mantenha **curto**: 4-6 linhas por sessão.

## Modelo
```
### AAAA-MM-DD — <objetivo>
- Objetivo: <1 frase>
- Arquivos alterados: <lista curta>
- Decisão: <principal decisão, se houver>
- Próximo passo: <o que fazer a seguir>
- Handoff: <link em handoffs/ ou "não">
```

---

### 2026-06-24 — Projeto⇐Levantamento + telas espelho + GCI/Consultores separados
- Objetivo: Levantamento como base única do Projeto; telas de edição espelhando os layouts oficiais; continuidade do fluxo.
- Arquivos: `webapp/app.py`, `db.py` (tabelas `LevantamentoResposta`, `DocConteudo`), `gerar_layout.py`, `doc_edit.py` (novo),
  templates (`doc_editar.html` novo, `levantamento.html`, `consultores.html`, `definir_gci.html`, `projeto_ficha.html`, `home.html`),
  `tools/preencher_layout.py`; `test_painel.py` (59 testes). Último commit `a1795d2`.
- Decisão: Projeto exige Levantamento respondido; espelho estrutural via `DocConteudo`+`SPEC`; auto-avanço permissivo de propósito;
  GCI (vários) no Agendamento × Consultores na Designação. Snapshot em `memoria_ia/CONTEXTO_COMPACTADO.md`.
- Próximo passo: usuário VALIDAR no painel (mapas `_SIGLA_BLOCOS`/`_PROJ_AREAS`) — "validar primeiro"; depois aplicar ajustes.
- Handoff: não.

### 2026-06-19 — Governança de contexto/IA
- Objetivo: reduzir custo de contexto e padronizar retomada de sessões.
- Arquivos alterados: `CLAUDE.md` (encurtado); criados `.cloudignore`, `docs/guia-operacional-ia.md`,
  `docs/uso-eficiente-ia.md`, `docs/template-handoff-sessao.md`, `entrada_ia/`, `memoria_ia/`, `ia_admin/`.
- Decisão: camada de governança de IA separada do painel; ver `decisoes.md`.
- Próximo passo: popular `ia_admin/` com sessões reais; validar layouts fiéis no painel.
- Handoff: não.

### 2026-06-19 — Cadastros + geração fiel + troca dos botões
- Objetivo: cadastros (Checklist, Índice de Tópicos, Modelos de Documentos) e geração fiel das fases.
- Arquivos: `webapp/app.py`, `db.py`, `gerar_layout.py`, `tools/preencher_layout.py`, templates `cad_*`, `projeto_ficha.html`.
- Decisão: não gerar `.exe` (roda da fonte); "subir total sempre".
- Próximo passo: validar documentos gerados.
- Handoff: não.
