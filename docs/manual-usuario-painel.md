# Painel de Implantação — o que o sistema entrega (guia do usuário)

> O que você encontra em cada tela do Painel, para que serve e quem pode usar.
> Escrito para quem **usa** o sistema — sem detalhe técnico de código.
>
> **Onde acessa:** `http://I7M1700-01-EVE:5100` (rede interna da Rech) · Login com usuário
> e senha cadastrados pelo Administrador · Documento atualizado em **2026-08-12**, a partir
> do sistema em produção.

---

## 1. O essencial em um parágrafo

O Painel é o **hub único da implantação do SIGER®**: cada cliente vira um **projeto** que
percorre um **processo guiado de 21 passos** — do fechamento comercial ao termo de
encerramento — com o sistema dizendo **de quem é a vez**, cobrando o que está atrasado,
**gerando os documentos oficiais** (Levantamento, Projeto, Cronograma, Check-list, Termo)
idênticos aos layouts da Rech e **disparando os e-mails** de cada etapa. Em volta desse
fluxo, o Painel entrega transcrição de reuniões por IA, consulta técnica ao SIGER®
(Dicionário Inteligente), matriz de conhecimento da equipe, painéis de BI com dados do
SICLA e ferramentas de gestão e administração.

---

## 2. Acesso, perfis e permissões

- **Login** com usuário e senha; há **"Esqueci minha senha"** na tela de entrada e uma
  página pública de **Apresentação** dos recursos (botão no cartão de login).
- Quem cria contas é o **Administrador** (Sistema → Usuários) — não há auto-cadastro.
- Cada pessoa tem um **papel**: `ADM`, `Coordenador`, `Administrativo`, `GCI`,
  `Consultor`, `Levantador` ou `Comercial`.
- **O que cada papel vê e edita é configurável** pelo próprio Painel (Gestão →
  Permissões), menu a menu, em três níveis: *nada* (menu escondido), *consulta* (só
  leitura) e *alteração* (acesso pleno). As telas de Sistema ficam sempre com o ADM.
- No topo direito ficam **Meu perfil** e **Trocar senha**; há também o **Mapa do Setor**.

---

## 3. O coração: o processo de implantação em 21 passos

Abrir um projeto na Carteira cai direto nos **passos do processo** — uma linha do tempo
única onde todos veem o andamento, mas **cada passo só pode ser concluído pelo papel
responsável**. Os passos com documento ou ação obrigatória funcionam como *gates*: não se
avança sem cumprir. Vários passos disparam **e-mail automático** com modelo e
destinatários configuráveis.

| # | Passo | Responsável |
|---|-------|-------------|
| 1 | Consulta e Cadastro do Cliente (busca no SICLA) | Comercial |
| 2 | Agendar Levantamento de Processo | Administrativo |
| 3 | Realizar o Levantamento de Processo | Levantador |
| 4 | Repassar informações do levantamento ao Comercial | Levantador |
| 5 | Avançar para finalização da negociação | Comercial |
| 6 | Finalizar negociação e enviar o fechamento | Administrativo |
| 7 | Contrato assinado e liberação para indicar os responsáveis | Administrativo |
| 8 | Indicar o GCI e os técnicos responsáveis | Coordenador |
| 9 | Incluir a RNI e as RNS de COB e Conversão | Administrativo |
| 10 | Criação do Projeto | GCI |
| 11 | Conferência do Projeto e envio para assinatura | Administrativo |
| 12 | Sinalizar Projeto assinado | Administrativo |
| 13 | Elaborar o cronograma e incluir as agendas no SICLA | Consultor |
| 14 | Gerar o check-list | Consultor |
| 15 | Encaminhar e-mail de boas-vindas | Consultor |
| 16 | Enviar o cronograma de visitas | Consultor |
| 17 | Sinalizar Projeto concluído | Consultor |
| 18 | Gerar o Termo de Encerramento e enviar ao Administrativo | Consultor |
| 19 | Conferir o Termo e encaminhar para assinatura | Administrativo |
| 20 | E-mail de Encerramento ao Coordenador e ao GCI | Consultor |
| 21 | E-mail de Encerramento ao cliente, com o Termo | Consultor |

---

## 4. Menu Execução — o dia a dia

### Novo Cliente (entrada do processo)
O Comercial **consulta o cliente direto no SICLA** (por código ou nome) e cadastra a ficha
que abre o projeto — é o passo 1. Substituiu a antiga leitura automática de e-mail de
fechamento.

### Visão Geral (home)
O "o que precisa de atenção agora": contadores de **projetos ativos, no prazo, atrasados e
alertas**, a lista **"Minhas próximas ações"** (o passo pendente de cada projeto em que
você é o responsável, com dias de atraso) e os **alertas** da carteira — tudo clicável,
levando direto ao ponto certo do projeto.

### Carteira de Projetos
A lista de todos os projetos (com busca pelo topo do sistema). Cada papel enxerga o que
lhe cabe: gestão vê tudo; GCI e Consultor veem os projetos em que estão designados.

### Dentro de um projeto
Abrir um projeto mostra os passos e, a partir deles, você alcança:

- **Dados do cliente** — a ficha cadastral (razão social, CNPJ, contato, módulos
  contratados, horas cobradas/bonificadas…).
- **Levantamento em tela** — o questionário digital do levantamento de processos. Dá
  para **gravar a reunião de levantamento** e a transcrição **preenche o questionário**
  automaticamente; as respostas depois alimentam o documento do Projeto sem redigitação.
- **Geração de documentos** — Levantamento, Projeto, Cronograma, Check-list e Termo saem
  **fiéis aos layouts oficiais da Rech** (.docx/.xlsx), com **pré-visualização** no
  navegador e **edição estruturada** (editar seções em tela antes de gerar).
- **Enviar e-mail** — envio dos e-mails do processo (encaminhamento, boas-vindas,
  cronograma, encerramento) com modelos prontos e anexos do projeto.
- **Agenda de Visitas** — calendário de visitas/treinamentos por dia e turno, com tela de
  **acompanhamento** do que foi realizado.
- **Cronograma e Check-list** — elaboração em tela, que vira o documento oficial.

### Transcrição Áudio/Vídeo
Central de gravações e transcrições por IA:

- **Enviar um áudio ou vídeo** (ex.: reunião gravada, vídeo de treinamento) e receber a
  **transcrição, o protocolo e o resumo completo** — o resumo cita os menus/rotinas do
  SIGER® tratados na conversa.
- **Gravar reunião ao vivo** — presencial (microfone), remota pelo Teams (áudio da
  tela/guia compartilhada) ou híbrida, com **transcrição aparecendo em tempo real**. Ao
  encerrar, a IA monta o protocolo e o resumo e o registro vai para revisão/aprovação.
- Um **robô do SharePoint** importa automaticamente os vídeos de treinamento da pasta
  compartilhada do time.
- **Privacidade:** cada um vê **apenas o próprio material** (o ADM vê tudo; os vídeos do
  SharePoint são de todos).

### Matriz de Conhecimento
Registra **quem domina o quê** no SIGER®, em três visões: a matriz clássica por técnico,
a **matriz por menu do SIGER** e a **matriz por menu com as funções do SICLA** — útil para
designar consultores e planejar capacitação.

### Dicionário Inteligente
Consulta técnica aos **87 documentos curados do SIGER®** (21 módulos + 66 adicionais):
busca por termo com filtros, leitura do documento completo e **pergunta em linguagem
natural respondida pela IA com as fontes citadas** — a IA é proibida de inventar menu,
programa, tabela ou parâmetro: sem base nos documentos, ela diz que não encontrou.

---

## 5. Menu Gestão

### Coordenação
Painel da coordenação sobre a carteira: situação de cada projeto, atrasos e alertas
consolidados, e a tela de **Capacidade da equipe** (carga de trabalho dos consultores).

### Centro Operacional
Monitoramento da operação do próprio Painel: saúde dos serviços e integrações, robôs, e a
**telemetria dos agentes de IA** (o que a IA executou, com grafo das execuções reais).

### Atividade
A trilha do que aconteceu no sistema — quem fez o quê e quando.

### BI (uma entrada, dois painéis)
- **BI Implantação** — indicadores do setor: **Contratação, Conclusão e % de Utilização
  das Horas**, **Alocação de Agendas** (calendário e horas aplicadas) e **Movimentos de
  trabalho efetivo**, além de dashboards por painel.
- **BI Implantação Clientes SIGER** — leitura direta dos dados do **SICLA** (conexão
  Oracle): **Resumo de Implantação** por cliente, **Extrato de Protocolo/Horas** (saldo de
  horas), **RNS vinculadas** e **Agendas**. Substitui os antigos relatórios do Power BI.

### Permissões (ADM)
O painel de controle de acesso: uma grade **papel × menu** onde o ADM libera cada tela em
*nada / consulta / alteração*. Vale na hora, sem mexer em código.

---

## 6. Menu Sistema (Administrador)

- **Ferramentas** — hub das configurações: **E-mail (SMTP)**, **Caixa de entrada (IMAP)**,
  **Gmail API**, **Modo IA** (escolher o provedor e o modelo — OpenRouter ou **IA local**
  na própria rede via Ollama/LM Studio — e as chaves por finalidade), **Disponibilidade
  dos Consultores** (base externa Oracle), **Modelos de E-mail** (editar o texto de cada
  e-mail automático), **Destinatários por Passo** (quem recebe cada aviso) e **Consultas
  BD** (consultas salvas e editáveis, como o SQL da busca no SICLA).
- **Usuários** — criar contas, definir papel, resetar senha.
- **Cad. Checklist / Índice de Tópicos / Modelos de Docs** — os cadastros de referência
  que alimentam os documentos gerados (itens do check-list, tópicos do levantamento,
  layouts oficiais).
- **Consulta BD** — consultar o banco do Painel em tela.
- **Assistente Legado** — os geradores administrativos herdados (kit de gestão da
  mudança, roteiros de teste, saúde do sistema, criação de templates por papel).
- **Prontidão do Sistema** — a visão da **auditoria de prontidão em 9 eixos** (Segurança,
  Governança, Resiliência, Agentes autônomos, Detecção antes do usuário, Alucinações,
  Custo por token, Fallback e Observabilidade), com cada achado, sua severidade e o status
  da correção.

---

## 7. Documentos que o Painel gera

| Documento | Quando | Formato |
|---|---|---|
| **Levantamento de Processos** | Após o questionário em tela (passos 3–4) | .docx fiel ao template |
| **Projeto de Implantação** | Passo 10, aproveitando o levantamento | .docx fiel ao template |
| **Cronograma de Implantação** | Passo 13 | .xlsx fiel ao template |
| **Check-list** | Passo 14 | .xlsx fiel ao template |
| **Termo de Encerramento** | Passo 18 | .docx fiel ao template |

Todos saem **idênticos aos layouts oficiais da Rech** (mesmo cabeçalho, logo, formatação),
com pré-visualização antes de baixar e histórico dentro do projeto. O Assistente Legado
gera ainda o kit de gestão da mudança e os roteiros de teste em Excel.

---

## 8. E-mails automáticos

O Painel envia os e-mails do processo por você: encaminhamento da implantação,
boas-vindas ao cliente, cronograma de visitas e os dois e-mails de encerramento. O texto
de cada um vem dos **Modelos de E-mail** (editáveis pelo ADM) e os destinatários de cada
passo são configuráveis em **Destinatários por Passo** — sem depender de redigir e-mail à
mão nem de lista de cópia decorada.

---

## 9. O que a IA faz por você

- **Transcreve** reuniões e vídeos (ao vivo ou por upload) e monta **protocolo + resumo
  completo** citando os menus do SIGER® tratados.
- **Preenche o questionário do levantamento** a partir da reunião gravada.
- **Responde perguntas técnicas do SIGER®** no Dicionário Inteligente, sempre com fonte
  citada e sem inventar.
- Roda no provedor que o ADM escolher — **OpenRouter (nuvem)** ou **IA local na rede da
  Rech** (Ollama/LM Studio), sem enviar dados para fora.
- Tudo que a IA executa fica **registrado e visível** no Centro Operacional.

---

## 10. Segurança e privacidade

- Acesso somente com login; sessões com token renovado automaticamente.
- **Permissão por tela e por papel**, administrada no próprio Painel; além dela, cada
  passo do processo só é concluído pelo papel responsável.
- Transcrições e gravações de cliente são **privadas de quem as conduziu**.
- O sistema roda **na rede interna** da Rech; o serviço de geração de documentos nunca é
  exposto publicamente.
- A tela **Prontidão do Sistema** dá transparência aos pontos de segurança e resiliência
  auditados e ao andamento das correções.

---

*Dúvidas de processo (o que fazer em cada passo do negócio) estão em
[processo-implantacao.md](processo-implantacao.md); papéis e responsabilidades em
[papeis-responsabilidades.md](papeis-responsabilidades.md). Este guia cobre o que o
**sistema** entrega.*
