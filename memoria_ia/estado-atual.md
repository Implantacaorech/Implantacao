# Estado atual do projeto

> Atualizado: 2026-06-19. Resumo curto — detalhes nos arquivos apontados.

## O que é
Repositório do **time de implantação** da Rech (ERP SIGER®): agentes/skills/docs **+** um
**painel Flask** (`webapp/`) que conduz o fluxo de implantação por cliente.

## Como roda (produção)
- **A partir da fonte** via `Iniciar_Servidor.bat` → `http://127.0.0.1:5000`.
- Banco: **PostgreSQL** (env do usuário `PAINEL_DB_URL`; Postgres em Docker/WSL2). `/health` confirma.
- **Sem `.exe`** — o fluxo PyInstaller (`build_painel_exe.py`) é **legado**; só gerar se pedido.
- Há um SQLite local em `dados/painel.db` (dev; não versionado).

## Módulos do painel (já existentes)
- Fluxo de 6 etapas: Agendamento → Levantamento → Projeto → Designação → Cronograma e Check-list → Encerramento.
- 5 perfis (ADM, Coordenador, Administrativo, GCI, Consultor) + senha mestra break-glass.
- Cadastros de referência (Sistema/ADM): **Checklist**, **Índice de Tópicos**, **Modelos de Documentos**.
- **Geração fiel** das fases: troca só os placeholders dos layouts oficiais pelos dados do projeto
  (`tools/preencher_layout.py` + `webapp/gerar_layout.py`).
- Importação do e-mail de fechamento (IMAP), notificações por e-mail, robô da caixa.

## Geradores Office (`tools/`)
Produzem .xlsx/.docx a partir de `tools/data/*.yaml`; saída em `exemplos/` (não versionado).

## Infra / sincronização
- GitHub: `Implantacaorech/Implantacao` (conta `Implantacaorech`). **Entrega = código no GitHub**;
  ao terminar, **commit + push** ("subir total sempre", respeitando `.gitignore`).
- Testes: `webapp/test_painel.py` (pytest); smoke em `tools/verificar.py`.

## Governança de IA (esta camada)
- `.cloudignore`, `docs/guia-operacional-ia.md`, `docs/uso-eficiente-ia.md`,
  `docs/template-handoff-sessao.md`, `entrada_ia/`, `memoria_ia/`, `ia_admin/`.

## ⚠️ Não confundir
O **painel operacional** (`webapp/`, clientes/projetos/cronogramas/RNS) é **separado** da
**área de governança de IA** (`ia_admin/`, `memoria_ia/`). Não misturar os dois.
