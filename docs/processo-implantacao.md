# GRM: Processo de Implantação do SIGER®

Transcrição organizada do processo **GRM:Implantação**. É a **fonte de verdade** para os
agentes e skills deste repositório. Cada seção indica objetivo, responsáveis e a skill
correspondente.

## Índice

1. [Macro fluxo](#1-macro-fluxo)
2. [Pré-implantação](#2-pré-implantação)
   - 2.1 [Mapeamento (levantamento) de processos](#21-mapeamento-levantamento-de-processos)
3. [Implantação](#3-implantação)
   - 3.1 [Aspectos operacionais](#31-aspectos-operacionais)
   - 3.2 [Mapeamento (levantamento) — micro](#32-mapeamento-levantamento--micro)
   - 3.3 [Aderência ao SIGER](#33-aderência-ao-siger)
   - 3.4 [Planejamento da implantação](#34-planejamento-da-implantação)
   - 3.5 [Execução da implantação](#35-execução-da-implantação)
   - 3.6 [Simulações](#36-simulações)
   - 3.7 [Produção (uso oficial)](#37-produção-uso-oficial)
   - 3.8 [Finalização e transição](#38-finalização-e-transição)

---

## 1. Macro fluxo

O processo de implantação compreende duas grandes etapas:

- **Pré-implantação** — atividades de apoio comercial para levantamento e demonstração em clientes.
- **Implantação** — etapa em que o cliente já oficializou contrato com a Rech e de fato são
  iniciadas as etapas de implantação do SIGER®.

Ver [fluxo-macro.md](fluxo-macro.md).

---

## 2. Pré-implantação

### 2.1 Mapeamento (levantamento) de processos

> Skills: `levantamento-processos`, `apoio-comercial-demonstracao`

Compreende o levantamento macro das demandas do cliente para aderência do software e
atividades de apoio ao Comercial (ex.: demonstrações do SIGER®).

**Objetivo:**
- Efetuar o mapeamento de processos ainda na etapa de pré-fechamento comercial.
- Dar suporte em demonstrações mais detalhadas quando solicitado pelo Comercial.

**Recursos:** template e exemplo de levantamento; base de demonstração (quando aplicável).
Ver [recursos-e-caminhos.md](recursos-e-caminhos.md).

#### 2.1.1 Geração da demanda de levantamento / demonstração
- Comercial solicita à Coordenação da Implantação a agenda de um consultor.
- A Coordenação designa um ou mais consultores (comunicação por e-mail, Skype ou agenda).
- Atividades de apoio comercial são registradas no SICLA com **tipo 12** (agendas,
  atendimentos, pendências). Ver template [email-encaminhamento-levantamento](../templates/email-encaminhamento-levantamento.md).

#### 2.1.2 Fluxo de elaboração do documento de levantamento
- A **prévia** do documento é feita pelo **Setor Adm**, sempre no formulário padrão vigente.
- Em geral a solicitação parte da **Coordenação** e/ou **GCIs**; o consultor também pode
  solicitar ao Setor Adm.
- O documento é disponibilizado via **link no Google Drive** (e-mail, Skype ou WhatsApp).
- O Setor Adm cria a **pasta do cliente** em `...\3-Documentação_Clientes\1-Clientes_Imp`.
- **Quem executa junto ao cliente:** em regra, o técnico designado como gerente do projeto
  (GCI). Áreas de mapeamento por consultor: ver [papeis-responsabilidades.md](papeis-responsabilidades.md).

#### 2.1.3 Registros no SICLA — apoio comercial
Tudo com **atividade tipo 12**: agendas/visitas (com e sem protocolo), atendimentos e
pendências. No levantamento, indicar o link do documento e colar o texto no protocolo.

#### 2.1.4 Devolutiva ao Comercial
- Análise dos módulos necessários (inclusão/exclusão).
- Abertura de **RNS de Orçamentos** para horas de desenvolvimento obrigatório.
- Análise de viabilidade das conversões (acesso a dados, modelo, o que será convertido).
- Análise de horas: parametrizações, treinamento e **acompanhamento full time na virada** e
  primeiros fechamentos.

---

## 3. Implantação

### 3.1 Aspectos operacionais

#### 3.1.1 Ações para início da implantação
> Skill: `abertura-implantacao`

1. Após fechamento + contrato, o Comercial encaminha a **RNS de instalação** do SIGER®
   (executada pelo **GTI**).
2. Instalado, a Coordenação recebe o e-mail de **"liberação para implantação"**.
3. A Coordenação designa consultores (podem ser os mesmos do levantamento).
4. O **Setor Adm** abre a **RNS de Implantação** em nome dos consultores e formaliza o e-mail
   com: levantamento, projeto, cronograma (compartilhado via SharePoint), e-mail de
   boas-vindas com tutoriais, RNS(I), protocolo, RNS de BI externo, e **RNS de conversão**
   (pares ORC/COB) conforme a necessidade do cliente.

> As RNS COB de conversão devem ser ajustadas às particularidades do cliente e ter os tempos
> de envolvimento apontados. São dadas como **"Entregues"** quando finalizadas no uso oficial
> (responsabilidade do consultor da implantação). Ver template
> [email-encaminhamento-implantacao](../templates/email-encaminhamento-implantacao.md).

#### 3.1.2 Manutenções necessárias na RNS de Implantação
> Skill: `manutencao-rns-implantacao`

Campos a manter atualizados:
- **Status geral da implantação** — *Consultores* (usar a predominância dos módulos).
- **Data previsão uso oficial** — *Gerente do Projeto* (em início parcial, usar a última
  data prevista; o campo registra o motivo de alteração).
- **Data encerramento** — *Gerente do Projeto*.
- **Status por módulo** (aba "Etapas") — *Consultores*.
- **Data transição manutenção** — *Coordenação/GCI*.

> A identificação do **status por módulo** na etapa de produção é fundamental para liberar o
> atendimento simultâneo pelo Suporte.

#### 3.1.3 Registros no SICLA — implantação
> Skill: `registros-sicla`

Tudo com **atividade tipo 13**: agendas/protocolos, atendimentos, pendências.
- Agenda interna de treinamento/parametrização: usar **tipo 84** (gera atendimento que
  desconta horas da RNS(I)).
- Atendimento com ação em mais de um módulo: seguir orientação específica.
- Cliente específico: a agenda deve constar no nome do cliente (não usar 4070 ou 99999).

### 3.2 Mapeamento (levantamento) — micro
> Skill: `levantamento-micro`

Não é facultativo; o aprofundamento varia com o porte do cliente. Em regra ocorre na
pré-implantação; se não, é feito antes do projeto, com o cliente já efetivo.

**Objetivos:** identificar o que o cliente busca; avaliar customizações; dimensionar horas
(configuração, treinamento e acompanhamento); validar módulos/adicionais; catalogar
formulários e relatórios que exijam aplicação similar no SIGER®.

#### 3.2.1 Refinamento do levantamento
- Se houve mapeamento detalhado na pré-implantação → apenas **refina**.
- Se não houve → faz dentro da implantação, **concomitante à aderência**.

### 3.3 Aderência ao SIGER

Sincroniza o mapeamento com o uso efetivo das funcionalidades do SIGER®.

**Objetivo:** definir recursos do SIGER®; identificar configurações/parametrizações
estratégicas; refinar simulações.

#### 3.3.1 Definições de uso do SIGER
> Skill: `aderencia-siger`

Alinhamento das rotinas que de fato serão usadas e das configurações aplicáveis.

#### 3.3.2 Encaminhamento das conversões
> Skill: `encaminhar-conversoes`

- **Setor Adm** abre RNS com templates padrão, conforme previsto comercialmente.
- RNS abertas como **pendentes**; o técnico complementa e passa para **redigida**.
- Antes de redigir, o técnico indica pontos relevantes: de/para de tabelas (local de
  cobrança, grupo de cadastros, representantes), campos além do padrão (conta financeira,
  comissão, dados contábeis).
- **Apontar os tempos na RNS de conversão** (não distorcer envolvimento).
- Se o técnico tratar dados sem a equipe de conversão: apontar tempos e **não** passar para
  redigida.
- RNS redigidas são validadas e vão ao **backlog** da conversão; indicar previsão de prévia
  **e** de conversão oficial.

#### 3.3.3 Encaminhamento dos desenvolvimentos
> Skill: `encaminhar-desenvolvimentos`

- Para cada **RNS ORC** de desenvolvimento aprovada no comercial, o **Setor Adm** encaminha
  uma **RNS COB**, tendo como responsável o consultor.
- O consultor refina: prazo desejável (em função da virada) e complementos que não alterem o
  orçamento aprovado.

### 3.4 Planejamento da implantação

Precede parametrizações e treinamentos.

**Objetivos:** documento complementar ao contrato (escopo); identificar envolvidos e
responsabilidades e a intenção de data de uso oficial; otimizar agendas e compartilhamento
com o cliente.

#### 3.4.1 Elaboração do Projeto de Implantação
> Skill: `projeto-implantacao` — **requisito não opcional**

Premissas: empresas atendidas (CNPJs); objetivos macro; delimitações de conversão; questões
de cadastros (Tabelas, Produtos, Clientes/Fornecedores); módulos/adicionais por macro rotina
(Estoque/Compras, Produção, Fiscal/Contábil, Financeiro...); envolvidos e usuário líder;
pontos críticos e mudanças de método; pontos **fora do escopo** original.

Cliente de menor porte: projeto simplificado, desde que claro o que será e o que **não** será
atendido. Após confecção → e-mail ao Setor Adm → assinatura digital → arquivamento na pasta
do cliente.

#### 3.4.2 Elaboração do Cronograma
> Skill: `cronograma-implantacao` — **requisito não opcional**

Premissas: distribuir agendas conforme contrato (horas contratadas + bonificadas); macro
tópicos por visita/treinamento; sincronização compartilhada com o cliente; imputar agendas no
SICLA.

Após confecção → e-mail ao Setor Adm → upload no Google Drive → link ao usuário líder.
**Prazo: 5 dias úteis** a contar da liberação do levantamento (com a RNS(I) já criada). O
técnico pode incluir as agendas ou solicitar ao Setor Adm. Faz parte das métricas do setor.

### 3.5 Execução da implantação

Aplicação "in loco" de parametrizações e treinamentos.

#### 3.5.1 Parametrizações
> Skill: `parametrizacoes`

1. **Criação das empresas** previstas no projeto. A senha de liberação é solicitada à
   Coordenação/GCI (ou Setor Adm), com: **código do cliente no SICLA**, **sigla** (3
   caracteres) e **CNPJ**.
2. **Parametrizações gerais** (menu `1.1.P`).
3. **Parametrizações por empresa** (`1.2.A`).
4. **Compartilhamento de cadastros** (`1.2.M`), conforme projeto/levantamento.

#### 3.5.2 Treinamentos das rotinas
> Skill: `treinamento-rotinas`

- Treinamento de tabelas (genéricas e por empresa); importação via layouts do SIGER®.
- Configurações específicas (padrões de carga, bloqueios, locais de cobrança p/ remessa).
- Treinamento das rotinas do processo. **Norteadores:** levantamento + escopo do projeto.
  Situações adversas: avaliar com bom senso e discutir com a coordenação quando necessário.

### 3.6 Simulações

#### 3.6.1 Ênfase nos testes das rotinas treinadas
> Skill: `simulacoes`

Simular processos críticos: emissão e reflexos (tributação, comissão, baixa de estoque);
entrada de notas e reflexos (estoque, custos, conversão de unidades); demanda de produção.
Quando: durante os treinamentos e em período combinado de ênfase, buscando o **macroprocesso**.

#### 3.6.2 Preparação de dados para virada oficial
> Skill: `virada-oficial`

Remessas bancárias homologadas; integrações com terceiros homologadas; ponto de corte da
conversão final; data/ação de inventário; simulações executadas; ponto de corte para limpeza
de movimentos de teste.

#### 3.6.3 Checklist de virada oficial
> Skill: `virada-oficial`

Pontos-chave: revisão das integrações entre módulos; ajuste de numeração de notas fiscais;
demais roteiros por área/módulo. Ver [checklist-virada-oficial](../templates/checklist-virada-oficial.md).

### 3.7 Produção (uso oficial)

#### 3.7.1 Acompanhamento e micro ajustes
> Skill: `acompanhamento-producao`

Apoiar uso full time; promover ajustes detectados; acompanhar primeiros fechamentos críticos;
condicionar o uso do Suporte. Maximizar filtros/seleções salvas; criar roteiros para rotinas
não diárias; ajustar formulários. Agendas estratégicas: full time nos primeiros dias,
espaçando após o período crítico.

### 3.8 Finalização e transição
> Skill: `encerramento-implantacao`

**Objetivos:** concluir pendências do projeto; revisar e entregar RNS; registrar
particularidades no SICLA; formalizar encerramento com o cliente; redigir o **Termo de
Encerramento**; comunicar a confirmação ao Gerente do Projeto.

#### 3.8.1 Revisão das pendências
Pendências concluídas → status "concluídas". Em tratamento (não impeditivas) → mencionar no
termo e no follow up da RNS(I).

#### 3.8.2 Revisão das RNS vinculadas
RNS geradas → status "Entregues". Em tratamento (não impeditivas) → mencionar no termo e no
follow up; se ligadas à implantação, serão entregues futuramente pelo consultor.

#### 3.8.3 Atualização da RNS de Implantação
- Módulos **implantados** (configurados + treinados): etapa "Final do Projeto" → "Concluída".
  Se o cliente optar por não usar, mencionar no termo e follow up.
- Módulos **não implantados**: mencionar no termo/follow up com motivo e pretensão (manter/cancelar).
- **Usuários do cliente:** demitidos → preencher data de demissão no contato (inativa);
  ativos treinados → revisar nome, e-mail, telefone, módulos capacitados; indicar
  responsável pela atualização.

**Checklist do follow up da RNS(I)** (itens a–i): ver
[checklist-followup-rns](../templates/checklist-followup-rns.md).

#### Elaboração do Termo de Encerramento
Referencia o projeto; ratifica o atendido e ressalvas; aponta alterações de escopo por área;
quadro de módulos/adicionais (implantados, substituídos, não implantados/cancelados). Envio
do e-mail de encerramento (registrar no SICLA) **não** dispensa o termo assinado. Ver
[termo-encerramento](../templates/termo-encerramento.md) e [email-encerramento](../templates/email-encerramento.md).

#### 3.8.4 E-mail à Coordenação/Gerência
Indicar o encerramento e formalizar o checklist. Ver
[email-encerramento](../templates/email-encerramento.md).

---

## 4. Robustez (camada P0 — além do processo original)

Adições para alinhar o processo às referências do setor (SAP Activate, TOTVS, boas práticas):

- **Gestão da Mudança (OCM)** — transversal, modelo ADKAR. Trata adoção, stakeholders,
  comunicação, prontidão, treino por papel e indicadores. Skill `gestao-mudanca` (gera o
  *Kit de Gestão da Mudança* em Excel).
- **Testes SIT/UAT** — formaliza as "simulações" (3.6) com roteiros versionados por módulo,
  registro de defeitos e **sign-off** como gate da virada. Skill `testes-sit-uat` (gera os
  *Roteiros SIT/UAT* e o *Termo de Aceite* em Office).

**Camada P1 (implementada):**
- **Validação de conversão** — reconciliação origem×destino, mock loads e aceite dos dados.
  Skill `validacao-conversao` (gera a *Reconciliação de Conversão*).
- **Hypercare** — estabilização pós-virada com governança diária e critério de saída. Skill
  `hypercare` (gera o *Painel de Hypercare*).
- **Fit/Gap** — log de aderência (padrão/configuração/desenvolvimento/fora de escopo) na skill
  `aderencia-siger` (gera o *Log de Fit/Gap*).

> Próxima camada (P2), ainda **não** implementada: métricas/KPIs, RAID (riscos/issues) e dossiê
> do cliente.
