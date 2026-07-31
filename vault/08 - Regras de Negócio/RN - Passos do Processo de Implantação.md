---
titulo: "Regras de Negócio — Passos do Processo de Implantação"
tipo: regras-de-negocio-tela
status: vivo
criado: 2026-07-30
atualizado: 2026-07-30
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - regras-de-negócio
  - painel
  - processo
relacionados:
  - "[[08 - Regras de Negócio]]"
  - "[[RN - Fluxo de Projetos (Onboarding)]]"
  - "[[09 - Casos de Uso]]"
gerado_por: "revisão do processo pelo usuário (2026-07-30)"
fontes_codigo:
  - "../backend/src/passos/passos.constants.ts"
  - "../backend/src/passos/passos-email.constants.ts"
  - "../backend/src/passos/passos.service.ts"
  - "../backend/src/passos/passos-notificacao.service.ts"
  - "../backend/src/passos/destinatarios-passo.service.ts"
  - "../frontend/src/app/features/passos/passos.component.ts"
---

> [!info] Como esta nota é mantida
> Espelha o mapa executável em `passos.constants.ts`, que é a fonte da verdade. A prova de
> que os dois batem é `passos.constants.spec.ts` — se o mapa mudar sem esta nota, o teste
> continua verde, então **atualize os dois juntos**.

# Regras de negócio — os 21 passos do processo de implantação

## Visão geral

O processo tem **21 passos** (revisão do usuário em 2026-07-30; antes eram 19). Cada passo
tem um **responsável**, **dependências** e, quase sempre, um **e-mail**. Os passos NÃO
substituem as 6 macro-etapas: cada passo pertence a uma delas, e a macro-etapa continua sendo
o que o painel, as métricas e os filtros usam.

**Vocabulário:** TÉCNICO = Consultor · GCI = único por projeto · LEVANTADOR = quem faz o
levantamento (pode ser mais de um) · Consultor = pode ser mais de um.

## Os 21 passos

| # | Passo | Responsável | Depende | E-mail ao concluir |
|---|---|---|---|---|
| 1 | Consulta e Cadastro do Cliente | Comercial | — | Administrativo **+ 2 grupos da Rech** (configuráveis) |
| 2 | Agendar Levantamento de Processo | Administrativo | 1 | Levantador(es) designado(s), com data e horário |
| 3 | Realizar o Levantamento de Processo | Levantador | 2 | — |
| 4 | Repassar informações do levantamento ao Comercial | Levantador | 3 | Comercial (**redigido na tela**) |
| 5 | Avançar para finalização da negociação | Comercial | 4 | Administrativo, **com a descrição escrita aqui** |
| 6 | Finalizar negociação e enviar o fechamento | Administrativo | 5 | — |
| 7 | Contrato assinado e liberação para indicar os responsáveis | Administrativo | 6 | Coordenador |
| 8 | Indicar o GCI e os técnicos responsáveis | Coordenador | 7 | GCI + técnicos + Administrativo |
| 9 | Incluir a RNI e as RNS de COB e Conversão | Administrativo | 8 | **nenhum** |
| 10 | Criação do Projeto | GCI | 8 | Administrativo |
| 11 | Conferência do Projeto e envio para assinatura | Administrativo | 10 | Coordenação (**redigido na tela**) |
| 12 | Sinalizar Projeto assinado | Administrativo | 11 | — |
| 13 | Elaborar o cronograma e incluir as agendas no SICLA | Consultor | **8** | **nenhum** |
| 14 | Gerar o check-list | Consultor | 13 | — |
| 15 | Encaminhar e-mail de boas-vindas | Consultor | 14 | Cliente (**redigido na tela**) |
| 16 | Enviar o cronograma de visitas | Consultor | 15 | Cliente (**redigido**, com o cronograma + anexos livres) |
| 17 | Sinalizar Projeto concluído | Consultor | 16 | Coordenação, GCI e Administrativo (**redigido**) |
| 18 | Gerar o Termo de Encerramento e enviar ao Administrativo | Consultor | 17 | Administrativo, com o Termo em anexo (**redigido**) |
| 19 | Conferir o Termo e encaminhar para assinatura | Administrativo | 18 | Consultores (**redigido na tela**) |
| 20 | E-mail de Encerramento ao Coordenador e ao GCI | Consultor | 19 | Coordenação e GCI (**redigido na tela**) |
| 21 | E-mail de Encerramento ao cliente, com o Termo | Consultor | 20 | Cliente, com o Termo em anexo (**redigido**) |

## Regras

- **RN-1 — Três trilhas paralelas a partir do passo 8.** Concluído o 8 (equipe definida),
  abrem-se ao mesmo tempo a RNS (9), o Projeto (10→11→12) e o Cronograma (13→…→21). Nenhuma
  espera a outra. Em especial, **o passo 13 depende do 8, não do 9 nem do 12** — é o que o
  usuário pediu ao marcar 9 e 10 como "não trancam as próximas etapas" e o bloco a partir do
  13 como independente do 11 e do 12.
- **RN-2 — Nada depende do passo 9.** Incluir as RNS é registro administrativo; não é gate de
  ninguém. Ele também **não envia e-mail** (decisão explícita do usuário).
- **RN-3 — A conferência do Projeto espera o Projeto.** O 11 depende do 10 porque a
  conferência É a leitura do arquivo gerado: o Administrativo o visualiza no layout da Rech,
  baixa e manda ao cliente dali mesmo.
- **RN-4 — Dois passos exigem assinatura + data.** O 7 (contrato assinado) e o 12 (projeto
  assinado) só fecham com a marcação E a data preenchidas — `PASSOS_COM_MARCACAO`, gravadas em
  `projeto_passos.marcado`/`data_marcada`. Sem elas o backend recusa (400).
- **RN-5 — Dois passos exigem conferência para liberar o seguinte.** O 11 e o 19
  (`PASSOS_COM_CONFERENCIA`): concluir não basta, é preciso marcar "conferido".
- **RN-6 — A partir do 14, concluir é definitivo.** São atos já formalizados com o cliente
  (check-list gerado, boas-vindas enviadas, termo assinado); reabrir daria ao Painel um
  histórico que não corresponde ao que o cliente recebeu.
- **RN-7 — A descrição do passo 5 viaja no e-mail do passo 5.** O Comercial descreve o que
  ficou acertado, e esse texto entra no corpo do e-mail que vai ao responsável pela etapa
  seguinte, via token `{{DESCRICAO_PASSO}}`.
- **RN-8 — O e-mail "enviado por aqui" é REVISADO, não automático.** Nos passos de
  `PASSOS_COM_REDACAO_DE_EMAIL` (4, 5, 11, 15–21) a tela abre com o e-mail já montado (modelo
  do passo + tokens do projeto) e a pessoa revisa destinatários, assunto e corpo antes de
  mandar. Nos demais, o e-mail sai pronto ao concluir.
- **RN-9 — Passos 4 e 6 guardam a PROVA, não o envio.** Nesses dois o e-mail sai do Outlook da
  pessoa; o Painel aceita o `.msg`/`.eml` encaminhado como registro
  (`PASSOS_COM_ANEXO_DE_EMAIL`).
- **RN-10 — Quem pode concluir.** Não basta ter o perfil: para os papéis designados por
  projeto, a pessoa tem de estar designada NAQUELE projeto (GCI em `Projeto.gci`; Consultor e
  Levantador em `projeto_pessoas`). Administrativo, Coordenador e Comercial valem pelo perfil.
  ADM passa em tudo.
- **RN-11 — ABRIR a tela ≠ CONCLUIR o passo.** `PERFIS_TELA_DO_PASSO` usa a mesma lista que a
  tela de destino já exige, para o botão não prometer o que a tela recusa.
- **RN-12 — Elaborar o cronograma (13) não fala com o cliente.** É trabalho interno, e o
  consultor pode refazer o cronograma quantas vezes quiser antes de fechar o passo. Quem leva
  o cronograma ao cliente é o **passo 16**, com o documento em anexo. (Revisão de 2026-07-30;
  até então o 13 disparava um e-mail ao contato do cliente.)
- **RN-13 — O passo 16 aceita anexos livres.** Além do cronograma gerado, o consultor anexa na
  tela os arquivos que o cliente precisa receber (`PASSOS_COM_ANEXO_LIVRE`). Eles sobem na
  hora da escolha, ficam visíveis antes do envio e são guardados como documentos do projeto
  com o tipo `anexo_passo_N` — o e-mail sai com os anexos livres **na frente** do documento
  gerado.
- **RN-14 — O roteiro do check-list (14) casa por SIGLA, não por código.** `Projeto.modulos`
  guarda os CÓDIGOS do SICLA desde que o passo 1 virou consulta; o catálogo do roteiro é
  indexado por sigla (FAT, NFE). `siglasContratadas()` faz a tradução por três caminhos, nesta
  ordem: a descrição gravada em `modulos_detalhe` (onde a sigla vem escrita do SICLA), o
  `catalogo_modulos.yaml` (código → abreviação) e o token cru, para os projetos antigos em que
  alguém digitou a sigla à mão. O casamento é pelo **adicional** quando ele existe — quem
  contratou FAT recebe as linhas do FAT, não também as de NFE e BRO.

## Consulta: e-mails e documentos de cada passo

Exigência do processo: **qualquer pessoa com acesso ao menu** vê os e-mails gerados e os
documentos produzidos em cada passo — e **pode baixar o documento mesmo tendo só consulta**.

- Os e-mails ficam em **`emails_passo`**, guardados por inteiro (destinatários, assunto,
  corpo, anexo, status, autor). Inclusive os que **falharam** — um e-mail que não saiu é
  justamente o que alguém precisa descobrir ao conferir o andamento.
- Os documentos vêm de `documentos`, ligados ao passo pelo **tipo**
  (`DocumentosService.PASSO_POR_TIPO`); os anexos do Outlook usam `email_passo_N` e os anexos
  livres do e-mail, `anexo_passo_N`.
- Na tela de passos, cada passo mostra um bloco **"Registros"** com os dois. O download usa
  `GET /api/documentos/:id/baixar`, que exige apenas autenticação.
- **Os passos 10 e 11 trazem o Projeto para fora do bloco de Registros**: os dois mostram
  "Visualizar" e "Baixar" na própria linha, apontando para o MESMO documento gerado no 10 —
  conferir (11) é ler o arquivo, e obrigar a caçá-lo dentro de "Registros" era atrito puro.

## Configuração (Sistema → Ferramentas)

O texto e os destinatários de cada e-mail são editáveis sem release:

- **Modelos de E-mail** (`/config/modelos-email`, ADM) — um modelo por passo, slug `passo-N`,
  semeado no boot a partir do padrão do código. Editar o `passo-15` muda o e-mail de
  boas-vindas para todos os projetos. Precedência: texto redigido na tela → modelo `passo-N`
  → padrão do código.
- **Destinatários por Passo** (`/config/destinatarios-passo`, ADM) — grupos dinâmicos
  (Administrativo, Coordenação, GCI, Consultores, Levantadores, Comercial, Cliente) mais
  **endereços fixos**. É por aqui que entram os dois grupos de e-mail da Rech avisados no
  passo 1: são listas internas, mudam sem release e não cabem no código. Passo sem linha
  configurada usa o padrão; a configuração também permite **desligar** o e-mail de um passo.

## Numeração é identidade, não rótulo

O número do passo é a chave em `projeto_passos.passo`. Mexer no mapa **exige migrar os dados
junto** — ver `1784810000000-RenumerarPassos21.ts`, que aplicou o de/para desta revisão
(1–4 iguais · 5–10 → +1 · 11–19 → +2) e preencheu retroativamente os passos novos onde o
processo comprovadamente já havia passado por eles.

## Relacionados no Vault

- [[08 - Regras de Negócio]]
- [[RN - Fluxo de Projetos (Onboarding)]]
- [[05 - Banco de Dados]]
