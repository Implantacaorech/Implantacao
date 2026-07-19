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

## Relacionados no Vault

- [[21 - Conhecimento]]
- [[11 - Testes]]
- [[12 - DevOps]]

## Aponta para (conteúdo real do repositório)

- `../memoria_ia/estado-atual.md` (desatualizado quanto à migração Angular/NestJS —
  pendência conhecida, não corrigida nesta sessão por não ter sido a entrega escolhida)

## Status

Esqueleto criado em 2026-07-19 — conteúdo será enriquecido incrementalmente. Ver [[00 - Dashboard]].
