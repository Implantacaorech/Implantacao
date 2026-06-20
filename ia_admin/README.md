# ia_admin/ — acompanhamento de uso da IA / Cloud

Área **separada** do painel operacional de implantação. **Não** se mistura com clientes, projetos,
cronogramas ou RNS, e **não** altera o painel Flask (`webapp/`). É estática (Markdown/YAML/HTML).

## Para que serve
Acompanhar o **uso da IA** (sessões, modelos, ferramentas, arquivos lidos/alterados, risco de
contexto, decisões, pendências, custo estimado). Útil para governança e controle de consumo.

## Arquivos
| Arquivo | Conteúdo |
|--------|----------|
| `uso-cloud.yaml` | **Fonte de verdade** dos registros de sessão (você edita só este) |
| `gerar_painel.py` | Lê o YAML e gera `dados.js` para a tela |
| `dados.js` | **Gerado** a partir do YAML (não editar à mão) |
| `painel-uso-cloud.html` | Visão estática (abra no navegador, `file://`), **offline**, sem internet |
| `sessoes.md` | Registro legível das sessões (texto, opcional) |

## Como usar (mantém-se SÓ o YAML)
1. A cada sessão relevante, adicione um registro em **`uso-cloud.yaml`**.
2. Rode **`python ia_admin/gerar_painel.py`** (regenera `dados.js` a partir do YAML).
3. Abra/atualize **`painel-uso-cloud.html`** no navegador — a tela reflete o YAML.

> Por que o passo 2? Ao abrir o HTML por duplo clique (`file://`), o navegador **bloqueia
> `fetch()` de arquivo local** (CORS). Então a página carrega `dados.js` via `<script src>`
> (isso o `file://` permite). O `gerar_painel.py` é o que converte YAML → `dados.js`.
> Se `dados.js` não existir, a página mostra um aviso e um exemplo (nunca fica em branco).

Sem API da Anthropic/OpenAI, os campos de **custo/tokens são manuais/estimados**.

## Observação
Esta área não depende de internet e não roda no Flask. Os dados são mantidos à mão (ou por um
script futuro). Não coloque dados sensíveis de cliente aqui.
