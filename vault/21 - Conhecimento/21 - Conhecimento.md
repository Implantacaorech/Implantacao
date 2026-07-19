---
titulo: "Base de Conhecimento"
tipo: indice
status: em-andamento
criado: 2026-07-19
atualizado: 2026-07-19
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - conhecimento
relacionados:
  - "[[22 - Troubleshooting]]"
  - "[[07 - Documentação]]"
---

# Base de Conhecimento

> [!info] Sobre esta seção
> FAQ, tutoriais e "como fazer" gerais do projeto — conhecimento que não é regra de negócio
> nem decisão arquitetural, mas ajuda no dia a dia.

## Como rodar cada stack localmente

**Backend (NestJS)** — dentro de `backend/`:

```bash
npm install
npm run start:dev        # watch mode, http://localhost:<PORT>/api
npm test                 # Jest (unitário)
npm run test:cov         # Jest com cobertura
npm run test:e2e         # E2E (jest-e2e.json)
npm run lint             # ESLint com --fix (cuidado: reformata na hora — ver [[11 - Testes]])
npm run migration:generate  # gera migration a partir do diff das entities
npm run migration:run       # aplica migrations pendentes
npm run seed:admin           # cria o usuário ADM inicial
```

**Frontend (Angular)** — dentro de `frontend/`:

```bash
npm install
npm start                 # ng serve, dev server
npm test                  # Vitest via @angular/build:unit-test — não abre browser real
npm run build             # build de produção (servido pelo próprio NestJS, ver [[03 - Backend]])
```

**Painel Flask legado** — ver `Iniciar_Servidor.bat` na raiz e [[../CLAUDE.md]].

## FAQ

**P: Por que o job `test` do CI às vezes falha mesmo sem eu ter mexido em nada do Python?**
R: Não é regressão sua — é uma lacuna pré-existente do repositório. Alguns testes do
`webapp/test_painel.py` dependem de arquivos `.docx` que são propositalmente gitignorados
(letterhead real da Rech). Detalhe e contexto completo em [[22 - Troubleshooting]] item 4.

**P: Por que os services do backend usam `Repository<Entity>` do TypeORM direto, em vez de
uma camada de repositório própria?**
R: É uma escolha consciente de manter o padrão idiomático do NestJS em vez de adicionar uma
camada de abstração que ninguém pediu operacionalmente ainda. Trade-offs documentados em
[[02 - Arquitetura]].

**P: As tabelas do banco têm `FOREIGN KEY` de verdade?**
R: Não. Toda referência (`projeto_id`, `modelo_id` etc.) é uma coluna simples com
`@Index()`, sem constraint de FK no banco nem relação formal do TypeORM
(`@ManyToOne`/`@OneToMany`). Integridade referencial é responsabilidade da aplicação. Ver
[[05 - Banco de Dados]].

**P: Por que o backend desliga HSTS e `upgrade-insecure-requests` do Helmet?**
R: O servidor roda em HTTP puro na rede interna, sem TLS/reverse proxy. HSTS quebraria
visitas seguintes (forçaria HTTPS num host que não tem); `upgrade-insecure-requests`
reescrevia carregamento de `main.js`/`styles.css` para HTTPS e quebrava a aplicação em
produção (achado real, `ERR_BLOCKED_BY_ORB`). Ver comentário em `backend/src/main.ts` e
[[03 - Backend]].

**P: Como sei se meu token do GitHub tem a permissão certa antes de tentar automatizar algo?**
R: Teste o endpoint específico primeiro (`GET` antes de `PUT`/`POST`) — um PAT fine-grained
pode autenticar (200 em endpoints de leitura) e mesmo assim não ter escrita numa API
específica (branch protection, PRs). Ver os três achados reais disso em
[[22 - Troubleshooting]].

## Relacionados no Vault

- [[22 - Troubleshooting]]
- [[07 - Documentação]]
- [[02 - Arquitetura]]
- [[05 - Banco de Dados]]

## Aponta para (conteúdo real do repositório)

- `../backend/package.json`
- `../frontend/package.json`
- `../Iniciar_Servidor.bat`

## Status

FAQ real populado em 2026-07-19, a partir de achados desta sessão e do código. Ver
[[00 - Dashboard]].
