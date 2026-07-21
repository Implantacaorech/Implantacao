---
titulo: "Regras de Negócio — Dicionário Inteligente"
tipo: regras-de-negocio-tela
status: vivo
criado: 2026-07-21
atualizado: 2026-07-21
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - regras-de-negócio
  - painel
  - ia
relacionados:
  - "[[08 - Regras de Negócio]]"
  - "[[14 - IA]]"
gerado_por: "skill codigo-para-regra"
fontes_codigo:
  - "../backend/src/dicionario/dicionario.controller.ts"
  - "../backend/src/dicionario/dicionario.service.ts"
  - "../backend/src/dicionario/dicionario-ia.service.ts"
  - "../backend/src/dicionario/dto/pesquisar-dicionario.dto.ts"
  - "../backend/src/dicionario/dto/perguntar-dicionario.dto.ts"
  - "../frontend/src/app/features/dicionario/dicionario.component.ts"
  - "../frontend/src/app/features/dicionario/dicionario-documento.component.ts"
---

> [!info] Como esta nota é mantida
> Transcrição do comportamento atual do código pela skill `codigo-para-regra`. Código vivo —
> regenere quando os arquivos em `fontes_codigo` mudarem.

# Regras de negócio — Dicionário Inteligente

## Visão geral
Ferramenta de consulta técnica do SIGER® para consultores/suporte: permite **buscar** assuntos
(por termo e filtros) nos documentos curados dos módulos e adicionais, **abrir** um documento
estruturado, e **perguntar em linguagem natural** recebendo uma resposta fundamentada nos
documentos, com as fontes citadas.

## Elementos da tela
- **Abas "Buscar" e "Perguntar":** dois modos de consulta — origem: `aba()` em `dicionario.component.ts`.
- **Campo de pesquisa:** busca por assunto, programa, menu, tabela ou erro — origem: `onTermoAlterado()`.
- **Filtros "Tipo" e "Módulo/Adicional":** restringem a busca por tipo de documento e por sigla — origem: `filtroTipo`/`filtroSigla`.
- **Resumo da base:** total de documentos, quantos módulos e adicionais, e data da última atualização — origem: `status()`.
- **Cartões de resultado:** cada um mostra sigla, título, tipo, resumo e um trecho onde o termo aparece — origem: laço de `resultados()`.
- **Campo "Sua pergunta" + botão "Perguntar":** pergunta em linguagem natural — origem: `perguntar()`.
- **Resposta + "Fontes consultadas" + "Copiar resposta":** a resposta sintetizada e a lista de documentos que a embasaram — origem: template da aba Perguntar.
- **Tela do documento:** título, tipo, data, link para o documento original, resumo, seções por categoria (Configurações, Rotinas, Suporte, Dependências, Checklist…), palavras-chave e a fonte — origem: `dicionario-documento.component`.

## Regras de negócio
- RN-01: A busca considera o termo digitado no **título, no resumo, nas palavras-chave e no conteúdo** do documento — origem: `pesquisar()`, cláusula LIKE sobre os quatro campos.
- RN-02: A busca pode ser filtrada por **tipo** (módulo ou adicional) e por **sigla** do módulo/adicional; os filtros combinam com o termo — origem: `pesquisar()`, filtros `tipo`/`sigla`.
- RN-03: A tela **só executa a busca** quando há um termo ou algum filtro selecionado; com tudo vazio, não busca — origem: `buscar()` no componente, guarda "se q e tipo e sigla vazios, não busca".
- RN-04: Os resultados são **limitados a 40** documentos, ordenados por sigla — origem: `pesquisar()`, `take(40)` e `orderBy sigla`.
- RN-05: Cada resultado mostra um **trecho em torno da primeira ocorrência** do termo (quando há termo); sem termo, não há trecho — origem: `trechoEmTornoDoTermo()`.
- RN-06: Ao **perguntar em linguagem natural**, o sistema seleciona os documentos mais relevantes à pergunta e **sintetiza uma resposta baseada apenas neles**, citando as fontes — origem: `DicionarioIaService.perguntar()` + `recuperarParaPergunta()`.
- RN-07: A resposta **nunca inventa**: se os documentos não sustentam uma resposta segura, o sistema responde explicitamente que **não foram encontradas informações suficientes** — origem: prompt do sistema em `dicionario-ia.service.ts` (regra dura) e checagem `temFundamento`.
- RN-08: Se **nenhum documento** for relevante à pergunta, a resposta já informa que não há base, sem chamar a IA — origem: `perguntar()`, ramo "docs vazios".
- RN-09: Se a **IA não estiver configurada** (Modo IA), a pergunta ainda devolve os **documentos relacionados** para leitura manual, em vez de falhar — origem: `perguntar()`, ramo "IA indisponível". Ver [[RN - Modo IA (Config IA)]].
- RN-10: A relevância de um documento para a pergunta é maior quando o termo aparece no **título/sigla/palavras-chave** do que só no corpo; documentos sem nenhuma correspondência ficam de fora — origem: `recuperarParaPergunta()`, pontuação (título +5, corpo +1).
- RN-11: Ao abrir um documento, o conteúdo é apresentado **estruturado** (tabelas, listas, títulos, blocos de código), não como texto cru; seções sem conteúdo são omitidas — origem: `parseDocumentoMarkdown` (blocos) e `secoesVisiveis()`.
- RN-12: Cada documento exibe sempre a **fonte** (caminho e link para o documento original) — origem: `obter()` retorna `caminhoOrigem`/`urlOrigem`; template do documento.

## Validações e restrições
- O termo de busca, quando enviado, tem no máximo 200 caracteres — origem: `PesquisarDicionarioDto.q` (`@MaxLength(200)`).
- O filtro de tipo só aceita "modulo" ou "adicional" — origem: `PesquisarDicionarioDto.tipo` (`@IsIn`).
- A pergunta tem de 3 a 500 caracteres — origem: `PerguntarDicionarioDto.pergunta` (`@MinLength(3)`/`@MaxLength(500)`); a tela também exige ao menos 3 caracteres antes de habilitar o botão.

## Permissões
- **Qualquer usuário autenticado** pode pesquisar, abrir documentos e perguntar — não é uma tela restrita a gestão — origem: `@Roles()` vazio no `DicionarioController` (só exige login).

## Dados envolvidos
- **Lê:** os documentos indexados do SIGER® (título, sigla, tipo, resumo, conteúdo, palavras-chave, fonte) e as estatísticas da base — origem: repositório de `dicionario_documentos`.
- **Grava:** nada pela tela — a consulta é somente leitura. A base é alimentada por um processo de ingestão à parte (ver Dependências).

## Fluxos e transições de estado
- Busca: **sem consulta → resultados** quando há termo/filtro; **resultados → "nada encontrado"** quando a base não tem correspondência — origem: `buscar()`.
- Pergunta: **sem resposta → resposta fundamentada** (IA disponível e há documentos) · **→ "não há informação suficiente"** (sem base) · **→ só documentos relacionados** (IA não configurada) — origem: `perguntar()`.

## Dependências e efeitos colaterais
- A base de documentos vem de uma **ingestão à parte** (fora desta tela) dos documentos markdown curados do repositório de documentação do SIGER®; a tela apenas consome o resultado — origem: script `ingerir-dicionario-siger.ts`. Ver [[14 - IA]].
- A resposta em linguagem natural usa a **configuração de IA da finalidade "Dicionário"** (provedor/chave/modelo do Modo IA) — origem: `DicionarioIaService` chama `IaService.completar('dicionario', …)`. Ver [[RN - Modo IA (Config IA)]].
- A lista de módulos/adicionais para o filtro e o resumo da base são carregados ao abrir a tela — origem: `carregarMeta()` no componente.

## Pontos ambíguos
- A relevância da pergunta é calculada carregando **todos** os documentos e pontuando em memória; para bases muito maiores isso pode não escalar. Não está claro no código se há intenção de trocar por busca vetorial/índice — a confirmar. *(Coerente com o "RAG-lite" descrito em [[14 - IA]].)*
- Documentos removidos da origem **não** são apagados da base pela ingestão (preserva histórico); a tela pode, em tese, mostrar um documento que não existe mais na origem — a confirmar se é o comportamento desejado.

## Relacionados no Vault
- [[08 - Regras de Negócio]]
- [[14 - IA]]
- [[RN - Modo IA (Config IA)]]
