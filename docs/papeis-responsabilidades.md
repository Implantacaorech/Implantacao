# Papéis e Responsabilidades

Cada papel corresponde a um **agente** em `.claude/agents/`. A matriz abaixo resume
"quem faz o quê" em cada etapa.

## Matriz RACI (resumida)

Legenda: **R** = Responsável (executa) · **A** = Aprova/Responde · **C** = Consultado · **I** = Informado

| Etapa | Coordenação | Setor Adm | Consultor | Gerente Projeto | Eq. Conversão |
|-------|:-----------:|:---------:|:---------:|:---------------:|:-------------:|
| Geração da demanda de levantamento | A | R | C | I | – |
| Elaboração do doc. de levantamento | C | R (prévia) | R (executa) | I | – |
| Devolutiva ao Comercial | A | I | R | I | – |
| Abertura da RNS de Implantação | A | R | C | I | – |
| E-mail de encaminhamento da implantação | A | R | I | I | – |
| Ajuste de status geral / por módulo da RNS(I) | I | – | R | I | – |
| Datas de uso oficial / encerramento (RNS(I)) | C | – | I | R | – |
| Data de transição manutenção | R | I | I | C | – |
| Levantamento micro / aderência | C | – | R | I | – |
| RNS de Conversão (abertura por template) | I | R | C → redige | I | A (executa) |
| RNS COB de desenvolvimentos | I | R | R (refina) | I | – |
| Projeto de Implantação | C | R (assinatura/arquivo) | R (elabora) | A | – |
| Cronograma de Implantação | C | R (upload/links) | R (elabora) | I | – |
| Parametrizações / Treinamento | C | C (senha empresa) | R | I | – |
| Simulações / Virada | C | – | R | C | C |
| Acompanhamento em produção | C | – | R | I | – |
| Termo de Encerramento | C | R (assinatura/arquivo) | R (elabora) | A | – |
| E-mail final à Coordenação/Gerência | A | I | R | A | – |

## Detalhe dos papéis

### Coordenação da Implantação
Recebe demandas do Comercial; designa consultores; autoriza criação de empresas (senha);
controla as RNS de Implantação; define a data de transição para manutenção.

### Setor Adm
Elabora a prévia dos documentos (levantamento) no template vigente; abre RNS por template;
disponibiliza documentos via Google Drive/SharePoint; conduz assinatura digital; arquiva na
pasta do cliente (`R:\...\1-Clientes_Imp`).

### Consultor de Implantação (GCI)
Executor central: levantamento, aderência, refinamento de RNS, parametrização, treinamento,
simulação, virada e encerramento. Mantém status da RNS(I) e aponta horas nas RNS corretas.

**Áreas de mapeamento (referência de alocação por especialidade):**

| Consultor | Área de Mapeamento |
|-----------|--------------------|
| Paim | Controladoria e Negócios |
| Sandri | Negócios e Produção |
| Brito | Negócios e Produção |
| Dibah | Negócios |
| Elias | RH e Folha de Pagamento |

> A alocação por área é referência; o papel `consultor-implantacao` é genérico e deve ser
> instruído com a área aplicável ao cliente (Controladoria, Negócios, Produção, Fiscal/Contábil,
> RH/Folha).

### Gerente do Projeto
Define e mantém datas de uso oficial e encerramento na RNS(I); trata negociações comerciais
em aberto na transição; recebe a confirmação de encerramento.

### Equipe de Conversão
Recebe RNS de conversão **redigidas e validadas** (backlog); trata layouts e de/para; executa
prévia e conversão oficial conforme as datas indicadas pelo consultor.
