# Decisões

Registro curto e datado de decisões. Decisões arquiteturais maiores vão em `adr/`.

| Data | Decisão | Motivo | Impacto |
|------|---------|--------|---------|
| 2026-06-19 | **Não gerar mais `.exe`**; rodar da fonte via `Iniciar_Servidor.bat` | Simplicidade; a entrega passou a ser o código no GitHub | `build_painel_exe.py` vira legado; deploy = pull/push da fonte |
| 2026-06-19 | **"Subir total sempre"** — commit + push de tudo (não-gitignored) ao fim da tarefa | Sem `.exe`, o GitHub é a entrega; não perder trabalho local | Inclui `.agents/`, `.codex/`, `AGENTS.md`; segredos/`.docx` seguem gitignored |
| 2026-06-19 | **Geração fiel** dos 4 documentos de fase (troca só placeholders dos layouts oficiais) | Documentos idênticos ao padrão Rech, com dados do projeto | Botões da ficha passam a usar os layouts; geradores programáticos das 4 fases aposentados (mantidos no código) |
| 2026-06-19 | **Cadastros de referência** (Checklist, Índice de Tópicos, Modelos de Documentos) no painel | Centralizar master data editável e os layouts por fase | 3 grupos de tabelas + telas (área Sistema/ADM) |
| 2026-06-19 | **Camada de governança de IA** (`.cloudignore`, `memoria_ia/`, `ia_admin/`, `entrada_ia/`, guias) | Reduzir consumo de contexto e padronizar retomada de sessões | `CLAUDE.md` encurtado; detalhe em `docs/guia-operacional-ia.md` |

> Ao tomar uma decisão relevante, adicione uma linha aqui (data, decisão, motivo, impacto).
