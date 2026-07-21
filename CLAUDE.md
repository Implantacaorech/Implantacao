# Implantação Rech — SIGER® · guia curto

Repositório do **time de implantação** da Rech: **agentes** (papéis), **skills** (etapas),
**documentação** e o **Painel** (`backend/` NestJS + `frontend/` Angular, em produção desde
2026-07-19 — porta 5100, `http://I7M1700-01-EVE:5100`). Este arquivo é curto de propósito —
o detalhamento operacional está em **[docs/guia-operacional-ia.md](docs/guia-operacional-ia.md)**.

## Padrões de desenvolvimento da Rech
Antes de criar, alterar estruturalmente ou auditar este projeto, carregue e siga:
<https://gitlab.rech.com.br/gitlab/rech/ia/padrao-ia/raw/master/PADRAO-RECH.md>

> Há uma cópia local em `MD Padrao desenv/Padrao_Rech.md` (rev. **2.0.0**). Em 2026-07-21 a
> canônica ainda respondia rev. 1.0.0 (sem a §4.8, de aplicações web) — a cópia local está
> **à frente**. Compare as revisões antes de assumir qual vale.
>
> **Este projeto é uma aplicação web** e está sujeito à §4.8 (Angular · NestJS + TypeORM ·
> MariaDB · entrega em processo único). Não conformidades conhecidas e o plano de adequação
> estão em [docs/pendencias.md](docs/pendencias.md) — a principal é o repositório ainda estar
> no GitHub, não no GitLab interno (§3).

## Idioma
Tudo em **português do Brasil (pt-BR)**, em qualquer arquivo novo.

## Antes de começar (eficiência de contexto)
1. **Consulte a memória primeiro:** [memoria_ia/estado-atual.md](memoria_ia/estado-atual.md),
   [memoria_ia/pendencias.md](memoria_ia/pendencias.md), [memoria_ia/arquivos-chave.md](memoria_ia/arquivos-chave.md).
2. **Não faça varredura completa do projeto** sem justificativa — busque arquivos específicos.
3. **Não carregue binários/artefatos gerados** (.docx/.xlsx/imagens/.db/.log/.min.js, `exemplos/`,
   `dados/`, `webapp/_uploads/`). Regras em [.cloudignore](.cloudignore).
4. **Anexos pesados:** peça para o usuário colocá-los em [entrada_ia/](entrada_ia/README.md) e
   converter o trecho útil para `.txt`/`.md`. Ver [docs/uso-eficiente-ia.md](docs/uso-eficiente-ia.md).
5. **Consulte docs específicos sob demanda** (abaixo), não tudo de uma vez.

## Fonte de verdade
- Processo: [docs/processo-implantacao.md](docs/processo-implantacao.md)
- Papéis: [docs/papeis-responsabilidades.md](docs/papeis-responsabilidades.md) · Glossário: [docs/glossario.md](docs/glossario.md)
- Caminhos/recursos: [docs/recursos-e-caminhos.md](docs/recursos-e-caminhos.md) · Backlog: [docs/pendencias.md](docs/pendencias.md)
- **Arquitetura/stack/ADRs (Documentation as Code):** [vault/00 - Dashboard/](<vault/00 - Dashboard/00 - Dashboard.md>) —
  este arquivo continua sendo a fonte das regras de **negócio** acima; o Vault é a fonte da
  **arquitetura e do código**. Decisão registrada em
  [ADR-0001](<vault/17 - ADR/ADR-0001 - Adocao do ecossistema Vault + IA.md>).

## Stack oficial (em produção desde 2026-07-19)

Backend **NestJS + TypeScript + TypeORM** (`backend/`) · Frontend **Angular + TypeScript**
(`frontend/`) · Banco **MariaDB** (`painel-db-mariadb`, db `painel_novo`) · **docservice/**
(Python, geração fiel + transcrição, nunca exposto publicamente). Detalhe em
[vault/03 - Backend/](<vault/03 - Backend/03 - Backend.md>) e
[vault/04 - Frontend/](<vault/04 - Frontend/04 - Frontend.md>).

O **painel Flask legado foi desligado e arquivado em `projeto_old/`** (virada executada em
2026-07-19 — ver `docs/migracao/05-plano-de-virada.md` e
[vault/18 - Histórico/](<vault/18 - Histórico/18 - Histórico.md>)). **`webapp/` continua
existindo, só que reduzido** a `legado_cli.py`/`runner.py`/`roles.py`/`forms.py` — uma
ponte de subprocesso chamada pelo backend novo (`LegadoCliService`) para o assistente
administrativo legado (roles/cliente/criar-templates/verbal/saúde). **`tools/` continua
vivo por completo** — é dependência real dessa ponte e do `docservice/`. Nada em `webapp/`
ou `tools/` que sobrou é código morto; não mover/apagar sem checar `import` primeiro.

## Papéis (agentes) — detalhe no guia operacional
`coordenador-implantacao` · `setor-adm` · `consultor-implantacao` (GCI) · `gerente-projeto` ·
`equipe-conversao` · `gestao-mudanca`. Definições em `.claude/agents/`.

## Skills por fase — detalhe no guia operacional
**Pré:** levantamento-processos, apoio-comercial-demonstracao ·
**Implantação:** abertura-implantacao … encerramento-implantacao ·
**Qualidade:** gestao-mudanca, testes-sit-uat, validacao-conversao, hypercare ·
**Gestão:** metricas-kpi, gestao-riscos-raid, dossie-cliente. Definições em `.claude/skills/`.

## Regras críticas (não pular)
- **Documentos obrigatórios:** Projeto de Implantação, Cronograma, Termo de Encerramento.
- **SICLA:** `12 = apoio Comercial` · `13 = Implantação` · `84 = agenda interna`.
- **RNS:** `RNS(I)` Implantação · par **ORC → COB** (orçamento → cobrança) p/ conversões e desenvolvimentos.
- **Prazo Projeto + Cronograma:** ≤ **5 dias úteis** após liberar o levantamento (RNS(I) já criada).
- **Sigla da empresa:** 3 caracteres + CNPJ + código do cliente no SICLA.
- Apontar horas na RNS correta; registrar no SICLA com o tipo certo; **faltou dado → pergunte**.

## Painel — como roda em produção

NestJS serve o build do Angular direto (`@nestjs/serve-static`) — um único processo/porta
(**5100**, máquina `I7M1700-01-EVE`). Sobe via `Iniciar_Painel_Novo.bat` (valida
`MIGRACAO_DB_URL`/`MIGRACAO_JWT_SECRET`/`MIGRACAO_JWT_REFRESH_SECRET` antes); guardião
(`Guardiao_Painel_Novo.vbs`) e verificação de integridade rodam como Tarefas Agendadas.
Entrega = código no GitHub (commit + push). `docs/runbooks-operacao.md` e
[vault/12 - DevOps/](<vault/12 - DevOps/12 - DevOps.md>) têm o detalhe operacional.
**`projeto_old/`** guarda o painel Flask desligado (não é runtime, é arquivo morto —
histórico/rollback de emergência; ver `docs/migracao/05-plano-de-virada.md` Fase 6).

## Painel — agentes de software e fronteiras

Para manter/evoluir o Painel, use os **agentes de software** em `.claude/agents/` (distintos
dos agentes de NEGÓCIO acima): **painel-core** · **qualidade** · **documentos-geracao** ·
**integracoes-operacao** · **documentacao-contexto** · **seguranca-permissoes**. Definições
atualizadas em 2026-07-19 pro stack novo (`backend/src/*`, `docservice/`, ponte
`legado_cli`) — mapa original pré-virada, só como histórico:
[docs/agentes-software.md](docs/agentes-software.md) (desatualizado, não reescrito).

**`webapp/legado_cli.py`/`runner.py`/`roles.py`/`forms.py` e `tools/`** continuam vivos —
são a ponte de subprocesso do backend novo (`LegadoCliService`) para o assistente
administrativo legado. Não mover/apagar sem checar quem importa o quê primeiro.
**`templates/` + CSS do Angular são do MANUS IA — nenhum agente de software escreve lá.**

**Antes de todo push:** `cd backend && npm test` e `cd frontend && npm test` (specs reais,
~40s+~23s). `python tools/verificar.py` (smoke dos geradores, best-effort) se mexer em
`tools/`. CI roda os três em `.github/workflows/ci.yml`.
