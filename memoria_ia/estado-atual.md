# Estado atual do projeto

> Atualizado: 2026-07-19 (virada para produção). Resumo curto — detalhes nos arquivos apontados.

## O que é
Repositório do **time de implantação** da Rech (ERP SIGER®): agentes/skills/docs **+** o
**Painel** — desde 2026-07-19, o Painel em produção é o stack **NestJS + Angular**
(`backend/` + `frontend/`), não mais o painel Flask.

## Como roda (produção)

- **NestJS serve o build do Angular direto** (`@nestjs/serve-static`) — um único
  processo/porta: **5100**, máquina `I7M1700-01-EVE` → `http://I7M1700-01-EVE:5100`.
- Sobe via `Iniciar_Painel_Novo.bat`; guardião (`Guardiao_Painel_Novo.vbs`) e verificação de
  integridade rodam como Tarefas Agendadas do Windows.
- Banco: **MariaDB** (container `painel-db-mariadb`, banco `painel_novo`), via
  `MIGRACAO_DB_URL`. `/api/health` confirma (`"db":"mariadb"`).
- **docservice/** (Python, processo próprio) faz a geração fiel de documentos + transcrição
  de vídeos de treinamento — nunca exposto publicamente, chamado só pelo backend.
- **`webapp/legado_cli.py`** (+ `runner.py`/`roles.py`/`forms.py`) é uma ponte de
  subprocesso do backend para o assistente administrativo legado (roles/cliente/
  criar-templates/verbal/saúde) — reaproveita esse código Python tal como é.
- **`tools/`** continua vivo por completo — dependência real da ponte acima e usado por
  ambos os stacks para os geradores Office (.docx/.xlsx).

## O painel Flask legado (`webapp/` original)

**Desligado e arquivado em `projeto_old/`** em 2026-07-19 (processo parado, Tarefas
Agendadas do guardião/integridade desabilitadas). Não é mais runtime — é histórico/rollback
de emergência. O Postgres dele (`painel-db`) já estava inacessível há ~2 dias quando a
virada aconteceu (achado durante a checagem de segurança pré-virada, não uma decisão
planejada) — detalhe em `vault/22 - Troubleshooting/` e
`docs/migracao/05-plano-de-virada.md` §"Registro real da virada". Risco aceito, não
mitigado: dado gravado no Flask entre 15/07 e a queda (17/07 à noite) pode não estar no
stack novo.

## Módulos do painel (já existentes)
- Fluxo de 6 etapas: Agendamento → Levantamento → Projeto → Designação → Cronograma e Check-list → Encerramento.
- 5 perfis (ADM, Coordenador, Administrativo, GCI, Consultor) — **sem mais "senha mestra"**
  de emergência (existia no Flask, não existe no stack novo).
- Cadastros de referência (Sistema/ADM): Checklist, Índice de Tópicos, Modelos de Documentos.
- **Geração fiel** das fases via `docservice/` (cópia própria dos geradores, não importa de
  `webapp/`) + a ponte `legado_cli` para o assistente administrativo.
- Importação do e-mail de fechamento (IMAP), notificações por e-mail, robô da caixa — agora
  em `backend/src/email/`, `backend/src/fluxo/`.

## Geradores Office (`tools/`)
Produzem .xlsx/.docx a partir de `tools/data/*.yaml`; saída em `exemplos/` (não versionado).
Usados tanto pela ponte `legado_cli` quanto (via cópia em `docservice/gerador/`) pelo
backend novo.

## Infra / sincronização
- GitHub: `Implantacaorech/Implantacao` (conta `Implantacaorech`). **Entrega = código no GitHub**;
  ao terminar, **commit + push** ("subir total sempre", respeitando `.gitignore`).
- Testes: `backend/` (Jest) + `frontend/` (Vitest) no CI (`.github/workflows/ci.yml`,
  jobs `backend-test`/`frontend-test`) + `tools-smoke` (best-effort).
- PR #8 (`feature/migracao-angular-backend-moderno` → `main`) ainda não mergeado; branch
  protection em `main` ainda não configurada — ver `vault/12 - DevOps/`.

## Governança de IA (esta camada)
- `.cloudignore`, `docs/guia-operacional-ia.md`, `docs/uso-eficiente-ia.md`,
  `docs/template-handoff-sessao.md`, `entrada_ia/`, `memoria_ia/`, `ia_admin/`.
- **Novo (2026-07-19):** `vault/` — Vault Obsidian, fonte de documentação técnica/
  arquitetural (Documentation as Code). Ver `vault/00 - Dashboard/`.

## ⚠️ Não confundir
O **painel operacional** (agora `backend/`+`frontend/`, clientes/projetos/cronogramas/RNS)
é **separado** da **área de governança de IA** (`ia_admin/`, `memoria_ia/`, `vault/`). Não
misturar os dois.

## ⚠️ Pendência conhecida, não corrigida nesta virada

As definições dos agentes de software em `.claude/agents/` (`painel-core`,
`documentos-geracao` etc.) ainda descrevem os caminhos do Flask antigo (`app.py`,
`routes_*`, `webapp/gl_*`) — precisam ser reescritas apontando para `backend/src/*`. Ver
`vault/19 - Roadmap/`.
