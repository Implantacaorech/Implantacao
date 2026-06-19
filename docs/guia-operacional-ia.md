# Guia operacional da IA — Implantação Rech / SIGER®

> Detalhamento movido do `CLAUDE.md` para mantê-lo curto e barato de carregar.
> Consulte este guia **sob demanda**, não em toda sessão. Tudo em **pt-BR**.

Fonte de verdade do processo: [processo-implantacao.md](processo-implantacao.md)
(transcrição organizada do GRM:Implantação).

## Papéis → Agentes (`.claude/agents/`)

Cada papel do processo é um subagente especializado. Use o agente certo para a tarefa:

| Agente | Papel | Quando acionar |
|--------|-------|----------------|
| `coordenador-implantacao` | Coordenação da Implantação | Designar consultores, abrir/controlar RNS de Implantação, decisões de escopo, transição p/ manutenção |
| `setor-adm` | Setor Adm | Preparar documentos, abrir RNS (templates), assinatura digital, arquivamento, links no Drive/SharePoint |
| `consultor-implantacao` | Consultor de Implantação (GCI) | Levantamento, aderência, parametrização, treinamento, simulação, virada e encerramento |
| `gerente-projeto` | Gerente do Projeto | Datas de uso oficial/encerramento, negociações em aberto, comunicação de encerramento |
| `equipe-conversao` | Equipe de Conversão | RNS de conversão redigidas, layouts, de/para, prévia e conversão oficial |
| `gestao-mudanca` | Gestão da Mudança (OCM) | **Gerador.** Adoção, stakeholders, comunicação, prontidão (ADKAR), treino por papel, indicadores |

## Etapas → Skills (`.claude/skills/`)

**Pré-implantação:** `levantamento-processos`, `apoio-comercial-demonstracao`

**Implantação:** `abertura-implantacao`, `manutencao-rns-implantacao`, `registros-sicla`,
`levantamento-micro`, `aderencia-siger`, `encaminhar-conversoes`, `encaminhar-desenvolvimentos`,
`projeto-implantacao`, `cronograma-implantacao`, `parametrizacoes`, `treinamento-rotinas`,
`simulacoes`, `virada-oficial`, `acompanhamento-producao`, `encerramento-implantacao`

**Qualidade e adoção (P0):** `gestao-mudanca` (OCM/ADKAR), `testes-sit-uat` (gate da virada)

**Qualidade de dados e estabilização (P1):** `validacao-conversao`, `hypercare`,
fit/gap (dentro de `aderencia-siger`)

**Gestão e medição (P2):** `metricas-kpi`, `gestao-riscos-raid`, `dossie-cliente`

> Definições paralelas: `.agents/skills/*` e `.codex/agents/*` (formatos Codex/.agents). O canônico
> citado pelo processo é `.claude/`.

## Convenções do processo (resumo operacional)

- **SICLA — tipos de atividade:** `12 = apoio Comercial` (pré-implantação) · `13 = Implantação`.
  Agenda interna de treinamento/parametrização usa o **tipo 84**.
- **RNS:** `RNS(I)` = RNS de Implantação · `ORC` = orçamento · `COB` = cobrança/execução.
  Conversões e desenvolvimentos seguem o par **ORC → COB**.
- **Prazo do Projeto + Cronograma:** até **5 dias úteis** após a liberação do levantamento
  (com a RNS de Implantação já criada).
- **Sigla da empresa:** 3 caracteres (ex.: `A01`) + CNPJ + código do cliente no SICLA.
- **Documentos obrigatórios:** Projeto de Implantação, Cronograma, Termo de Encerramento.
- Caminhos de templates corporativos (rede `R:\`) e pastas de cliente em
  [recursos-e-caminhos.md](recursos-e-caminhos.md).

## Painel Flask (`webapp/`) — runtime e deploy

- Roda **a partir da fonte** via `Iniciar_Servidor.bat` em **http://127.0.0.1:5000**.
- Banco em produção: **PostgreSQL** via env do usuário `PAINEL_DB_URL`
  (`postgresql+psycopg2://painel:painel2026@localhost:5432/painel`, Postgres em Docker/WSL2).
  `/health` → `{"db":"postgresql","status":"ok"}`.
- **NÃO gerar `.exe`** (fluxo legado via `build_painel_exe.py`) salvo pedido explícito.
- Entrega = **código sincronizado no GitHub** (commit + push em `origin/main`, conta `Implantacaorech`).
- Cadastros de referência (área Sistema/ADM): Checklist, Índice de Tópicos, Modelos de Documentos.
- Geração **fiel** das fases: troca só os placeholders dos layouts oficiais pelos dados do projeto.

## Geradores Office

Produzem artefatos **Excel/Word** a partir de `tools/data/*.yaml` ("dados entram → Office sai").
Saída em `exemplos/` (não versionado).

| Comando | Saída |
|---------|-------|
| `python tools/gerar_kit_mudanca.py` | `Kit_Gestao_Mudanca_<cliente>.xlsx` |
| `python tools/gerar_roteiros_teste.py` | `Roteiros_SIT_UAT_<cliente>.xlsx` |
| `python tools/gerar_aceite_uat.py` | `Termo_Aceite_UAT_<cliente>.docx` |
| `python tools/gerar_reconciliacao_conversao.py` | `Reconciliacao_Conversao_<cliente>.xlsx` |
| `python tools/gerar_painel_hypercare.py` | `Painel_Hypercare_<cliente>.xlsx` |
| `python tools/gerar_log_fitgap.py` | `Log_FitGap_<cliente>.xlsx` |
| `python tools/gerar_painel_kpi.py` | `Painel_KPIs_<cliente>.xlsx` |
| `python tools/gerar_raid.py` | `RAID_<cliente>.xlsx` |
| `python tools/gerar_dossie_cliente.py` | `Dossie_<cliente>.docx` |
| `python tools/gerar_projeto_implantacao.py` | `Projeto_Implantacao_<cliente>.docx` (engine de tokens) |
| `python tools/gerar_termo_encerramento.py` | `Termo_Encerramento_<cliente>.docx` |
| `python tools/gerar_levantamento.py` | `Levantamento_<cliente>.docx` |
| `python tools/importar_mapeamento.py <doc>` | `projeto_<cliente>.yaml` (Levantamento→Projeto + conversão verbal) |
| `python tools/conversor_verbal.py "<texto>"` | Converte Presente→Futuro (motor offline) |

Dependências: `python -m pip install -r tools/requirements.txt`. Detalhes em [tools/README.md](../tools/README.md).

## Estrutura de pastas

```
Implantacao/
├── CLAUDE.md                  # guia curto (carregável)
├── AGENTS.md / README.md      # referência de comandos / visão geral
├── docs/                      # processo, glossário, papéis, fluxo, caminhos, guias-IA
├── templates/                 # e-mails, termos e checklists (.md)
├── tools/                     # geradores Office + dados (YAML) + templates .docx (local)
├── webapp/                    # painel Flask (app principal)
├── exemplos/                  # artefatos gerados (não versionado)
├── dados/                     # banco local SQLite (não versionado)
├── entrada_ia/                # anexos para a IA analisar (ver README)
├── memoria_ia/                # memória curta/versionada do projeto
├── ia_admin/                  # painel separado de acompanhamento de uso da IA
└── .claude/ .agents/ .codex/  # agentes e skills (definições)
```

## Princípios ao executar tarefas

1. **Referencie a etapa do processo** ([processo-implantacao.md](processo-implantacao.md)) e o papel responsável antes de agir.
2. **Não pule documentos obrigatórios** (Projeto, Cronograma, Termo).
3. **Registre no SICLA** com o tipo correto (12 ou 13).
4. **Aponte horas na RNS correta** (conversão na RNS de conversão; implantação na RNS(I)).
5. Quando faltar dado do cliente, **gere a pergunta** em vez de assumir.
6. **Eficiência de contexto:** consulte `memoria_ia/` primeiro; não faça varredura total;
   peça anexos pesados em `entrada_ia/`. Ver [uso-eficiente-ia.md](uso-eficiente-ia.md).
