---
titulo: "Troubleshooting"
tipo: indice
status: em-andamento
criado: 2026-07-19
atualizado: 2026-07-19
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - troubleshooting
relacionados:
  - "[[21 - Conhecimento]]"
  - "[[11 - Testes]]"
  - "[[12 - DevOps]]"
---

# Troubleshooting

> [!info] Sobre esta seção
> Problemas conhecidos, causas-raiz e soluções aplicadas — para não repetir a mesma
> investigação duas vezes.

## Pendências abertas (atualizado 2026-07-19 à tarde — diagnóstico refeito com credenciais reais)

> [!note] Adiado por decisão do usuário (2026-07-19)
> Os dois itens abaixo dependem de uma ação do usuário fora desta sessão (pedido de aumento
> de quota no Google Cloud Console; edição de permissão do token no GitHub). Ele decidiu
> deixar para depois. Retomar quando ele avisar que fez o pedido de quota e/ou ajustou a
> permissão do token — nesse momento, testar de novo com as credenciais já salvas em `.env`
> antes de assumir que segue bloqueado.

O usuário forneceu uma API key do Gemini e um Personal Access Token do GitHub. Ambos foram
testados de ponta a ponta (chamadas reais às APIs, não suposição). As duas credenciais estão
**armazenadas em `.env` na raiz do repo** (arquivo ignorado pelo Git — confirmado com
`git check-ignore`). Os dois itens abaixo estão mais avançados do que "falta ferramenta":
agora é uma ação pontual de configuração do lado do usuário no GitHub/Google.

### 1. Nano Banana (Gemini image gen) — billing habilitado, mas quota de imagem ainda em 0

- **Testado (1ª chave, antes do billing):** `GET /v1beta/models` listou os modelos
  normalmente, incluindo `gemini-2.5-flash-image` (nome comercial real: **"Nano Banana"**),
  `gemini-3.1-flash-image` ("Nano Banana 2") e `imagen-4.0-fast-generate-001` ("Imagen 4").
  A integração (endpoint, payload, parsing da resposta) está correta e comprovada.
- **Testado (2ª chave, depois do usuário mexer no billing):** texto normal agora funciona e
  retorna `"serviceTier": "standard"` no `usageMetadata` — ou seja, **o projeto passou a
  usar tier pago para texto**. Billing foi de fato habilitado.
- **Bloqueio que persiste:** `generateContent` no modelo de imagem (`gemini-2.5-flash-image`)
  continua retornando `429 RESOURCE_EXHAUSTED` com a mesma mensagem
  (`generate_content_free_tier_requests, limit: 0, model: gemini-2.5-flash-preview-image`).
  A quota de **imagem** é uma quota separada da quota de texto — habilitar billing no
  projeto não a libera automaticamente; ela precisa de um pedido de aumento de quota à
  parte, específico para modelos de imagem.
- **Como resolver:** no Google Cloud Console → **IAM & Admin → Quotas & System Limits** →
  filtrar pelo serviço **"Generative Language API"** → procurar a quota de
  *Generate Content Requests* para modelos de imagem (`gemini-2.5-flash-image` /
  `*-preview-image`) → **Edit Quotas** → solicitar aumento (de 0 para pelo menos 1). Pode
  levar de minutos a algumas horas para o Google aprovar/propagar. Alternativa: contatar o
  suporte do Gemini API pelo link que vem no próprio erro
  (<https://ai.google.dev/gemini-api/docs/rate-limits>) se a quota não aparecer editável no
  Console. Assim que a quota for liberada, a mesma chave em `.env` já funciona sem mudar
  nada no código.

### 2. Branch protection — token válido, mas sem escopo de Administration

- **Testado:** o PAT autentica normalmente (`GET /repos/.../pulls` e `/contents/...` → 200,
  `permissions.admin: true` no objeto do repo) e tem 5000 req/h de rate limit — é um token
  ativo de verdade, não expirado nem malformado.
- **Bloqueio real:** `GET/PUT /repos/Implantacaorech/Implantacao/branches/main/protection`
  retornou `403 "Resource not accessible by personal access token"`. É um PAT **fine-grained**
  (prefixo `github_pat_...`) e não foi concedida a permissão de repositório
  **"Administration: Read and write"** — só ela habilita endpoints de branch protection;
  as permissões de conteúdo/PR que ele já tem não bastam.
- **Como resolver:** em <https://github.com/settings/tokens> (aba "Fine-grained tokens"),
  editar este token e adicionar a permissão de repositório **Administration → Read and
  write** para `Implantacaorech/Implantacao` (ou gerar um novo token já com essa permissão).
  Assim que isso for feito, o mesmo token em `.env` já é suficiente — não precisa colar de
  novo.

### 3. Criar PR via API — token também sem "Pull requests: write"

- **Testado:** `POST /repos/Implantacaorech/Implantacao/pulls` com o mesmo PAT retornou
  `403 "Resource not accessible by personal access token"` — mesma causa-raiz do item 2
  (fine-grained PAT sem a permissão específica, dessa vez **"Pull requests: Read and
  write"**, não "Administration").
- **Como resolver:** editar o token em <https://github.com/settings/tokens> e adicionar
  **Pull requests → Read and write** (pode marcar junto com Administration do item 2, no
  mesmo token).
- **Contorno usado:** o usuário abriu o PR manualmente pela UI do GitHub (PR #8,
  <https://github.com/Implantacaorech/Implantacao/pull/8>) com o título/descrição
  preparados nesta sessão. Funcionou normalmente — a limitação é só de escrita via API.

### 4. Job `test` (Python/webapp) falha no CI real — pré-existente, não é regressão de hoje

- **Contexto:** `feature/migracao-angular-backend-moderno` nunca tinha sido *pushada* pro
  GitHub antes de 2026-07-19 (41 commits existiam só localmente) — ou seja, essa foi a
  **primeira vez que o CI real rodou** nesse conteúdo.
- **Testado:** o job `test` (pytest do painel Flask legado) falhou no Actions
  (`FileNotFoundError: Arquivo do modelo 'levantamento'/'projeto'/'termo'/'cronograma' não
  encontrado`) — os testes dependem de `.docx` em `tools/data/modelos_documento/` e
  `tools/templates/`, que são **propositalmente gitignorados** (letterhead real da Rech,
  mantido só local, nunca versionado).
- **Não é causado pelas mudanças desta sessão:** confirmado consultando o histórico de runs
  do Actions — o mesmo job `test` **já falha em pushes recentes na própria `main`**
  (ex.: commits `bfd21dea`, `3f4ede9c`), então é uma lacuna pré-existente do repositório,
  só nunca tinha aparecido nesta branch por falta de CI rodando nela.
- **Os jobs novos (`backend-test`, `frontend-test`) passaram normalmente** no Actions real
  (Linux), confirmando que a adição ao pipeline funcionou.
- **Como resolver (não feito ainda, decisão de escopo, não técnica):** ou os testes que
  dependem desses `.docx` passam a pular graciosamente quando o arquivo não existe (comum
  em CI de código aberto com fixtures proprietárias), ou os `.docx` de teste (não os reais
  da Rech) passam a ser versionados como fixture. Requer decisão do dono do `painel-core`/
  `qualidade`, não uma correção unilateral.
- **Status em 2026-07-19 (mais tarde):** ficou sem objeto — o painel Flask (e
  `webapp/test_painel.py` com ele) foi desligado e movido para `projeto_old/` na virada
  para produção (ver item 5). O job `test` foi removido do CI, substituído por
  `tools-smoke` (só testa o que continua vivo: `tools/` + a ponte `legado_cli`).

### 5. Painel Flask fora do ar havia 2 dias — achado durante a Fase 2 de segurança da virada

- **Contexto:** o usuário pediu para executar a Fase 2 do plano de virada (rotacionar senha
  do Postgres do Flask). Antes de tocar em qualquer senha, investiguei o container
  (`docker exec -it painel-db ...`, do runbook) e ele **não existe**.
- **Achado real:** `http://localhost:5000/health` respondia erro; `guardiao.log` mostrou
  **288 tentativas de reinício falhas em 18/07 (24h inteiras)** e mais 269 em 19/07,
  contínuo — zero entradas em 17/07 (dia saudável, bate com o último backup bom,
  `painel_20260717_220001.sql.gz`). Ou seja: o Postgres do Flask sumiu na janela da
  migração de banco do stack novo (17/07 à tarde) e ninguém percebeu por 2 dias — o
  guardião só loga falha, nunca sucesso, então o problema ficou silencioso.
- **Não consegui checar** se sobrou volume/container recuperável no Docker do WSL desta
  máquina — `sudo docker ps` pediu senha que eu não tenho.
- **Decisão do usuário (2026-07-19):** não investigar recuperação; seguir direto para
  produção só com o stack novo. Flask desligado (processo + as duas Tarefas Agendadas
  `Painel - Guardiao`/`Painel - Verificacao de Integridade`), arquivos só-Flask movidos
  para `projeto_old/`. Detalhe completo, incluindo o que NÃO foi movido (dependências
  vivas), em `docs/migracao/05-plano-de-virada.md` §"Registro real da virada".
- **Risco aceito, não mitigado:** dado gravado no Flask entre 15/07 (corte da migração) e
  17/07 à noite (queda), se existir e não estiver no stack novo, não foi reconciliado.

### 6. Deploy do módulo `agentes` derrubou a produção por ~1-2 min — porta errada

- **Contexto:** ao colocar o `AgentesModule` no ar (telemetria de execução de agentes),
  reiniciei o backend novo manualmente com `node dist/main.js` direto, em vez de passar por
  `Iniciar_Painel_Novo.bat`.
- **Erro:** o `.bat` faz `set "MIGRACAO_PORT=5100"` **só como fallback** se a variável não
  estiver definida — não é uma env var persistente do Windows. Chamando `node dist/main.js`
  direto, sem esse fallback, o backend caiu no default do Nest (`configuration.ts`:
  `Number(process.env.MIGRACAO_PORT ?? 3000)`) — porta **3000**, já ocupada por outro
  processo nesta máquina (`EADDRINUSE`) — e o processo crashou, deixando a porta 5100 vazia.
- **Correção:** subi de novo com `MIGRACAO_PORT=5100` explícito na chamada. No ar em
  segundos; janela real de indisponibilidade ficou entre matar o processo antigo e o
  restart correto, poucos minutos.
- **Lição:** reiniciar o backend novo em produção **sempre** via `Iniciar_Painel_Novo.bat`
  (ou setando `MIGRACAO_PORT` explicitamente), nunca `node dist/main.js` cru — ver
  [[integracoes-operacao]] (`.claude/agents/integracoes-operacao.md`).

## Relacionados no Vault

- [[21 - Conhecimento]]
- [[11 - Testes]]
- [[12 - DevOps]]

## Aponta para (conteúdo real do repositório)

- `../memoria_ia/estado-atual.md` (desatualizado quanto à migração Angular/NestJS —
  pendência conhecida, não corrigida nesta sessão por não ter sido a entrega escolhida)

## Status

Esqueleto criado em 2026-07-19 — conteúdo será enriquecido incrementalmente. Ver [[00 - Dashboard]].
