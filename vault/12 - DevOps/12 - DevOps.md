---
titulo: "DevOps"
tipo: indice
status: em-andamento
criado: 2026-07-19
atualizado: 2026-07-19
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - devops
relacionados:
  - "[[05 - Banco de Dados]]"
  - "[[13 - Segurança]]"
  - "[[25 - Automações]]"
---

# DevOps

> [!info] Sobre esta seção
> CI/CD, pipelines, deploy e infraestrutura.

## CI existente

`.github/workflows/ci.yml` já roda em push/PR para `main` com dois jobs:
`test` (compileall + smoke + pytest com cobertura do painel Flask) e `test-postgres`
(smoke do schema contra Postgres real). Esses dois nomes de job são os `contexts` a exigir
quando a branch protection abaixo for aplicada.

## Processo-alvo: PR obrigatório + CI + revisão antes de merge

Decidido em [[ADR-0001 - Adocao do ecossistema Vault + IA|ADR-0001]]: toda alteração deve
passar por Pull Request, pipeline de CI e aprovação em code review antes do merge — sem
exceção, inclusive para o próprio repositório de documentação.

**Ainda não está em vigor** — testado nesta sessão com um PAT fornecido pelo usuário
(guardado em `.env`, ignorado pelo Git). O token autentica normalmente e tem
`permissions.admin: true` no objeto do repositório, mas é um **fine-grained PAT** sem a
permissão de repositório **"Administration: Read and write"**, que é a única que habilita os
endpoints de branch protection (`GET/PUT /repos/Implantacaorech/Implantacao/branches/main/protection`
→ hoje retornam `403 Resource not accessible by personal access token`). Detalhe completo em
[[22 - Troubleshooting]].

### Como destravar

1. Em <https://github.com/settings/tokens> → editar o fine-grained token existente (ou criar
   um novo) → adicionar permissão de repositório **Administration → Read and write** para
   `Implantacaorech/Implantacao`.
2. Assim que isso for feito, o mesmo token em `.env` já é suficiente. A chamada a aplicar é:

```http
PUT /repos/Implantacaorech/Implantacao/branches/main/protection
{
  "required_status_checks": {"strict": false, "contexts": ["test", "test-postgres"]},
  "enforce_admins": true,
  "required_pull_request_reviews": {"required_approving_review_count": 1},
  "restrictions": null
}
```

> [!warning] Efeito prático imediato
> Com `enforce_admins: true`, push direto em `main` (inclusive pela conta que já commita
> hoje) passa a ser rejeitado — toda mudança precisa de PR + 1 aprovação + os dois checks de
> CI passando. Isso é o comportamento pedido no ADR-0001 ("sem exceção"), mas é uma mudança
> de hábito de trabalho, não só de configuração.

Alternativa manual, sem token: GitHub → repositório → Settings → Branches → Add branch
protection rule para `main`, marcando as mesmas opções acima pela UI.

## Relacionados no Vault

- [[05 - Banco de Dados]]
- [[13 - Segurança]]
- [[25 - Automações]]
- [[22 - Troubleshooting]]

## Aponta para (conteúdo real do repositório)

- `../docker-compose.yml`
- `../Iniciar_Servidor.bat`
- `../.github/workflows/ci.yml`

## Status

Esqueleto criado em 2026-07-19, diagnóstico de branch protection refeito no mesmo dia com
credencial real. Ver [[00 - Dashboard]].
