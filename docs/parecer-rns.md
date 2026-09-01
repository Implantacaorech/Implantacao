# Parecer para RNS — Painel de Implantação (SIGER®)

> **Documento vivo.** Texto pronto para colar no campo de parecer de uma RNS.
> Mantido acumulativo: a cada nova função/assunto entregue, esta lista é atualizada.
> Registre a mudança no rodapé (**Atualizações**).
>
> Última atualização: **2026-07-02** (Protocolos de Treinamento por vídeo + desempenho).

---

## Parecer (texto para colar)

O Painel de Implantação é uma aplicação web interna que centraliza, controla e automatiza o processo de implantação do SIGER®. Cada cliente é tratado como um **projeto** que percorre seis etapas (Agendamento, Levantamento, Projeto, Designação, Cronograma e Check-list, Encerramento), com portões de qualidade (gates) que impedem o avanço sem os documentos e ações obrigatórias. A ferramenta encontra-se **em produção na rede interna**, com banco de dados PostgreSQL, backup diário automatizado e suíte de testes automatizados. Funções entregues:

**1. Gestão da carteira e da ficha do cliente**
- Carteira única de projetos com status por etapa, situação, atrasos e busca/filtro.
- Ficha por cliente com dados cadastrais, fase atual, documentos anexados e linha do tempo (histórico) de todos os eventos (mudanças de etapa, documentos, e-mails e notas).
- Exclusão de documento gerado (para regerar) **respeitando o fluxo**: só exclui se nenhum documento posterior existir (ex.: exclua o Projeto antes do Levantamento).

**2. Fluxo guiado e controle de qualidade**
- Sequência de etapas com gates de documentos e ações obrigatórias por fase.
- Avanço automático de etapa quando os requisitos são cumpridos; bloqueio com aviso quando falta item obrigatório.
- Alertas proativos (uso oficial vencido, prazo do cronograma estourado, projeto parado, em risco).

**3. Levantamento e geração de documentos**
- Levantamento respondido em tela (perguntas dos módulos contratados), que alimenta o Projeto sem redigitação.
- Geração fiel, no padrão oficial Rech, dos documentos: Mapeamento/Levantamento, Projeto de Implantação, Cronograma, Check List e Termo de Encerramento.
- Gate de origem do Projeto (dados de tela, levantamento importado ou modelo para preenchimento manual).
- Pré-visualização dos documentos na tela e edição estruturada de campos.

**4. Cronograma e Check-list editáveis**
- Planos em tabela editável, com carga automática inicial (seed), histórico de modificações e geração da planilha (.xlsx).

**5. Agendamento e Designação**
- Definição do GCI e da data do Levantamento; designação de consultores por módulo, com notificação automática por e-mail.

**6. Agendador de visitas**
- Calendário por dia e turno com arrastar-e-soltar; técnico por módulo; horário por turno; status de cada visita (Solicitada, Agendada, Realizada, Não Realizada, Postergada, Cancelada); postergação com histórico; geração da agenda em planilha e visão de acompanhamento.
- Bloqueio de agendamento em datas passadas (só hoje em diante) e em dias/turnos sem disponibilidade do técnico.

**7. Disponibilidade dos consultores**
- Cruzamento da agenda com a ocupação real dos técnicos (consulta a base externa configurável), bloqueando conflitos, com análise conjunta e individual.
- O vínculo técnico↔agenda é feito pelo **Código SICLA** do cadastro de usuário, casado com a coluna `tecnico` do SELECT; a montagem do cronograma só permite alocar em dias/turnos livres e a partir da data atual.

**8. Comunicação e automação por e-mail**
- Envio de e-mail por projeto com modelos parametrizáveis; notificações automáticas a cada evento do fluxo; resumo diário (digest) por e-mail.
- Abertura automática de projeto a partir do e-mail de fechamento do Comercial (manual ou via robô de caixa de entrada), já gerando o pacote inicial.

**9. Gestão e indicadores**
- Painel de Coordenação (indicadores e alertas), Atividade (feed e métricas de uso) e Monitoramento operacional por setor (saúde, carga por colaborador e próximas entregas).

**10. Protocolos de Treinamento (vídeos → base de conhecimento)**
- Vídeos de treinamento (upload manual ou capturados automaticamente da pasta do SharePoint) são **transcritos localmente** (o áudio não sai da rede) e **analisados por IA**, gerando um registro de protocolo estruturado: título, módulo, menu, resumo, objetivo, quando utilizar, pré-requisitos, passo a passo numerado, configurações, dependências, regras de negócio, pontos de atenção e exemplos — com **remoção auditada** de assuntos irrelevantes e **sem inventar** informação.
- Revisão humana obrigatória (vídeo + transcrição + campos editáveis) antes da aprovação; consulta com filtros (módulo, menu, status, palavra-chave) forma a base de conhecimento.

**11. Cadastros e configurações**
- Cadastros de referência (Check-list, Índice de Tópicos, Modelos de Documentos com versões).
- Configurações de envio/recebimento (Microsoft 365, SMTP, IMAP), de IA, de disponibilidade e de modelos de e-mail.

**12. Segurança e acesso**
- Login por usuário com 5 perfis (ADM, Coordenador, Administrativo, GCI, Consultor) e permissões aplicadas também no backend; autocadastro com validação por e-mail; senha mestra de contingência; download de arquivos restrito a diretórios autorizados; filtro de visão por perfil.
- **Código SICLA obrigatório** no cadastro de usuário (todos os perfis) — elo do usuário com a sua agenda no SICLA.

**13. Arquitetura**
- Banco de dados agnóstico (SQLite ou PostgreSQL) com migração automática de schema; servidor de produção (waitress) na rede interna; cobertura por testes automatizados.

**Parecer:** o sistema já entrega, de ponta a ponta, o controle e a padronização do processo de implantação, com automações que reduzem retrabalho e aumentam a rastreabilidade. Evoluções previstas (dependentes de liberação de acesso ao SICLA/SIGER e de chave de IA): integração com SICLA/RNS, pipeline de conversão e gate de virada, disparadores de encerramento e copiloto de IA ao consultor.

---

## Versão curta (1 parágrafo, para campo enxuto)

O Painel de Implantação centraliza e automatiza a implantação do SIGER® por cliente: carteira e ficha única com histórico, fluxo de 6 etapas com gates e avanço automático, Levantamento em tela e geração fiel dos documentos oficiais (Levantamento, Projeto, Cronograma, Check List e Termo), Cronograma/Check-list editáveis, agendador de visitas com disponibilidade real dos consultores, designação por módulo, notificações e abertura automática por e-mail, e painéis de coordenação e monitoramento. Em produção na rede interna, com PostgreSQL, backup diário e testes automatizados.

---

## Atualizações

> Ao acrescentar um assunto/função novo ao parecer, registre aqui (data + o que entrou).

- **2026-07-02** — **Protocolos de Treinamento** (novo item 10): vídeos (upload ou pasta do
  SharePoint via robô) transcritos localmente (faster-whisper) e analisados por IA, gerando
  registro estruturado por módulo/menu com remoção auditada de assuntos irrelevantes, revisão
  humana obrigatória e consulta como base de conhecimento.
- **2026-06-29** — Versão inicial consolidada a partir da documentação do sistema
  ([painel-sistema.md](painel-sistema.md)). Cobre as 12 áreas de função atuais.
- **2026-06-29** — Vínculo usuário↔SICLA: Código SICLA obrigatório no cadastro (todos os
  perfis), casado com a coluna `tecnico` do SELECT de disponibilidade; bloqueio de
  alocação em datas passadas e em slots ocupados na montagem do cronograma (itens 6, 7 e 11).
- **2026-07-02** — Pacote de desempenho e operação: cache com TTL na consulta de disponibilidade
  (navegação instantânea no agendador), pré-aquecimento do PDF da pré-visualização (1º "Ver"
  instantâneo), limpeza automática do cache de PDFs, criação retroativa de índices na
  auto-migração e verificação completa de operação em um comando (`verificar_tudo.py`).
- **2026-07-01** — Pré-visualização ("Ver") fiel: documento `.docx` exibido como espelho exato
  (PDF renderizado pelo Word, com cache); `.xlsx`/sem Word cai na visão HTML. Disponibilidade da
  agenda filtra por `:tecnicos` + janela de 18 meses (SELECT de ocupação).
- **2026-06-30** — Exclusão de documento gerado (para regerar) respeitando o fluxo/dependências
  (item 1). Correções de fidelidade do Projeto: Detalhamento das Rotinas com uma linha por
  tópico e remoção do bloco duplicado do Levantamento após a assinatura. Notificações por
  e-mail passam a ser assíncronas (não travam a etapa).
