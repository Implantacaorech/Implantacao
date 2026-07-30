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

`.github/workflows/ci.yml` roda em push/PR para `main` com três jobs (atualizado em
2026-07-19, depois da virada para produção — ver [[18 - Histórico]]):

- `tools-smoke` — compileall + smoke dos geradores (`tools/verificar.py`, best-effort).
  Substituiu o antigo `test`/`test-postgres` (pytest do painel Flask), que ficaram sem
  objeto quando `webapp/test_painel.py` e o resto do Flask foram movidos para
  `projeto_old/` — pasta removida do repositório em 2026-07-29. `tools/` continua vivo
  (dependência da ponte `legado_cli`), por isso ainda tem smoke.
- `backend-test` — `npm ci` + `npm test -- --ci` (Jest) em `backend/`, mais lint
  best-effort. 44 suítes, 364 testes (validado no Actions real).
- `frontend-test` — `npm ci` + `npm test` (Vitest, via `@angular/build:unit-test` — não
  precisa de browser real) em `frontend/`. 27 arquivos, 111 testes (validado no Actions
  real).

Esses três nomes de job são os `contexts` a exigir quando a branch protection abaixo for
aplicada (a lista de `contexts` no exemplo de `PUT` abaixo já está atualizada).

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
  "required_status_checks": {"strict": false, "contexts": ["tools-smoke", "backend-test", "frontend-test"]},
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

## Banco e backup em produção (revisto em 2026-07-29)

- **MariaDB 12.2 é serviço NATIVO do Windows** (porta 3306, banco `painel_novo`) — **não há
  mais Docker nesta máquina**. O container `painel-db-mariadb` (porta 3307) que aparece na
  documentação antiga saiu de cena depois do incidente de 22/07 (`restart=no` derrubou o
  painel por ~13h). `docker-compose.yml`, que ainda descrevia o Postgres do Flask, está
  pendente de remoção.
- **O backup quebrou junto com a migração, em silêncio.**
  `tools/Painel_Novo_Backup_MariaDB.ps1` chamava `docker exec painel-db-mariadb mysqldump`;
  sem Docker o comando falhava, o `Out-File` criava um arquivo **vazio** e o `try/catch` não
  pegava nada (falha de executável nativo não vira exceção no PowerShell) — o log registrava
  `ok` com um `.sql` de 0 byte dentro do zip. **Janela da falha: 27, 28 e 29/07** (zips de 176
  bytes); o último dump bom é o de **23/07** (~1 MB), e 20/07 e 22/07 vencem na retenção em
  03/08 e 05/08. Corrigido: cliente local `mariadb-dump`,
  `--result-file` (sem o pipe da PS 5.1, que grava BOM) e **validação obrigatória** do dump
  (código de saída, ≥ 10 KB, rodapé `Dump completed`, presença de `CREATE TABLE`) antes de
  compactar; qualquer falha loga `ERRO` e sai com código 1.
- **Lição para qualquer script de operação:** validar o artefato produzido, não só o "deu
  certo" do comando. Um backup nunca verificado é um backup que não existe.
- **Guarda da stack obrigatória:** `backend/src/common/conformidade-stack.spec.ts` roda em
  `npm test` (logo, no job `backend-test`) e reprova driver de banco novo, Python fora das
  pastas declaradas e volta do Postgres ao config.
- **Migration é passo do deploy, não do boot** (2026-07-30): `migrationsRun` é `false`
  (`database.module.ts`), então subir o processo NÃO aplica migration. Enquanto isso ficou
  fora do script de build, o código de `preferencias` passou **um dia em produção sem a
  tabela `preferencias_usuario`** — e, como o frontend engole o erro de preferência, nada
  apareceu na tela nem no log. Desde então o `Build_Painel_Novo.bat` roda
  `npm run migration:run` como passo `[3/3]`, **depois** dos dois builds (build quebrado não
  encosta no banco) e **antes** do `Iniciar`, com o processo antigo ainda no ar — migration
  aditiva não atrapalha o código velho. Falha de migration aborta com código 1 e não imprime
  "BUILD CONCLUIDO". Sem `MIGRACAO_DB_URL` o passo é pulado com aviso, porque o TypeORM
  cairia no SQLite descartável de desenvolvimento e criaria schema em um banco que ninguém
  usa. Não fica no `Iniciar_Painel_Novo.bat` de propósito: é o script que o guardião executa
  a cada queda, e migration em toda recuperação atrasaria a volta do painel.
- **Falha silenciosa é a pior:** o caso acima só apareceu numa auditoria, não em uso. Quando
  o cliente do recurso engole o erro por bom motivo (preferência de tela não deve derrubar
  navegação), a checagem tem de vir do lado do deploy.

## Aponta para (conteúdo real do repositório)

- `../tools/Painel_Novo_Backup_MariaDB.ps1` (Tarefa Agendada `Painel Novo - Backup MariaDB`, 22h)
- `../Build_Painel_Novo.bat` (build de produção + `migration:run`; rodar antes do `Iniciar`)
- `../Iniciar_Painel_Novo.bat` (produção — o `Iniciar_Servidor.bat` do Flask saiu com `projeto_old/` em 2026-07-29)
- `../.github/workflows/ci.yml`

## Status

CI atualizado para refletir a virada (2026-07-19) — jobs do Flask legado removidos,
branch protection segue pendente. Ver [[00 - Dashboard]].
