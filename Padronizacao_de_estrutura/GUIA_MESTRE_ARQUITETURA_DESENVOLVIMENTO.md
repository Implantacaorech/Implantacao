# GUIA MESTRE DE ARQUITETURA DE DESENVOLVIMENTO — consolidado

> **Este arquivo deixou de ser normativo em 2026-08-03.** O conteúdo foi incorporado ao documento
> único [`PADRAO-DESENVOLVIMENTO-RECH.md`](../PADRAO-DESENVOLVIMENTO-RECH.md), na **Parte II
> (§13 a §21)**, junto com o Padrão Rech (Parte I, §3 a §10).

Consulte lá. Mapa do que virou o quê:

| Assunto deste guia | Onde está agora |
|---|---|
| Princípios e arquitetura Controller → Service → Repository | §13 |
| Responsabilidades de cada camada | §13.1 a §13.3 |
| Injeção de dependência | §13.4 |
| Estrutura recomendada e estrutura de módulo | §14 |
| Clean Code e SOLID | §15 |
| Banco de dados (migrations, seeds, índices, constraints, FKs) | §16 |
| Documentação por módulo (6 arquivos) | §17 |
| Testes e cobertura mínima de 80% | §18 |
| Segurança (JWT, RBAC, Helmet, CORS, rate limit, validação, sanitização) | §19 |
| Checklist final | §21 |

A leitura **aplicada a este repositório** — como cada camada se chama no `backend/`, `frontend/` e
`docservice/`, quais guardas rodam no CI e quais desvios estão reconhecidos com prazo — continua em
[`vault/23 - Padrões/Guia Mestre de Arquitetura de Desenvolvimento.md`](<../vault/23 - Padrões/Guia Mestre de Arquitetura de Desenvolvimento.md>),
adotada pelo [ADR-0002](<../vault/17 - ADR/ADR-0002 - Adocao do Guia Mestre de Arquitetura.md>).
