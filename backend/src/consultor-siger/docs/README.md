# Consultor SIGER — Execução → Consultor SIGER

Base inteligente de conhecimento do **código-fonte do SIGER** para os Consultores de
Implantação: a pessoa pergunta em linguagem natural ("o que preciso configurar para emitir
NF?") e recebe resposta **estruturada e rastreável** — resumo, como funciona, regras e
validações, configurações, cadastros, telas/menus, assuntos relacionados e pesquisas
sugeridas — com **arquivo:linha da fonte citados em cada item** e nível de confiança
(alta/média/baixa/não confirmado).

- **Fonte original:** `F:\SIGER` — **somente leitura, inegociável**. O Painel **nem a
  acessa**: consome apenas a base derivada.
- **Base derivada:** SQLite (`consultor.db`) gerado pelo indexador em `F:\CONSULTOR-SIGER`
  (fora deste repositório), aberto aqui em modo **somente leitura**. Caminho configurável
  por `MIGRACAO_CONSULTOR_SIGER_DB`.
- **Sem a base**, a tela degrada com aviso claro (nada quebra).
- **Extrativo por construção:** toda frase exibida é trecho real da fonte — a regra
  anti-invenção não depende de prompt.

Documentos: [arquitetura](arquitetura.md) · [api](api.md) ·
[regras de negócio](regras-negocio.md) · [casos de uso](casos-de-uso.md) ·
[fluxo](fluxo.md).
