---
titulo: "Regras de Negócio — Modo IA (Config → IA)"
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
  - "[[13 - Segurança]]"
gerado_por: "skill codigo-para-regra"
fontes_codigo:
  - "../backend/src/ia/ia.controller.ts"
  - "../backend/src/ia/ia.service.ts"
  - "../backend/src/ia/ia.constants.ts"
  - "../backend/src/ia/dto/salvar-chave-ia.dto.ts"
  - "../frontend/src/app/features/config/config-ia.component.ts"
  - "../frontend/src/app/features/config/config-ia.component.html"
---

> [!info] Como esta nota é mantida
> Transcrição do **comportamento atual do código** da tela Modo IA para linguagem de negócio,
> gerada pela skill `codigo-para-regra`. É **código vivo**: quando os arquivos em `fontes_codigo`
> mudarem, regenere esta nota rodando a skill de novo — não edite regra a regra à mão. O campo
> "origem" de cada regra aponta o trecho de código que a sustenta.

# Regras de negócio — Modo IA (Config → IA)

## Visão geral
Tela administrativa onde se define **como o Painel usa Inteligência Artificial**, configurando,
para cada finalidade que usa IA, qual **provedor**, qual **chave de acesso** e qual **modelo**
serão usados. Sem configuração válida, a finalidade funciona em modo básico (sem IA).

## Elementos da tela
- **Título "Modo IA — chaves por finalidade":** deixa claro que a configuração é separada por finalidade — origem: `config-ia.component.html`, cabeçalho.
- **Uma seção por finalidade:** hoje existem duas — "Protocolos de Treinamento" e "Dicionário Inteligente" — cada uma com seu bloco próprio de configuração — origem: `FINALIDADES_IA` em `ia.constants.ts`; laço por finalidade no template.
- **Selo de situação (ativa/inativa):** em cada seção, mostra se a IA daquela finalidade está ativa, com o provedor e o modelo em uso; quando inativa, indica "modo básico" — origem: bloco `@if (f.ativa)` no template.
- **Campo "Provedor":** escolha entre Anthropic e OpenRouter — origem: `<select formControlName="provider">` alimentado por `provedores()`.
- **Campo "Chave de API":** onde se cola o segredo de acesso do provedor (exibido como senha) — origem: `<input type="password" formControlName="apiKey">`.
- **Campo "Modelo":** qual modelo de IA usar; quando o provedor é OpenRouter, vira uma lista pesquisável com o catálogo de modelos do OpenRouter — origem: campo `modelo` + `datalist` `modelos-openrouter`; `ehOpenRouter()`.
- **Botão "Salvar" (por seção):** grava a configuração daquela finalidade — origem: `(click)="salvar(i)"`.
- **Aviso de modelo suspeito:** alerta quando, no OpenRouter, o modelo informado não tem o prefixo do provedor (ex.: `anthropic/…`) — origem: `modeloSuspeito()`.

## Regras de negócio
- RN-01: A configuração de IA é feita **separadamente para cada finalidade** (Protocolos de Treinamento e Dicionário Inteligente); cada uma tem provedor, chave e modelo próprios, sem chave compartilhada entre elas — origem: `salvar(finalidade, …)` grava por finalidade; `statusTodas()`.
- RN-02: Cada finalidade pode usar um de dois provedores de IA: **Anthropic** ou **OpenRouter** — origem: `PROVEDORES_IA` em `ia.constants.ts`.
- RN-03: Ao salvar uma finalidade **sem informar a chave** (chave em branco), a configuração daquela finalidade é **removida** e ela volta ao modo básico — origem: `salvar()`, ramo "apiKey vazia → apaga a finalidade".
- RN-04: Se o provedor for **Anthropic** e o modelo não for informado, o sistema assume o modelo padrão `claude-opus-4-8` — origem: `salvar()` e `completarAnthropic()`, uso de `MODELO_ANTHROPIC_PADRAO`.
- RN-05: Se o provedor for **OpenRouter**, o **modelo é obrigatório** para a IA funcionar; sem modelo, a chamada é bloqueada com aviso de "modelo não informado" — origem: `completarOpenRouter()`, checagem de modelo vazio.
- RN-06: Uma finalidade só é considerada **ativa** (usa IA de verdade) quando tem uma chave configurada — própria ou herdada de uma configuração global de ambiente — origem: `resolver()` / `disponivel()`.
- RN-07: Quando uma finalidade **não tem chave própria**, o sistema usa como reserva uma **chave global de ambiente** da Anthropic, se existir; nesse caso a finalidade fica marcada como "chave via variável de ambiente" e não é editável pela tela — origem: `fallbackAnthropic()` e `viaEnv` em `status()`.
- RN-08: Após salvar com sucesso, o **campo da chave é limpo** na tela e é exibida a confirmação "chave salva" (ou "chave removida", se foi apagada) — origem: `salvar(idx)`, `patchValue({apiKey:''})` e mensagem de aviso.
- RN-09: A tela oferece um **catálogo de modelos do OpenRouter** para escolha; esse catálogo é público e é buscado sem exigir chave — origem: `listarModelosOpenRouter()` (endpoint público) e combo no template.
- RN-10: Ao usar uma finalidade configurada com OpenRouter, o sistema envia a solicitação ao serviço do OpenRouter usando o modelo escolhido; se o OpenRouter recusar (ex.: sem créditos, modelo inválido, chave inválida), o erro do provedor é repassado — origem: `completarOpenRouter()`, tratamento de resposta não-OK.

## Validações e restrições
- A finalidade a configurar é obrigatória e só pode ser "Protocolos de Treinamento" ou "Dicionário Inteligente" — origem: `SalvarChaveIaDto.finalidade` (`@IsIn(FINALIDADE_IDS)`).
- Quando informado, o provedor só pode ser "anthropic" ou "openrouter" — origem: `SalvarChaveIaDto.provider` (`@IsIn(PROVEDORES_IA)`).
- Chave e modelo são opcionais no envio (chave em branco significa remover a finalidade) — origem: `SalvarChaveIaDto.apiKey`/`modelo` (`@IsOptional`).
- **(Preventiva, não bloqueante)** No OpenRouter, se o modelo informado não contém o prefixo do provedor (`/`), a tela exibe um alerta de que o modelo provavelmente está errado — origem: `modeloSuspeito()`. *É apenas um aviso visual; não impede salvar.*

## Permissões
- Apenas usuários do perfil **ADM** podem acessar e alterar a configuração de IA (ver status, salvar/remover chaves, consultar o catálogo de modelos) — origem: `@Roles(...PERFIS_SISTEMA)` no controller, com `PERFIS_SISTEMA = ['ADM']`; exige usuário autenticado (`JwtAuthGuard`).

## Dados envolvidos
- **Lê:** a configuração de IA por finalidade (provedor, chave, modelo); o catálogo de modelos do OpenRouter (fonte externa, pública) — origem: `lerArquivo()`, `listarModelosOpenRouter()`.
- **Grava:** a configuração de cada finalidade em um **arquivo local do servidor** (`dados/ia_config.json`), **nunca no banco de dados**; salvar com chave em branco apaga a finalidade do arquivo — origem: `gravarArquivo()`, comentário "fora do Git, NUNCA no banco".

## Fluxos e transições de estado
- Finalidade **inativa → ativa**: quando se salva uma chave válida para ela — origem: `salvar()` grava; `disponivel()` passa a retornar verdadeiro.
- Finalidade **ativa → inativa**: quando se salva com a chave em branco (remoção) — origem: ramo de remoção em `salvar()`.
- Finalidade **sem chave própria → ativa por herança**: quando existe a chave global de ambiente da Anthropic, a finalidade fica ativa "via variável de ambiente" e a edição pela tela é bloqueada — origem: `fallbackAnthropic()` + `viaEnv`.

## Dependências e efeitos colaterais
- A configuração salva aqui é usada por **todas as funcionalidades de IA do Painel** daquela finalidade — hoje, os **Protocolos de Treinamento** (reconferência do texto transcrito) e o **Dicionário Inteligente** (resposta em linguagem natural sobre a documentação) — origem: `IaService.completar()` é chamado por `ProtocoloIaService` e `DicionarioIaService`. Ver [[14 - IA]].
- Ao consultar o catálogo de modelos, o Painel chama um **serviço externo (OpenRouter)**; se estiver indisponível, a lista vem vazia, sem quebrar a tela — origem: `listarModelosOpenRouter()`, retorno vazio em falha.
- Ao efetivamente usar a IA (fora desta tela), o Painel chama o serviço do provedor escolhido (Anthropic ou OpenRouter) — origem: `completarAnthropic()`/`completarOpenRouter()`.

## Pontos ambíguos
- O aviso de "modelo suspeito" no OpenRouter é **apenas visual e não impede salvar** uma configuração inválida; o código não bloqueia salvar um modelo malformado nem uma chave que não pareça uma chave (ex.: um id de modelo colado no campo da chave). Não está claro se é intencional ou lacuna — a confirmar. *(Foi exatamente esse cenário que causou a falha de 2026-07-20: um id de modelo salvo no campo da chave. Ver [[22 - Troubleshooting]].)*
- A **chave global de ambiente** de reserva só existe para a Anthropic; não há equivalente para OpenRouter no código. A confirmar se é decisão ou pendência.
- O texto de apoio da tela cita a variável `MIGRACAO_ANTHROPIC_API_KEY` como origem quando a chave vem do ambiente, mas o código também aceita `ANTHROPIC_API_KEY`; a mensagem ao usuário cita só a primeira — possível defasagem de texto.

## Relacionados no Vault
- [[08 - Regras de Negócio]]
- [[14 - IA]]
- [[13 - Segurança]]
