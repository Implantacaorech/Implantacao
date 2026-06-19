# Sessões da IA — registro legível

Registro humano das sessões (a fonte machine-readable é [`uso-cloud.yaml`](uso-cloud.yaml)).
Mais recente no topo. Mantenha curto.

## Modelo
```
### AAAA-MM-DD — <objetivo>
- Modelo: <ex.: Claude Opus 4.8> · Ferramentas/MCPs: <lista>
- Arquivos lidos: <curto> · Arquivos alterados: <curto>
- Comandos: <curto>
- Risco de contexto: baixo|medio|alto · Handoff: sim|não
- Decisões: <curto> · Pendências: <curto>
- Responsável: <nome> · Custo/consumo: <estimado, se houver>
```

---

### 2026-06-19 — Governança de contexto/IA
- Modelo: Claude Opus 4.8 · Ferramentas: filesystem, git
- Arquivos lidos: `CLAUDE.md`, `.gitignore`, estrutura do repo
- Arquivos alterados: `CLAUDE.md`, `.cloudignore`, `docs/*`, `entrada_ia/`, `memoria_ia/`, `ia_admin/`
- Risco de contexto: médio · Handoff: não
- Decisões: camada de governança de IA separada do painel
- Responsável: Everton · Custo: estimativa manual (sem API de tokens)

### 2026-06-19 — Cadastros + geração fiel + troca dos botões
- Modelo: Claude Opus 4.8 · Ferramentas: filesystem, git, python
- Arquivos alterados: `webapp/app.py`, `db.py`, `gerar_layout.py`, `tools/preencher_layout.py`, templates
- Risco de contexto: alto · Handoff: não
- Decisões: não gerar `.exe`; "subir total sempre"
- Responsável: Everton
