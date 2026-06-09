# Implantação Rech — Time de Implantação do SIGER®

Este repositório modela o **time de implantação** da Rech como uma estrutura de
**agentes** (papéis), **skills** (etapas do processo) e **documentação** (processo,
glossário e templates). O objetivo é permitir que o Claude Code execute, oriente e
padronize as tarefas de cada etapa do processo de implantação do ERP **SIGER®**.

> Fonte de verdade do processo: [docs/processo-implantacao.md](docs/processo-implantacao.md)
> (transcrição organizada do GRM:Implantação).

## Idioma

Todo o conteúdo deste repositório é em **português do Brasil (pt-BR)**. Mantenha esse
padrão em qualquer arquivo novo (agentes, skills, docs, e-mails, templates).

## Como o time está organizado

### Papéis → Agentes (`.claude/agents/`)

Cada papel do processo é um subagente especializado. Use o agente certo para a tarefa:

| Agente | Papel | Quando acionar |
|--------|-------|----------------|
| `coordenador-implantacao` | Coordenação da Implantação | Designar consultores, abrir/controlar RNS de Implantação, decisões de escopo, transição p/ manutenção |
| `setor-adm` | Setor Adm | Preparar documentos, abrir RNS (templates), assinatura digital, arquivamento, links no Drive/SharePoint |
| `consultor-implantacao` | Consultor de Implantação (GCI) | Executar levantamento, aderência, parametrização, treinamento, simulação, virada e encerramento |
| `gerente-projeto` | Gerente do Projeto | Datas de uso oficial/encerramento, negociações em aberto, comunicação de encerramento |
| `equipe-conversao` | Equipe de Conversão | Tratar RNS de conversão redigidas, layouts, de/para, prévia e conversão oficial |
| `gestao-mudanca` | Gestão da Mudança (OCM) | **Gerador.** Adoção, stakeholders, comunicação, prontidão (ADKAR), treino por papel, indicadores |

### Etapas → Skills (`.claude/skills/`)

Cada etapa numerada do processo é uma skill acionável (passo a passo + templates):

**Pré-implantação**
- `levantamento-processos` — mapeamento/levantamento macro (apoio comercial)
- `apoio-comercial-demonstracao` — demonstrações + devolutiva ao comercial

**Implantação**
- `abertura-implantacao` — ações de início e abertura da RNS de Implantação
- `manutencao-rns-implantacao` — ajuste dos campos/status da RNS(I)
- `registros-sicla` — registros no SICLA (tipos 12 e 13)
- `levantamento-micro` — refinamento/detalhamento do levantamento
- `aderencia-siger` — definição dos recursos do SIGER que serão usados
- `encaminhar-conversoes` — RNS de Conversão (ORC/COB), de/para, layouts
- `encaminhar-desenvolvimentos` — RNS COB de desenvolvimentos específicos
- `projeto-implantacao` — elaboração do Projeto de Implantação
- `cronograma-implantacao` — elaboração do Cronograma (5 dias úteis)
- `parametrizacoes` — criação de empresas e parametrizações (1.1.P / 1.2.A / 1.2.M)
- `treinamento-rotinas` — treinamento de tabelas e rotinas
- `simulacoes` — micro e macroprocessos
- `virada-oficial` — preparação de dados + checklist de virada
- `acompanhamento-producao` — uso oficial e micro ajustes
- `encerramento-implantacao` — pendências, RNS, termo de encerramento e e-mail final

**Qualidade e adoção (robustez P0)**
- `gestao-mudanca` — OCM/ADKAR: stakeholders, comunicação, prontidão, treino por papel, adoção
- `testes-sit-uat` — testes formais SIT/UAT, registro de defeitos e sign-off (gate da virada)

**Qualidade de dados e estabilização (robustez P1)**
- `validacao-conversao` — reconciliação origem×destino, mock loads e aceite dos dados convertidos
- `hypercare` — estabilização pós-virada com governança diária e critério de saída
- fit/gap — log de aderência (dentro da skill `aderencia-siger`)

**Gestão e medição (robustez P2)**
- `metricas-kpi` — KPIs de resultado (prazo, orçamento, adoção, time-to-value, CSAT)
- `gestao-riscos-raid` — RAID: riscos, premissas, issues, decisões e dependências
- `dossie-cliente` — documento vivo com o estado consolidado da implantação

## Convenções do processo (resumo operacional)

- **SICLA — tipos de atividade:** `12 = apoio Comercial` (pré-implantação) · `13 = Implantação`.
  Agenda interna de treinamento/parametrização usa o **tipo 84**.
- **RNS:** `RNS(I)` = RNS de Implantação · `ORC` = orçamento · `COB` = cobrança/execução.
  Conversões e desenvolvimentos seguem o par **ORC → COB**.
- **Prazo do Projeto + Cronograma:** até **5 dias úteis** após a liberação do levantamento
  (com a RNS de Implantação já criada).
- **Sigla da empresa:** 3 caracteres (letras/números, ex.: `A01`) + CNPJ + código do cliente no SICLA.
- **Documentos obrigatórios (não opcionais):** Projeto de Implantação, Cronograma, Termo de Encerramento.
- Caminhos de templates corporativos (rede `R:\`) e pastas de cliente estão em
  [docs/recursos-e-caminhos.md](docs/recursos-e-caminhos.md).

## Estrutura de pastas

```
Implantacao/
├── CLAUDE.md                  # este guia
├── README.md                  # visão geral do time
├── docs/                      # processo, glossário, papéis, fluxo, caminhos
├── templates/                 # e-mails, termos e checklists prontos para uso
├── tools/                     # geradores Office (.xlsx/.docx) + dados (YAML)
├── exemplos/                  # artefatos gerados (não versionado)
└── .claude/
    ├── agents/                # papéis do time (subagentes)
    └── skills/                # etapas do processo (skills)
```

## Geradores Office (agentes geradores)

Alguns agentes são **geradores**: produzem artefatos em **Excel/Word** a partir de dados em
`tools/data/*.yaml` (modelo "dados entram → Office sai"). Saída em `exemplos/`.

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
| `python tools/gerar_projeto_implantacao.py` | `Projeto_Implantacao_<cliente>.docx` (**fiel ao template Rech**) |
| `python tools/gerar_termo_encerramento.py` | `Termo_Encerramento_<cliente>.docx` (**fiel ao template Rech**) |
| `python tools/gerar_levantamento.py` | `Levantamento_<cliente>.docx` (**fiel ao template Rech**) |
| `python tools/extrair_levantamento.py <doc>` | `projeto_seed.yaml` (ponte Levantamento→Projeto, p/ IA) |

Instalar dependências uma vez: `python -m pip install -r tools/requirements.txt`.
Detalhes em [tools/README.md](tools/README.md).

## Princípios ao executar tarefas

1. **Sempre referencie a etapa do processo** ([docs/processo-implantacao.md](docs/processo-implantacao.md))
   e o papel responsável antes de agir.
2. **Não pule documentos obrigatórios.** Projeto, Cronograma e Termo são requisitos.
3. **Registre no SICLA** com o tipo de atividade correto (12 ou 13).
4. **Aponte horas na RNS correta** (conversão na RNS de conversão; implantação na RNS(I)).
5. Quando faltar dado do cliente, **gere a pergunta para o consultor/cliente** em vez de assumir.
