# Testes ponta a ponta (Playwright) — Painel de Implantação

Testes de **interface real, em navegador real**, contra o Painel rodando. Complementam o
Jest do backend e o Vitest do frontend: aqui o que se prova é que **a tela e a API contam a
mesma história** — que o botão que a tela oferece o backend aceita, e que os gates dos 21
passos valem de ponta a ponta.

> ⚠️ **Nunca aponte para a porta 5100.** É o Painel em **produção**. Estes testes concluem
> passos, criam projetos e disparam e-mails. O `playwright.config.ts` recusa a 5100 no boot.
>
> 📘 **A documentação da suíte é [`docs/TESTES-INTEGRADOS.md`](../docs/TESTES-INTEGRADOS.md)**
> — escopo, mapa de superfícies com status de cobertura, a matriz `CT-###` → spec, as lacunas
> conhecidas e a **regra de atualização** (§9: toda implementação nova entra lá antes de ser
> considerada pronta). Este README é o *como rodar*; aquele documento é o *o quê e por quê*.
> O inventário bruto das 306 rotas e 89 telas está em
> [`docs/_inventario-superficies.md`](../docs/_inventario-superficies.md).

## No CI

Desde 2026-08-21 esta suíte roda **em todo pull request**, pelo workflow
[`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) — o job monta a stack inteira
(build do backend e do frontend, instância descartável na 5199, semeadura dos usuários) e
executa o Playwright em Chromium. `workflow_dispatch` continua disponível para rodar à mão.

Um caso aparece **pulado** lá, de propósito: o que **gera** o Projeto depende dos layouts
oficiais em `tools/templates/layouts/`, que são ignorados no git (binários com o timbre da
Rech, que não se publica). Em vez de falhar, ele pergunta à instância se o Cadastro de
Modelos tem o arquivo e se pula quando não tem — ver `apoio/insumo-local.ts`, gêmeo do
`seTiverInsumo` do backend. Na sua máquina, com os layouts presentes, ele roda inteiro.

## Como rodar

### 1. Suba a instância isolada (porta 5199)

Ela usa **SQLite descartável** e um `cwd` próprio — assim o `backend/dados/smtp.json` de
produção não é encontrado e **nenhum e-mail sai**.

```powershell
$Raiz = "C:\SEG-EVE\OneDrive - rech.com.br\PortalImplantacao\Implantacao"
$Base = "$env:TEMP\painel-e2e"

New-Item -ItemType Directory -Force -Path "$Base\dados", "$Base\protocolos" | Out-Null
# O backend resolve os insumos como `cwd/../tools` (layouts fiéis, indice_topicos.yaml,
# checklist_modulos.yaml). Com o cwd em $Base, isso é `$env:TEMP\tools` — o junction TEM de
# ficar aí. Enquanto ele ficava em "$Base\tools", o `seedDefaults()` não achava layout
# nenhum e QUALQUER geração de documento respondia 404 na instância isolada (corrigido em
# 2026-08-20, ao cobrir o passo 10 no e2e).
if (-not (Test-Path "$env:TEMP\tools")) { cmd /c mklink /J "$env:TEMP\tools" "$Raiz\tools" | Out-Null }
Set-Location $Base

# CRÍTICO: as variáveis de usuário do Windows apontam para o MariaDB e o HTTPS de PRODUÇÃO.
Remove-Item Env:MIGRACAO_DB_URL, Env:MIGRACAO_HTTPS_PFX, Env:MIGRACAO_HTTPS_PFX_SENHA -ErrorAction SilentlyContinue

$env:NODE_ENV = "development"
$env:MIGRACAO_PORT = "5199"
$env:MIGRACAO_DB_SQLITE = "$Base\dados\painel-teste.sqlite"
$env:MIGRACAO_JWT_SECRET = "teste-isolado-0000000000"
$env:MIGRACAO_JWT_REFRESH_SECRET = "teste-isolado-1111111111"
$env:MIGRACAO_FRONTEND_DIST = "$Raiz\frontend\dist\frontend\browser"
$env:MIGRACAO_PROTOCOLOS_DIR = "$Base\protocolos"
$env:MIGRACAO_RATE_LIMIT = "100000"

node "$Raiz\backend\dist\main.js"
```

Confirme que subiu **descartável** antes de qualquer coisa:

```powershell
(Invoke-RestMethod http://localhost:5199/api/health).data.db   # tem de responder: better-sqlite3
```

Se responder `mariadb`, **pare**: a variável de produção vazou para o processo.

Confirme também que os layouts foram semeados — sem eles, todo teste de geração de
documento falha com 404:

```powershell
Get-ChildItem "$env:TEMP\painel-e2e\dados\modelos_documento"   # tem de listar os 4 arquivos
```

Se a pasta estiver vazia, o junction de `tools` está no lugar errado. O seed só roda uma
vez: corrija o junction, apague `$env:TEMP\painel-e2e\dados\painel-teste.sqlite` e suba de
novo.

> ⚠️ Os comandos de seed do passo 2 NÃO limpam `MIGRACAO_DB_URL` sozinhos. Essa
> variável está no ambiente do Windows apontando para o **MariaDB de produção** — rode-os no
> mesmo shell em que você a removeu, ou prefixe com `env -u MIGRACAO_DB_URL`.

### 1b. Suba também o Portal API (porta 5198)

Desde 2026-08-26 a **administração** da API de Dados (catálogo, conexões, consultas e tokens)
existe **só** no Portal API — o Painel monta o `DadosModule` para executar, mas não os
controllers de `/admin`. Os casos de `08-api-dados.spec.ts` que administram apontam para a
5198; sem ela no ar eles **pulam** (com o motivo no relatório), em vez de falhar.

⚠️ **Nunca aponte para a 5110** — é o Portal API de produção, com a credencial real do
Oracle. O `apoio/portal-api.ts` recusa essa porta.

Noutra janela, com as MESMAS variáveis do passo 1 (o banco é o mesmo SQLite descartável):

```powershell
$env:MIGRACAO_DADOS_PORT = "5198"
node "$Raiz\backend\dist\main-dados.js"
```

Confirme que subiu como Portal API:

```powershell
(Invoke-RestMethod http://localhost:5198/api/instancia).data.perfil   # portal-api
```

### 2. Crie os usuários de teste

Um login por papel do processo, todos com a senha `Teste@123`:
`adm`, `comercial`, `administrativo`, `coordenador`, `gci`, `consultor`, `levantador`.

O `apoio/painel.ts` assume esses logins e os nomes `Gabriel GCI`, `Cesar Consultor` e
`Lucia Levantadora` nas designações.

### 3. Rode

```powershell
cd e2e
npm install          # só na primeira vez
npx playwright install chromium
npm test             # ou: npx playwright test --ui
```

Pela extensão **Playwright Test for VSCode**, os testes aparecem na aba de testes assim que
o `e2e/playwright.config.ts` é detectado — dá para rodar e depurar caso a caso.

## O que cada arquivo cobre

Desde 2026-09-02 todo caso tem um **`CT-###` estável** no início do título — o mesmo que
aparece na matriz da [Seção 4 de `docs/TESTES-INTEGRADOS.md`](../docs/TESTES-INTEGRADOS.md).
O ID **nunca é reaproveitado**: caso removido vira `CT-0NN — REMOVIDO` no histórico, e o
número não volta. Assim o relatório do Playwright e a documentação se conversam sem trabalho
manual, e um relatório antigo nunca aponta para o teste errado.

Cada caso carrega também uma **tag de prioridade** (no `test.describe`): `@p0` é o gate de
PR — autorização, login, gates dos 21 passos, fronteira Rech↔cliente; `@p1` é
funcionalidade com alternativa manual; `@p2` é apresentação e varredura ampla. Rode só o
gate com `npm run test:p0`.

| Arquivo | Cobre |
| --- | --- |
| `testes/01-acesso.spec.ts` | login, senha errada, rota protegida, deep link recarregado (fallback de SPA) |
| `testes/02-passos-integridade.spec.ts` | os 21 passos na tela, responsáveis, bloqueio com motivo, RN-1 (trilhas paralelas), RN-5 (conferência), RN-6 (definitivo), escape de HTML |
| `testes/03-comercial-passo-5.spec.ts` | o Comercial conclui o passo 5 (dele) e **não** ganha ação num passo alheio |
| `testes/04-permissoes-fluxo.spec.ts` | RN-10 pelos caminhos que **não** passam pelo `PassosController` (anexo, geração de documento, `PUT /projetos/:id`, `POST /fluxo/criar`), destinatários de e-mail, RN-4, homônimo e tamanho de corpo |
| `testes/07-projeto-heranca-etapa-10.spec.ts` | etapa 10 herdando a etapa 3: a tela abre preenchida, o GCI edita, gerar conclui o passo 10 e libera o 11; Cronograma Macro como campo de data; alinhamento dos campos; passo 11 sem "Abrir" |
| `testes/08-api-dados.spec.ts` | **API de Dados** (ADR-0003): 401 sem credencial, 404 fora do catálogo, 400 de parâmetro, 403 por menu e **por consulta** (a autorização do token é nome a nome), o catálogo sem SQL, o ciclo de vida da chave de máquina (exibida uma vez, revogada, rotacionada) — inclusive que uma chave **não** administra a API — a publicação de consulta pela TELA (só SELECT, teto obrigatório, bind × parâmetro, nome que não sequestra o catálogo de código), a configuração das conexões (que nunca devolve senha) e os tokens do lado consumidor (que nunca voltam em claro) |
| `testes/09-acesso-cliente-bi.spec.ts` | o papel **Cliente** (externo): cai direto no BI, só enxerga a própria fatia, não alcança rota interna nem a sessão de outro cliente; e a tela de Acesso de Clientes do ADM |
| `testes/10-permissoes-rbac.spec.ts` | o **painel de Permissões** manda no menu **e** na API: fechar o menu para um papel some com o item da tela e devolve 403; a exceção por usuário vence o papel e `herdar` a desfaz; papel/nível inventado é recusado; tela de Sistema continua fixa no ADM |
| `testes/11-superficies-publicas.spec.ts` | as **10 rotas que um anônimo alcança**: "esqueci minha senha" não denuncia se a conta existe, código errado não troca a senha, sondas públicas não vazam configuração, mídia de protocolo exige token assinado — e o **CT-120 varre o Swagger** e falha se um `GET` novo nascer sem guarda |
| `testes/12-presenca-online.spec.ts` | **Controle de acessos**: qualquer autenticado bate o ponto, mas **só o ADM vê a lista**; a unidade é a ABA (duas abas, um usuário); aba em segundo plano é ociosa; a tela `/usuarios/online` recusa quem não é ADM |
| `testes/13-controle-atividades.spec.ts` | **fronteira Rech ↔ cliente** do quadro por cliente: um cliente não alcança o quadro do outro, o cartão interno **nasce fechado** e o do cliente nasce compartilhado, o cliente não empurra cartão para o Bastidor Rech, e interno não designado **lê e não escreve** |
| `testes/90-auditoria-varredura.spec.ts` | varredura ampla: todas as rotas estáticas sem erro de console/HTTP, responsividade sem overflow horizontal, menu por perfil |

## De onde vieram estes testes

Cada caso do `03-` e do `04-` nasceu de um **defeito real**, encontrado e corrigido em
2026-08-05. São testes de regressão: se algum voltar a falhar, a brecha voltou.

- **Passo 5 inalcançável pelo Comercial** — a rota de concluir exigia `carteira/alteracao` e o
  Comercial tem nível `consulta`; o passo 5 não tem caminho automático, então o processo
  travava ali. A rota passou a exigir só `carteira`; quem decide é `podeExecutar` (RN-10),
  que é mais estrito.
- **RN-10 contornável** — anexar um arquivo com `tipo=termo`, gerar o documento (inclusive o
  modelo EM BRANCO), reescrever `gci` por `PUT /projetos/:id` ou criar projeto por
  `POST /fluxo/criar` fechavam passos sem gate de designação, alguns irreversíveis, em nome
  de "sistema". O gate agora está em `DocumentosService.registrarDocumento` e nas permissões
  das rotas.
- **Destinatário, data e homônimo** — dois GCIs no projeto e nenhum recebia o e-mail do passo
  8; `2026-13-45` fechava o passo 7; e dois usuários com o mesmo nome eram indistinguíveis
  para a designação.

O gate de **ordem** (dependências entre passos) sempre valeu em todos esses caminhos — o que
faltava era o de **autorização**.

## Preparo de estado

`apoio/painel.ts:projetoNoPasso()` leva um projeto novo até o passo desejado **pela API, com
token de ADM**. É preparo, não o que está sob teste: o que se exercita na tela é sempre o
passo em questão, com o usuário do papel certo.
