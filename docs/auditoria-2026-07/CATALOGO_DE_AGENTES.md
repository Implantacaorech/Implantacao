# Catálogo de agentes

> Este catálogo **integra-se** ao existente — não recria. Fonte de verdade dos agentes de
> software: [`docs/agentes-software.md`](../agentes-software.md) e [`.claude/agents/`](../../.claude/agents/).
> Fonte de verdade dos agentes de negócio: os mesmos 13 arquivos em `.claude/agents/` cobrem os
> dois grupos.
>
> **Regra seguida aqui:** só documentar responsabilidade nova onde há lacuna real e recorrente.
> Um projeto com 1 dev principal e um monolito Flask não justifica dezenas de agentes de
> infraestrutura especializados (containers, rede, capacidade, réplicas) — isso criaria
> agentes decorativos, o oposto do que a auditoria pede.

## 1. Agentes de negócio (processo de implantação) — já existentes, sem alteração

| Agente | Papel | Arquivo |
|---|---|---|
| `coordenador-implantacao` | Coordenação da implantação | `.claude/agents/coordenador-implantacao.md` |
| `setor-adm` | Administrativo (RNS, prévias, arquivamento) | `.claude/agents/setor-adm.md` |
| `consultor-implantacao` | Execução técnica (GCI) | `.claude/agents/consultor-implantacao.md` |
| `gerente-projeto` | Datas oficiais, encerramento | `.claude/agents/gerente-projeto.md` |
| `equipe-conversao` | Viabilidade e planejamento de conversão | `.claude/agents/equipe-conversao.md` |
| `gestao-mudanca` | OCM / ADKAR | `.claude/agents/gestao-mudanca.md` |
| `controle-pendencias` | Backlog de evolução do Painel | `.claude/agents/controle-pendencias.md` |

Nenhuma mudança recomendada aqui — cobertura completa do processo, sem sobreposição.

## 2. Agentes de software (manutenção do Painel) — já existentes, sem alteração

| Agente | Território | Classe |
|---|---|---|
| `painel-core` | `app.py`, `routes_*.py`, `db.py`, regras de fluxo | Obrigatório |
| `qualidade` | `test_painel.py`, revisão de diff, endpoints | Obrigatório |
| `documentos-geracao` | `gerar_layout`/`gl_*`, `tools/gerar_*`, modelos | Recomendado |
| `integracoes-operacao` | `mailer`/`imap_intake`/`gmail_api`/`disponibilidade`, Docker/Postgres/backup, robôs | Recomendado |
| `documentacao-contexto` | `docs/`, `memoria_ia/`, README | Opcional |
| `seguranca-permissoes` | permissões, login, segredos, LGPD | Opcional |

Esses 6 agentes **já cobrem** todo o território técnico do painel, inclusive backup
(`integracoes-operacao`, que já é dono de `docker-compose.yml`/`painel-backup.sh`) e segurança
(`seguranca-permissoes`).

## 3. Lacunas avaliadas e decisão

Analisando os "agentes adicionais" sugeridos pelo template genérico de auditoria contra o
território já coberto pelos 6 agentes de software:

| Agente sugerido pelo template | Decisão | Justificativa |
|---|---|---|
| Agente de Testes Unitários/Integração/Regressão/Segurança (setor de Qualidade) | **Não criar — já coberto** | `qualidade` já cobre pytest + revisão + verificação de regressão de endpoints. Dividir em 4 agentes criaria overhead de coordenação sem ganho, para uma suíte de ~98 testes mantida por 1 pessoa. |
| Agente de Testes de Interface | **Não criar** | `templates/`+CSS são território do MANUS IA; não há agente de software que escreve lá (regra de ouro já estabelecida). Teste de UI, se necessário, é tarefa pontual do usuário, não papel recorrente. |
| Agente de Testes de Desempenho | **Não criar agora** | Sem indício de gargalo de performance na auditoria (app pequeno, poucos usuários simultâneos). Reavaliar se houver reclamação de lentidão. |
| Agente de Arquitetura / Refatoração / Performance (Setor de Evolução) | **Não criar — absorvido por `painel-core`** | Já listado como "não recomendado" em `docs/agentes-software.md` ("baixa recorrência; absorvido por painel-core"). Esta auditoria concorda. |
| Agente de Banco de Dados (dedicado) | **Não criar — absorvido por `integracoes-operacao` + `painel-core`** | `integracoes-operacao` já é dono de Postgres/backup; `painel-core` já é dono de modelos/migração. Um banco único não justifica um terceiro agente. |
| Agente de Dependências | **Não criar como agente — resolver como automação (M-05)** | Dependabot resolve isso sem precisar de um "agente" continuamente ativo; é configuração, não trabalho recorrente de julgamento. |
| Agente Auditor de Documentação | **Não criar — absorvido por `documentacao-contexto`** | Já é papel implícito desse agente (mantém docs/memória em dia); criar um segundo agente só para auditar o primeiro é redundante para o volume do projeto. |
| Setor de Backup/Continuidade (5 agentes dedicados) | **Não criar — absorvido por `integracoes-operacao`** | Backup do Postgres, backup de arquivos e restauração já são um único fluxo pequeno (`painel-backup.sh` + runbook §6), de propriedade de `integracoes-operacao`. Cinco agentes para um script de 15 linhas seria desproporcional. |
| Setor de Infraestrutura completo (12 agentes: ambientes, DevOps, containers, servidores, rede, monitoramento, logs, segurança de infra, BD operacional, incidentes, capacidade) | **Não criar como agentes separados** | Ver `ESTRUTURA_DO_SETOR_DE_INFRAESTRUTURA.md` — as responsabilidades reais (1 container de banco, 1 servidor Windows, sem rede complexa, sem múltiplos ambientes) cabem inteiramente em `integracoes-operacao`, que já é dono desse território. Fragmentar criaria 12 papéis para 1 pessoa executar. |
| Agente de Segurança da Aplicação / Controle de Acesso / Proteção de Dados / Conformidade (LGPD) | **Não criar — já coberto** | `seguranca-permissoes` já cobre exatamente esse escopo (perfis, permissões, segredos, LGPD). |
| Agente de Migração de Dados | **Não criar — já coberto pelo processo de negócio** | Migração de dados de cliente é o domínio de `equipe-conversao` (RNS de conversão); não é uma responsabilidade de software separada. |
| Agente Orquestrador do Projeto | **Não criar como agente formal** | O papel de orquestração (classificar demanda → escolher agente → sequenciar) já é exercido pelo usuário + Claude Code diretamente, apoiado pela tabela de fronteiras em `docs/agentes-software.md` §"Fluxo de colaboração". Formalizar um 14º agente só para rotear entre os outros 13 adicionaria uma camada sem reduzir trabalho real. |
| Agente de Observabilidade / Homologação / Releases / Governança / Custos | **Não criar** | Sem volume de incidentes, sem múltiplos ambientes, sem orçamento de infraestrutura variável que justifique um papel dedicado e recorrente. |

## 4. Única lacuna real identificada

Nenhuma lacuna de **agente novo** foi identificada. A lacuna real está em **automação e
configuração**, não em papéis adicionais:

- Dependabot (M-05) — configuração, não agente.
- Job de CI contra Postgres (M-09) — configuração, não agente.
- Troca de senha (M-01) — execução pontual pelo `integracoes-operacao` existente.

Isso é consistente com o texto de `docs/agentes-software.md`: *"Crie somente os agentes
realmente necessários e justifique cada criação"* — e a conclusão desta auditoria é que a
estrutura atual de 6 agentes de software + 7 de negócio já é suficiente para o porte e a
maturidade operacional do projeto.

## 5. Revisão futura

Reavaliar este catálogo se qualquer um destes marcos ocorrer:
- Equipe de desenvolvimento crescer além de 1-2 pessoas simultâneas no código.
- Painel passar a ter múltiplos ambientes formais (homologação separada de produção).
- Volume de incidentes/chamados justificar um papel dedicado de suporte.
- Integração SICLA/RNS automatizada (hoje pendente) adicionar superfície de integração
  significativa a `integracoes-operacao`.
