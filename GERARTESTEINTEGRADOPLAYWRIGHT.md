# Gerador de Teste Integrado com Playwright

> **O que é este arquivo:** um *meta-documento* reutilizável. Ele **não** é a documentação de
> testes de nenhum projeto — ele é a receita que faz um agente de IA (ou uma pessoa) **ler um
> projeto inteiro** e **produzir** a documentação de testes `TESTES-INTEGRADOS.md` junto com uma
> suíte Playwright executável.
>
> **Independente de stack e de projeto.** Serve para qualquer aplicação web: Flask, FastAPI,
> Django, Node/Express, Next.js, Rails, Laravel, Spring, .NET, SPA pura ou app renderizado no
> servidor.
>
> **Contrato central:** *toda nova implementação entra na documentação e, portanto, entra no
> teste integrado.* A Fase 8 e a Seção 9 do documento gerado são obrigatórias e não podem ser
> removidas.
>
> **Como distribuir:** copie este único arquivo para `docs/` de qualquer repositório. Ele não
> depende de nada externo.

---

## 0. Como usar

### 0.1 Primeira geração

Coloque o arquivo em `docs/` e dispare o agente com:

```text
Leia docs/GERAR-TESTE-INTEGRADO-PLAYWRIGHT.md e execute-o do início ao fim neste projeto.
Escopo: <caminho da aplicação, ou "todo o repositório">.
URL base sob teste: <http://localhost:PORTA, ou "descobrir a partir do projeto">.
Entregue ao final: docs/TESTES-INTEGRADOS.md, a suíte Playwright rodando e o resumo de cobertura.
```

### 0.2 Atualização depois de novas funcionalidades

```text
Execute a Fase 8 (varredura delta) de docs/GERAR-TESTE-INTEGRADO-PLAYWRIGHT.md,
comparando o projeto com o estado registrado no fim de docs/TESTES-INTEGRADOS.md.
```

### 0.3 Entregáveis obrigatórios

| # | Entregável | Caminho sugerido |
|---|---|---|
| 1 | Documentação do teste integrado | `docs/TESTES-INTEGRADOS.md` |
| 2 | Inventário bruto da varredura | `docs/_inventario-superficies.md` |
| 3 | Configuração do runner | `playwright.config.ts` |
| 4 | Suíte de specs | `tests/e2e/**` |
| 5 | Fixtures, Page Objects e seeds | `tests/support/**` |
| 6 | Comando único de execução | script em `package.json`, `Makefile` ou equivalente |
| 7 | Gate de manutenção | Seção 9 do documento gerado + checklist de PR |

---

## 1. Princípios inegociáveis

1. **Ler antes de escrever.** Nenhum caso de teste é inventado: todo caso rastreia até um
   arquivo e linha reais do projeto.
2. **Integrado é ponta a ponta.** O teste sobe a aplicação de verdade (servidor + banco +
   sessão) e navega como um usuário. Mock só na fronteira externa paga, lenta ou não
   determinística — gateway de pagamento, envio de e-mail, API de terceiros.
3. **Determinismo acima de cobertura.** Um teste instável vale menos que teste nenhum, porque
   ensina o time a ignorar o vermelho.
4. **Rastreabilidade.** Todo caso tem ID estável (`CT-###`) que nunca é reciclado.
5. **Documento vivo.** O MD gerado é a fonte da verdade; os specs são a implementação dele.
   Divergência entre os dois é bug de documentação.
6. **Sem dado real.** Nenhuma credencial, chave, token ou dado de cliente entra no documento
   ou nos specs — apenas variáveis de ambiente e usuários de teste.

---

## 2. Fase 1 — Leitura total do projeto

O objetivo desta fase é não deixar nenhuma superfície testável escapar.

### 2.1 Delimitar o escopo

```bash
find . -maxdepth 3 -type d \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/venv/*" | sort
```

Confirme onde vive a aplicação antes de ler qualquer código.

### 2.2 O que **não** ler

`node_modules/`, `.git/`, `venv/`, `.venv/`, `__pycache__/`, `vendor/`, `dist/`, `build/`,
`.next/`, `target/`, `coverage/`, `*.min.js`, `*.map`, binários, mídia, dumps e qualquer
caminho listado em `.gitignore`.

### 2.3 Ordem de leitura (do contrato para o detalhe)

1. **Manifestos** — `package.json`, `requirements.txt`, `pyproject.toml`, `go.mod`, `Gemfile`,
   `composer.json`, `*.csproj`, `pom.xml`: linguagem, framework, scripts, versões.
2. **Deploy e execução** — `Dockerfile`, `docker-compose.yml`, `Procfile`, `Makefile`, scripts
   `*.sh` / `*.bat`, `README`: **como a aplicação sobe e em qual porta**.
3. **Configuração** — `.env.example`, arquivos de settings/config: variáveis obrigatórias,
   feature flags, modo debug, ambientes.
4. **Ponto de entrada** — o arquivo que instancia o servidor.
5. **Rotas, controllers e handlers** — a lista **completa**, sem amostragem.
6. **Autenticação e autorização** — login, sessão, papéis, middlewares, decorators, guards.
7. **Camada de apresentação** — templates, páginas, componentes: telas reais, formulários,
   botões, tabelas, estados vazios e de erro.
8. **Modelos e persistência** — schema, migrações, seeds, constraints.
9. **Assíncrono** — jobs agendados, cron, filas, workers, threads de background, WebSocket, SSE.
10. **Integrações externas** — clientes HTTP, SDKs, e-mail, webhooks, storage.
11. **Testes existentes** — reaproveite fixtures e evite duplicar cobertura.

### 2.4 Comandos de varredura (adapte ao stack encontrado)

```bash
# Rotas — Python (Flask / FastAPI)
grep -rnE "@(app|bp|router)\.(route|get|post|put|patch|delete)" --include="*.py" .

# Rotas — Node (Express / NestJS)
grep -rnE "(app|router)\.(get|post|put|patch|delete)\(|@(Get|Post|Put|Patch|Delete)\(" \
  --include="*.js" --include="*.ts" .

# Rotas — arquivos de roteamento por convenção
find . -type d \( -name "pages" -o -name "routes" -o -name "app" \) -not -path "*/node_modules/*"

# Telas e formulários
grep -rnE "<form|type=[\"']submit[\"']|onSubmit|action=" \
  --include="*.html" --include="*.jsx" --include="*.tsx" --include="*.vue" .

# Guardas de acesso
grep -rniE "login_required|authorize|isAuthenticated|permission|role|session\[|@Guard" .

# Trabalho assíncrono
grep -rniE "cron|schedule|celery|sidekiq|setInterval|BackgroundTasks|Thread\(|queue" .

# Integrações externas
grep -rniE "requests\.|httpx|axios|fetch\(|smtp|webhook|s3|storage" .
```

### 2.5 Saída da Fase 1 — inventário de superfícies

Grave `docs/_inventario-superficies.md` com **uma linha por superfície descoberta**:

| Tipo | Identificador | Origem (arquivo:linha) | Auth | Método | Observação |
|---|---|---|---|---|---|
| Página | `/exemplo` | `<arquivo>:<linha>` | sessão | GET | tabela paginada |
| API | `/api/exemplo` | `<arquivo>:<linha>` | token | POST | valida payload |
| Job | `<nome-do-job>` | `<arquivo>:<linha>` | — | agendado | roda a cada 15 min |

Tipos válidos: `Página`, `API`, `Formulário`, `Job`, `Webhook`, `Download`, `Upload`,
`E-mail`, `Integração externa`, `Estado de erro`.

**Critério de saída:** a contagem de rotas do inventário bate com a contagem do `grep`. Se não
bater, a varredura está incompleta — repita antes de avançar.

---

## 3. Fase 2 — Transformar superfícies em jornadas

Superfície isolada vira teste de unidade. **Teste integrado testa jornada.** Agrupe o
inventário em fluxos com valor de negócio:

- **Acesso:** visitante → cadastro/login → área restrita → logout.
- **Jornada principal:** o caminho feliz completo da razão de existir do produto.
- **Escrita:** criar → disparar erro de validação → corrigir → salvar → conferir persistência
  após recarregar a página.
- **Administrativa:** operação privilegiada funciona para admin **e** é bloqueada para o
  usuário comum.
- **Consulta de dados:** busca, filtro, ordenação, paginação, exportação.
- **Resiliência:** sessão expirada, 404, 403, dependência externa fora do ar, banco vazio,
  volume alto.

Para cada jornada registre: **pré-condição**, **passos**, **asserções observáveis pelo usuário**
(texto na tela, URL, badge, linha na tabela, arquivo baixado) e **pós-condição/limpeza**.

---

## 4. Fase 3 — Priorizar por risco

| Prioridade | Critério | Meta de cobertura |
|---|---|---|
| **P0** | A quebra impede o uso do produto ou expõe dados: login, autorização, fluxo principal, cobrança | 100 %, roda em todo PR |
| **P1** | Funcionalidade relevante com alternativa manual: CRUDs, filtros, relatórios | ≥ 80 % |
| **P2** | Cosmético, tela rara, ferramenta interna | oportunista |

Regra prática: se a suíte P0 inteira passa de ~5 minutos, o time vai desligá-la. Mantenha P0
enxuta e rápida; empurre o resto para execução noturna.

---

## 5. Fase 4 — Decisões técnicas (registre no documento gerado)

### 5.1 Runner

- **Padrão: `@playwright/test` (Node/TypeScript)** — mesmo com backend em outra linguagem.
  Traz trace viewer, retry, sharding, `webServer` e relatório HTML.
- **Exceção: `pytest-playwright`** quando o time não tem Node ou exige um único comando de
  teste em Python. Registre a exceção e o motivo no documento.

### 5.2 Subir a aplicação sob teste

Deixe o Playwright ligar e desligar a aplicação:

```ts
webServer: {
  command: process.env.APP_START ?? '<comando que sobe a aplicação>',
  url: process.env.BASE_URL ?? 'http://127.0.0.1:<porta>',
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
  env: { APP_ENV: 'test' },
}
```

**Nunca aponte a suíte para produção.** Se existir apenas um ambiente, o documento gerado deve
declarar isso em destaque e restringir a suíte a operações de leitura.

### 5.3 Dados e isolamento

1. Banco descartável por execução: arquivo temporário, schema dedicado ou container.
2. Seed determinística em `tests/support/seed.*` — usuários, papéis e registros base.
3. Cada teste cria o que consome com sufixo único (ex.: `e2e-${Date.now()}`) e limpa ao final.
4. Credenciais apenas por variável de ambiente (`E2E_USER`, `E2E_PASS`, `E2E_ADMIN`).
   Nunca literais no repositório.

### 5.4 Seletores

Ordem de preferência: `getByRole` → `getByLabel` → `getByText` → `data-testid`.

**Proibido:** seletor CSS estrutural (`div > div:nth-child(3)`) e XPath posicional.
Se um elemento não for alcançável por papel ou rótulo, **adicione `data-testid` no código-fonte**
— isso faz parte do trabalho, e a alteração deve ser listada no documento gerado.

### 5.5 Espera

Somente auto-waiting e web-first assertions (`await expect(locator).toBeVisible()`).
`waitForTimeout` é proibido fora de caso justificado e documentado.

### 5.6 Fronteiras externas

Liste o que será interceptado com `page.route(...)` e por quê (custo, lentidão, não
determinismo). Mantenha ao menos um teste de contrato conversando com o serviço real, marcado
com a tag `@external` e fora do gate de PR.

---

## 6. Fase 5 — Escrever `docs/TESTES-INTEGRADOS.md`

Use **exatamente** este esqueleto. Seção não aplicável recebe "Não se aplica — motivo";
nenhuma seção é apagada.

`````markdown
# Testes Integrados — <Nome do Projeto>

- **Versão do documento:** 1.0.0
- **Gerado em:** AAAA-MM-DD
- **Gerado a partir de:** `docs/GERAR-TESTE-INTEGRADO-PLAYWRIGHT.md`
- **Estado de referência:** <hash do commit, ou "sem versionamento">
- **Responsável pela manutenção:** <time ou pessoa>

## 1. Escopo
O que a suíte cobre, o que deliberadamente não cobre e por quê.

## 2. Ambiente sob teste
| Item | Valor |
|---|---|
| Comando para subir a aplicação | `...` |
| URL base | `...` |
| Banco de teste | `...` |
| Variáveis obrigatórias | `E2E_USER`, `E2E_PASS`, ... |
| Serviços externos mockados | `...` |

Pré-requisitos de máquina e passo a passo da primeira execução.

## 3. Mapa de superfícies
Tabela completa — páginas, APIs, formulários, jobs, integrações — com origem
(arquivo:linha) e status de cobertura: `coberta` / `parcial` / `não coberta (motivo)`.

## 4. Matriz de cobertura
| ID | Jornada / caso | Prioridade | Superfícies | Spec | Status |
|---|---|---|---|---|---|
| CT-001 | <título do caso> | P0 | `<rota>`, `<tela>` | `tests/e2e/<arquivo>.spec.ts` | ativo |

## 5. Casos de teste detalhados
### CT-001 — <título>
- **Prioridade:** P0
- **Pré-condição:** ...
- **Passos:** 1) ... 2) ... 3) ...
- **Resultado esperado:** asserções observáveis pelo usuário
- **Pós-condição / limpeza:** ...
- **Rastreabilidade:** `<arquivo>:<linha>`

## 6. Dados de teste e isolamento
Seeds, usuários, política de limpeza, como zerar o ambiente.

## 7. Convenções
IDs, nomes de arquivo, seletores, tags (`@p0`, `@smoke`, `@external`), estrutura de pastas.

## 8. Execução
```bash
npx playwright test              # suíte completa
npx playwright test --grep @p0   # gate de PR
npx playwright show-report       # relatório
```

## 9. Regra de atualização (obrigatória)
Toda nova implementação entra neste documento **antes** de ser considerada pronta.
Definition of Done, varredura delta e gate de cobertura — ver Fase 8 do gerador.

## 10. Integração contínua
Workflow, artefatos (trace, vídeo, screenshot), política de retry.

## 11. Estabilidade
Testes em quarentena, causa suspeita, responsável e prazo de correção.

## 12. Lacunas conhecidas (backlog)
O que ainda não está coberto, com prioridade e responsável.

## 13. Histórico
| Data | Versão | Mudança | Casos afetados |
|---|---|---|---|
| AAAA-MM-DD | 1.0.0 | Criação da suíte | CT-001..CT-0NN |
`````

---

## 7. Fase 6 — Gerar a suíte

Estrutura padrão:

```text
tests/
  e2e/
    01-acesso.spec.ts
    02-<jornada-principal>.spec.ts
    03-crud.spec.ts
    04-admin.spec.ts
    05-resiliencia.spec.ts
  support/
    fixtures.ts        # contexto autenticado, storageState
    pages/             # Page Objects
    seed.ts            # dados base
    helpers.ts
playwright.config.ts
```

Regras de escrita dos specs:

- O título do `test` **começa com o ID**: `test('CT-001 — <título>', ...)`. Assim relatório e
  documento se conversam sem esforço manual.
- Um `test` por caso do documento — nada de três casos disfarçados de `test.step`.
- Zero dependência de ordem: cada teste monta o próprio estado.
- Login repetido vira `storageState` gerado uma vez no `globalSetup`.
- Toda asserção precisa poder falhar. Navegar sem verificar nada é reprovado na revisão.

Configuração mínima recomendada:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html'], ['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:<porta>',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

---

## 8. Fase 7 — Executar, estabilizar e relatar

1. Rode a suíte inteira **três vezes seguidas**. Teste que oscila é flaky e não é aprovado.
2. Corrija flaky pela causa (espera de rede, dado compartilhado, animação), nunca aumentando
   `retries`.
3. Caso não seja possível estabilizar agora: marque `test.fixme`, registre na Seção 11 com
   causa e prazo. Nunca apague em silêncio.
4. Relate ao solicitante: total de casos, aprovados, quarentena, tempo de execução, cobertura
   por prioridade e as lacunas da Seção 12.

---

## 9. Fase 8 — Regra de perpetuidade: toda nova implementação entra no teste

Esta fase é o que impede a documentação de envelhecer. Ela é replicada na Seção 9 do documento
gerado e é condição de "pronto".

### 9.1 Definition of Done

Uma implementação **só está concluída** quando:

1. A superfície nova (rota, tela, campo, API, job, permissão, regra) foi acrescentada à
   **Seção 3** do `TESTES-INTEGRADOS.md`.
2. Existe pelo menos um caso `CT-###` na **Seção 4** cobrindo o caminho feliz — e, se for P0,
   também o caminho de erro.
3. O spec correspondente existe, roda e passa.
4. A **Seção 13** registra a mudança (data, versão, casos afetados) e a versão do documento
   foi incrementada.

### 9.2 Varredura delta (a cada nova entrega)

```bash
# Com git — compare com o estado registrado no documento
git diff --name-only <ultimo-estado-documentado>..HEAD

# Sem git — arquivos alterados nos últimos 7 dias
find . -type f -mtime -7 -not -path "*/node_modules/*" -not -path "*/.git/*"
```

Para cada arquivo alterado, pergunte: *surgiu rota, tela, campo, permissão, job, integração ou
regra de negócio nova?* Se sim → nova superfície → novo caso → atualizar documento **e** suíte.

Em seguida, repita o `grep` de rotas da Fase 1 e compare a contagem com a Seção 3. Diferença
positiva não explicada = superfície não documentada.

### 9.3 Gate de cobertura

Antes de encerrar qualquer entrega:

- [ ] Rodei a varredura delta.
- [ ] Toda superfície nova está na Seção 3.
- [ ] Toda superfície P0 nova tem caso na Seção 4 e spec passando.
- [ ] Nenhum `CT-###` foi renumerado ou reaproveitado.
- [ ] Seção 13 atualizada e versão do documento incrementada.
- [ ] Suíte `@p0` verde em três execuções seguidas.

### 9.4 Automação do lembrete (opcional, recomendado)

- **Template de PR:** replique o checklist 9.3.
- **CI:** falhe o build quando arquivos de rota, tela ou modelo mudarem sem que
  `docs/TESTES-INTEGRADOS.md` tenha sido alterado no mesmo commit.
- **Agente de IA:** configure um hook que dispare a Fase 8 quando arquivos de rota ou template
  forem editados.

---

## 10. Aceite deste gerador

O trabalho está correto quando:

- [ ] `docs/_inventario-superficies.md` existe e cobre 100 % das rotas encontradas por `grep`.
- [ ] `docs/TESTES-INTEGRADOS.md` segue o esqueleto da Fase 5, sem seção faltando.
- [ ] Todo `CT-###` do documento tem spec, e todo spec tem `CT-###` no documento.
- [ ] `npx playwright test --grep @p0` passa do zero em máquina limpa.
- [ ] Nenhum segredo real aparece em documento, spec ou configuração.
- [ ] A Seção 9 está presente e íntegra no documento gerado.

---

## Anexo A — Convenção de IDs

`CT-001` em diante, sequencial, **nunca reutilizado**. Caso removido vira
`CT-0NN — REMOVIDO (motivo, data)` na Seção 13. Isso preserva a auditoria e evita que um
relatório antigo aponte para o teste errado.

## Anexo B — Modelo de spec

```ts
import { test, expect } from '../support/fixtures';

test.describe('Acesso @p0', () => {
  test('CT-001 — login com credenciais válidas', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(process.env.E2E_USER!);
    await page.getByLabel('Senha').fill(process.env.E2E_PASS!);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/inicio/);
    await expect(page.getByRole('heading', { name: 'Painel' })).toBeVisible();
  });

  test('CT-002 — senha inválida exibe erro e não autentica', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(process.env.E2E_USER!);
    await page.getByLabel('Senha').fill('senha-incorreta');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText(/credenciais inválidas/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
```

## Anexo C — Perguntas que revelam caso de teste esquecido

1. O que acontece com o banco vazio? E com dezenas de milhares de registros?
2. O que um usuário sem permissão vê ao acessar a URL restrita diretamente?
3. O que acontece se a sessão expirar no meio do preenchimento de um formulário?
4. Qual tela aparece quando a dependência externa está fora do ar ou lenta?
5. O formulário tolera submissão dupla (clique duplo)?
6. O valor persiste após recarregar a página? E após logout e novo login?
7. A busca lida com acento, maiúscula, caractere especial e string vazia?
8. Alguma rota devolve arquivo? O download tem nome e conteúdo corretos?
9. Algum processo em background altera a tela sem interação do usuário?
10. Alguma rota nova ficou sem guarda de autenticação ou de permissão?
11. Existe ação destrutiva sem confirmação — e ela está coberta?
12. Há limite de upload, timeout ou paginação que nunca foi exercitado?
