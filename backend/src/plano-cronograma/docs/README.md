# Módulo `plano-cronograma`

Linhas **editáveis** do Cronograma e do Check List de um projeto, com histórico de quem
mudou o quê.

> **Não confundir com o Agendador de Visitas** (`/projetos/:id/agenda*`, módulo
> `cronograma/`). Aqui é a grade editável que vira o documento entregue ao cliente; lá é a
> alocação de agenda do consultor no SICLA.

## Por que este módulo é o piloto

É o módulo de referência da adequação ao
[Guia Mestre de Arquitetura](<../../../../vault/23 - Padrões/Guia Mestre de Arquitetura de Desenvolvimento.md>)
(Controller → Service → Repository). Foi escolhido porque continha a **única violação real
de camada do backend**: o `PlanoCronogramaController` injetava `Repository<Projeto>` e
`Repository<Evento>` e fazia `findOne`/`save` direto — persistência e regra dentro da camada
de entrada.

Ao copiar um padrão para um módulo novo, copie deste.

## Documentos

| Arquivo | Conteúdo |
|---|---|
| [arquitetura.md](arquitetura.md) | Camadas, arquivos e a regra de onde cada repository mora |
| [api.md](api.md) | As 6 rotas, payloads e códigos de resposta |
| [regras-negocio.md](regras-negocio.md) | Substituição total, diff posicional, defaults, timeline |
| [casos-de-uso.md](casos-de-uso.md) | Fluxos do consultor na tela |
| [fluxo.md](fluxo.md) | Sequência de uma edição, ponta a ponta |

## Estado

- Cobertura do módulo: **7 suítes / 46 testes** (`npx jest src/plano-cronograma`).
- Entidades próprias: `CronogramaItem`, `ChecklistItem`, `Modificacao`.
- Entidades de terceiros que consome: `Projeto`, `Evento` (via `RepositoriosModule`).
