---
name: auditoria-geral-sistema
description: Auditoria 360° do Painel de Implantação — integridade, funcionalidade, usabilidade e qualidade, de ponta a ponta (frontend, backend, APIs, banco, autenticação, autorização, regras de negócio, navegação, formulários, layout, responsividade, console, network, performance e segurança). Navega de verdade pela aplicação num navegador real, testa cada fluxo, classifica os achados por severidade, corrige o que for corrigível, reteste e produz o relatório final. Use quando o usuário pedir "auditoria geral", "auditoria completa", "verificação 360", "revisar o sistema inteiro", "testar tudo", "auditar integridade do sistema", ou antes de uma entrega/virada importante. NÃO é para revisar um diff (use /code-review) nem para testar um módulo isolado.
---

# Auditoria geral do sistema

Verificação **completa, profunda e sistemática** do Painel de Implantação. A finalidade é
encontrar qualquer problema existente — mesmo pequeno, inconsistente ou aparentemente
secundário — e corrigir o que for corrigível.

## Regra zero: nunca contra a produção

O Painel em produção é `http://I7M1700-01-EVE:5100` (e HTTPS na 5443), ligado ao **MariaDB
real**, com **SMTP configurado**. Esta auditoria conclui passos, cria e apaga registros e
dispara e-mail. Rodá-la contra a 5100 manda e-mail para cliente de verdade e suja a base.

**Suba a instância isolada da porta 5199** — receita completa em
[e2e/README.md](../../../e2e/README.md). Dois cuidados que já causaram estrago:

1. O `cwd` do processo tem de ficar **FORA de `backend/`**. `MailerService` procura
   `<cwd>/dados/smtp.json`; achando o de produção, o e-mail sai de verdade.
2. As variáveis de USUÁRIO do Windows apontam para produção — limpe `MIGRACAO_DB_URL`,
   `MIGRACAO_HTTPS_PFX` e afins antes de subir.

Confirme antes de qualquer teste:

```powershell
(Invoke-RestMethod http://localhost:5199/api/health).data.db   # tem de ser: better-sqlite3
```

Respondeu `mariadb`? **Pare.** A variável de produção vazou para o processo.

Catálogos e layouts são lidos de `<cwd>/../tools` — a junction vai no **pai** do cwd, não
dentro dele, senão a geração de documento falha com "Arquivo do modelo não encontrado".

## Filosofia

**Não presuma que está correto.** Compilar, iniciar e abrir a tela não é evidência de nada.
Cada funcionalidade se valida pelo **comportamento real**: clicar, preencher, salvar,
reabrir e conferir se o dado ficou onde deveria.

Duas coisas que esta auditoria já provou valerem mais do que parecem:

- **A tela e a API têm de contar a mesma história.** Um `GET` dizendo `liberado: true`
  enquanto o `POST` correspondente devolve 403 é defeito, mesmo que ninguém reclame.
- **Um teste que passa pelo motivo errado é pior do que teste nenhum.** Ao ver verde,
  pergunte se o caso realmente exercitou o que você queria — várias vezes a asserção passou
  porque o passo anterior falhou em silêncio.

## Ordem de trabalho

**INSPECIONAR → TESTAR → IDENTIFICAR → CLASSIFICAR → CORRIGIR → TESTAR NOVAMENTE**

Não pare no primeiro problema. Percorra o sistema inteiro, junte os achados, só então
corrija. Corrigir no meio da varredura faz perder a visão do conjunto e produz remendo.

## Fase 0 — Preparo

1. Suba a instância isolada (5199) e confirme `better-sqlite3`.
2. Crie usuários de **todos os perfis** — ADM, Comercial, Administrativo, Coordenador, GCI,
   Consultor, Levantador —, mais casos de borda: alguém que acumula papéis, alguém **não
   designado** em nenhum projeto e um nome com vírgula.
3. Rode a linha de base: `cd backend && npm test`, `cd frontend && npm test`,
   `cd e2e && npx playwright test`. Se algo já está vermelho, isso é o achado nº 1.
4. Registre a versão auditada (`git log --oneline -1`).

## Fase 1 — Varredura estrutural (leitura)

Mapeie antes de clicar, para saber o que existe e o que **não** foi visitado.

- **Rotas do frontend:** extraia de `frontend/src/app/app.routes.ts` a lista completa. Toda
  rota tem de ser visitada — inclusive as que ninguém lembra (já apareceu tela **órfã**,
  com rota e sem link no menu).
- **Endpoints do backend:** `http://localhost:5199/api/docs-json` dá o inventário real.
- **Menus e permissões:** `common/constants/menus.ts` (`PADRAO_PERMISSOES`) diz quem vê o
  quê; compare com o que a tela realmente oferece.
- **Camadas:** controllers, services, repositories, DTOs, entities, guards, interceptors,
  pipes, filters, middlewares. Procure regra de negócio no controller, SQL espalhado,
  duplicação, código morto, endpoint sem validação e tratamento de erro inconsistente.

## Fase 2 — Autenticação, autorização e rotas

- Login válido, senha errada, usuário inexistente, logout, expiração de sessão.
- Rota protegida sem token → tem de cair no login; token inválido → 401.
- Deep link recarregado (F5) e voltar/avançar do navegador.
- Rota inexistente → 404 tratado.
- **Por perfil:** para cada um dos 7, percorra o menu e confirme que ele alcança o que deve
  e **não** alcança o que não deve. Teste também pela API, sem a tela: o guard de menu e a
  regra de negócio são gates diferentes e já divergiram.
- **Autorização por objeto, não só por perfil:** quem tem o perfil certo mas não está
  designado *naquele* projeto não pode agir nele.

## Fase 3 — Navegação e telas (navegador real)

Percorra **todas** as rotas mapeadas na Fase 1. Em cada tela:

menu e submenu · breadcrumb · botões de retorno · redirecionamentos · estado de carregamento ·
estado vazio · estado de erro.

Procure: botão que não faz nada, botão que faz a coisa errada, link quebrado, tela que não
carrega, componente que não responde, erro silencioso.

## Fase 4 — Formulários e CRUD

Para **cada** formulário: alinhamento, labels, placeholders, obrigatórios × opcionais,
máscaras, tipos, validações, mensagens de validação/erro/sucesso, preencher, editar, limpar,
cancelar, salvar, carregar.

Casos que revelam defeito:

- formulário vazio; dados inválidos; dados incompletos;
- caracteres especiais e acentuação; HTML (`<script>`) nos campos de texto;
- valor mínimo, máximo e **acima do máximo**;
- **data inválida que passa pelo formato** (`2026-13-45` já fechou passo em produção);
- data futura onde só cabe data passada;
- obrigatório não preenchido; submissão repetida; **duplo clique no salvar**;
- duas requisições simultâneas na mesma ação (só uma pode vencer).

CRUD completo por módulo: criar → validar → salvar → conferir persistência → listar →
pesquisar → filtrar → ordenar → paginar → abrir detalhe → editar → salvar → conferir →
excluir → confirmar → cancelar → conferir o que acontece com os registros relacionados.

## Fase 5 — Regras de negócio

O coração do Painel são os **21 passos**. A especificação é
[RN - Passos do Processo de Implantação](<../../../vault/08 - Regras de Negócio/RN - Passos do Processo de Implantação.md>);
o mapa executável é `backend/src/passos/passos.constants.ts`.

- Caminhe o processo inteiro, do passo 1 ao 21, com o **ator correto de cada passo**.
- Gates de ORDEM: fora de ordem tem de recusar.
- Gates de AUTORIZAÇÃO: **por todos os caminhos**, não só pela tela de passos. Anexar
  documento, gerar layout, editar a ficha e criar projeto por outra rota também fecham
  passos — foi exatamente aí que a regra não valia.
- Irreversibilidade, conferência, marcação + data, trilhas paralelas.
- E-mails: quem recebe, o que diz, token não resolvido chegando ao cliente, e o que acontece
  quando o envio falha.
- Macro-etapa: acompanhe a progressão e confirme que ela **nunca regride**.

## Fase 6 — APIs

Para cada endpoint: método, parâmetros, payload, headers, autenticação, autorização,
resposta, status e corpo do erro.

Exercite os status: 200 · 201 · 400 · 401 · 403 · 404 · 409 · 413 · 422 · 500.

O status tem de ser **honesto**: corpo grande demais é 413, não um 404 dizendo que a rota
não existe. E erro interno não pode vazar stack trace nem detalhe de implementação.

Entradas extremas: id inexistente, id negativo, zero, `MAX_INT`, não numérico, path
traversal em nome de arquivo, extensão não permitida, payload gigante.

## Fase 7 — Banco de dados

Entidades × tabelas, relacionamentos, PKs, FKs, índices, constraints, migrations, tipos,
obrigatoriedade, defaults, integridade referencial.

Prove o caminho inteiro: **o frontend envia → o backend recebe → persiste → o banco devolve
→ a tela apresenta.** Confira no banco, não só na tela.

Migrations: rodam limpo? `down()` desfaz de verdade? Renumeração/backfill preserva o dado?

## Fase 8 — Console, network e performance

Com o navegador aberto, durante toda a navegação:

- **Console:** erro de JS/Angular, warning, CORS, recurso 404, promise rejeitada, problema de
  renderização e de acessibilidade.
- **Network:** status, payload, corpo da resposta, headers, tempo, **chamadas duplicadas**,
  chamadas desnecessárias, endpoint errado.
- **Performance:** carregamento excessivo, consulta lenta, N+1, renderização repetida,
  volume grande sem paginação.

O Playwright captura console e requisições — use isso em vez de olhar à mão:

```ts
page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400) falhas.push(`${r.status()} ${r.url()}`); });
```

## Fase 9 — Layout, responsividade e UX

- **Alinhamento:** campos, labels, botões, ícones, títulos, tabelas, cards, filtros,
  cabeçalhos, rodapés, menus, modais. Nada de texto cortado ou sobreposto, borda
  inconsistente, elemento fora do grid.
- **Consistência:** componentes iguais têm de ter a mesma altura, espaçamento, tipografia,
  cor e comportamento. A aplicação tem de parecer **um produto**, não telas soltas.
- **Responsividade:** desktop, notebook, tablet e mobile. Procure overflow horizontal,
  tabela ultrapassando a tela, menu quebrado, modal maior que a viewport.
- **UX:** o fluxo é intuitivo? O botão diz o que faz? Há feedback e indicação de carregamento?
  Há confirmação onde precisa? O erro é compreensível? Dá para voltar? Fica claro quando a
  operação terminou?

⚠️ **`templates/` e o CSS do Angular são do MANUS IA — nenhum agente de software escreve
lá** (CLAUDE.md). Achado de layout nessas áreas vira **registro**, não correção.

## Fase 10 — Segurança (sem teste destrutivo)

Credencial exposta, secret no frontend, token indevido, dado sensível em log, endpoint sem
autenticação, endpoint sem autorização, validação só no frontend, input sem validação no
backend, exposição excessiva de dados, mensagem de erro revelando detalhe interno.

**Nada de ataque real ou teste destrutivo** — a análise fica dentro do ambiente autorizado.

## Fase 11 — Correção e regressão

Corrija o que for corrigível, atacando a **causa raiz** — não o sintoma. Ajuste superficial
que esconde o problema é pior do que deixá-lo registrado.

Toda correção precisa de **teste que falharia antes dela**. Defeito de fluxo/permissão vai
para `e2e/testes/`; regra de backend, para o Jest; comportamento de tela, para o Vitest.

Depois: refaça os fluxos principais, reabra as telas alteradas, e rode a suíte inteira
(backend, frontend, e2e). Correção que quebra outra coisa não é correção.

## Classificação

| Severidade | Critério |
| --- | --- |
| **CRÍTICO** | Impede o funcionamento ou compromete segurança/integridade |
| **ALTO** | Funcionalidade importante quebrada ou com comportamento incorreto |
| **MÉDIO** | Problema funcional ou visual relevante, mas com contorno |
| **BAIXO** | Problema pequeno de UX, layout ou padronização |
| **MELHORIA** | Não é erro; ganha em qualidade, performance ou experiência |

## Relatório final

Encerre com **AUDITORIA GERAL CONCLUÍDA** e o relatório:

**Resumo executivo** — status geral, % de áreas verificadas, achados encontrados, corrigidos
e pendentes.

**Tabela de achados** — uma linha por problema:

| ID | Severidade | Módulo | Tela | Problema | Como reproduzir | Causa raiz | Correção | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-001 | Alta | Usuários | Cadastro | Botão salvar não executa | ... | ... | ... | Corrigido |

**Fechamento** — o que foi verificado · o que foi encontrado · o que foi corrigido · o que
falta corrigir · melhorias feitas · pontos a acompanhar depois.

Seja honesto sobre a cobertura: diga o que **não** foi verificado e por quê. "100% auditado"
sem prova é pior do que "80%, e estas são as áreas que ficaram de fora".

## Checklist de conclusão

Rotas · menus · telas · formulários · botões · modais · CRUDs · APIs · backend · banco ·
autenticação · autorização · console · network · layout · alinhamento · responsividade · UX ·
performance · segurança básica · mensagens · tratamento de erro · **testes de regressão**.

A auditoria só termina quando o sistema inteiro foi percorrido, o que dava para corrigir foi
corrigido **e retestado**, e o relatório foi produzido — não quando a aplicação abre.
