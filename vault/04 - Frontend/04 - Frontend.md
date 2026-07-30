---
titulo: "Frontend"
tipo: indice
status: em-andamento
criado: 2026-07-19
atualizado: 2026-07-19
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - frontend
relacionados:
  - "[[02 - Arquitetura]]"
  - "[[06 - APIs]]"
  - "[[23 - Padrões]]"
---

# Frontend

> [!info] Sobre esta seção
> Frontend em Angular/TypeScript: componentes, rotas, serviços, RxJS e Angular Signals.

## Estrutura real (levantada em 2026-07-19)

`src/app/` organizado em três blocos:

- **`core/`** — `constants`, `directives`, `guards`, `interceptors`, `models`, `services`
  (cross-cutting, compartilhado entre features).
- **`features/`** — uma pasta por domínio de negócio (24 features:
  `agenda`, `atividade`, `cadastro(s)`, `config`, `coordenacao`, `dashboards`,
  `designacao`, `doc-editar`, `fluxo`, `home`, `legado`, `levantamento`, `login`, `mapa`,
  `matriz`, `monitoramento`, `perfil`, `plano-cronograma`, `projeto-email`,
  `projeto-origem`, `projetos`, `protocolos`, `trocar-senha`, `usuarios`).
- **`layouts/shell`** — layout raiz da aplicação.

Essa organização (`core/` + `features/` por domínio) é um padrão real e reconhecido de
"feature-based architecture" no ecossistema Angular — não é ad hoc. Depois dessa data
entraram, entre outras, as features `bi-implantacao`, `bi-indicadores`, `clientes-sicla`,
`dicionario`, `ferramentas`, `passos` e `permissoes`, e a pasta `core/utils/`.

### Filtros salvos por usuário (2026-07-29)

Toda tela com filtro reabre no recorte que o usuário deixou. A mecânica é UMA só, para as 13
telas: o helper `core/utils/filtros-salvos.ts` (`filtrosSalvos(chave, campos, opções)`), sobre
`core/services/preferencias.service.ts`. Pontos de projeto que valem lembrar:

- O **`authGuard` pré-carrega** o mapa de preferências numa chamada só. Com ele em memória, a
  restauração no construtor de cada tela é **síncrona** — a primeira carga de dados já sai
  filtrada, sem consulta jogada fora nem piscada de conteúdo. `aoRestaurar` cobre o caminho
  tardio (tela montada fora daquele fluxo, como em teste).
- **Gravação automática** para filtro em signal (um `effect` observa) e `salvar()` explícito
  para campo comum de `[(ngModel)]`, que não é observável. Debounce de 400 ms e dedupe contra o
  último valor sincronizado — filtro se mexe em rajada.
- **Leitura tolerante:** preferência é dado antigo por natureza (fica meses, a tela muda no
  meio). Campo que não existe mais é ignorado; valor cujo formato mudou (era texto, virou
  lista) é recusado comparando com o valor PADRÃO do campo, para não quebrar a renderização.
- Não grava preferência "nenhum filtro" só porque a pessoa passou pela tela; e o **"Limpar"**
  *esquece* a preferência (DELETE) em vez de fixar o vazio como escolha.

Detalhe funcional e tabela das chaves por tela: `docs/painel-sistema.md` §5.21.

### Framework e padrões — confirmados no código, não só no `package.json`

- **100% standalone components** — `grep` por `NgModule` em `app/` deu **zero**
  resultados; **53 arquivos** usam `standalone: true`. Não há NgModules legados
  convivendo — migração completa para o modelo standalone do Angular atual.
- **Angular Signals** — usado de verdade: **48 arquivos** chamam `signal(...)`.
- **Angular Material** — **não usado** (`0` ocorrências no `package.json`). Não é uma
  falha: o Prompt Mestre pedia Material só "quando aprovado", e `templates/`+CSS são
  domínio do MANUS IA por regra do `CLAUDE.md` — fora do escopo dos agentes de software.

### Testes

**27 arquivos `.spec.ts`** contra **118 arquivos não-spec** (~23% em contagem de
arquivos) — 111 testes de fato via Vitest (`@angular/build:unit-test`, roda em Node sem
browser real), todos passando, confirmado no CI real em 2026-07-19 (ver [[11 - Testes]]).

## Relacionados no Vault

- [[02 - Arquitetura]]
- [[06 - APIs]]
- [[23 - Padrões]]
- [[11 - Testes]]

## Aponta para (conteúdo real do repositório)

- `../frontend/`
- `../frontend/src/app/core/`
- `../frontend/src/app/features/`

## Status

Estrutura real levantada e auditada em 2026-07-19. Ver [[00 - Dashboard]].
