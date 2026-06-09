# Templates de estilo (base visual fiel à Rech)

Coloque aqui os `.docx` oficiais da Rech para que os geradores produzam documentos com o
**cabeçalho (logo), rodapé, fonte, tema e margens idênticos** ao padrão de vocês:

| Arquivo esperado | Usado por |
|------------------|-----------|
| `base_projeto_tokenizado.docx` | `gerar_projeto_implantacao.py` (engine de tokens `{{...}}`) |
| `base_termo.docx` | `gerar_termo_encerramento.py` |
| `base_levantamento.docx` | `gerar_levantamento.py` |

## Como funciona
O gerador abre o template, **limpa o corpo** (preservando a seção — margens, cabeçalho e
rodapé com logo — e os estilos) e injeta o conteúdo. Se o arquivo **não existir**, usa um
estilo limpo padrão (sem o letterhead), sem quebrar.

## Como preparar (uma vez)
Copie os templates em branco da Rech para esta pasta com os nomes acima. Ex.:
```
base_projeto_tokenizado.docx  <- GeradorProjetoSIGER/assets/template.docx (modelo com {{tokens}})
base_termo.docx               <- "Termo de Encerramento_XXXXX.docx"
base_levantamento.docx        <- "Mapeamento levantamento de processos_XXXX.docx"
```

> ⚠️ Estes `.docx` **não são versionados** (contêm o logo/letterhead da Rech) — regra
> `tools/templates/*.docx` no `.gitignore`. Cada usuário coloca os seus localmente.
