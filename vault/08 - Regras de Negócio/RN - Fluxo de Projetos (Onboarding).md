---
titulo: "Regras de Negócio — Fluxo de Projetos (Onboarding)"
tipo: regras-de-negocio-tela
status: vivo
criado: 2026-07-21
atualizado: 2026-07-21
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - regras-de-negócio
  - painel
  - onboarding
relacionados:
  - "[[08 - Regras de Negócio]]"
  - "[[09 - Casos de Uso]]"
gerado_por: "skill codigo-para-regra"
fontes_codigo:
  - "../backend/src/fluxo/fluxo.controller.ts"
  - "../backend/src/fluxo/fluxo.service.ts"
  - "../frontend/src/app/features/fluxo/fluxo-inicio.component.ts"
  - "../frontend/src/app/features/fluxo/fluxo-confirmar.component.ts"
---

> [!info] Como esta nota é mantida
> Transcrição do comportamento atual do código pela skill `codigo-para-regra`. Código vivo —
> regenere quando os arquivos em `fontes_codigo` mudarem.

# Regras de negócio — Fluxo de Projetos (Onboarding / "Novo Projeto")

## Visão geral
Assistente que **inicia um projeto de implantação a partir do e-mail de fechamento do
Comercial**: lê os dados do e-mail (da caixa de entrada ou colado à mão), deixa o usuário
revisar/completar, cria a ficha do projeto, gera o pacote inicial de documentos e envia um
e-mail-resumo aos responsáveis.

## Elementos da tela
### Passo 1 — Início
- **Status de configuração (Caixa/E-mail):** indica se a leitura automática de e-mail (IMAP) e o envio (SMTP) estão configurados — origem: `fluxo-inicio.component.ts`, `imapOk`/`smtpOk`.
- **Modelo de e-mail de fechamento + "Copiar":** o texto-padrão que o Comercial deve usar, para o Painel conseguir extrair os campos — origem: `modelo()`/`copiarModelo()`.
- **Botão "Checar caixa de entrada":** busca o e-mail de fechamento mais recente não lido — origem: `checarCaixa()`.
- **Campo de texto + "Extrair":** alternativa manual — colar o e-mail e extrair os campos — origem: `extrairTexto()`.

### Passo 2 — Confirmar
- **Formulário com os dados do projeto:** cliente, CNPJ, ramo, nº do projeto/proposta, contato (nome, e-mail, telefone), módulos, horas cobradas/bonificadas, datas, observações, GCI (consultor), técnicos, e-mails dos responsáveis — origem: campos de `fluxo-confirmar.component.ts`.
- **Opções "gerar":** marcar quais documentos do pacote inicial gerar (Levantamento, Check List, Cronograma) — origem: `gerarLevantamento`/`gerarChecklist`/`gerarCronograma`.
- **Botão "Criar":** cria o projeto e o pacote — origem: `criar()`.
- **Ir para a ficha:** após criar, abre a ficha do projeto — origem: `irParaFicha()`.

## Regras de negócio
- RN-01: Um projeto pode ser iniciado a partir de um e-mail de fechamento **lido da caixa** (IMAP) ou **colado manualmente**; em ambos os casos, os campos são extraídos do texto no formato "Rótulo: valor" — origem: `parseFechamento()`; rotas `inbox`/`parse`.
- RN-02: A extração reconhece os rótulos por um **dicionário de sinônimos** (aceita variações de escrita, com/sem acento) e ignora linhas sem ":"; para cada campo, mantém o **primeiro** valor encontrado — origem: `campoDoRotulo()` + `LABELS`; `parseFechamento()`.
- RN-03: A cidade e as observações do e-mail são **combinadas** no campo de observações do projeto — origem: `paraProjeto()`, junção `cidade · observacoes`.
- RN-04: Antes de criar, o sistema **evita duplicar**: se já existe um projeto com o **mesmo CNPJ** (comparando só os dígitos) ou, na falta de CNPJ, o **mesmo nome de cliente**, ele **não cria de novo** e aponta o projeto existente — origem: `existeSimilar()`; ramo "duplicado" em `criarComPacote()`.
- RN-05: Ao criar, a **data de início** é a data de hoje e o **GCI informado** é gravado como consultor responsável pelo Levantamento — origem: `criarComPacote()`, `dataInicio: hoje`, `consultor: gci`.
- RN-06: Os **técnicos** informados são anexados às observações do projeto e registrados como nota no histórico — origem: `criarComPacote()`, montagem de `observacoes` e evento de nota.
- RN-07: O **pacote inicial padrão** de documentos é Levantamento (Mapeamento de Processos), Check List e Cronograma; o usuário pode escolher quais gerar. O Termo de Encerramento **não** faz parte do pacote inicial — origem: `TIPOS_PACOTE_PADRAO`; comentário "'termo' não faz parte do pacote inicial".
- RN-08: Levantamento e Cronograma são gerados pelos **layouts fiéis** do Painel; o Check List é gerado pelo **gerador legado** (ponte de subprocesso) — origem: `criarComPacote()`, ramos `checklist` (LegadoCliService) vs layout fiel.
- RN-09: A falha ao gerar **um** documento do pacote **não interrompe** a criação do projeto nem a geração dos demais; ela é registrada como aviso — origem: `try/catch` por documento em `criarComPacote()`.
- RN-10: Após criar, o sistema envia um **e-mail-resumo com os documentos em anexo** aos responsáveis informados — desde que haja destinatários e o envio (SMTP) esteja configurado — origem: bloco de envio em `criarComPacote()`.
- RN-11: A criação **sempre gera um registro no histórico** do projeto e uma **notificação** de fechamento — origem: `registrarEvento` + `notificarEvento`.

## Validações e restrições
- Para gerar o Check List, o projeto precisa ter cliente e módulos (passados ao gerador legado) — origem: `criarComPacote()`, chamada `gerar_do_projeto` com `{cliente, modulos}`.
- Se o cliente não for informado, o projeto é criado com o nome "Cliente" (valor padrão) — origem: `criarComPacote()`, `cliente: dto.cliente || 'Cliente'`.
- A tela de confirmação só funciona se veio do passo de início (com campos); acessada direto, avisa que não há origem — origem: `fluxo-confirmar.component.ts`, `semOrigem`.

## Permissões
- **Qualquer usuário autenticado** pode usar o fluxo (checar caixa, extrair, criar) — não há restrição de perfil além do login — origem: `@UseGuards(JwtAuthGuard)` no `FluxoController`, sem `@Roles(...)`.

## Dados envolvidos
- **Lê:** o e-mail de fechamento (caixa IMAP ou texto colado); os projetos existentes (para dedup) — origem: `ImapIntakeService.buscarFechamento()`, `existeSimilar()`.
- **Grava:** a ficha do novo projeto; os documentos do pacote inicial (arquivos + registros); eventos no histórico; a notificação de fechamento; o e-mail-resumo enviado — origem: `criarComPacote()`.
- A leitura da caixa de entrada **não marca o e-mail como lido** — origem: comentário na rota `inbox`.

## Fluxos e transições de estado
- **Início → Confirmar:** quando a caixa/colagem produz campos válidos — origem: `irParaConfirmar()`.
- **Confirmar → Projeto criado:** ao clicar em Criar; **ou → aponta duplicado** se já existir — origem: `criar()` / `criarComPacote()` ramo duplicado.
- **Projeto criado → Ficha do projeto:** ao clicar em ir para a ficha; o próximo passo do processo (Levantamento pelo GCI) segue na ficha — origem: `irParaFicha()`; texto do resumo "Próximo passo: o GCI realiza o Levantamento".

## Dependências e efeitos colaterais
- Depende da **configuração de e-mail** (IMAP para ler, SMTP para enviar) — ver as telas de Config de e-mail. Sem SMTP, o projeto é criado mas o e-mail-resumo não sai (com aviso) — origem: `mailer.configurado()`.
- Depende do **assistente legado** (ponte de subprocesso) para gerar o Check List — origem: `LegadoCliService`.
- Depende dos **geradores de layout fiel** para Levantamento e Cronograma — origem: `GeracaoLayoutService`.
- Existe também um **robô da caixa** que cria o projeto automaticamente do e-mail, sem passar por esta tela (texto de evento e efeitos ligeiramente diferentes) — origem: `criarDeFechamento`/`criarDeCampos`.

## Pontos ambíguos
- Há **dois caminhos** de criação — manual pela tela (`criarComPacote`) e automático pelo robô (`criarDeCampos`) — com efeitos colaterais diferentes (texto de evento, geração de pacote só no manual). Não está claro no código se essa diferença é intencional em todos os detalhes — a confirmar.
- A dedup compara CNPJ só por dígitos e, sem CNPJ, por nome exato normalizado; clientes com nomes muito parecidos (sem CNPJ) podem gerar duplicatas. A confirmar se o critério é suficiente.
- Alguns campos do formulário de confirmação (nº da proposta, datas, "contatos" agregado) **não são preenchidos pelo parse** — só manualmente. A confirmar se é esperado que venham sempre em branco do e-mail.

## Relacionados no Vault
- [[08 - Regras de Negócio]]
- [[09 - Casos de Uso]]
