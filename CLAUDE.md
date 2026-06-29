# Implantação Rech — SIGER® · guia curto

Repositório do **time de implantação** da Rech: **agentes** (papéis), **skills** (etapas),
**documentação** e o **painel Flask** (`webapp/`). Este arquivo é curto de propósito — o
detalhamento operacional está em **[docs/guia-operacional-ia.md](docs/guia-operacional-ia.md)**.

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

## Painel Flask — não gerar `.exe`
Roda da **fonte** via `Iniciar_Servidor.bat` em `http://127.0.0.1:5000` (Postgres via `PAINEL_DB_URL`).
**Não** reconstruir o `.exe` (legado) salvo pedido explícito. Entrega = código no GitHub (commit + push).
Geradores Office e runtime detalhados em [docs/guia-operacional-ia.md](docs/guia-operacional-ia.md) e [tools/README.md](tools/README.md).

## Painel Flask — agentes de software e fronteiras
Para manter/evoluir o `webapp/`, use os **agentes de software** em `.claude/agents/` (distintos
dos agentes de NEGÓCIO acima): **painel-core** (backend/rotas/`db.py`/regras) · **qualidade**
(pytest + revisão + endpoints) · **documentos-geracao** (`gl_*`/modelos) · **integracoes-operacao**
(e-mail/Oracle/infra) · **documentacao-contexto** · **seguranca-permissoes**. Mapa e ordem de
implantação: [docs/agentes-software.md](docs/agentes-software.md).

**Regra de ouro — fronteira por módulo (não sobrepor):**
`app.py`/`routes_*`/`db.py` → painel-core · `gerar_layout`/`gl_*`/`tools/gerar_*`/modelos →
documentos-geracao · `mailer`/`imap_intake`/`gmail_api`/`disponibilidade`/infra →
integracoes-operacao · `docs/`+`memoria_ia/` → documentacao-contexto.
**`templates/` + CSS são do MANUS IA — nenhum agente de software escreve lá.**

**Antes de todo push** (e após cada pull que traga mudança do MANUS): rode o smoke
`python webapp/verificar_app.py` (segundos) e a suíte `pytest webapp/test_painel.py -q` (≈4 min).
Rotas vivem nos `routes_*` com `register(app, **deps)` — nunca `from app import …` num módulo de rota.
