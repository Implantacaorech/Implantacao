---
titulo: "Regras de Negócio — Protocolos de Treinamento"
tipo: regras-de-negocio-tela
status: vivo
criado: 2026-07-21
atualizado: 2026-07-21
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - regras-de-negócio
  - painel
  - ia
relacionados:
  - "[[08 - Regras de Negócio]]"
  - "[[14 - IA]]"
gerado_por: "skill codigo-para-regra"
fontes_codigo:
  - "../backend/src/protocolos/protocolos.controller.ts"
  - "../backend/src/protocolos/protocolos.service.ts"
  - "../backend/src/protocolos/processamento-protocolos.service.ts"
  - "../backend/src/protocolos/protocolo-ia.service.ts"
  - "../backend/src/protocolos/protocolos.constants.ts"
  - "../frontend/src/app/features/protocolos/protocolos.component.ts"
---

> [!info] Como esta nota é mantida
> Transcrição do comportamento atual do código pela skill `codigo-para-regra`. Código vivo —
> regenere quando os arquivos em `fontes_codigo` mudarem.

# Regras de negócio — Protocolos de Treinamento

## Visão geral
Transforma **vídeos/áudios de treinamento do SIGER®** em uma **base de conhecimento
pesquisável**: o vídeo é transcrito automaticamente, a IA estrutura um "protocolo" (módulo,
menu, passo a passo, etc.), um revisor humano ajusta e, ao aprovar, o protocolo é publicado na
base.

## Elementos da tela
### Lista (base de conhecimento)
- **Filtros:** módulo, menu, status, origem e palavra-chave — origem: `protocolos.component.ts`, campos `fModulo`/`fMenu`/`fStatus`/`fOrigem`/`fQ`.
- **Situação do robô + pasta monitorada:** indica se a captura automática de vídeos está ativa e qual pasta ela observa — origem: `roboOk`/`pasta` (rota `listar`).
- **Enviar arquivo:** upload manual de vídeo/áudio — origem: `enviarArquivo()`.
- **Lista de protocolos:** cada linha mostra título, módulo, menu, status, origem e data — origem: `itens()`.

### Ficha de revisão
- **Player do vídeo/áudio + transcrição + campos editáveis do protocolo**, agrupados em blocos (1. Resumo · 2. Conteúdo do treinamento · 3. Conceitos, regras e configurações · 4. Fechamento · 5. Auditoria da análise) — origem: rota `ficha` + `salvar`, lista `PROTO_CAMPOS_EDICAO`.
- **Ações:** (re)processar, salvar edição, aprovar, reprovar — origem: rotas `processar`/`salvar`/`aprovar`/`reprovar`.
- **Andamento:** barra de progresso da transcrição, atualizada por consulta periódica — origem: rota `status` (polling).

## Regras de negócio
- RN-01: Um protocolo entra na base por **upload manual** ou pela **captura automática** de vídeos de uma pasta monitorada (robô) — origem: rota `novo` (upload) e `varrerPasta()` (robô).
- RN-02: Ao receber um vídeo, o sistema **evita duplicar**: se o mesmo conteúdo já foi registrado antes (mesmo hash), não cria de novo e avisa — origem: `criar()` (dedup por hash); aviso "já foi registrado antes".
- RN-03: Um vídeo novo dispara automaticamente o **pipeline**: transcrição → análise por IA → fica "Em revisão"; qualquer falha leva ao status "Erro" — origem: `processarAsync()`/`processar()`; transições de status.
- RN-04: A **análise por IA nunca inventa**: sem evidência clara, o módulo vira "Módulo a validar" e o menu vira "Menu não identificado - revisar manualmente"; a IA também lista o que removeu e o que ficou pendente de revisão humana — origem: prompt e pós-processamento em `protocolo-ia.service.ts`.
- RN-05: Ao **reprocessar**, se a transcrição já existe, ela é **reaproveitada** (não transcreve de novo) — vai direto para a análise — origem: `processar()` no serviço de processamento, ramo "texto já existe".
- RN-06: **Não é possível reprocessar** um protocolo que já está transcrevendo ou analisando (evita processamento concorrente) — origem: rota `processar`, guarda de status.
- RN-07: Um revisor pode **editar** os campos do protocolo antes de decidir — origem: rota `salvar` / `salvarEdicao()`.
- RN-08: **Aprovar** publica o protocolo na base de conhecimento e registra quem aprovou e quando; **reprovar** devolve para ajuste — origem: `decidir()`, estados "Aprovado" / "Reprovado / Ajustar".
- RN-09: Ao concluir a análise, o protocolo passa a "Em revisão" e registra a data de processamento — origem: `atualizarStatus()`, `processadoEm` quando "Em revisão".
- RN-10: Os status possíveis de um protocolo são: Pendente, Transcrevendo, Analisando, Em revisão, Aprovado, Reprovado / Ajustar, Erro — origem: `PROTO_STATUS`.
- RN-11: Quando o processamento falha, a mensagem ao usuário é **traduzida para linguagem clara** conforme a causa (créditos de IA esgotados, chave/modelo inválidos, serviço sobrecarregado) — origem: `erroAmigavel()`. Ver [[RN - Modo IA (Config IA)]].
- RN-12: A análise segue o **protocolo técnico de treinamento em 10 seções**: resumo geral, menus do sistema abordados (todos, cada um com objetivo e atividades), funcionalidades demonstradas, definições explicadas, configurações e parametrizações, processos executados, dúvidas respondidas, pendências, próximos passos e resumo técnico final — origem: prompt `SISTEMA` em `protocolo-ia.service.ts` (homologado fora do painel antes de entrar, 2026-07-29).
- RN-13: A IA **descarta** conversas paralelas, cumprimentos/despedidas, assuntos pessoais, conversas comerciais, discussões sobre outros clientes, assuntos administrativos, interrupções/pausas e problemas de infraestrutura — estes últimos só entram quando impactam o treinamento; o que foi removido fica registrado em `assuntos_removidos` — origem: bloco "FILTRAGEM" do prompt.
- RN-14: **"Pendências" tem dois sentidos** e campos distintos: `pendencias_treinamento` é o que ficou pendente com o cliente (vazio vira "Nenhuma pendência identificada.") e `pendencias` é a lista de pontos que a IA levanta para o revisor humano — origem: `analisar()` (fallback) e rótulos de `PROTO_CAMPOS_EDICAO`.

## Validações e restrições
- Só são aceitos arquivos de **vídeo ou áudio** em formatos suportados; outro formato é recusado com a lista de extensões válidas — origem: rota `novo`, checagem `EXTS`.
- O upload sem arquivo é recusado — origem: rota `novo`, "Selecione um arquivo".
- O nome do arquivo é normalizado (slug) e, se já existir um homônimo na pasta, recebe um sufixo — não sobrescreve — origem: rota `novo`, laço de sufixo.
- O vídeo só é servido ao player se estiver **dentro da pasta permitida** (proteção contra acesso a arquivos fora dela) — origem: rota `video`, checagem de caminho + `ForbiddenException`.

## Permissões
- **Qualquer usuário autenticado** pode consultar a base, enviar vídeos, ver a ficha, editar e reprocessar — origem: `@UseGuards(JwtAuthGuard)` na controller.
- **Apenas ADM e Coordenador** podem **aprovar ou reprovar** um protocolo — origem: `@Roles(...PERFIS_APROVA_PROTOCOLO)` nas rotas `aprovar`/`reprovar`; a ficha informa `podeAprovar` conforme o perfil.

## Dados envolvidos
- **Lê:** os protocolos e seus campos (transcrição, campos estruturados, status, origem, datas); o arquivo de vídeo/áudio (para o player e a transcrição) — origem: `ProtocolosService`, rota `video`.
- **Grava:** o arquivo enviado (na pasta "Videos Pendentes"); o registro do protocolo; a transcrição e os campos gerados pela IA; as edições humanas; a decisão (aprovado/reprovado) com autor e data; o histórico de cada passo — origem: `criar()`, `atualizar()`, `salvarEdicao()`, `decidir()`, `historico()`.
- Ao concluir/errar, o vídeo é **movido** para "Videos Processados" ou "Videos Com Erro" — origem: `moverVideo()` no serviço de processamento.

## Fluxos e transições de estado
- **Pendente → Transcrevendo → Analisando → Em revisão** (caminho feliz) — origem: `processar()`.
- **(qualquer passo) → Erro** em caso de falha (com o vídeo movido para "Com Erro") — origem: tratamento de erro em `processar()`.
- **Em revisão → Aprovado** (publicado) — origem: `decidir(true)`.
- **Em revisão → Reprovado / Ajustar** (devolvido) — origem: `decidir(false)`.
- **Erro/Reprovado → (reprocessar) → Analisando…** reaproveitando a transcrição — origem: rota `processar` + reaproveitamento.

## Dependências e efeitos colaterais
- A **transcrição** roda num serviço à parte (docservice); a tela apenas orquestra e acompanha o andamento por consulta periódica — origem: `TranscricaoService`, rota `status`.
- A **análise** usa a configuração de IA da finalidade "Protocolos" (provedor/chave/modelo do Modo IA) — origem: `ProtocoloIaService` chama `IaService.completar('protocolos', …)`. Ver [[RN - Modo IA (Config IA)]].
- A **captura automática** depende de a pasta monitorada estar configurada e acessível — origem: `configurado()`/`varrerPasta()`.
- Cada passo relevante gera **registro no histórico** do protocolo — origem: `historico()`.

## Pontos ambíguos
- O upload devolve sucesso mesmo quando o vídeo é duplicado (mesmo conteúdo) — apenas com um aviso; não fica claro no código se o usuário percebe que **nada novo** foi criado. A confirmar na experiência da tela.
- A proteção do player valida que o arquivo está sob a pasta raiz, mas a pasta raiz vem de configuração; se mal configurada, o escopo do que pode ser servido muda. A confirmar o hardening esperado.
- O status "Pendente" existe na lista de status, mas o pipeline dispara logo após o registro; não está claro em quais situações um protocolo permanece "Pendente" visível ao usuário (ex.: robô que só registra e processa depois). A confirmar.

## Relacionados no Vault
- [[08 - Regras de Negócio]]
- [[14 - IA]]
- [[RN - Modo IA (Config IA)]]
