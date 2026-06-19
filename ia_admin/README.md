# ia_admin/ — acompanhamento de uso da IA / Cloud

Área **separada** do painel operacional de implantação. **Não** se mistura com clientes, projetos,
cronogramas ou RNS, e **não** altera o painel Flask (`webapp/`). É estática (Markdown/YAML/HTML).

## Para que serve
Acompanhar o **uso da IA** (sessões, modelos, ferramentas, arquivos lidos/alterados, risco de
contexto, decisões, pendências, custo estimado). Útil para governança e controle de consumo.

## Arquivos
| Arquivo | Conteúdo |
|--------|----------|
| `uso-cloud.yaml` | **Fonte de verdade** dos registros de sessão (machine-readable) |
| `sessoes.md` | Registro legível das sessões (texto) |
| `painel-uso-cloud.html` | Visão estática (abra no navegador, `file://`), **offline**, sem internet |

## Como usar
1. A cada sessão relevante, adicione um registro em `uso-cloud.yaml` (e, opcionalmente, em `sessoes.md`).
2. Abra `painel-uso-cloud.html` para visualizar (a página traz dados de exemplo que **espelham**
   `uso-cloud.yaml`; atualize o bloco de dados da página ou regenere quando registrar novas sessões).
3. Sem API da Anthropic/OpenAI, os campos de **custo/tokens são manuais/estimados**.

## Observação
Esta área não depende de internet e não roda no Flask. Os dados são mantidos à mão (ou por um
script futuro). Não coloque dados sensíveis de cliente aqui.
