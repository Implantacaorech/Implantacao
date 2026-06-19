# Uso eficiente da IA — governança de contexto

Boas práticas para reduzir custo de contexto/tokens e melhorar a retomada de sessões no
projeto de Implantação Rech / SIGER®. **pt-BR.**

## Política para novas sessões (ler PRIMEIRO)
Antes de iniciar qualquer tarefa, a IA deve ler, nesta ordem:
1. [`memoria_ia/estado-atual.md`](../memoria_ia/estado-atual.md)
2. [`memoria_ia/pendencias.md`](../memoria_ia/pendencias.md)
3. [`memoria_ia/arquivos-chave.md`](../memoria_ia/arquivos-chave.md)

Depois:
- buscar **apenas arquivos específicos** (Glob/Grep), não a árvore inteira;
- **evitar varredura completa** do projeto sem justificativa explícita;
- pedir ao usuário que coloque anexos em [`entrada_ia/`](../entrada_ia/README.md);
- pedir versão **`.txt`/`.md` resumida** para relatórios/documentos longos;
- **atualizar a memória** ao finalizar uma tarefa relevante (`memoria_ia/`);
- **criar handoff** ([template](template-handoff-sessao.md)) quando a tarefa for longa ou incompleta.

## Regras práticas
- **Uma conversa por funcionalidade.** Não acumule temas distintos numa sessão longa.
- **Não cole PDFs, imagens ou relatórios inteiros** no chat. Coloque o arquivo em `entrada_ia/`.
- **Converta o trecho útil** de documentos pesados para `.txt`, `.md`, `.csv`, `.json` ou `.yaml`
  antes de trazê-lo ao contexto principal.
- **Não use “ultrathink”/raciocínio profundo em tarefas simples** — reserve para problemas difíceis.
- **Mantenha MCPs desnecessários desligados.** Ligue só o que a tarefa exige.
- **Acione GitHub, Browser ou DevTools só quando necessário** — cada um adiciona contexto/custo.
- **Use handoff ao trocar de sessão** (registre estado e próximos passos).
- **Evite trocar de modelo no meio de uma tarefa longa** sem necessidade real.
- **Consulte primeiro a memória do projeto** (`memoria_ia/`) antes de vasculhar arquivos.
- **Não faça varredura completa** do projeto sem justificativa.

## O que NÃO carregar rotineiramente
Ver [.cloudignore](../.cloudignore). Em resumo: `dados/` (banco), `exemplos/` (gerados),
`webapp/_uploads/`, `tools/templates/**` e `tools/data/modelos_documento/**` (.docx/.xlsx),
`webapp/static/chart.umd.min.js`, imagens, logs, caches e `*.exe`.

## O que é contexto útil (texto leve)
`webapp/**/*.py`, `webapp/templates/**/*.html`, `webapp/static/style.css`, `tools/**/*.py`,
`tools/data/*.yaml`, `docs/**/*.md`, `templates/**/*.md`, `CLAUDE.md`, `AGENTS.md`, `README.md`,
`memoria_ia/**`, `*.bat`, `docker-compose.yml`, `build_painel_exe.py`.
