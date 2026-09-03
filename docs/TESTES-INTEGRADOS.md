# Testes Integrados — Painel de Implantação (Rech · SIGER®)

- **Versão do documento:** 1.0.1
- **Gerado em:** 2026-09-02
- **Gerado a partir de:** [`GERARTESTEINTEGRADOPLAYWRIGHT.md`](../GERARTESTEINTEGRADOPLAYWRIGHT.md)
- **Estado de referência:** `5dcb50f` (branch `feat/controle-acessos`)
- **Responsável pela manutenção:** time de implantação Rech — agentes de software `qualidade`
  e `seguranca-permissoes` (`.claude/agents/`)

> **O que este documento é.** A fonte da verdade sobre o que o teste integrado do Painel
> cobre, o que deliberadamente não cobre, e a regra que impede essa resposta de envelhecer.
> Os specs em [`e2e/testes/`](../e2e/testes/) são a implementação dele: divergência entre os
> dois é **bug de documentação**, não detalhe.
>
> **Como ele nasceu.** A suíte Playwright já existia desde 2026-08-05 — cada caso dos
> arquivos `03-` e `04-` nasceu de um defeito real de autorização. O que não existia era o
> documento, a numeração estável e o gate de perpetuidade. Esta versão 1.0.0 é a aplicação do
> gerador sobre a suíte existente: os 109 casos que já rodavam receberam `CT-001`..`CT-109`
> sem mudar uma linha de asserção, e 24 casos novos (`CT-110`..`CT-133`) fecharam os buracos
> P0 encontrados na varredura.

---

## 1. Escopo

**O que a suíte cobre.** O Painel de Implantação rodando de verdade — NestJS servindo o build
do Angular num processo só — navegado por um Chromium real. O que se prova aqui é que **a
tela e a API contam a mesma história**: que o botão que a interface oferece o backend aceita,
que o botão que ela esconde o backend também recusa, e que os gates dos 21 passos valem em
todos os caminhos, inclusive nos que não passam pelo `PassosController`.

O eixo central é **autorização**. Não por gosto, mas por histórico: os defeitos que este
projeto de fato teve não foram telas quebradas — foram caminhos alternativos que fechavam
passo sem gate (anexar documento com `tipo=termo`, gerar o modelo em branco, reescrever `gci`
por `PUT /projetos/:id`). Erro assim **não dá erro**: dá acesso indevido, calado. É o que a
suíte existe para pegar.

**O que ela deliberadamente NÃO cobre, e por quê:**

| Fora do escopo | Por quê |
| --- | --- |
| Envio real de e-mail | A instância isolada roda com `cwd` fora de `backend/`, então o `smtp.json` **não é encontrado** e nenhuma mensagem sai. O que se testa é o **destinatário e o corpo montados**, não a entrega. |
| Consulta a banco EXTERNO (Oracle SICLA, MySQL Portal Rech) | Sem credencial na 5199, por decisão. O que se testa é a **degradação**: a tela avisa e a API responde 503, em vez de quebrar (ADR-0003). |
| Geração fiel de documento pelo layout oficial | Os layouts (`tools/templates/layouts/`) são binários com o timbre da Rech e **não vão para o git**. O único caso que gera documento (CT-048) **pergunta à instância** se ela os tem e se pula quando não tem — ver [`e2e/apoio/insumo-local.ts`](../e2e/apoio/insumo-local.ts). Na máquina de quem desenvolve, roda inteiro. |
| Os 4 robôs de fundo | São **pulados quando `NODE_ENV=test`** (`robo-digest`, `robo-caixa`, `robo-protocolos`, `robo-prazos-atividades`), então não existem na instância sob teste. A cobertura deles é unitária (Jest). |
| `docservice/` (Python) | Nunca exposto publicamente e não sobe junto. Transcrição e geração fiel ficam com os testes do próprio serviço. |
| Unidade e integração de backend/frontend | Já cobertas por `backend/npm test` (Jest) e `frontend/npm test` (Vitest). Esta suíte não as duplica. |

**Nunca contra produção.** A porta **5100** é o Painel em produção e estes testes concluem
passos, criam projetos e disparam e-mail. O `playwright.config.ts` **recusa a 5100 no boot**,
e o CT-053 confirma, a cada execução, que o banco embaixo é `better-sqlite3` — não o MariaDB.

---

## 2. Ambiente sob teste

| Item | Valor |
| --- | --- |
| Comando para subir a aplicação | `node backend/dist/main.js` com `cwd` em `%TEMP%\painel-e2e` (ver [`e2e/README.md`](../e2e/README.md)) |
| URL base | `http://localhost:5199` (`PAINEL_E2E_URL`) |
| Instância auxiliar | Portal API em `http://localhost:5198` (`node backend/dist/main-dados.js`) — sem ela, os casos de **administração** da API de Dados **pulam** com o motivo no relatório |
| Banco de teste | SQLite descartável em `%TEMP%\painel-e2e\dados\painel-teste.sqlite` |
| Variáveis obrigatórias | `MIGRACAO_PORT=5199`, `MIGRACAO_DB_SQLITE`, `MIGRACAO_JWT_SECRET`, `MIGRACAO_JWT_REFRESH_SECRET`, `MIGRACAO_FRONTEND_DIST`, `MIGRACAO_PROTOCOLOS_DIR`, `MIGRACAO_RATE_LIMIT=100000` |
| Variáveis que precisam ser **removidas** | `MIGRACAO_DB_URL`, `MIGRACAO_HTTPS_PFX`, `MIGRACAO_HTTPS_PFX_SENHA` — são variáveis de **usuário do Windows** e apontam para **produção** |
| Serviços externos indisponíveis (por decisão) | SMTP, Microsoft Graph, IMAP, Oracle SICLA, MySQL Portal Rech, docservice, LLM, Trello |
| Usuários de teste | um login por papel, senha `Teste@123`, semeados por [`e2e/apoio/semear-usuarios.mjs`](../e2e/apoio/semear-usuarios.mjs) |
| Credenciais no repositório | nenhuma. A senha da instância descartável é literal **de propósito** — é o valor que o CT-053 usa para provar que não é produção. |

### Primeira execução, passo a passo

Pré-requisitos: Node 24, `backend/dist` e `frontend/dist` construídos, e o junction
`%TEMP%\tools` apontando para `tools/` do repositório (o backend resolve os insumos como
`cwd/../tools`).

```powershell
# 1. build (uma vez)
cd backend  ; npm ci ; npm run build
cd ..\frontend ; npm ci ; npm run build

# 2. instância isolada — o passo a passo completo, com as guardas, está em e2e/README.md
#    Confirme ANTES de qualquer coisa:
(Invoke-RestMethod http://localhost:5199/api/health).data.db      # better-sqlite3
(Invoke-RestMethod http://localhost:5198/api/instancia).data.perfil  # portal-api

# 3. usuários
node e2e/apoio/semear-usuarios.mjs

# 4. rodar
cd e2e ; npm ci ; npx playwright install chromium ; npm test
```

> ⚠️ Os comandos de seed **não** limpam `MIGRACAO_DB_URL` sozinhos. Rode-os no mesmo shell em
> que a variável foi removida, ou prefixe com `env -u MIGRACAO_DB_URL`.

---

## 3. Mapa de superfícies

A varredura da Fase 1 encontrou, no estado de referência:

| Tipo | Quantidade | Onde |
| --- | ---: | --- |
| Rotas de API (NestJS) | **306** | `backend/src/**/*.controller.ts` |
| Telas (Angular) | **89** | `frontend/src/app/app.routes.ts` |
| Rotas **públicas** (sem `JwtAuthGuard`) | **10** | ver §3.3 |
| Robôs de fundo | 4 | pulados em teste |
| Integrações externas | 12 | indisponíveis na 5199, por decisão |

A tabela **rota a rota**, com origem `arquivo:linha` e a guarda de cada uma, está em
[`_inventario-superficies.md`](_inventario-superficies.md) — é o entregável bruto da Fase 1 e
tem as 306 linhas. Aqui fica o que interessa para decidir: **o status de cobertura**.

### 3.1 Como a cobertura abaixo foi medida

Não por varredura dos specs — essa subestima, porque não enxerga o que passa por helper, por
URL montada em variável ou por navegação da SPA. A medida é do **próprio servidor**: o
`MetricasInterceptor` do backend agrega chamadas por **template de rota**
(`GET /projetos/:id`), e a suíte roda contra uma instância recém-subida, com as métricas
zeradas. O que aparece com `chamadas > 0` foi, de fato, exercitado.

Reproduzir:

```powershell
# instância recém-subida (métricas zeradas) → suíte inteira → o que foi tocado
cd e2e ; npm test
$t = (Invoke-RestMethod http://localhost:5199/api/auth/login -Method Post `
      -ContentType application/json `
      -Body '{"login":"adm","senha":"Teste@123"}').data.accessToken
(Invoke-RestMethod http://localhost:5199/api/saude/metricas `
  -Headers @{Authorization="Bearer $t"}).data | Sort-Object rota
```

### 3.2 Cobertura por módulo

| Módulo (backend) | Rotas | Exercitadas | Status | Observação |
| --- | ---: | ---: | --- | --- |
| `projetos` | 5 | 5 | **coberta** | CRUD completo asserido (CT-036..039) + gates RN-10 |
| `permissoes` | 4 | 4 | **coberta** | matriz, exceção por usuário e gates asseridos (CT-110..114) |
| `presenca` | 4 | 4 | **coberta** | ciclo e gates asseridos (CT-121..126) |
| `preferencias` | 3 | 3 | **coberta** | ciclo completo asserido (CT-043) |
| `agenda` | 2 | 2 | **coberta** | alcançada só pela varredura CT-105 (a tela abre e degrada sem SICLA); regra não asserida — P2 |
| `bi-agenda-alocacao` | 2 | 2 | **coberta** | idem `agenda` — alcançada pela varredura, sem asserção de regra |
| `disponibilidade` | 2 | 2 | **coberta** | idem — base externa indisponível na 5199 |
| `health` | 2 | 2 | **coberta** | CT-053 e CT-117 — inclusive a prova de que não é produção |
| `bi-indicadores` | 1 | 1 | **coberta** | idem — alcançada pela varredura; o BI depende do SICLA |
| `bi-movimentos` | 1 | 1 | **coberta** | idem |
| `ia-telemetria` | 1 | 1 | **coberta** | alcançada pela varredura CT-105; leitura |
| `bi-implantacao` | 8 | 7 | parcial | recorte por cliente coberto (CT-093/094); as demais dependem do SICLA |
| `painel` | 6 | 5 | parcial | alcançada pela varredura; Visão Geral/Coordenação/Centro Operacional sem asserção de regra — P1 |
| `ia` | 3 | 2 | parcial | alcançada pela varredura; depende de chave de LLM, não configurada na 5199 — P2 |
| `users` | 5 | 3 | parcial | CRUD e homônimo asseridos (CT-028, CT-040/041); falta GET/DELETE por id |
| `passos` | 21 | 12 | parcial | o coração do processo; o que falta são variações de leitura |
| `email` | 10 | 5 | parcial | envio real desligado na 5199 de propósito (sem `smtp.json`) |
| `agentes` | 4 | 2 | parcial | alcançada pela varredura CT-105; telemetria de IA, leitura — P2 |
| `rns` | 2 | 1 | parcial | gate de menu asserido (CT-110); a consulta em si depende do SICLA |
| `saude` | 2 | 1 | parcial | instrumento de medição desta seção; `/saude/metricas` alcançada pela varredura |
| `levantamento` | 9 | 4 | parcial | etapa 3 é preenchida pela API no preparo do CT-047/048, não exercitada por si — P1 |
| `auth` | 7 | 3 | parcial | o que falta é refresh/logout — cobertos indiretamente por toda a suíte |
| `documentos` | 10 | 4 | parcial | geração coberta por CT-018/019/048; anexos e listagem — P1 |
| `fluxo` | 8 | 3 | parcial | criação por `POST /fluxo/criar` coberta (CT-022); IMAP desligado em teste |
| `plano-cronograma` | 6 | 2 | parcial | módulo de REFERÊNCIA da arquitetura e ainda sem e2e próprio — P1 |
| `contatos-sicla` | 3 | 1 | parcial | alcançada pela varredura; degradação sem SICLA coberta por CT-104 |
| `matriz-detalhada` | 3 | 1 | parcial | alcançada pela varredura; regra não asserida — P2 |
| `cronograma` | 26 | 8 | parcial | maior lacuna: 26 rotas do cronograma do projeto sem caso — P1, ver Seção 12 |
| `matriz` | 4 | 1 | parcial | alcançada pela varredura; Matriz de Conhecimento — P2 |
| `matriz-funcoes` | 4 | 1 | parcial | alcançada pela varredura — P2 |
| `controle-atividades` | 34 | 8 | parcial | fronteira Rech↔cliente coberta (CT-127..133); checklist, anexos, comentários e Trello — P1 |
| `catalogos` | 14 | 3 | parcial | Cadastro de Modelos exercitado pelo `insumo-local`; checklist/índice — P1 |
| `designacao` | 6 | 1 | parcial | coberta indiretamente pelo gate RN-10 (CT-017..023); rotas próprias sem caso — P1 |
| `dados` | 33 | 4 | parcial | a ADMINISTRAÇÃO mora no Portal API (5198), que tem métricas próprias — ver nota |
| `protocolos` | 25 | 2 | parcial | transcrição áudio/vídeo depende do docservice, que não sobe na 5199 — P1 |
| `legado` | 11 | 0 | não coberta | ponte de subprocesso para `webapp/legado_cli.py`; exige Python + tools/ — P2 |
| `automacao` | 3 | 0 | não coberta | P2 |
| `cadastro` | 3 | 0 | não coberta | auto-cadastro sem porta no login desde 2026-07-30; P2 |
| `rechedu` | 3 | 0 | não coberta | moldura de portal externo — P2 |
| `clientes-sicla` | 2 | 0 | não coberta | idem |
| `tecnicos-sicla` | 2 | 0 | não coberta | idem |
| `modulos-sicla` | 1 | 0 | não coberta | idem |
| `prontidao` | 1 | 0 | não coberta | tela de leitura da auditoria dos 9 eixos — P2 |

**Total: 111/306 rotas de API exercitadas** por pelo menos um caso.
> **Leia "exercitada" com precisão.** A coluna diz que a rota foi **alcançada** por pelo menos
> um caso — não que a regra dela foi asserida. Boa parte das rotas de leitura chega ali pelo
> **CT-105**, a varredura que abre todas as telas com login de ADM e exige ausência de erro de
> console e de HTTP. Isso é cobertura real e útil (prova que a tela abre, que a rota responde e
> que nada quebra no console), mas é **mais rasa** do que um caso dedicado. A coluna
> *Observação* diz, módulo a módulo, qual dos dois se tem — e a Seção 12 lista o que falta.

> **Nota sobre `dados` (API de Dados).** Desde 2026-08-26 a **administração** do catálogo
> (conexões, consultas, chaves de máquina) existe só no **Portal API**, na 5198 — uma
> instância à parte, com métricas próprias. Os 30 casos de
> [`08-api-dados.spec.ts`](../e2e/testes/08-api-dados.spec.ts) exercitam essas rotas lá, e por
> isso elas **não aparecem** na contagem acima, que mede a instância do Painel. A cobertura
> real da fronteira de dados é bem maior do que o número desta linha sugere.

### 3.3 Superfícies públicas — a lista que não pode crescer sozinha

Dez rotas respondem **sem `Authorization`**. É a lista mais sensível do inventário, e ela
tem dono no teste: a constante `PUBLICAS` de
[`11-superficies-publicas.spec.ts`](../e2e/testes/11-superficies-publicas.spec.ts). O
**CT-120** varre o Swagger da instância, chama cada `GET` servido e falha se algum responder
sem credencial estando fora dessa lista. Rota nova que nasça sem guarda é pega ali, no PR —
não em produção.

| Método | Rota | Por que é pública | Coberta por |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | porta de entrada | CT-001..003 |
| POST | `/api/auth/refresh` | rotação do refresh token | uso implícito de toda a suíte |
| POST | `/api/auth/esqueci-senha` | quem esqueceu a senha não tem sessão | **CT-115** |
| POST | `/api/auth/redefinir-senha` | idem | **CT-116** |
| POST | `/api/cadastro` | auto-cadastro (sem porta no login desde 2026-07-30) | CT-120 |
| POST | `/api/cadastro/confirmar` | confirmação por e-mail | CT-120 |
| POST | `/api/cadastro/reenviar` | reenvio do código | CT-120 |
| GET | `/api/health` | sonda do guardião | **CT-053**, CT-117 |
| GET | `/api/instancia` | decide o menu antes de haver login | **CT-117** |
| GET | `/api/protocolos/:id/video` | mídia por token assinado na URL (o token de sessão nunca vai para a URL, que entra em log de servidor) | **CT-118** |

### 3.4 Telas

Das **89** telas do `app.routes.ts`, o **CT-105** percorre todas as estáticas com login de
ADM, exigindo ausência de erro de console e de HTTP; o **CT-106** faz o mesmo com as rotas de
um projeto real. Telas com recorte de perfil têm caso próprio: `/usuarios/online` (CT-125),
`/acesso-clientes` (CT-100..104), a área BI do cliente (CT-084..089) e o menu por papel
(CT-109). O detalhe por rota está no [inventário](_inventario-superficies.md#2-telas-frontendsrcappapproutests).

---

## 4. Matriz de cobertura

Os **133 casos** declarados (**140** em execução — dois deles são parametrizados: CT-108 roda
em 3 viewports e CT-109 em 6 logins). Distribuição: **105 P0**, **23 P1**, **5 P2**.

A coluna *Superfícies* é colhida do corpo do caso e dos helpers que ele chama; quando aparece
`_só interface_`, o caso navega e assere na tela sem montar chamada de API própria.

| ID | Jornada / caso | Prio | Superfícies | Spec | Estado |
| --- | --- | --- | --- | --- | --- |
| CT-001 | login válido entra e sai da tela de login | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +3 | [01-acesso.spec.ts:5](../e2e/testes/01-acesso.spec.ts#L5) | ativo |
| CT-002 | senha errada não entra e mostra o erro na tela | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/login` +3 | [01-acesso.spec.ts:10](../e2e/testes/01-acesso.spec.ts#L10) | ativo |
| CT-003 | usuário inexistente não entra | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/login` +3 | [01-acesso.spec.ts:16](../e2e/testes/01-acesso.spec.ts#L16) | ativo |
| CT-004 | rota protegida sem login cai no login | P0 | `/projetos/1/passos` | [01-acesso.spec.ts:21](../e2e/testes/01-acesso.spec.ts#L21) | ativo |
| CT-005 | deep link recarregado continua funcionando (fallback de SPA) | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/projetos` +3 | [01-acesso.spec.ts:26](../e2e/testes/01-acesso.spec.ts#L26) | ativo |
| CT-006 | mostra os 21 passos, na ordem, com o responsável de cada um | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/projetos/:id/passos` +3 | [02-passos-integridade.spec.ts:6](../e2e/testes/02-passos-integridade.spec.ts#L6) | ativo |
| CT-007 | passo bloqueado tem o botão desabilitado e explica o porquê | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/projetos/:id/passos` +3 | [02-passos-integridade.spec.ts:31](../e2e/testes/02-passos-integridade.spec.ts#L31) | ativo |
| CT-008 | RN-1: concluído o passo 8, o cronograma (13) libera sem esperar o Projeto | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/projetos/:id/passos` +3 | [02-passos-integridade.spec.ts:43](../e2e/testes/02-passos-integridade.spec.ts#L43) | ativo |
| CT-009 | RN-6: passo definitivo não oferece "Reabrir"; reversível oferece | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/projetos/:id/passos` +3 | [02-passos-integridade.spec.ts:57](../e2e/testes/02-passos-integridade.spec.ts#L57) | ativo |
| CT-010 | RN-5: "Marcar conferido" não aparece antes de o passo 11 ser concluído | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/projetos/:id/passos` +3 | [02-passos-integridade.spec.ts:71](../e2e/testes/02-passos-integridade.spec.ts#L71) | ativo |
| CT-011 | RN-5: concluído o 11, a tela oferece "Marcar conferido" — e só nele | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/projetos/:id/passos` +3 | [02-passos-integridade.spec.ts:87](../e2e/testes/02-passos-integridade.spec.ts#L87) | ativo |
| CT-012 | nome de cliente com <script> é escapado, não executado | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/projetos/:id/passos` +3 | [02-passos-integridade.spec.ts:104](../e2e/testes/02-passos-integridade.spec.ts#L104) | ativo |
| CT-013 | a API aceita a conclusão do passo 5 pelo Comercial | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +4 | [03-comercial-passo-5.spec.ts:18](../e2e/testes/03-comercial-passo-5.spec.ts#L18) | ativo |
| CT-014 | a tela oferece ao Comercial a ação do passo 5 | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/projetos/:id/passos` +3 | [03-comercial-passo-5.spec.ts:29](../e2e/testes/03-comercial-passo-5.spec.ts#L29) | ativo |
| CT-015 | quem só consulta NÃO ganha ação num passo que não é seu | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/projetos/:id/passos` +3 | [03-comercial-passo-5.spec.ts:42](../e2e/testes/03-comercial-passo-5.spec.ts#L42) | ativo |
| CT-016 | coerência: "liberado" e a conclusão contam a mesma história | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +5 | [03-comercial-passo-5.spec.ts:55](../e2e/testes/03-comercial-passo-5.spec.ts#L55) | ativo |
| CT-017 | anexar documento com tipo="termo" não pode concluir o passo 18 | P0 | `/api/auth/login`, `/api/fluxo/criar`, `/api/projetos` +8 | [04-permissoes-fluxo.spec.ts:26](../e2e/testes/04-permissoes-fluxo.spec.ts#L26) | ativo |
| CT-018 | gerar o Termo não pode fechar o passo 18 de quem não é o consultor designado | P0 | `/api/auth/login`, `/api/fluxo/criar`, `/api/projetos` +8 | [04-permissoes-fluxo.spec.ts:41](../e2e/testes/04-permissoes-fluxo.spec.ts#L41) | ativo |
| CT-019 | baixar o Termo EM BRANCO (modo=modelo) não pode concluir o passo 18 | P0 | `/api/auth/login`, `/api/fluxo/criar`, `/api/projetos` +8 | [04-permissoes-fluxo.spec.ts:51](../e2e/testes/04-permissoes-fluxo.spec.ts#L51) | ativo |
| CT-020 | PUT /projetos/:id não pode deixar alguém se autodesignar GCI e concluir o passo 10 | P0 | `/api/auth/login`, `/api/fluxo/criar`, `/api/projetos` +8 | [04-permissoes-fluxo.spec.ts:61](../e2e/testes/04-permissoes-fluxo.spec.ts#L61) | ativo |
| CT-021 | quem só tem CONSULTA na carteira não pode reescrever a ficha | P0 | `/api/auth/login`, `/api/fluxo/criar`, `/api/projetos` +8 | [04-permissoes-fluxo.spec.ts:76](../e2e/testes/04-permissoes-fluxo.spec.ts#L76) | ativo |
| CT-022 | POST /fluxo/criar não pode concluir o passo 1 para quem não cadastra cliente | P0 | `/api/auth/login`, `/api/fluxo/criar`, `/api/projetos` +8 | [04-permissoes-fluxo.spec.ts:87](../e2e/testes/04-permissoes-fluxo.spec.ts#L87) | ativo |
| CT-023 | o gate de ORDEM continua valendo na auto-conclusão | P0 | `/api/auth/login`, `/api/fluxo/criar`, `/api/projetos` +8 | [04-permissoes-fluxo.spec.ts:96](../e2e/testes/04-permissoes-fluxo.spec.ts#L96) | ativo |
| CT-024 | com UM GCI, o e-mail do passo 8 chega ao GCI | P1 | `/api/auth/login`, `/api/fluxo/criar`, `/api/projetos` +9 | [04-permissoes-fluxo.spec.ts:108](../e2e/testes/04-permissoes-fluxo.spec.ts#L108) | ativo |
| CT-025 | com DOIS GCIs, o e-mail do passo 8 ainda tem de chegar a um GCI | P1 | `/api/auth/login`, `/api/fluxo/criar`, `/api/projetos` +9 | [04-permissoes-fluxo.spec.ts:116](../e2e/testes/04-permissoes-fluxo.spec.ts#L116) | ativo |
| CT-026 | data inexistente (2026-13-45) não pode fechar o passo 7 | P0 | `/api/auth/login`, `/api/fluxo/criar`, `/api/projetos` +9 | [04-permissoes-fluxo.spec.ts:147](../e2e/testes/04-permissoes-fluxo.spec.ts#L147) | ativo |
| CT-027 | data de assinatura no futuro não pode fechar o passo 7 | P0 | `/api/auth/login`, `/api/fluxo/criar`, `/api/projetos` +9 | [04-permissoes-fluxo.spec.ts:156](../e2e/testes/04-permissoes-fluxo.spec.ts#L156) | ativo |
| CT-028 | recusa um segundo usuário ativo com o mesmo nome | P1 | `/api/auth/login`, `/api/fluxo/criar`, `/api/projetos` +9 | [04-permissoes-fluxo.spec.ts:167](../e2e/testes/04-permissoes-fluxo.spec.ts#L167) | ativo |
| CT-029 | corpo acima do limite responde 413, não um 404 dizendo que a rota não existe | P1 | `/api/auth/login`, `/api/fluxo/criar`, `/api/projetos` +8 | [04-permissoes-fluxo.spec.ts:182](../e2e/testes/04-permissoes-fluxo.spec.ts#L182) | ativo |
| CT-030 | a prévia remontada já contém o que foi escrito | P1 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +6 | [05-emails-e-designacao.spec.ts:17](../e2e/testes/05-emails-e-designacao.spec.ts#L17) | ativo |
| CT-031 | o e-mail registrado carrega a descrição, tendo sido redigido ou não | P1 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +6 | [05-emails-e-designacao.spec.ts:31](../e2e/testes/05-emails-e-designacao.spec.ts#L31) | ativo |
| CT-032 | nenhum token do seletor de modelos sai literal no e-mail do passo | P1 | `/api/auth/login`, `/api/config/modelos-email`, `/api/config/modelos-email/:id` +9 | [05-emails-e-designacao.spec.ts:72](../e2e/testes/05-emails-e-designacao.spec.ts#L72) | ativo |
| CT-033 | a macro-etapa nunca regride enquanto os 21 passos avançam | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +7 | [05-emails-e-designacao.spec.ts:122](../e2e/testes/05-emails-e-designacao.spec.ts#L122) | ativo |
| CT-034 | Administrativo salvando a equipe NÃO conclui o passo 8 | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +7 | [05-emails-e-designacao.spec.ts:182](../e2e/testes/05-emails-e-designacao.spec.ts#L182) | ativo |
| CT-035 | Coordenador salvando a equipe conclui o passo 8 | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +7 | [05-emails-e-designacao.spec.ts:192](../e2e/testes/05-emails-e-designacao.spec.ts#L192) | ativo |
| CT-036 | ciclo completo: cria, lê, lista, busca, edita e exclui | P1 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +4 | [06-crud.spec.ts:30](../e2e/testes/06-crud.spec.ts#L30) | ativo |
| CT-037 | acentuação e símbolos sobrevivem à ida e volta | P1 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +4 | [06-crud.spec.ts:61](../e2e/testes/06-crud.spec.ts#L61) | ativo |
| CT-038 | validação do CREATE recusa o que não deve entrar | P1 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +4 | [06-crud.spec.ts:70](../e2e/testes/06-crud.spec.ts#L70) | ativo |
| CT-039 | id inválido não vira 500 nem registro fantasma | P1 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +4 | [06-crud.spec.ts:84](../e2e/testes/06-crud.spec.ts#L84) | ativo |
| CT-040 | cria, lista sem vazar senha, edita sem apagar o resto | P1 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +6 | [06-crud.spec.ts:94](../e2e/testes/06-crud.spec.ts#L94) | ativo |
| CT-041 | recusa duplicidade e dado inválido | P1 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +5 | [06-crud.spec.ts:115](../e2e/testes/06-crud.spec.ts#L115) | ativo |
| CT-042 | ciclo completo e validação | P1 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +6 | [06-crud.spec.ts:138](../e2e/testes/06-crud.spec.ts#L138) | ativo |
| CT-043 | grava, lê, não vaza para outro usuário e apaga | P1 | `/api/auth/login`, `/api/preferencias`, `/api/preferencias/crud-e2e` +6 | [06-crud.spec.ts:166](../e2e/testes/06-crud.spec.ts#L166) | ativo |
| CT-044 | edita, alterna ativo e o inativo continua visível na tela de administração | P1 | `/api/auth/login`, `/api/config/modelos-email`, `/api/config/modelos-email/99999` +8 | [06-crud.spec.ts:181](../e2e/testes/06-crud.spec.ts#L181) | ativo |
| CT-045 | id inexistente devolve 404, e não-ADM é recusado | P1 | `/api/auth/login`, `/api/config/modelos-email/1`, `/api/config/modelos-email/99999` +6 | [06-crud.spec.ts:204](../e2e/testes/06-crud.spec.ts#L204) | ativo |
| CT-046 | o passo 10 abre a tela de EDIÇÃO, não a geração direta | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/projetos/:id/passos` +3 | [07-projeto-heranca-etapa-10.spec.ts:44](../e2e/testes/07-projeto-heranca-etapa-10.spec.ts#L44) | ativo |
| CT-047 | a tela do passo 10 abre com os dados da etapa 3 e o GCI edita antes de gerar | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/projetos/:id/editar/projeto`, `/projetos/:id/passos` +4 | [07-projeto-heranca-etapa-10.spec.ts:60](../e2e/testes/07-projeto-heranca-etapa-10.spec.ts#L60) | ativo |
| CT-048 | gerar pela tela de edição conclui o passo 10 e libera o 11 | P0 | `/api/auth/login`, `/api/cadastros/modelos`, `/api/cadastros/modelos/:id/baixar`, `/projetos/:id/editar/projeto`, `/projetos/:id/passos` +6 | [07-projeto-heranca-etapa-10.spec.ts:106](../e2e/testes/07-projeto-heranca-etapa-10.spec.ts#L106) | ativo |
| CT-049 | o Levantador vê o botão do passo 10 e a tela o aceita (o botão não promete o que a tela recusa) | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/projetos/:id/editar/projeto` +3 | [07-projeto-heranca-etapa-10.spec.ts:150](../e2e/testes/07-projeto-heranca-etapa-10.spec.ts#L150) | ativo |
| CT-050 | o Cronograma Macro é preenchido por seletor de data, não texto livre | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/projetos/:id/editar/projeto` +3 | [07-projeto-heranca-etapa-10.spec.ts:163](../e2e/testes/07-projeto-heranca-etapa-10.spec.ts#L163) | ativo |
| CT-052 | o passo 11 não oferece mais o botão Abrir | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/projetos/:id/passos` +3 | [07-projeto-heranca-etapa-10.spec.ts:187](../e2e/testes/07-projeto-heranca-etapa-10.spec.ts#L187) | ativo |
| CT-051 | o rótulo somente-leitura não desalinha o campo vizinho na mesma linha | P2 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/projetos/:id/editar/projeto` +3 | [07-projeto-heranca-etapa-10.spec.ts:209](../e2e/testes/07-projeto-heranca-etapa-10.spec.ts#L209) | ativo |
| CT-053 | sanidade: a suíte está na instância descartável, não em produção | P0 | `/api/health` | [07-projeto-heranca-etapa-10.spec.ts:232](../e2e/testes/07-projeto-heranca-etapa-10.spec.ts#L232) | ativo |
| CT-054 | sem credencial nenhuma: 401 no catálogo e na execução | P0 | `/api/dados/v1/consultas`, `/api/dados/v1/consultas/sicla.rns.listar/executar` | [08-api-dados.spec.ts:80](../e2e/testes/08-api-dados.spec.ts#L80) | ativo |
| CT-055 | o catálogo NUNCA devolve o SQL | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/consultas` +6 | [08-api-dados.spec.ts:91](../e2e/testes/08-api-dados.spec.ts#L91) | ativo |
| CT-056 | consulta fora do catálogo: 404, não 500 | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/consultas/nao.existe.aqui/executar` +6 | [08-api-dados.spec.ts:109](../e2e/testes/08-api-dados.spec.ts#L109) | ativo |
| CT-057 | parâmetro inválido: 400 — e o banco nem é procurado | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/consultas/sicla.rns.listar/executar` +6 | [08-api-dados.spec.ts:119](../e2e/testes/08-api-dados.spec.ts#L119) | ativo |
| CT-058 | parâmetro que não existe no contrato é recusado | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/consultas/sicla.rns.listar/executar` +6 | [08-api-dados.spec.ts:130](../e2e/testes/08-api-dados.spec.ts#L130) | ativo |
| CT-059 | SQL, conexão e limite no corpo são ignorados — não há atalho | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/consultas/sicla.rns.listar/executar` +6 | [08-api-dados.spec.ts:140](../e2e/testes/08-api-dados.spec.ts#L140) | ativo |
| CT-060 | requisição legítima chega até a conexão e para em 503 (nada cadastrado aqui) | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/consultas/sicla.rns.listar/executar` +6 | [08-api-dados.spec.ts:158](../e2e/testes/08-api-dados.spec.ts#L158) | ativo |
| CT-061 | quem não enxerga a tela não consulta o dado por baixo dela | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/consultas/sicla.rns.listar/executar` +6 | [08-api-dados.spec.ts:172](../e2e/testes/08-api-dados.spec.ts#L172) | ativo |
| CT-062 | só ADM administra: os demais perfis levam 403 | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/admin/clientes` +6 | [08-api-dados.spec.ts:192](../e2e/testes/08-api-dados.spec.ts#L192) | ativo |
| CT-063 | uma chave de máquina NÃO administra a API (não emite outra chave) | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/admin/clientes` +1 | [08-api-dados.spec.ts:203](../e2e/testes/08-api-dados.spec.ts#L203) | ativo |
| CT-064 | a chave é exibida uma vez e nunca volta na listagem | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/admin/clientes` +6 | [08-api-dados.spec.ts:223](../e2e/testes/08-api-dados.spec.ts#L223) | ativo |
| CT-065 | chave válida entra; chave inventada, alterada ou revogada não | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/admin/clientes/:id/ativo` +7 | [08-api-dados.spec.ts:233](../e2e/testes/08-api-dados.spec.ts#L233) | ativo |
| CT-066 | rotacionar mata a chave anterior imediatamente | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/admin/clientes/:id/rotacionar` +7 | [08-api-dados.spec.ts:260](../e2e/testes/08-api-dados.spec.ts#L260) | ativo |
| CT-067 | o token é um teto POR CONSULTA: fora da lista, 403 — e o catálogo vem recortado | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/consultas` +2 | [08-api-dados.spec.ts:278](../e2e/testes/08-api-dados.spec.ts#L278) | ativo |
| CT-068 | uma consulta da MESMA conexão, não autorizada, também dá 403 | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/consultas/sicla.bi.extrato-horas/executar` +2 | [08-api-dados.spec.ts:304](../e2e/testes/08-api-dados.spec.ts#L304) | ativo |
| CT-069 | consulta inexistente não é cadastrável num token | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/admin/clientes` +6 | [08-api-dados.spec.ts:324](../e2e/testes/08-api-dados.spec.ts#L324) | ativo |
| CT-070 | só ADM administra consultas — nem usuário comum, nem chave de máquina | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/tokens` +5 | [08-api-dados.spec.ts:363](../e2e/testes/08-api-dados.spec.ts#L363) | ativo |
| CT-071 | não publica nada que não seja SELECT | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/tokens` +5 | [08-api-dados.spec.ts:379](../e2e/testes/08-api-dados.spec.ts#L379) | ativo |
| CT-072 | publicar sem teto de linhas é recusado | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/tokens` +5 | [08-api-dados.spec.ts:390](../e2e/testes/08-api-dados.spec.ts#L390) | ativo |
| CT-073 | bind sem parâmetro declarado é recusado na publicação | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/tokens` +5 | [08-api-dados.spec.ts:400](../e2e/testes/08-api-dados.spec.ts#L400) | ativo |
| CT-074 | a tela não sequestra um nome do catálogo de código | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/tokens` +5 | [08-api-dados.spec.ts:417](../e2e/testes/08-api-dados.spec.ts#L417) | ativo |
| CT-075 | rascunho salva, entra na lista e NÃO aparece no catálogo | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/admin/consultas/e2e_consulta` +7 | [08-api-dados.spec.ts:427](../e2e/testes/08-api-dados.spec.ts#L427) | ativo |
| CT-076 | publicada entra no catálogo e pode ser autorizada num token | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/admin/consultas/e2e_publicada` +8 | [08-api-dados.spec.ts:443](../e2e/testes/08-api-dados.spec.ts#L443) | ativo |
| CT-077 | a configuração das conexões NUNCA devolve a senha | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/admin/conexoes` +6 | [08-api-dados.spec.ts:485](../e2e/testes/08-api-dados.spec.ts#L485) | ativo |
| CT-078 | conexão inexistente é 404, não 500 | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/admin/conexoes/oracle-do-vizinho` +6 | [08-api-dados.spec.ts:501](../e2e/testes/08-api-dados.spec.ts#L501) | ativo |
| CT-079 | só ADM administra conexão — nem usuário comum, nem chave de máquina | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/admin/conexoes` +6 | [08-api-dados.spec.ts:511](../e2e/testes/08-api-dados.spec.ts#L511) | ativo |
| CT-080 | o token do lado consumidor não volta na listagem — só o prefixo | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/tokens` +6 | [08-api-dados.spec.ts:534](../e2e/testes/08-api-dados.spec.ts#L534) | ativo |
| CT-081 | sondar um Portal API inalcançável responde com o endereço, não com stack | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/tokens` +6 | [08-api-dados.spec.ts:565](../e2e/testes/08-api-dados.spec.ts#L565) | ativo |
| CT-082 | token colado pela METADE é diagnosticado, não chamado de revogado | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/tokens` +6 | [08-api-dados.spec.ts:581](../e2e/testes/08-api-dados.spec.ts#L581) | ativo |
| CT-083 | só ADM mexe nos tokens do Painel | P0 | `/api/auth/login`, `/api/dados/v1`, `/api/dados/v1/tokens` +5 | [08-api-dados.spec.ts:598](../e2e/testes/08-api-dados.spec.ts#L598) | ativo |
| CT-084 | cai direto no BI: a Visão Geral não é tela dele | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +3 | [09-acesso-cliente-bi.spec.ts:29](../e2e/testes/09-acesso-cliente-bi.spec.ts#L29) | ativo |
| CT-085 | o cabeçalho diz de que lado a pessoa está | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +3 | [09-acesso-cliente-bi.spec.ts:34](../e2e/testes/09-acesso-cliente-bi.spec.ts#L34) | ativo |
| CT-086 | o menu tem o BI e mais nada do processo | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +3 | [09-acesso-cliente-bi.spec.ts:46](../e2e/testes/09-acesso-cliente-bi.spec.ts#L46) | ativo |
| CT-087 | dentro da área BI, só a aba do BI de clientes | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +3 | [09-acesso-cliente-bi.spec.ts:64](../e2e/testes/09-acesso-cliente-bi.spec.ts#L64) | ativo |
| CT-088 | rota interna digitada na barra de endereço não abre | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +3 | [09-acesso-cliente-bi.spec.ts:71](../e2e/testes/09-acesso-cliente-bi.spec.ts#L71) | ativo |
| CT-089 | as 4 subabas do BI abrem para o cliente | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/bi/clientes-siger/:id` +3 | [09-acesso-cliente-bi.spec.ts:82](../e2e/testes/09-acesso-cliente-bi.spec.ts#L82) | ativo |
| CT-090 | endpoints internos respondem 403 ao cliente | P0 | `/api/auth/login`, `/api/permissoes/matriz`, `/api/projetos`, `/bi/clientes-siger/:id` +5 | [09-acesso-cliente-bi.spec.ts:92](../e2e/testes/09-acesso-cliente-bi.spec.ts#L92) | ativo |
| CT-091 | o envio por e-mail do painel de visitas é negado ao cliente | P0 | `/api/auth/login`, `/api/bi-implantacao/visitas-portal/enviar-email`, `/api/bi-implantacao/visitas-portal/modelo-email`, `/bi/clientes-siger/:id` +5 | [09-acesso-cliente-bi.spec.ts:103](../e2e/testes/09-acesso-cliente-bi.spec.ts#L103) | ativo |
| CT-092 | e continua liberado para quem é da casa | P0 | `/api/auth/login`, `/api/bi-implantacao/visitas-portal/modelo-email`, `/api/projetos`, `/bi/clientes-siger/:id` +4 | [09-acesso-cliente-bi.spec.ts:125](../e2e/testes/09-acesso-cliente-bi.spec.ts#L125) | ativo |
| CT-093 | o BI responde ao cliente | P0 | `/api/auth/login`, `/api/bi-implantacao/resumo`, `/api/projetos`, `/bi/clientes-siger/:id` +4 | [09-acesso-cliente-bi.spec.ts:135](../e2e/testes/09-acesso-cliente-bi.spec.ts#L135) | ativo |
| CT-094 | filtro de cliente forjado não muda a resposta | P0 | `/api/auth/login`, `/api/bi-implantacao/extrato`, `/api/projetos`, `/bi/clientes-siger/:id` +4 | [09-acesso-cliente-bi.spec.ts:145](../e2e/testes/09-acesso-cliente-bi.spec.ts#L145) | ativo |
| CT-095 | cliente SEM código de cliente é recusado | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/bi/clientes-siger/:id` +4 | [09-acesso-cliente-bi.spec.ts:160](../e2e/testes/09-acesso-cliente-bi.spec.ts#L160) | ativo |
| CT-096 | cliente acumulado com papel interno é recusado | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/bi/clientes-siger/:id` +4 | [09-acesso-cliente-bi.spec.ts:175](../e2e/testes/09-acesso-cliente-bi.spec.ts#L175) | ativo |
| CT-097 | e o cadastro válido passa | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/bi/clientes-siger/:id` +4 | [09-acesso-cliente-bi.spec.ts:189](../e2e/testes/09-acesso-cliente-bi.spec.ts#L189) | ativo |
| CT-098 | o consultor continua caindo na Visão Geral | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +3 | [09-acesso-cliente-bi.spec.ts:205](../e2e/testes/09-acesso-cliente-bi.spec.ts#L205) | ativo |
| CT-099 | e um cliente não enxerga a sessão do outro | P0 | `/api/auth/login`, `/api/bi-implantacao/resumo`, `/api/projetos`, `/bi/clientes-siger/:id` +4 | [09-acesso-cliente-bi.spec.ts:210](../e2e/testes/09-acesso-cliente-bi.spec.ts#L210) | ativo |
| CT-100 | abre para o ADM, com a origem declarada na própria tela | P1 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/acesso-clientes` +3 | [09-acesso-cliente-bi.spec.ts:227](../e2e/testes/09-acesso-cliente-bi.spec.ts#L227) | ativo |
| CT-101 | o menu do ADM oferece a tela | P1 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +3 | [09-acesso-cliente-bi.spec.ts:237](../e2e/testes/09-acesso-cliente-bi.spec.ts#L237) | ativo |
| CT-102 | não abre para quem não é ADM — nem pela URL, nem no menu | P1 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/acesso-clientes` +3 | [09-acesso-cliente-bi.spec.ts:244](../e2e/testes/09-acesso-cliente-bi.spec.ts#L244) | ativo |
| CT-103 | e a API recusa quem não é ADM | P1 | `/api/auth/login`, `/api/contatos-sicla`, `/api/projetos`, `/bi/clientes-siger/:id` +4 | [09-acesso-cliente-bi.spec.ts:253](../e2e/testes/09-acesso-cliente-bi.spec.ts#L253) | ativo |
| CT-104 | sem SICLA, o ADM recebe a mensagem da conexão — não uma lista vazia | P1 | `/api/auth/login`, `/api/contatos-sicla`, `/api/projetos`, `/bi/clientes-siger/:id` +4 | [09-acesso-cliente-bi.spec.ts:265](../e2e/testes/09-acesso-cliente-bi.spec.ts#L265) | ativo |
| CT-110 | fechar o menu para o PAPEL tira o item da tela e fecha a API | P0 | `/api/auth/login`, `/api/permissoes`, `/api/permissoes/me`, `/home` +9 | [10-permissoes-rbac.spec.ts:40](../e2e/testes/10-permissoes-rbac.spec.ts#L40) | ativo |
| CT-111 | a exceção por USUÁRIO vence o papel, e "herdar" a desfaz | P0 | `/api/auth/login`, `/api/permissoes`, `/api/permissoes/me`, `/home` +9 | [10-permissoes-rbac.spec.ts:71](../e2e/testes/10-permissoes-rbac.spec.ts#L71) | ativo |
| CT-112 | só quem tem o menu  | P0 | `/api/auth/login`, `/api/permissoes`, `/api/permissoes/papel` +5 | [10-permissoes-rbac.spec.ts:107](../e2e/testes/10-permissoes-rbac.spec.ts#L107) | ativo |
| CT-113 | a matriz recusa papel e nível inventados | P0 | `/api/auth/login`, `/api/permissoes`, `/api/permissoes/me`, `/home` +9 | [10-permissoes-rbac.spec.ts:135](../e2e/testes/10-permissoes-rbac.spec.ts#L135) | ativo |
| CT-114 | as telas de Sistema continuam fixas no Administrador | P0 | `/api/auth/login`, `/api/permissoes`, `/api/permissoes/me`, `/home` +9 | [10-permissoes-rbac.spec.ts:165](../e2e/testes/10-permissoes-rbac.spec.ts#L165) | ativo |
| CT-115 | "esqueci minha senha" responde igual para conta existente e inventada | P0 | `/api/auth/esqueci-senha` | [11-superficies-publicas.spec.ts:32](../e2e/testes/11-superficies-publicas.spec.ts#L32) | ativo |
| CT-116 | redefinir com código errado não troca a senha e dá resposta genérica | P0 | `/api/auth/login`, `/api/auth/redefinir-senha` | [11-superficies-publicas.spec.ts:55](../e2e/testes/11-superficies-publicas.spec.ts#L55) | ativo |
| CT-117 | /health e /instancia respondem sem sessão, e sem contar demais | P0 | `/api/atividades/quadros`, `/api/auth/esqueci-senha`, `/api/auth/login` +15 | [11-superficies-publicas.spec.ts:93](../e2e/testes/11-superficies-publicas.spec.ts#L93) | ativo |
| CT-118 | a mídia de protocolo exige o token assinado, não a sessão | P0 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id` +4 | [11-superficies-publicas.spec.ts:109](../e2e/testes/11-superficies-publicas.spec.ts#L109) | ativo |
| CT-119 | rota autenticada sem credencial é 401, nunca 200 com dado | P0 | `/api/atividades/quadros`, `/api/dados/v1/consultas`, `/api/painel/home` +4 | [11-superficies-publicas.spec.ts:130](../e2e/testes/11-superficies-publicas.spec.ts#L130) | ativo |
| CT-120 | nenhuma rota NOVA nasceu sem guarda de autenticação | P0 | `/api/docs-json` | [11-superficies-publicas.spec.ts:149](../e2e/testes/11-superficies-publicas.spec.ts#L149) | ativo |
| CT-121 | a batida aparece no panorama do ADM com a tela em que a pessoa está | P0 | `/api/presenca`, `/api/presenca/ping`, `/api/presenca/quantos`, `/usuarios/online` +1 | [12-presenca-online.spec.ts:54](../e2e/testes/12-presenca-online.spec.ts#L54) | ativo |
| CT-122 | a unidade é a ABA: duas abas, duas sessões, um usuário só | P0 | `/api/presenca`, `/api/presenca/ping`, `/api/presenca/quantos`, `/usuarios/online` +1 | [12-presenca-online.spec.ts:79](../e2e/testes/12-presenca-online.spec.ts#L79) | ativo |
| CT-123 | a aba com a janela em segundo plano é marcada como ociosa | P0 | `/api/presenca`, `/api/presenca/ping`, `/api/presenca/quantos`, `/usuarios/online` +1 | [12-presenca-online.spec.ts:111](../e2e/testes/12-presenca-online.spec.ts#L111) | ativo |
| CT-124 | todos batem o ponto, mas só o ADM vê a lista | P0 | `/api/auth/login`, `/api/presenca`, `/api/presenca/ping`, `/usuarios/online` +8 | [12-presenca-online.spec.ts:135](../e2e/testes/12-presenca-online.spec.ts#L135) | ativo |
| CT-125 | a tela /usuarios/online abre para o ADM e não para os demais | P0 | `/api/auth/login`, `/api/presenca`, `/api/presenca/ping`, `/usuarios/online` +7 | [12-presenca-online.spec.ts:181](../e2e/testes/12-presenca-online.spec.ts#L181) | ativo |
| CT-126 | a batida recusa dado fora do contrato | P0 | `/api/auth/login`, `/api/presenca`, `/api/presenca/ping`, `/usuarios/online` +7 | [12-presenca-online.spec.ts:208](../e2e/testes/12-presenca-online.spec.ts#L208) | ativo |
| CT-127 | o quadro nasce com as colunas padrão, e o Bastidor Rech fechado ao cliente | P0 | `/api/atividades/cartoes`, `/api/atividades/cartoes/:id/mover`, `/api/atividades/cartoes/:id/visibilidade`, `/home` +11 | [13-controle-atividades.spec.ts:52](../e2e/testes/13-controle-atividades.spec.ts#L52) | ativo |
| CT-128 | um cliente não alcança o quadro do outro | P0 | `/api/atividades/cartoes`, `/api/atividades/cartoes/:id/mover`, `/api/atividades/cartoes/:id/visibilidade`, `/home` +11 | [13-controle-atividades.spec.ts:85](../e2e/testes/13-controle-atividades.spec.ts#L85) | ativo |
| CT-129 | cartão criado pelo interno nasce FECHADO; compartilhar é ato explícito | P0 | `/api/atividades/cartoes`, `/api/atividades/cartoes/:id/mover`, `/api/atividades/cartoes/:id/visibilidade`, `/home` +11 | [13-controle-atividades.spec.ts:130](../e2e/testes/13-controle-atividades.spec.ts#L130) | ativo |
| CT-130 | o cartão aberto pelo CLIENTE nasce compartilhado (é uma solicitação) | P0 | `/api/atividades/cartoes`, `/api/atividades/cartoes/:id/mover`, `/api/atividades/cartoes/:id/visibilidade`, `/home` +11 | [13-controle-atividades.spec.ts:166](../e2e/testes/13-controle-atividades.spec.ts#L166) | ativo |
| CT-131 | o cliente não empurra o próprio cartão para dentro do bastidor da Rech | P0 | `/api/atividades/cartoes`, `/api/atividades/cartoes/:id/mover`, `/api/atividades/cartoes/:id/visibilidade`, `/home` +11 | [13-controle-atividades.spec.ts:194](../e2e/testes/13-controle-atividades.spec.ts#L194) | ativo |
| CT-132 | interno não designado LÊ o quadro e não ESCREVE nele | P0 | `/api/atividades/cartoes`, `/api/atividades/cartoes/:id/mover`, `/api/atividades/cartoes/:id/visibilidade`, `/home` +12 | [13-controle-atividades.spec.ts:247](../e2e/testes/13-controle-atividades.spec.ts#L247) | ativo |
| CT-133 | sem o menu  | P0 | `/api/atividades/cartoes`, `/api/atividades/cartoes/:id/mover`, `/api/atividades/cartoes/:id/visibilidade`, `/home` +10 | [13-controle-atividades.spec.ts:275](../e2e/testes/13-controle-atividades.spec.ts#L275) | ativo |
| CT-105 | ADM percorre todas as rotas estáticas sem erro de console nem HTTP | P2 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/rota-que-nao-existe-xyz` +3 | [90-auditoria-varredura.spec.ts:127](../e2e/testes/90-auditoria-varredura.spec.ts#L127) | ativo |
| CT-106 | rotas de um PROJETO real abrem sem erro | P2 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/rota-que-nao-existe-xyz` +3 | [90-auditoria-varredura.spec.ts:142](../e2e/testes/90-auditoria-varredura.spec.ts#L142) | ativo |
| CT-107 | rota inexistente não quebra — cai no fallback do roteador | P2 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/rota-que-nao-existe-xyz` +3 | [90-auditoria-varredura.spec.ts:158](../e2e/testes/90-auditoria-varredura.spec.ts#L158) | ativo |
| CT-108 | sem overflow horizontal em ${vp.nome} (${vp.width}px) | P2 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/rota-que-nao-existe-xyz` +3 | [90-auditoria-varredura.spec.ts:178](../e2e/testes/90-auditoria-varredura.spec.ts#L178) | ativo |
| CT-109 | menu do ${login} mostra o que deve e esconde o que não deve | P1 | `/api/auth/login`, `/api/projetos`, `/api/projetos/:id`, `/home` +3 | [90-auditoria-varredura.spec.ts:218](../e2e/testes/90-auditoria-varredura.spec.ts#L218) | ativo |
---

## 5. Casos de teste detalhados

Cada caso, com prioridade, estado e a **rastreabilidade** (`arquivo:linha`) que o liga ao
código. Os passos executáveis são o próprio spec — é ele que roda, e duplicá-los aqui em prosa
criaria duas versões da mesma verdade, que divergiriam na primeira alteração. O que este
documento garante é a **identidade estável** (o `CT-###` que nunca muda de significado), o
**porquê** de cada grupo existir — que está no comentário de cabeçalho de cada arquivo de spec,
onde ele fica ao lado do código que explica — e a superfície que cada caso toca.

**Os grupos que nasceram de defeito real**, e que por isso são os que menos se pode mexer sem
pensar duas vezes:

| Grupo | Defeito de origem | Casos |
| --- | --- | --- |
| `03-comercial-passo-5` | a rota de concluir exigia `carteira/alteracao` e o Comercial tem `consulta`; o passo 5 não tem caminho automático, então o processo **travava ali** | CT-013..016 |
| `04-permissoes-fluxo` · RN-10 | quatro caminhos fechavam passo **sem gate de designação**, alguns irreversíveis: anexar com `tipo=termo`, gerar o documento (inclusive o modelo em branco), reescrever `gci` por `PUT /projetos/:id`, criar projeto por `POST /fluxo/criar` | CT-017..023 |
| `04-permissoes-fluxo` · destinatários | com **dois GCIs** no projeto, o e-mail do passo 8 não chegava a nenhum; `2026-13-45` fechava o passo 7; dois usuários homônimos eram indistinguíveis para a designação | CT-024..028 |
| `07-projeto-heranca-etapa-10` | o passo 10 abria direto em "Gerar Projeto": o `.docx` saía **sem ninguém revisar** o que veio do levantamento, e a tela de edição abria em branco | CT-046..052 |
| `09-acesso-cliente-bi` | o papel `Cliente` é externo: qualquer escorregão aqui expõe dado de um cliente a outro | CT-084..104 |

O gate de **ordem** (dependência entre passos) sempre valeu em todos esses caminhos — o que
faltava era o de **autorização**.

### `01-acesso.spec.ts`

#### Acesso ao Painel · @p0 @smoke

- **CT-001 — login válido entra e sai da tela de login**  
  P0 · ativo · [01-acesso.spec.ts:5](../e2e/testes/01-acesso.spec.ts#L5)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-002 — senha errada não entra e mostra o erro na tela**  
  P0 · ativo · [01-acesso.spec.ts:10](../e2e/testes/01-acesso.spec.ts#L10)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/login`
- **CT-003 — usuário inexistente não entra**  
  P0 · ativo · [01-acesso.spec.ts:16](../e2e/testes/01-acesso.spec.ts#L16)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/login`
- **CT-004 — rota protegida sem login cai no login**  
  P0 · ativo · [01-acesso.spec.ts:21](../e2e/testes/01-acesso.spec.ts#L21)  
  tela `/projetos/1/passos`
- **CT-005 — deep link recarregado continua funcionando (fallback de SPA)**  
  P0 · ativo · [01-acesso.spec.ts:26](../e2e/testes/01-acesso.spec.ts#L26)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/projetos`

### `02-passos-integridade.spec.ts`

#### Tela dos 21 passos — integridade do que a interface promete · @p0

- **CT-006 — mostra os 21 passos, na ordem, com o responsável de cada um**  
  P0 · ativo · [02-passos-integridade.spec.ts:6](../e2e/testes/02-passos-integridade.spec.ts#L6)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/projetos/:id/passos`
- **CT-007 — passo bloqueado tem o botão desabilitado e explica o porquê**  
  P0 · ativo · [02-passos-integridade.spec.ts:31](../e2e/testes/02-passos-integridade.spec.ts#L31)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/projetos/:id/passos`
- **CT-008 — RN-1: concluído o passo 8, o cronograma (13) libera sem esperar o Projeto**  
  P0 · ativo · [02-passos-integridade.spec.ts:43](../e2e/testes/02-passos-integridade.spec.ts#L43)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/projetos/:id/passos`
- **CT-009 — RN-6: passo definitivo não oferece "Reabrir"; reversível oferece**  
  P0 · ativo · [02-passos-integridade.spec.ts:57](../e2e/testes/02-passos-integridade.spec.ts#L57)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/projetos/:id/passos`
- **CT-010 — RN-5: "Marcar conferido" não aparece antes de o passo 11 ser concluído**  
  P0 · ativo · [02-passos-integridade.spec.ts:71](../e2e/testes/02-passos-integridade.spec.ts#L71)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/projetos/:id/passos`
- **CT-011 — RN-5: concluído o 11, a tela oferece "Marcar conferido" — e só nele**  
  P0 · ativo · [02-passos-integridade.spec.ts:87](../e2e/testes/02-passos-integridade.spec.ts#L87)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/projetos/:id/passos`
- **CT-012 — nome de cliente com <script> é escapado, não executado**  
  P0 · ativo · [02-passos-integridade.spec.ts:104](../e2e/testes/02-passos-integridade.spec.ts#L104)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/projetos/:id/passos`

### `03-comercial-passo-5.spec.ts`

#### Passo 5 — o Comercial conclui o próprio passo · @p0

- **CT-013 — a API aceita a conclusão do passo 5 pelo Comercial**  
  P0 · ativo · [03-comercial-passo-5.spec.ts:18](../e2e/testes/03-comercial-passo-5.spec.ts#L18)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/5/concluir` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-014 — a tela oferece ao Comercial a ação do passo 5**  
  P0 · ativo · [03-comercial-passo-5.spec.ts:29](../e2e/testes/03-comercial-passo-5.spec.ts#L29)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/projetos/:id/passos`
- **CT-015 — quem só consulta NÃO ganha ação num passo que não é seu**  
  P0 · ativo · [03-comercial-passo-5.spec.ts:42](../e2e/testes/03-comercial-passo-5.spec.ts#L42)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/projetos/:id/passos`
#### (fora de grupo) · @p0

- **CT-016 — coerência: "liberado" e a conclusão contam a mesma história**  
  P0 · ativo · [03-comercial-passo-5.spec.ts:55](../e2e/testes/03-comercial-passo-5.spec.ts#L55)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos` · `/api/projetos/:id/passos/5/concluir` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`

### `04-permissoes-fluxo.spec.ts`

#### RN-10 — designação por projeto vale em todos os caminhos · @p0

- **CT-017 — anexar documento com tipo="termo" não pode concluir o passo 18**  
  P0 · ativo · [04-permissoes-fluxo.spec.ts:26](../e2e/testes/04-permissoes-fluxo.spec.ts#L26)  
  `/api/auth/login` · `/api/fluxo/criar` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/anexar` · `/api/projetos/:id/gerar-layout/termo` · `/api/projetos/:id/passos` · `/api/projetos/:id/passos/10/concluir` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-018 — gerar o Termo não pode fechar o passo 18 de quem não é o consultor designado**  
  P0 · ativo · [04-permissoes-fluxo.spec.ts:41](../e2e/testes/04-permissoes-fluxo.spec.ts#L41)  
  `/api/auth/login` · `/api/fluxo/criar` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/anexar` · `/api/projetos/:id/gerar-layout/termo` · `/api/projetos/:id/passos` · `/api/projetos/:id/passos/10/concluir` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-019 — baixar o Termo EM BRANCO (modo=modelo) não pode concluir o passo 18**  
  P0 · ativo · [04-permissoes-fluxo.spec.ts:51](../e2e/testes/04-permissoes-fluxo.spec.ts#L51)  
  `/api/auth/login` · `/api/fluxo/criar` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/anexar` · `/api/projetos/:id/gerar-layout/termo` · `/api/projetos/:id/passos` · `/api/projetos/:id/passos/10/concluir` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-020 — PUT /projetos/:id não pode deixar alguém se autodesignar GCI e concluir o passo 10**  
  P0 · ativo · [04-permissoes-fluxo.spec.ts:61](../e2e/testes/04-permissoes-fluxo.spec.ts#L61)  
  `/api/auth/login` · `/api/fluxo/criar` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/anexar` · `/api/projetos/:id/gerar-layout/termo` · `/api/projetos/:id/passos` · `/api/projetos/:id/passos/10/concluir` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-021 — quem só tem CONSULTA na carteira não pode reescrever a ficha**  
  P0 · ativo · [04-permissoes-fluxo.spec.ts:76](../e2e/testes/04-permissoes-fluxo.spec.ts#L76)  
  `/api/auth/login` · `/api/fluxo/criar` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/anexar` · `/api/projetos/:id/gerar-layout/termo` · `/api/projetos/:id/passos` · `/api/projetos/:id/passos/10/concluir` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-022 — POST /fluxo/criar não pode concluir o passo 1 para quem não cadastra cliente**  
  P0 · ativo · [04-permissoes-fluxo.spec.ts:87](../e2e/testes/04-permissoes-fluxo.spec.ts#L87)  
  `/api/auth/login` · `/api/fluxo/criar` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/anexar` · `/api/projetos/:id/gerar-layout/termo` · `/api/projetos/:id/passos` · `/api/projetos/:id/passos/10/concluir` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-023 — o gate de ORDEM continua valendo na auto-conclusão**  
  P0 · ativo · [04-permissoes-fluxo.spec.ts:96](../e2e/testes/04-permissoes-fluxo.spec.ts#L96)  
  `/api/auth/login` · `/api/fluxo/criar` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/anexar` · `/api/projetos/:id/gerar-layout/termo` · `/api/projetos/:id/passos` · `/api/projetos/:id/passos/10/concluir` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
#### Destinatários dos e-mails do processo · @p1

- **CT-024 — com UM GCI, o e-mail do passo 8 chega ao GCI**  
  P1 · ativo · [04-permissoes-fluxo.spec.ts:108](../e2e/testes/04-permissoes-fluxo.spec.ts#L108)  
  `/api/auth/login` · `/api/fluxo/criar` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/anexar` · `/api/projetos/:id/emails` · `/api/projetos/:id/gerar-layout/termo` · `/api/projetos/:id/passos` · `/api/projetos/:id/passos/10/concluir` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-025 — com DOIS GCIs, o e-mail do passo 8 ainda tem de chegar a um GCI**  
  P1 · ativo · [04-permissoes-fluxo.spec.ts:116](../e2e/testes/04-permissoes-fluxo.spec.ts#L116)  
  `/api/auth/login` · `/api/fluxo/criar` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/anexar` · `/api/projetos/:id/emails` · `/api/projetos/:id/gerar-layout/termo` · `/api/projetos/:id/passos` · `/api/projetos/:id/passos/10/concluir` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
#### RN-4 — data da assinatura · @p0

- **CT-026 — data inexistente (2026-13-45) não pode fechar o passo 7**  
  P0 · ativo · [04-permissoes-fluxo.spec.ts:147](../e2e/testes/04-permissoes-fluxo.spec.ts#L147)  
  `/api/auth/login` · `/api/fluxo/criar` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/anexar` · `/api/projetos/:id/gerar-layout/termo` · `/api/projetos/:id/passos` · `/api/projetos/:id/passos/10/concluir` · `/api/projetos/:id/passos/7/concluir` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-027 — data de assinatura no futuro não pode fechar o passo 7**  
  P0 · ativo · [04-permissoes-fluxo.spec.ts:156](../e2e/testes/04-permissoes-fluxo.spec.ts#L156)  
  `/api/auth/login` · `/api/fluxo/criar` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/anexar` · `/api/projetos/:id/gerar-layout/termo` · `/api/projetos/:id/passos` · `/api/projetos/:id/passos/10/concluir` · `/api/projetos/:id/passos/7/concluir` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
#### Cadastro de usuário — homônimo · @p1

- **CT-028 — recusa um segundo usuário ativo com o mesmo nome**  
  P1 · ativo · [04-permissoes-fluxo.spec.ts:167](../e2e/testes/04-permissoes-fluxo.spec.ts#L167)  
  `/api/auth/login` · `/api/fluxo/criar` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/anexar` · `/api/projetos/:id/gerar-layout/termo` · `/api/projetos/:id/passos` · `/api/projetos/:id/passos/10/concluir` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/usuarios`
#### Tamanho do corpo da requisição · @p1

- **CT-029 — corpo acima do limite responde 413, não um 404 dizendo que a rota não existe**  
  P1 · ativo · [04-permissoes-fluxo.spec.ts:182](../e2e/testes/04-permissoes-fluxo.spec.ts#L182)  
  `/api/auth/login` · `/api/fluxo/criar` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/anexar` · `/api/projetos/:id/gerar-layout/termo` · `/api/projetos/:id/passos` · `/api/projetos/:id/passos/10/concluir` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`

### `05-emails-e-designacao.spec.ts`

#### RN-7 — a descrição do passo 5 chega ao e-mail · @p1

- **CT-030 — a prévia remontada já contém o que foi escrito**  
  P1 · ativo · [05-emails-e-designacao.spec.ts:17](../e2e/testes/05-emails-e-designacao.spec.ts#L17)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/emails` · `/api/projetos/:id/passos/5/concluir` · `/api/projetos/:id/passos/5/email` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-031 — o e-mail registrado carrega a descrição, tendo sido redigido ou não**  
  P1 · ativo · [05-emails-e-designacao.spec.ts:31](../e2e/testes/05-emails-e-designacao.spec.ts#L31)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/emails` · `/api/projetos/:id/passos/5/concluir` · `/api/projetos/:id/passos/5/email` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
#### (fora de grupo) · @p1

- **CT-032 — nenhum token do seletor de modelos sai literal no e-mail do passo**  
  P1 · ativo · [05-emails-e-designacao.spec.ts:72](../e2e/testes/05-emails-e-designacao.spec.ts#L72)  
  `/api/auth/login` · `/api/config/modelos-email` · `/api/config/modelos-email/:id` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/emails` · `/api/projetos/:id/passos/15/email` · `/api/projetos/:id/passos/5/concluir` · `/api/projetos/:id/passos/5/email` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-033 — a macro-etapa nunca regride enquanto os 21 passos avançam**  
  P0 · ativo · [05-emails-e-designacao.spec.ts:122](../e2e/testes/05-emails-e-designacao.spec.ts#L122)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/cabecalho` · `/api/projetos/:id/emails` · `/api/projetos/:id/passos/5/concluir` · `/api/projetos/:id/passos/5/email` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
#### passo 8 — salvar a equipe só conclui para quem responde pelo passo · @p0

- **CT-034 — Administrativo salvando a equipe NÃO conclui o passo 8**  
  P0 · ativo · [05-emails-e-designacao.spec.ts:182](../e2e/testes/05-emails-e-designacao.spec.ts#L182)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/emails` · `/api/projetos/:id/passos` · `/api/projetos/:id/passos/5/concluir` · `/api/projetos/:id/passos/5/email` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-035 — Coordenador salvando a equipe conclui o passo 8**  
  P0 · ativo · [05-emails-e-designacao.spec.ts:192](../e2e/testes/05-emails-e-designacao.spec.ts#L192)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/emails` · `/api/projetos/:id/passos` · `/api/projetos/:id/passos/5/concluir` · `/api/projetos/:id/passos/5/email` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`

### `06-crud.spec.ts`

#### CRUD — Projetos · @p1

- **CT-036 — ciclo completo: cria, lê, lista, busca, edita e exclui**  
  P1 · ativo · [06-crud.spec.ts:30](../e2e/testes/06-crud.spec.ts#L30)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/projetos/abc`
- **CT-037 — acentuação e símbolos sobrevivem à ida e volta**  
  P1 · ativo · [06-crud.spec.ts:61](../e2e/testes/06-crud.spec.ts#L61)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/projetos/abc`
- **CT-038 — validação do CREATE recusa o que não deve entrar**  
  P1 · ativo · [06-crud.spec.ts:70](../e2e/testes/06-crud.spec.ts#L70)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/projetos/abc`
- **CT-039 — id inválido não vira 500 nem registro fantasma**  
  P1 · ativo · [06-crud.spec.ts:84](../e2e/testes/06-crud.spec.ts#L84)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/projetos/abc`
#### CRUD — Usuários · @p1

- **CT-040 — cria, lista sem vazar senha, edita sem apagar o resto**  
  P1 · ativo · [06-crud.spec.ts:94](../e2e/testes/06-crud.spec.ts#L94)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/projetos/abc` · `/api/usuarios` · `/api/usuarios/:id`
- **CT-041 — recusa duplicidade e dado inválido**  
  P1 · ativo · [06-crud.spec.ts:115](../e2e/testes/06-crud.spec.ts#L115)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/projetos/abc` · `/api/usuarios`
#### CRUD — RNS do projeto · @p1

- **CT-042 — ciclo completo e validação**  
  P1 · ativo · [06-crud.spec.ts:138](../e2e/testes/06-crud.spec.ts#L138)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/projetos/:id/rns` · `/api/projetos/:id/rns/${lista` · `/api/projetos/abc`
#### CRUD — Preferências do usuário · @p1

- **CT-043 — grava, lê, não vaza para outro usuário e apaga**  
  P1 · ativo · [06-crud.spec.ts:166](../e2e/testes/06-crud.spec.ts#L166)  
  `/api/auth/login` · `/api/preferencias` · `/api/preferencias/crud-e2e` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/projetos/abc`
#### CRUD — Modelos de e-mail · @p1

- **CT-044 — edita, alterna ativo e o inativo continua visível na tela de administração**  
  P1 · ativo · [06-crud.spec.ts:181](../e2e/testes/06-crud.spec.ts#L181)  
  `/api/auth/login` · `/api/config/modelos-email` · `/api/config/modelos-email/99999` · `/api/config/modelos-email/:id` · `/api/config/modelos-email/:id/toggle` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/projetos/abc`
- **CT-045 — id inexistente devolve 404, e não-ADM é recusado**  
  P1 · ativo · [06-crud.spec.ts:204](../e2e/testes/06-crud.spec.ts#L204)  
  `/api/auth/login` · `/api/config/modelos-email/1` · `/api/config/modelos-email/99999` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/projetos/abc`

### `07-projeto-heranca-etapa-10.spec.ts`

#### Etapa 10 — o Projeto herda o Levantamento da etapa 3 · @p0

- **CT-046 — o passo 10 abre a tela de EDIÇÃO, não a geração direta**  
  P0 · ativo · [07-projeto-heranca-etapa-10.spec.ts:44](../e2e/testes/07-projeto-heranca-etapa-10.spec.ts#L44)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/projetos/:id/passos`
- **CT-047 — a tela do passo 10 abre com os dados da etapa 3 e o GCI edita antes de gerar**  
  P0 · ativo · [07-projeto-heranca-etapa-10.spec.ts:60](../e2e/testes/07-projeto-heranca-etapa-10.spec.ts#L60)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/doc-conteudo/levantamento` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/projetos/:id/editar/projeto` · tela `/projetos/:id/passos`
- **CT-048 — gerar pela tela de edição conclui o passo 10 e libera o 11**  
  P0 · ativo · [07-projeto-heranca-etapa-10.spec.ts:106](../e2e/testes/07-projeto-heranca-etapa-10.spec.ts#L106)  
  `/api/auth/login` · `/api/cadastros/modelos` · `/api/cadastros/modelos/:id/baixar` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/doc-conteudo/levantamento` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/projetos/:id/editar/projeto` · tela `/projetos/:id/passos`
- **CT-049 — o Levantador vê o botão do passo 10 e a tela o aceita (o botão não promete o que a tela recusa)**  
  P0 · ativo · [07-projeto-heranca-etapa-10.spec.ts:150](../e2e/testes/07-projeto-heranca-etapa-10.spec.ts#L150)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/projetos/:id/editar/projeto`
- **CT-050 — o Cronograma Macro é preenchido por seletor de data, não texto livre**  
  P0 · ativo · [07-projeto-heranca-etapa-10.spec.ts:163](../e2e/testes/07-projeto-heranca-etapa-10.spec.ts#L163)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/projetos/:id/editar/projeto`
- **CT-052 — o passo 11 não oferece mais o botão Abrir**  
  P0 · ativo · [07-projeto-heranca-etapa-10.spec.ts:187](../e2e/testes/07-projeto-heranca-etapa-10.spec.ts#L187)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/projetos/:id/passos`
#### Etapa 10 — apresentação da tela · @p2

- **CT-051 — o rótulo somente-leitura não desalinha o campo vizinho na mesma linha**  
  P2 · ativo · [07-projeto-heranca-etapa-10.spec.ts:209](../e2e/testes/07-projeto-heranca-etapa-10.spec.ts#L209)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/projetos/:id/editar/projeto`
#### Etapa 10 — senha padrão da instância isolada · @p0 @smoke

- **CT-053 — sanidade: a suíte está na instância descartável, não em produção**  
  P0 · ativo · [07-projeto-heranca-etapa-10.spec.ts:232](../e2e/testes/07-projeto-heranca-etapa-10.spec.ts#L232)  
  `/api/health`

### `08-api-dados.spec.ts`

#### API de Dados — a fronteira recusa quem deve recusar · @p0

- **CT-054 — sem credencial nenhuma: 401 no catálogo e na execução**  
  P0 · ativo · [08-api-dados.spec.ts:80](../e2e/testes/08-api-dados.spec.ts#L80)  
  `/api/dados/v1/consultas` · `/api/dados/v1/consultas/sicla.rns.listar/executar`
- **CT-055 — o catálogo NUNCA devolve o SQL**  
  P0 · ativo · [08-api-dados.spec.ts:91](../e2e/testes/08-api-dados.spec.ts#L91)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/consultas` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-056 — consulta fora do catálogo: 404, não 500**  
  P0 · ativo · [08-api-dados.spec.ts:109](../e2e/testes/08-api-dados.spec.ts#L109)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/consultas/nao.existe.aqui/executar` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-057 — parâmetro inválido: 400 — e o banco nem é procurado**  
  P0 · ativo · [08-api-dados.spec.ts:119](../e2e/testes/08-api-dados.spec.ts#L119)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/consultas/sicla.rns.listar/executar` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-058 — parâmetro que não existe no contrato é recusado**  
  P0 · ativo · [08-api-dados.spec.ts:130](../e2e/testes/08-api-dados.spec.ts#L130)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/consultas/sicla.rns.listar/executar` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-059 — SQL, conexão e limite no corpo são ignorados — não há atalho**  
  P0 · ativo · [08-api-dados.spec.ts:140](../e2e/testes/08-api-dados.spec.ts#L140)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/consultas/sicla.rns.listar/executar` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-060 — requisição legítima chega até a conexão e para em 503 (nada cadastrado aqui)**  
  P0 · ativo · [08-api-dados.spec.ts:158](../e2e/testes/08-api-dados.spec.ts#L158)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/consultas/sicla.rns.listar/executar` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-061 — quem não enxerga a tela não consulta o dado por baixo dela**  
  P0 · ativo · [08-api-dados.spec.ts:172](../e2e/testes/08-api-dados.spec.ts#L172)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/consultas/sicla.rns.listar/executar` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
#### API de Dados — clientes de máquina · @p0

- **CT-062 — só ADM administra: os demais perfis levam 403**  
  P0 · ativo · [08-api-dados.spec.ts:192](../e2e/testes/08-api-dados.spec.ts#L192)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/admin/clientes` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-063 — uma chave de máquina NÃO administra a API (não emite outra chave)**  
  P0 · ativo · [08-api-dados.spec.ts:203](../e2e/testes/08-api-dados.spec.ts#L203)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/admin/clientes` · `/api/dados/v1/tokens`
- **CT-064 — a chave é exibida uma vez e nunca volta na listagem**  
  P0 · ativo · [08-api-dados.spec.ts:223](../e2e/testes/08-api-dados.spec.ts#L223)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/admin/clientes` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-065 — chave válida entra; chave inventada, alterada ou revogada não**  
  P0 · ativo · [08-api-dados.spec.ts:233](../e2e/testes/08-api-dados.spec.ts#L233)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/admin/clientes/:id/ativo` · `/api/dados/v1/consultas` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-066 — rotacionar mata a chave anterior imediatamente**  
  P0 · ativo · [08-api-dados.spec.ts:260](../e2e/testes/08-api-dados.spec.ts#L260)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/admin/clientes/:id/rotacionar` · `/api/dados/v1/consultas` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-067 — o token é um teto POR CONSULTA: fora da lista, 403 — e o catálogo vem recortado**  
  P0 · ativo · [08-api-dados.spec.ts:278](../e2e/testes/08-api-dados.spec.ts#L278)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/consultas` · `/api/dados/v1/consultas/sicla.rns.listar/executar` · `/api/dados/v1/tokens`
- **CT-068 — uma consulta da MESMA conexão, não autorizada, também dá 403**  
  P0 · ativo · [08-api-dados.spec.ts:304](../e2e/testes/08-api-dados.spec.ts#L304)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/consultas/sicla.bi.extrato-horas/executar` · `/api/dados/v1/consultas/sicla.rns.listar/executar` · `/api/dados/v1/tokens`
- **CT-069 — consulta inexistente não é cadastrável num token**  
  P0 · ativo · [08-api-dados.spec.ts:324](../e2e/testes/08-api-dados.spec.ts#L324)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/admin/clientes` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
#### API de Dados — publicar consulta pela tela · @p0

- **CT-070 — só ADM administra consultas — nem usuário comum, nem chave de máquina**  
  P0 · ativo · [08-api-dados.spec.ts:363](../e2e/testes/08-api-dados.spec.ts#L363)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-071 — não publica nada que não seja SELECT**  
  P0 · ativo · [08-api-dados.spec.ts:379](../e2e/testes/08-api-dados.spec.ts#L379)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-072 — publicar sem teto de linhas é recusado**  
  P0 · ativo · [08-api-dados.spec.ts:390](../e2e/testes/08-api-dados.spec.ts#L390)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-073 — bind sem parâmetro declarado é recusado na publicação**  
  P0 · ativo · [08-api-dados.spec.ts:400](../e2e/testes/08-api-dados.spec.ts#L400)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-074 — a tela não sequestra um nome do catálogo de código**  
  P0 · ativo · [08-api-dados.spec.ts:417](../e2e/testes/08-api-dados.spec.ts#L417)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-075 — rascunho salva, entra na lista e NÃO aparece no catálogo**  
  P0 · ativo · [08-api-dados.spec.ts:427](../e2e/testes/08-api-dados.spec.ts#L427)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/admin/consultas/e2e_consulta` · `/api/dados/v1/consultas` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-076 — publicada entra no catálogo e pode ser autorizada num token**  
  P0 · ativo · [08-api-dados.spec.ts:443](../e2e/testes/08-api-dados.spec.ts#L443)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/admin/consultas/e2e_publicada` · `/api/dados/v1/consultas` · `/api/dados/v1/consultas/sicla.e2e.publicada/executar` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
#### API de Dados — conexões (Portal API) · @p0

- **CT-077 — a configuração das conexões NUNCA devolve a senha**  
  P0 · ativo · [08-api-dados.spec.ts:485](../e2e/testes/08-api-dados.spec.ts#L485)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/admin/conexoes` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-078 — conexão inexistente é 404, não 500**  
  P0 · ativo · [08-api-dados.spec.ts:501](../e2e/testes/08-api-dados.spec.ts#L501)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/admin/conexoes/oracle-do-vizinho` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-079 — só ADM administra conexão — nem usuário comum, nem chave de máquina**  
  P0 · ativo · [08-api-dados.spec.ts:511](../e2e/testes/08-api-dados.spec.ts#L511)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/admin/conexoes` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
#### API de Dados — tokens do Painel · @p0

- **CT-080 — o token do lado consumidor não volta na listagem — só o prefixo**  
  P0 · ativo · [08-api-dados.spec.ts:534](../e2e/testes/08-api-dados.spec.ts#L534)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/tokens` · `/api/dados/v1/tokens/:id` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-081 — sondar um Portal API inalcançável responde com o endereço, não com stack**  
  P0 · ativo · [08-api-dados.spec.ts:565](../e2e/testes/08-api-dados.spec.ts#L565)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/tokens` · `/api/dados/v1/tokens/sondar` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-082 — token colado pela METADE é diagnosticado, não chamado de revogado**  
  P0 · ativo · [08-api-dados.spec.ts:581](../e2e/testes/08-api-dados.spec.ts#L581)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/tokens` · `/api/dados/v1/tokens/sondar` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-083 — só ADM mexe nos tokens do Painel**  
  P0 · ativo · [08-api-dados.spec.ts:598](../e2e/testes/08-api-dados.spec.ts#L598)  
  `/api/auth/login` · `/api/dados/v1` · `/api/dados/v1/tokens` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`

### `09-acesso-cliente-bi.spec.ts`

#### Acesso do cliente — sessão e navegação · @p0

- **CT-084 — cai direto no BI: a Visão Geral não é tela dele**  
  P0 · ativo · [09-acesso-cliente-bi.spec.ts:29](../e2e/testes/09-acesso-cliente-bi.spec.ts#L29)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-085 — o cabeçalho diz de que lado a pessoa está**  
  P0 · ativo · [09-acesso-cliente-bi.spec.ts:34](../e2e/testes/09-acesso-cliente-bi.spec.ts#L34)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-086 — o menu tem o BI e mais nada do processo**  
  P0 · ativo · [09-acesso-cliente-bi.spec.ts:46](../e2e/testes/09-acesso-cliente-bi.spec.ts#L46)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-087 — dentro da área BI, só a aba do BI de clientes**  
  P0 · ativo · [09-acesso-cliente-bi.spec.ts:64](../e2e/testes/09-acesso-cliente-bi.spec.ts#L64)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-088 — rota interna digitada na barra de endereço não abre**  
  P0 · ativo · [09-acesso-cliente-bi.spec.ts:71](../e2e/testes/09-acesso-cliente-bi.spec.ts#L71)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-089 — as 4 subabas do BI abrem para o cliente**  
  P0 · ativo · [09-acesso-cliente-bi.spec.ts:82](../e2e/testes/09-acesso-cliente-bi.spec.ts#L82)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/bi/clientes-siger/:id`
#### Acesso do cliente — o que a API fecha · @p0

- **CT-090 — endpoints internos respondem 403 ao cliente**  
  P0 · ativo · [09-acesso-cliente-bi.spec.ts:92](../e2e/testes/09-acesso-cliente-bi.spec.ts#L92)  
  `/api/auth/login` · `/api/permissoes/matriz` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/usuarios` · tela `/bi/clientes-siger/:id`
- **CT-091 — o envio por e-mail do painel de visitas é negado ao cliente**  
  P0 · ativo · [09-acesso-cliente-bi.spec.ts:103](../e2e/testes/09-acesso-cliente-bi.spec.ts#L103)  
  `/api/auth/login` · `/api/bi-implantacao/visitas-portal/enviar-email` · `/api/bi-implantacao/visitas-portal/modelo-email` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/bi/clientes-siger/:id`
- **CT-092 — e continua liberado para quem é da casa**  
  P0 · ativo · [09-acesso-cliente-bi.spec.ts:125](../e2e/testes/09-acesso-cliente-bi.spec.ts#L125)  
  `/api/auth/login` · `/api/bi-implantacao/visitas-portal/modelo-email` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/bi/clientes-siger/:id`
- **CT-093 — o BI responde ao cliente**  
  P0 · ativo · [09-acesso-cliente-bi.spec.ts:135](../e2e/testes/09-acesso-cliente-bi.spec.ts#L135)  
  `/api/auth/login` · `/api/bi-implantacao/resumo` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/bi/clientes-siger/:id`
- **CT-094 — filtro de cliente forjado não muda a resposta**  
  P0 · ativo · [09-acesso-cliente-bi.spec.ts:145](../e2e/testes/09-acesso-cliente-bi.spec.ts#L145)  
  `/api/auth/login` · `/api/bi-implantacao/extrato` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/bi/clientes-siger/:id`
#### Acesso do cliente — o cadastro não deixa nascer usuário inseguro · @p0

- **CT-095 — cliente SEM código de cliente é recusado**  
  P0 · ativo · [09-acesso-cliente-bi.spec.ts:160](../e2e/testes/09-acesso-cliente-bi.spec.ts#L160)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/usuarios` · tela `/bi/clientes-siger/:id`
- **CT-096 — cliente acumulado com papel interno é recusado**  
  P0 · ativo · [09-acesso-cliente-bi.spec.ts:175](../e2e/testes/09-acesso-cliente-bi.spec.ts#L175)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/usuarios` · tela `/bi/clientes-siger/:id`
- **CT-097 — e o cadastro válido passa**  
  P0 · ativo · [09-acesso-cliente-bi.spec.ts:189](../e2e/testes/09-acesso-cliente-bi.spec.ts#L189)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/usuarios` · tela `/bi/clientes-siger/:id`
#### Acesso do cliente — o interno não é afetado · @p0

- **CT-098 — o consultor continua caindo na Visão Geral**  
  P0 · ativo · [09-acesso-cliente-bi.spec.ts:205](../e2e/testes/09-acesso-cliente-bi.spec.ts#L205)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-099 — e um cliente não enxerga a sessão do outro**  
  P0 · ativo · [09-acesso-cliente-bi.spec.ts:210](../e2e/testes/09-acesso-cliente-bi.spec.ts#L210)  
  `/api/auth/login` · `/api/bi-implantacao/resumo` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/bi/clientes-siger/:id`
#### Acesso de Clientes — a tela do ADM · @p1

- **CT-100 — abre para o ADM, com a origem declarada na própria tela**  
  P1 · ativo · [09-acesso-cliente-bi.spec.ts:227](../e2e/testes/09-acesso-cliente-bi.spec.ts#L227)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/acesso-clientes`
- **CT-101 — o menu do ADM oferece a tela**  
  P1 · ativo · [09-acesso-cliente-bi.spec.ts:237](../e2e/testes/09-acesso-cliente-bi.spec.ts#L237)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-102 — não abre para quem não é ADM — nem pela URL, nem no menu**  
  P1 · ativo · [09-acesso-cliente-bi.spec.ts:244](../e2e/testes/09-acesso-cliente-bi.spec.ts#L244)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/acesso-clientes`
- **CT-103 — e a API recusa quem não é ADM**  
  P1 · ativo · [09-acesso-cliente-bi.spec.ts:253](../e2e/testes/09-acesso-cliente-bi.spec.ts#L253)  
  `/api/auth/login` · `/api/contatos-sicla` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/bi/clientes-siger/:id`
- **CT-104 — sem SICLA, o ADM recebe a mensagem da conexão — não uma lista vazia**  
  P1 · ativo · [09-acesso-cliente-bi.spec.ts:265](../e2e/testes/09-acesso-cliente-bi.spec.ts#L265)  
  `/api/auth/login` · `/api/contatos-sicla` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/bi/clientes-siger/:id`

### `10-permissoes-rbac.spec.ts`

#### Permissões — a matriz manda no menu e na API · @p0

- **CT-110 — fechar o menu para o PAPEL tira o item da tela e fecha a API**  
  P0 · ativo · [10-permissoes-rbac.spec.ts:40](../e2e/testes/10-permissoes-rbac.spec.ts#L40)  
  `/api/auth/login` · `/api/permissoes` · `/api/permissoes/me` · `/api/permissoes/papel` · `/api/permissoes/usuario` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/rns` · `/api/usuarios` · tela `/home`
- **CT-111 — a exceção por USUÁRIO vence o papel, e "herdar" a desfaz**  
  P0 · ativo · [10-permissoes-rbac.spec.ts:71](../e2e/testes/10-permissoes-rbac.spec.ts#L71)  
  `/api/auth/login` · `/api/permissoes` · `/api/permissoes/me` · `/api/permissoes/papel` · `/api/permissoes/usuario` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/rns` · `/api/usuarios` · tela `/home`
- **CT-112 — só quem tem o menu **  
  P0 · ativo · [10-permissoes-rbac.spec.ts:107](../e2e/testes/10-permissoes-rbac.spec.ts#L107)  
  `/api/auth/login` · `/api/permissoes` · `/api/permissoes/papel` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas`
- **CT-113 — a matriz recusa papel e nível inventados**  
  P0 · ativo · [10-permissoes-rbac.spec.ts:135](../e2e/testes/10-permissoes-rbac.spec.ts#L135)  
  `/api/auth/login` · `/api/permissoes` · `/api/permissoes/me` · `/api/permissoes/papel` · `/api/permissoes/usuario` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/rns` · `/api/usuarios` · tela `/home`
- **CT-114 — as telas de Sistema continuam fixas no Administrador**  
  P0 · ativo · [10-permissoes-rbac.spec.ts:165](../e2e/testes/10-permissoes-rbac.spec.ts#L165)  
  `/api/auth/login` · `/api/permissoes` · `/api/permissoes/me` · `/api/permissoes/papel` · `/api/permissoes/usuario` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/rns` · `/api/usuarios` · tela `/home`

### `11-superficies-publicas.spec.ts`

#### Superfícies públicas — a porta da rua · @p0

- **CT-115 — "esqueci minha senha" responde igual para conta existente e inventada**  
  P0 · ativo · [11-superficies-publicas.spec.ts:32](../e2e/testes/11-superficies-publicas.spec.ts#L32)  
  `/api/auth/esqueci-senha`
- **CT-116 — redefinir com código errado não troca a senha e dá resposta genérica**  
  P0 · ativo · [11-superficies-publicas.spec.ts:55](../e2e/testes/11-superficies-publicas.spec.ts#L55)  
  `/api/auth/login` · `/api/auth/redefinir-senha`
- **CT-117 — /health e /instancia respondem sem sessão, e sem contar demais**  
  P0 · ativo · [11-superficies-publicas.spec.ts:93](../e2e/testes/11-superficies-publicas.spec.ts#L93)  
  `/api/atividades/quadros` · `/api/auth/esqueci-senha` · `/api/auth/login` · `/api/auth/redefinir-senha` · `/api/dados/v1/consultas` · `/api/docs-json` · `/api/health` · `/api/instancia` · `/api/painel/home` · `/api/permissoes` · `/api/presenca` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/protocolos/1/video` · `/api/usuarios`
- **CT-118 — a mídia de protocolo exige o token assinado, não a sessão**  
  P0 · ativo · [11-superficies-publicas.spec.ts:109](../e2e/testes/11-superficies-publicas.spec.ts#L109)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/protocolos/1/video`
- **CT-119 — rota autenticada sem credencial é 401, nunca 200 com dado**  
  P0 · ativo · [11-superficies-publicas.spec.ts:130](../e2e/testes/11-superficies-publicas.spec.ts#L130)  
  `/api/atividades/quadros` · `/api/dados/v1/consultas` · `/api/painel/home` · `/api/permissoes` · `/api/presenca` · `/api/projetos` · `/api/usuarios`
- **CT-120 — nenhuma rota NOVA nasceu sem guarda de autenticação**  
  P0 · ativo · [11-superficies-publicas.spec.ts:149](../e2e/testes/11-superficies-publicas.spec.ts#L149)  
  `/api/docs-json`

### `12-presenca-online.spec.ts`

#### Presença — quem está online · @p0

- **CT-121 — a batida aparece no panorama do ADM com a tela em que a pessoa está**  
  P0 · ativo · [12-presenca-online.spec.ts:54](../e2e/testes/12-presenca-online.spec.ts#L54)  
  `/api/presenca` · `/api/presenca/ping` · `/api/presenca/quantos` · `/api/presenca/sair` · tela `/usuarios/online`
- **CT-122 — a unidade é a ABA: duas abas, duas sessões, um usuário só**  
  P0 · ativo · [12-presenca-online.spec.ts:79](../e2e/testes/12-presenca-online.spec.ts#L79)  
  `/api/presenca` · `/api/presenca/ping` · `/api/presenca/quantos` · `/api/presenca/sair` · tela `/usuarios/online`
- **CT-123 — a aba com a janela em segundo plano é marcada como ociosa**  
  P0 · ativo · [12-presenca-online.spec.ts:111](../e2e/testes/12-presenca-online.spec.ts#L111)  
  `/api/presenca` · `/api/presenca/ping` · `/api/presenca/quantos` · `/api/presenca/sair` · tela `/usuarios/online`
- **CT-124 — todos batem o ponto, mas só o ADM vê a lista**  
  P0 · ativo · [12-presenca-online.spec.ts:135](../e2e/testes/12-presenca-online.spec.ts#L135)  
  `/api/auth/login` · `/api/presenca` · `/api/presenca/ping` · `/api/presenca/quantos` · `/api/presenca/sair` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/usuarios` · tela `/usuarios/online`
- **CT-125 — a tela /usuarios/online abre para o ADM e não para os demais**  
  P0 · ativo · [12-presenca-online.spec.ts:181](../e2e/testes/12-presenca-online.spec.ts#L181)  
  `/api/auth/login` · `/api/presenca` · `/api/presenca/ping` · `/api/presenca/quantos` · `/api/presenca/sair` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/usuarios/online`
- **CT-126 — a batida recusa dado fora do contrato**  
  P0 · ativo · [12-presenca-online.spec.ts:208](../e2e/testes/12-presenca-online.spec.ts#L208)  
  `/api/auth/login` · `/api/presenca` · `/api/presenca/ping` · `/api/presenca/quantos` · `/api/presenca/sair` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/usuarios/online`

### `13-controle-atividades.spec.ts`

#### Controle de Atividades — a fronteira Rech ↔ cliente · @p0

- **CT-127 — o quadro nasce com as colunas padrão, e o Bastidor Rech fechado ao cliente**  
  P0 · ativo · [13-controle-atividades.spec.ts:52](../e2e/testes/13-controle-atividades.spec.ts#L52)  
  `/api/atividades/cartoes` · `/api/atividades/cartoes/:id/mover` · `/api/atividades/cartoes/:id/visibilidade` · `/api/atividades/quadros` · `/api/atividades/quadros/:id` · `/api/atividades/quadros/:id/listas` · `/api/auth/login` · `/api/permissoes/papel` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/usuarios` · tela `/home`
- **CT-128 — um cliente não alcança o quadro do outro**  
  P0 · ativo · [13-controle-atividades.spec.ts:85](../e2e/testes/13-controle-atividades.spec.ts#L85)  
  `/api/atividades/cartoes` · `/api/atividades/cartoes/:id/mover` · `/api/atividades/cartoes/:id/visibilidade` · `/api/atividades/quadros` · `/api/atividades/quadros/:id` · `/api/atividades/quadros/:id/listas` · `/api/auth/login` · `/api/permissoes/papel` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/usuarios` · tela `/home`
- **CT-129 — cartão criado pelo interno nasce FECHADO; compartilhar é ato explícito**  
  P0 · ativo · [13-controle-atividades.spec.ts:130](../e2e/testes/13-controle-atividades.spec.ts#L130)  
  `/api/atividades/cartoes` · `/api/atividades/cartoes/:id/mover` · `/api/atividades/cartoes/:id/visibilidade` · `/api/atividades/quadros` · `/api/atividades/quadros/:id` · `/api/atividades/quadros/:id/listas` · `/api/auth/login` · `/api/permissoes/papel` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/usuarios` · tela `/home`
- **CT-130 — o cartão aberto pelo CLIENTE nasce compartilhado (é uma solicitação)**  
  P0 · ativo · [13-controle-atividades.spec.ts:166](../e2e/testes/13-controle-atividades.spec.ts#L166)  
  `/api/atividades/cartoes` · `/api/atividades/cartoes/:id/mover` · `/api/atividades/cartoes/:id/visibilidade` · `/api/atividades/quadros` · `/api/atividades/quadros/:id` · `/api/atividades/quadros/:id/listas` · `/api/auth/login` · `/api/permissoes/papel` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/usuarios` · tela `/home`
- **CT-131 — o cliente não empurra o próprio cartão para dentro do bastidor da Rech**  
  P0 · ativo · [13-controle-atividades.spec.ts:194](../e2e/testes/13-controle-atividades.spec.ts#L194)  
  `/api/atividades/cartoes` · `/api/atividades/cartoes/:id/mover` · `/api/atividades/cartoes/:id/visibilidade` · `/api/atividades/quadros` · `/api/atividades/quadros/:id` · `/api/atividades/quadros/:id/listas` · `/api/auth/login` · `/api/permissoes/papel` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/usuarios` · tela `/home`
- **CT-132 — interno não designado LÊ o quadro e não ESCREVE nele**  
  P0 · ativo · [13-controle-atividades.spec.ts:247](../e2e/testes/13-controle-atividades.spec.ts#L247)  
  `/api/atividades/cartoes` · `/api/atividades/cartoes/:id/mover` · `/api/atividades/cartoes/:id/visibilidade` · `/api/atividades/quadros` · `/api/atividades/quadros/3180/listas` · `/api/atividades/quadros/:id` · `/api/atividades/quadros/:id/listas` · `/api/auth/login` · `/api/permissoes/papel` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · `/api/usuarios` · tela `/home`
- **CT-133 — sem o menu **  
  P0 · ativo · [13-controle-atividades.spec.ts:275](../e2e/testes/13-controle-atividades.spec.ts#L275)  
  `/api/atividades/cartoes` · `/api/atividades/cartoes/:id/mover` · `/api/atividades/cartoes/:id/visibilidade` · `/api/atividades/quadros` · `/api/atividades/quadros/:id` · `/api/atividades/quadros/:id/listas` · `/api/auth/login` · `/api/permissoes/papel` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/home`

### `90-auditoria-varredura.spec.ts`

#### Auditoria — varredura de rotas · @p2

- **CT-105 — ADM percorre todas as rotas estáticas sem erro de console nem HTTP**  
  P2 · ativo · [90-auditoria-varredura.spec.ts:127](../e2e/testes/90-auditoria-varredura.spec.ts#L127)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/rota-que-nao-existe-xyz`
- **CT-106 — rotas de um PROJETO real abrem sem erro**  
  P2 · ativo · [90-auditoria-varredura.spec.ts:142](../e2e/testes/90-auditoria-varredura.spec.ts#L142)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/rota-que-nao-existe-xyz`
- **CT-107 — rota inexistente não quebra — cai no fallback do roteador**  
  P2 · ativo · [90-auditoria-varredura.spec.ts:158](../e2e/testes/90-auditoria-varredura.spec.ts#L158)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/rota-que-nao-existe-xyz`
#### Auditoria — responsividade · @p2

- **CT-108 — sem overflow horizontal em ${vp.nome} (${vp.width}px)**  
  P2 · ativo · [90-auditoria-varredura.spec.ts:178](../e2e/testes/90-auditoria-varredura.spec.ts#L178)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/rota-que-nao-existe-xyz`
#### Auditoria — menu por perfil · @p1

- **CT-109 — menu do ${login} mostra o que deve e esconde o que não deve**  
  P1 · ativo · [90-auditoria-varredura.spec.ts:218](../e2e/testes/90-auditoria-varredura.spec.ts#L218)  
  `/api/auth/login` · `/api/projetos` · `/api/projetos/:id` · `/api/projetos/:id/passos/:id/concluir` · `/api/projetos/:id/passos/:id/conferir` · `/api/projetos/:id/pessoas` · tela `/home`---

## 6. Dados de teste e isolamento

**Banco descartável por execução.** SQLite em arquivo, fora do repositório. Zerar o ambiente
é apagar o arquivo e subir de novo — o schema nasce por `synchronize` e o ADM por
`npm run seed:admin`.

**Seed determinística.** [`e2e/apoio/semear-usuarios.mjs`](../e2e/apoio/semear-usuarios.mjs)
cria 11 logins, todos com senha `Teste@123`, e é **idempotente**: quem já existe é pulado, e
ao final ele confere que todos estão lá — sem isso, um teste falharia por ambiente, não por
defeito. O script **recusa a porta 5100**, como o `playwright.config.ts`.

| Login | Papel | Para quê |
| --- | --- | --- |
| `adm` | ADM | preparo de estado e casos de Sistema |
| `comercial`, `administrativo`, `coordenador`, `gci`, `consultor`, `levantador` | um por papel | gates por papel |
| `gabriel.gci`, `cesar.consultor`, `lucia.levantadora` | GCI / Consultor / Levantador | os **nomes** que `projetoNoPasso` designa — a RN-10 é por designação, então o teste precisa de gente designável |
| `cliente.acme` (código `3180`), `cliente.outro` (código `3729`) | Cliente | são **dois de propósito**: o que se prova é que um não alcança o outro, e isso exige dois |

**Cada caso monta o que consome.** Projetos nascem com nome único (`Cliente X ${Date.now()}`);
as sessões de presença usam sufixo `e2e-${Date.now()}-${aleatório}` e são encerradas no
`finally`; as alterações na matriz de permissões são revertidas no `finally`. Não há ordem
entre casos.

**Preparo ≠ objeto do teste.** [`apoio/painel.ts:projetoNoPasso()`](../e2e/apoio/painel.ts)
leva um projeto até o passo desejado **pela API, com token de ADM**. Isso é montagem de
cenário; o que se exercita na tela é sempre o passo em questão, com o usuário do papel certo.

**Credenciais.** Só as da instância descartável, e elas são literais de propósito (o CT-053
usa `Teste@123` como prova de que não é produção). Nenhum segredo real entra em spec,
configuração ou neste documento.

---

## 7. Convenções

**IDs.** `CT-001` em diante, sequenciais, **nunca reaproveitados**. O ID abre o título do
`test`, então o relatório do Playwright e este documento se conversam sem trabalho manual.
Caso removido vira `CT-0NN — REMOVIDO (motivo, data)` na Seção 13; o número não volta.

**Tags de prioridade.** Uma por caso, no `test.describe` (ou no próprio `test`, quando ele
está fora de um grupo):

| Tag | O que é | Onde roda |
| --- | --- | --- |
| `@p0` | a quebra impede o uso ou expõe dado: login, autorização, gates dos 21 passos, fronteira Rech↔cliente, API de Dados | **todo PR** |
| `@p1` | funcionalidade relevante com alternativa manual: CRUDs, conteúdo de e-mail, menu por papel | suíte completa |
| `@p2` | apresentação, varredura ampla, tela rara | suíte completa / noturno |
| `@smoke` | sanidade do ambiente (inclusive "isto não é produção") | primeiro, sempre |

**Seletores.** `getByRole` → `getByLabel` → `getByText` → `data-testid`. Seletor CSS
estrutural e XPath posicional são proibidos. Um detalhe desta base: na tela do Projeto os
campos são localizados **pelo rótulo**, nunca por `[name=...]` — o `name` é consumido pela
diretiva `NgModel` do Angular e não chega ao DOM.

**Espera.** Só auto-waiting e web-first assertions. `waitForTimeout` sobrevive em dois
pontos do `90-auditoria-varredura.spec.ts`, onde o que se espera é a estabilização de layout
depois de trocar o viewport — está registrado aqui como dívida consciente, não como padrão.

**Nomes.** Arquivos `NN-assunto.spec.ts`, numerados na ordem em que se lê a suíte:
`01`..`13` são os assuntos; `90` é a varredura ampla, que roda por último por ser a mais lenta.

**Estrutura.**

```text
e2e/
  testes/          # os specs — um arquivo por assunto
  apoio/           # helpers: painel.ts (login, token, projetoNoPasso), insumo-local.ts,
                   # portal-api.ts, semear-usuarios.mjs
  playwright.config.ts
  README.md        # como subir a instância isolada (o passo a passo com as guardas)
```

---

## 8. Execução

```bash
cd e2e
npm test                 # suíte completa: 140 casos, ~4 min
npm run test:p0          # gate de PR: 105 casos, ~2 a 3,5 min
npm run test:smoke       # sanidade do ambiente: 6 casos, ~11 s
npm run test:tres        # três execuções seguidas (caça a instabilidade, Fase 7)
npm run report           # relatório HTML da última execução
npx playwright test --ui # modo interativo
```

Pela extensão **Playwright Test for VSCode**, os casos aparecem na aba de testes assim que o
`e2e/playwright.config.ts` é detectado — dá para rodar e depurar um `CT-###` isolado.

---

## 9. Regra de atualização (obrigatória)

**Toda nova implementação entra neste documento antes de ser considerada pronta.** Esta seção
é a Fase 8 do gerador e não pode ser removida — é o que impede a resposta da Seção 3 de
envelhecer.

### 9.1 Definition of Done

Uma implementação só está concluída quando:

1. A superfície nova (rota, tela, campo, API, job, permissão, regra) foi acrescentada à
   **Seção 3**.
2. Existe pelo menos um `CT-###` na **Seção 4** cobrindo o caminho feliz — e, se for **P0**,
   também o caminho de erro.
3. O spec correspondente existe, roda e passa.
4. A **Seção 13** registra a mudança e a versão do documento foi incrementada.

### 9.2 Varredura delta

```bash
# o que mudou desde o estado de referência do cabeçalho
git diff --name-only <estado-de-referência>..HEAD

# a contagem de rotas ainda bate com a Seção 3?
grep -rhoE "@(Get|Post|Put|Patch|Delete|All)\(" --include="*.controller.ts" \
  backend/src --exclude="*.spec.ts" | wc -l      # 309 ocorrências − 3 em comentário = 306
grep -cE "^\s*path:" frontend/src/app/app.routes.ts   # 89
```

Para cada arquivo alterado: *nasceu rota, tela, campo, permissão, job, integração ou regra de
negócio?* Se sim → nova superfície → novo caso → atualizar documento **e** suíte. Diferença
positiva de contagem não explicada = superfície não documentada.

### 9.3 Gate de cobertura

O checklist está replicado no [template de PR](../.github/pull_request_template.md), que
aparece sozinho a cada pull request:

- [ ] Rodei a varredura delta.
- [ ] Toda superfície nova está na Seção 3.
- [ ] Toda superfície P0 nova tem caso na Seção 4 e spec passando.
- [ ] Nenhum `CT-###` foi renumerado ou reaproveitado.
- [ ] Seção 13 atualizada e versão incrementada.
- [ ] `npm run test:p0` verde em três execuções seguidas.

### 9.4 O que é automático

Três mecanismos seguram a regra sem depender de memória:

| Mecanismo | O que faz | Onde |
| --- | --- | --- |
| **CT-120** | varre o Swagger da instância e falha se um `GET` novo responder sem credencial estando fora da lista `PUBLICAS` | [`11-superficies-publicas.spec.ts`](../e2e/testes/11-superficies-publicas.spec.ts) |
| **Gate de CI** | falha o PR que mexe em controller, `app.routes.ts`, entity ou `menus.ts` **sem** tocar neste documento; e confere que todo `CT-###` daqui tem spec e vice-versa | [`.github/workflows/cobertura-teste-integrado.yml`](../.github/workflows/cobertura-teste-integrado.yml) |
| **Template de PR** | põe o checklist 9.3 na frente de quem abre o PR | [`.github/pull_request_template.md`](../.github/pull_request_template.md) |

---

## 10. Integração contínua

| Workflow | Quando | O que faz |
| --- | --- | --- |
| [`e2e.yml`](../.github/workflows/e2e.yml) | todo PR (+ `workflow_dispatch`) | monta a stack inteira, sobe a 5199 e a 5198, **prova que o banco é `better-sqlite3`** antes de rodar, semeia os usuários e executa a suíte em Chromium |
| [`cobertura-teste-integrado.yml`](../.github/workflows/cobertura-teste-integrado.yml) | todo PR | o gate da §9.4 |
| [`ci.yml`](../.github/workflows/ci.yml) | todo PR | Jest (backend), Vitest (frontend), `tools/verificar.py` |

**Artefatos em falha:** `e2e/relatorio` (HTML do Playwright) e `painel-e2e.log`, publicados
pelo `upload-artifact`. A configuração guarda **trace, screenshot e vídeo só em falha**
(`retain-on-failure`) — é o suficiente para investigar sem inflar o artefato.

**Retry: zero, de propósito.** `retries: 0` no `playwright.config.ts`. Reexecutar um caso que
falhou esconde instabilidade em vez de corrigi-la, e um teste instável ensina o time a
ignorar o vermelho — o que já aconteceu neste repositório (achado A19 da Auditoria de
Prontidão: a suíte existia e ficava fora do CI).

**O caso que pula no CI, e por quê.** O CT-048 é o único que **gera** documento e depende dos
layouts oficiais, que não vão para o git. Ele **pergunta à instância** se o Cadastro de
Modelos tem o arquivo e se pula com o motivo no relatório, em vez de falhar. Local, com os
layouts presentes, ele roda inteiro. O mesmo vale para os casos de administração da API de
Dados quando a 5198 não está no ar.

---

## 11. Estabilidade

**Nenhum caso em quarentena.** Não há `test.fixme` nesta suíte.

**Medido em 2026-09-02**, na instância isolada, com o critério da Fase 7 — a suíte inteira
**três vezes seguidas**:

| Execução | Resultado | Tempo |
| --- | --- | --- |
| 1ª | 140 passed, 0 failed, 0 flaky | 3,9 min |
| 2ª | 140 passed, 0 failed, 0 flaky | 4,3 min |
| 3ª | 140 passed, 0 failed, 0 flaky | 5,1 min |
| `@p0` (gate de PR) | 105 passed | 3,4 min |
| `@p0` **em máquina limpa** (banco apagado, ADM e usuários semeados do zero) | 105 passed | **2,0 min** |
| `@smoke` | 6 passed | 11 s |

Nada oscilou. A variação de tempo entre execuções é da máquina e do volume acumulado no
banco descartável, não dos casos — daí o gate ser mais rápido em banco limpo, que é
exatamente a condição do CI.

Critério de aprovação da Fase 7: a suíte inteira roda **três vezes seguidas** sem oscilar.
Caso que oscilar é corrigido **pela causa** (espera de rede, dado compartilhado, animação),
nunca aumentando `retries`. Se não der para estabilizar na hora, o caminho é `test.fixme` +
uma linha nesta seção com causa, responsável e prazo — nunca apagar em silêncio.

| Caso | Sintoma | Causa suspeita | Responsável | Prazo |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

**Pontos de atenção conhecidos** (não são instabilidade hoje, mas são onde ela apareceria):

- `90-auditoria-varredura.spec.ts` usa `waitForTimeout` após trocar o viewport. É a única
  espera cega da suíte. Se ela virar fonte de oscilação, a correção é esperar por um estado
  observável do layout, não aumentar o tempo.
- A suíte roda **serial** (`fullyParallel: false`, `workers: 1`) de propósito: o processo de
  implantação é sequencial e vários casos caminham pelo mesmo projeto. Paralelizar embaralha
  o estado dos passos.
- CT-110, CT-114 e CT-133 **alteram a matriz de permissões** e revertem no `finally`. Uma
  interrupção brusca (Ctrl+C) no meio de um deles deixa a matriz alterada — é banco
  descartável, então a correção é apagar o SQLite e semear de novo.

---

## 12. Lacunas conhecidas (backlog)

O que **não** está coberto, com prioridade e onde entrar. Nada aqui é surpresa: é a saída da
Fase 3 aplicada ao que sobrou.

| # | Lacuna | Prio | Por que ainda não | Próximo passo |
| --- | --- | --- | --- | --- |
| L1 | **`cronograma`** — 26 rotas, nenhuma exercitada | P1 | é o maior módulo sem caso; o cronograma do projeto tem tela própria e regras de distribuição de agenda | um caso de ciclo (criar → distribuir → ler) + um de autorização por designação |
| L2 | **`plano-cronograma`** — 6 rotas | P1 | é o **módulo de referência da arquitetura** e ainda não tem e2e próprio | ciclo do checklist e do cronograma do plano, com o gate `coordenacao` |
| L3 | **`levantamento`** — 9 rotas | P1 | hoje só é preenchido pela API no preparo do CT-047/048 | exercitar a etapa 3 pela tela, com o papel Levantador |
| L4 | **`designacao`** — 6 rotas | P1 | coberta *indiretamente* pelo gate RN-10 (CT-017..023), mas as rotas próprias (`definir-gci`, `consultores`, `agendar`) não têm caso | um caso por rota, com o papel que responde por ela |
| L5 | **`controle-atividades`** — 29 das 34 rotas | P1 | a fronteira Rech↔cliente está coberta (CT-127..133); falta o resto do cartão | checklist, comentários, anexos, membros e a importação do Trello |
| L6 | **`painel`** — 6 rotas (Visão Geral, Coordenação, Centro Operacional) | P1 | telas de leitura agregada | um caso de leitura por tela, com o gate de menu |
| L7 | **`protocolos`** — 25 rotas | P1 | transcrição depende do `docservice`, que não sobe na 5199 | subir o docservice no CI, ou cobrir só o que não depende dele |
| L8 | **`catalogos`** — checklist e índice de tópicos | P1 | o Cadastro de Modelos já é tocado pelo `insumo-local` | ciclo de cada catálogo |
| L9 | **`documentos`** — anexos e listagem | P1 | geração e gate cobertos (CT-018/019/048) | listar, baixar e excluir anexo |
| L10 | Módulos que dependem do **SICLA** (`agenda`, `rns`, `bi-*`, `*-sicla`, `disponibilidade`) | P2 | sem credencial na 5199, por decisão do ADR-0003 | o que dá para cobrir é a **degradação** (503 com aviso na tela), no molde do CT-104 |
| L11 | `legado`, `matriz*`, `rechedu`, `ia`, `prontidao`, `automacao`, `agentes` | P2 | telas raras ou dependentes de serviço externo | oportunista |
| L12 | Os 4 **robôs** de fundo | P2 | pulados com `NODE_ENV=test`, então inalcançáveis pelo e2e | manter a cobertura unitária; se precisar de e2e, será preciso um modo que os ligue sob demanda |

**Onde as lacunas estão detalhadas rota a rota:** §12.1, logo abaixo.


### 12.1 Rotas sem nenhum caso, por módulo

- **`agentes`** (2/4): `POST /agentes/execucoes`, `PATCH /agentes/execucoes/:id`
- **`auth`** (4/7): `POST /auth/logout`, `GET /auth/me`, `POST /auth/refresh`, `POST /auth/trocar-senha`
- **`automacao`** (3/3): `GET /automacao`, `POST /automacao/pausar`, `POST /automacao/retomar`
- **`bi-implantacao`** (1/8): `GET /bi-implantacao/extrato/descricao`
- **`cadastro`** (3/3): `POST /cadastro`, `POST /cadastro/confirmar`, `POST /cadastro/reenviar`
- **`catalogos`** (11/14): `POST /cadastros/checklist`, `DELETE /cadastros/checklist/:id`, `POST /cadastros/checklist/reimportar`, `GET /cadastros/indice`, `POST /cadastros/indice`, `DELETE /cadastros/indice/:id`, `POST /cadastros/indice/reimportar`, `GET /cadastros/modelos/:id`, `POST /cadastros/modelos/:id/campos`, `DELETE /cadastros/modelos/:id/campos/:campoId`, `POST /cadastros/modelos/:id/versao`
- **`clientes-sicla`** (2/2): `POST /clientes-sicla`, `GET /clientes-sicla/buscar`
- **`contatos-sicla`** (2/3): `POST /contatos-sicla/liberar`, `POST /contatos-sicla/revogar`
- **`controle-atividades`** (26/34): `GET /atividades/busca`, `DELETE /atividades/cartoes/:id`, `PATCH /atividades/cartoes/:id`, `POST /atividades/cartoes/:id/anexos`, `DELETE /atividades/cartoes/:id/anexos/:anexoId`, `GET /atividades/cartoes/:id/anexos/:anexoId`, `POST /atividades/cartoes/:id/anexos/link`, `POST /atividades/cartoes/:id/checklist`, `DELETE /atividades/cartoes/:id/checklist/:itemId`, `PATCH /atividades/cartoes/:id/checklist/:itemId`, `POST /atividades/cartoes/:id/comentarios`, `POST /atividades/cartoes/:id/membros`, `DELETE /atividades/cartoes/:id/membros/:membroId`, `GET /atividades/clientes`, `GET /atividades/consultores`, `GET /atividades/contatos/:codigo`, `GET /atividades/etiquetas`, `DELETE /atividades/listas/:id`, `PATCH /atividades/listas/:id`, `POST /atividades/notificacoes/lidas`, `GET /atividades/projetos-disponiveis`, `POST /atividades/quadros/:codigo/importar/trello`, `POST /atividades/quadros/:codigo/importar/trello/previa`, `POST /atividades/quadros/:codigo/responsaveis`, `DELETE /atividades/quadros/:codigo/responsaveis/:usuarioId`, `POST /atividades/quadros/:codigo/responsaveis/sincronizar`
- **`cronograma`** (18/26): `GET /projetos/:projetoId/agenda/acompanhamento`, `POST /projetos/:projetoId/agenda/alocar-visita`, `POST /projetos/:projetoId/agenda/alocar/:atividadeId`, `GET /projetos/:projetoId/agenda/atividades`, `DELETE /projetos/:projetoId/agenda/atividades/:atividadeId`, `PUT /projetos/:projetoId/agenda/atividades/:atividadeId/status`, `PUT /projetos/:projetoId/agenda/config`, `POST /projetos/:projetoId/agenda/desfazer-tudo`, `PUT /projetos/:projetoId/agenda/designacoes`, `POST /projetos/:projetoId/agenda/distribuir`, `POST /projetos/:projetoId/agenda/gerar`, `PUT /projetos/:projetoId/agenda/horarios`, `POST /projetos/:projetoId/agenda/periodos`, `DELETE /projetos/:projetoId/agenda/periodos/:periodoId`, `POST /projetos/:projetoId/agenda/postergar`, `POST /projetos/:projetoId/agenda/postergar-visita`, `POST /projetos/:projetoId/agenda/redistribuir`, `POST /projetos/:projetoId/agenda/reorganizar-modulo`
- **`dados`** (29/33): `GET /config/consultas-bd`, `POST /config/consultas-bd`, `GET /config/consultas-bd/:slug`, `POST /config/consultas-bd/:slug`, `POST /config/consultas-bd/:slug/excluir`, `POST /config/consultas-bd/:slug/testar`, `POST /dados/v1/admin/cache/limpar`, `GET /dados/v1/admin/clientes`, `POST /dados/v1/admin/clientes`, `DELETE /dados/v1/admin/clientes/:id`, `PATCH /dados/v1/admin/clientes/:id`, `PATCH /dados/v1/admin/clientes/:id/ativo`, `POST /dados/v1/admin/clientes/:id/rotacionar`, `GET /dados/v1/admin/clientes/consultas-disponiveis`, `GET /dados/v1/admin/conexoes`, `POST /dados/v1/admin/conexoes/:chave`, `POST /dados/v1/admin/conexoes/:chave/testar`, `GET /dados/v1/admin/consultas`, `POST /dados/v1/admin/consultas`, `DELETE /dados/v1/admin/consultas/:slug`, `GET /dados/v1/admin/consultas/:slug`, `POST /dados/v1/admin/consultas/analisar`, `GET /dados/v1/admin/metricas`, `GET /dados/v1/conexoes`, `GET /dados/v1/consultas`, `GET /dados/v1/consultas/:nome`, `POST /dados/v1/consultas/:nome/executar`, `PUT /dados/v1/tokens/:id`, `PATCH /dados/v1/tokens/:id/ativo`
- **`designacao`** (5/6): `GET /projetos/:id/agendar`, `POST /projetos/:id/agendar`, `POST /projetos/:id/consultores`, `GET /projetos/:id/definir-gci`, `POST /projetos/:id/definir-gci`
- **`documentos`** (6/10): `DELETE /documentos/:id`, `GET /documentos/:id/baixar`, `GET /documentos/:id/preview`, `POST /projetos/:projetoId/anexar`, `POST /projetos/:projetoId/avancar`, `POST /projetos/:projetoId/nota`
- **`email`** (5/10): `POST /config/email`, `POST /config/graph`, `POST /config/modelos-email`, `GET /config/modelos-email/:id`, `POST /config/modelos-email/:id/excluir`
- **`fluxo`** (5/8): `POST /config/imap`, `POST /fluxo/criar`, `POST /fluxo/inbox`, `POST /fluxo/parse`, `POST /projetos/:projetoId/email`
- **`ia`** (1/3): `POST /config/ia`
- **`legado`** (11/11): `GET /legado/baixar/:token`, `GET /legado/catalogo`, `POST /legado/cliente`, `POST /legado/criar-templates`, `POST /legado/form-modulos`, `POST /legado/gerar`, `GET /legado/ia-status`, `POST /legado/importar`, `GET /legado/saude`, `POST /legado/verbal/docx`, `POST /legado/verbal/texto`
- **`levantamento`** (5/9): `PUT /projetos/:projetoId/levantamento`, `PATCH /projetos/:projetoId/levantamento/:linhaId`, `GET /projetos/:projetoId/levantamento/gravacoes`, `DELETE /projetos/:projetoId/levantamento/presenca`, `POST /projetos/:projetoId/levantamento/sugerir`
- **`matriz`** (3/4): `GET /matriz/:id`, `POST /matriz/:id/salvar`, `POST /matriz/importar`
- **`matriz-detalhada`** (2/3): `GET /matriz-detalhada/:id`, `POST /matriz-detalhada/:id/salvar`
- **`matriz-funcoes`** (3/4): `GET /matriz-funcoes/:id`, `POST /matriz-funcoes/:id/salvar`, `POST /matriz-funcoes/recarregar`
- **`modulos-sicla`** (1/1): `GET /modulos-sicla/buscar`
- **`painel`** (1/6): `POST /painel/coordenacao/digest`
- **`passos`** (9/21): `DELETE /config/destinatarios-passo/:passo`, `PUT /config/destinatarios-passo/:passo`, `GET /passos/grade`, `GET /passos/pessoas-por-papel/:papel`, `POST /projetos/:id/emails/:emailId/reenviar`, `DELETE /projetos/:id/passos/:numero`, `POST /projetos/:id/passos/:numero/anexar-email`, `POST /projetos/:id/passos/:numero/anexo-email`, `GET /projetos/:id/pessoas`
- **`plano-cronograma`** (4/6): `POST /projetos/:id/checklist`, `POST /projetos/:id/checklist/seed`, `POST /projetos/:id/cronograma`, `POST /projetos/:id/cronograma/seed`
- **`prontidao`** (1/1): `GET /prontidao`
- **`protocolos`** (23/25): `DELETE /protocolos/:id`, `GET /protocolos/:id`, `POST /protocolos/:id/aprovar`, `POST /protocolos/:id/cancelar`, `POST /protocolos/:id/enviar-portal`, `POST /protocolos/:id/locutores`, `POST /protocolos/:id/processar`, `GET /protocolos/:id/rascunho-visita`, `POST /protocolos/:id/reprovar`, `POST /protocolos/:id/salvar`, `GET /protocolos/:id/status`, `GET /protocolos/:id/video-ticket`, `GET /protocolos/clientes`, `GET /protocolos/clientes-com-protocolo`, `POST /protocolos/gravacao`, `DELETE /protocolos/gravacao/:id`, `GET /protocolos/gravacao/:id`, `POST /protocolos/gravacao/:id/finalizar`, `POST /protocolos/gravacao/:id/trecho`, `POST /protocolos/novo`, `DELETE /protocolos/portal/credencial`, `GET /protocolos/portal/credencial`, `POST /protocolos/portal/credencial`
- **`rechedu`** (3/3): `DELETE /rechedu/credencial`, `GET /rechedu/credencial`, `POST /rechedu/credencial`
- **`rns`** (1/2): `GET /rns/detalhe`
- **`saude`** (1/2): `GET /saude/metricas`
- **`tecnicos-sicla`** (2/2): `GET /tecnicos-sicla`, `POST /tecnicos-sicla/importar`
- **`users`** (2/5): `DELETE /usuarios/:id`, `GET /usuarios/:id`

---

## 13. Histórico

| Data | Versão | Mudança | Casos afetados |
| --- | --- | --- | --- |
| 2026-09-02 | 1.0.0 | **Criação do documento.** Aplicação do gerador sobre a suíte que já existia: inventário completo das 306 rotas e 89 telas, numeração `CT-###` estável para os 109 casos existentes (sem alterar nenhuma asserção), tags de prioridade, e o gate de perpetuidade (§9). | CT-001..CT-109 |
| 2026-09-03 | 1.0.1 | **Correção de defeito, sem superfície nova.** `GET /api/atividades/contatos/:codigo` passou a chamar a consulta `sicla.contatos.do-cliente` (agenda do cliente) em vez de `sicla.contatos.listar` (autorização, filtrada por `PORTAL_RECH_CLIENTES = 1`) — o seletor "do lado do cliente" do cartão oferecia quase ninguém. A rota é a mesma, o contrato de resposta é o mesmo: a Seção 3 não muda. Coberto por teste **unitário** (5 casos em `contatos-sicla.service.spec.ts` e 2 em `controle-atividades.component.spec.ts`), não por caso e2e — a consulta depende do SICLA, que por decisão não existe na instância isolada (ver Seção 1). | — |
| 2026-09-02 | 1.0.0 | **Cobertura P0 nova** — os buracos que a varredura encontrou: painel de Permissões (o RBAC dirigido por banco não tinha nenhum caso), superfícies públicas (enumeração de conta e rota nova sem guarda), Controle de Acessos/presença (entregue em 2026-09-01, sem cobertura) e Controle de Atividades (34 rotas, a fronteira Rech↔cliente sem nenhum caso). | CT-110..CT-133 |

### Registro de IDs removidos

Nenhum até aqui. Quando houver, a linha entra assim — e o número **não volta a ser usado**:

```text
CT-0NN — REMOVIDO (motivo, AAAA-MM-DD)
```
