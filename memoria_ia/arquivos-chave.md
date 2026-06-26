# Arquivos-chave — onde mexer / o que evitar carregar

Mapa para ir direto ao ponto, sem varrer o projeto. **Aponta** para arquivos; não os copia.

> **Para achar função/rota sem ler `app.py`/`db.py` inteiros:** use `mapa-codigo.md`
> (índice nome→linha por domínio). Economia de contexto de risco zero.

## Painel Flask (`webapp/`)
| Arquivo | Quando ler |
|--------|-----------|
| `webapp/app.py` | Rotas, fluxo, cadastros, geração; ponto central do painel (grande — leia trechos) |
| `webapp/db.py` | Modelos SQLAlchemy, seeds, migração aditiva, helpers de dados |
| `webapp/gerar_layout.py` | Geração fiel: **fachada** (`gerar`, `gerar_agenda_xlsx`, `area_do_modulo`). Lógica em `gl_comum/gl_levantamento/gl_projeto/gl_termo/gl_xlsx` |
| `webapp/fluxo.py` | Parse do e-mail de fechamento e montagem de projeto |
| `webapp/templates/*.html` | Telas (Jinja). `projeto_ficha.html` = ficha; `cad_*.html` = cadastros |
| `webapp/static/style.css` | Estilos (carregar só se for mexer em UI) |
| `webapp/test_painel.py` | Testes (pytest) — referência de comportamento esperado |

## Geradores e dados (`tools/`)
| Arquivo | Quando ler |
|--------|-----------|
| `tools/preencher_layout.py` | Motor de substituição fiel (.docx/.xlsx) |
| `tools/gerar_*.py` | Geradores Office por artefato |
| `tools/_common.py` | Paths (DATA/OUT/FROZEN), `load_yaml`, `slug` |
| `tools/data/*.yaml` | Dados de configuração/seed (ex.: `indice_topicos.yaml`, `catalogo_modulos.yaml`) |
| `tools/verificar.py` | Smoke da estrutura/geradores |

## Processo / referência
`docs/processo-implantacao.md` (fonte de verdade) · `docs/papeis-responsabilidades.md` ·
`docs/glossario.md` · `docs/recursos-e-caminhos.md` · `docs/pendencias.md` ·
`templates/*.md` (e-mails/termos/checklists) · `.claude/agents/*` · `.claude/skills/*`.

## ❌ EVITAR carregar (pesado/binário/gerado) — ver `.cloudignore`
- `dados/painel.db` (banco) · `exemplos/` (gerados) · `webapp/_uploads/`
- `tools/templates/**/*.docx|xlsx` · `tools/data/modelos_documento/**` (layouts da Rech)
- `webapp/static/chart.umd.min.js`, `*.png`, `favicon.svg`
- `*.log`, `__pycache__/`, `.pytest_cache/`, `*.exe`, `build/`, `dist/`
- Qualquer `.docx/.xlsx/.pdf/imagem` — só abrir sob pedido explícito (ver `entrada_ia/`).
