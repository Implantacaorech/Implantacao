# Padrão de Desenvolvimento — Rech Informática Ltda

**Revisão:** `1.0.0` · **Data:** 03/08/2026 · **Status:** Vigente ·
**Responsável:** Time DevTools (Parte I) · Arquiteto Principal (Parte II)

> **Este é o documento único de padrão para qualquer desenvolvimento.** Vale para código novo,
> alteração estrutural de código existente e auditoria de projeto — em qualquer linguagem da stack,
> por pessoa ou por agente de IA (Claude Code, Copilot, Cursor e equivalentes).
>
> Não há um segundo documento a consultar: **o que não estiver aqui não é norma.**

## Do que este documento é feito

Ele consolida, em um arquivo só, as duas normas que antes viviam separadas — e que respondiam a
perguntas diferentes:

| Parte | Responde | Origem consolidada | Seções |
|---|---|---|---|
| **Parte I — o QUE usar** | onde versionar, em que linguagem escrever, qual banco, qual framework, qual pipeline | *Padrões de Desenvolvimento da Rech*, rev. `2.0.0` (21/07/2026), norma da **empresa** | §3 a §10 |
| **Parte II — COMO construir** | como organizar o código **dentro** da stack escolhida: camadas, módulos, testes, documentação, segurança | *Guia Mestre de Arquitetura de Desenvolvimento* (31/07/2026), norma de **arquitetura** | §13 a §21 |

São **transversais às duas partes**: §1 (como usar), §2 (checklist), §11 (relatório de
conformidade), §12 (resumo executivo) e §22 (controle de revisões).

**Precedência:** havendo conflito entre as duas partes, **a Parte I prevalece** — ela é norma da
empresa, homologada pelo DevTools; a Parte II diz como construir bem *dentro* do que a Parte I
permitiu. Na prática elas não se contradizem: a Parte I escolhe NestJS + TypeORM, a Parte II diz que
o controller não pode conter regra de negócio. Uma não substitui a outra, e **nenhuma das duas é
opcional**.

> A numeração `§1`–`§12` foi mantida idêntica à do Padrão Rech rev. `2.0.0` de propósito: código,
> `CLAUDE.md`, `.gitlab-ci.yml` e documentação já citam `§3`, `§4.2`, `§4.7`, `§4.8`, `§7.1` e
> `§10.3`, e essas referências continuam válidas. O "Controle de revisões", que era a `§13`, passou
> a ser a **§22** para dar lugar à Parte II.

**Fontes.** Parte I: [Procedimentos para desenvolvimento de aplicações na Rech](http://intranet/blog/48347/procedimentos-para-desenvolvimento-de-aplicacoes-na-rech)
(Blog da Intranet, por Sandro, 04/06/2026), mais as convenções observadas no GitLab interno em
`https://gitlab.rech.com.br/gitlab/rech/`. Parte II: Guia Mestre de Arquitetura de Desenvolvimento,
adotado como norma deste repositório pelo
[ADR-0002](<vault/17 - ADR/ADR-0002 - Adocao do Guia Mestre de Arquitetura.md>).

---

## 1. Como o agente deve usar este documento

### 1.1 Formas de acesso

**Versão canônica da Parte I (sempre atual):**

```
https://gitlab.rech.com.br/gitlab/rech/ia/padrao-ia/raw/master/PADRAO-RECH.md
```

Este documento tem o mesmo valor normativo em qualquer uma das formas de acesso:

| Forma | Como ocorre | Observação |
|---|---|---|
| **Arquivo presente no projeto** | Este `PADRAO-DESENVOLVIMENTO-RECH.md` na raiz | Traz as duas partes; a Parte I envelhece em silêncio |
| **Carregado por URL** | O agente busca a versão canônica sob demanda | Parte I sempre atualizada — **forma preferida para ela** |
| **Referenciado** | `CLAUDE.md`, `AGENTS.md` ou regras do agente apontam para este arquivo e para a URL, e o `README.md` registra a vinculação | Combina rastreabilidade e atualização automática |

**A URL canônica cobre apenas a Parte I.** A Parte II (§13 a §21) é norma de arquitetura e não tem
publicação canônica externa — este arquivo *é* a fonte dela. Portanto:

- **Parte I** — prefira referenciar a copiar. Uma cópia local congela a versão do dia em que foi
  feita e passa a divergir do padrão sem que ninguém perceba. Havendo conflito entre o texto da
  Parte I deste arquivo e a versão canônica, **vale a canônica** — e o agente deve avisar o humano
  que a cópia está desatualizada, indicando as duas revisões.
- **Parte II** — este arquivo é a versão vigente. Alterá-la segue o rito da §22.

**Como verificar a atualidade da Parte I.** Compare a revisão declarada na tabela "Do que este
documento é feito" (hoje `2.0.0`) com o campo **Revisão** do cabeçalho da versão canônica.
Divergindo, use a canônica para a Parte I, mantenha a Parte II deste arquivo e informe o humano
citando as duas revisões. Se a canônica estiver inacessível, prossiga com este arquivo e registre no
relatório que a atualidade não pôde ser confirmada.

> **Consequência prática de ter consolidado:** a Parte I deste arquivo é, por construção, uma cópia.
> Quando a canônica subir de revisão, é preciso **reincorporá-la aqui** — e registrar a nova revisão
> incorporada na §22. Sem isso, o documento único vira exatamente a "cópia que envelhece em
> silêncio" contra a qual esta seção adverte.

Para carregar por URL, o agente usa sua ferramenta de busca web (`WebFetch` ou equivalente) ou:

```bash
curl -sS "https://gitlab.rech.com.br/gitlab/rech/ia/padrao-ia/raw/master/PADRAO-RECH.md"
```

> A URL canônica e as demais fontes citadas (GitLab interno, blog da intranet) só respondem **de
> dentro da rede corporativa**. Agentes executados em nuvem podem falhar ao buscá-las; nesse caso,
> o carregamento deve partir da máquina do desenvolvedor, ou usar uma cópia local como alternativa.

Para vincular um projeto ao padrão, inclua no `CLAUDE.md` / `AGENTS.md` do projeto:

```markdown
## Padrão de desenvolvimento

Antes de criar, alterar estruturalmente ou auditar este projeto, carregue e siga o documento único
`PADRAO-DESENVOLVIMENTO-RECH.md` (raiz do repositório) — Parte I (o que usar) e Parte II (como
construir). A Parte I tem versão canônica em
https://gitlab.rech.com.br/gitlab/rech/ia/padrao-ia/raw/master/PADRAO-RECH.md, que prevalece se
divergir.
```

E registre a vinculação no `README.md` do projeto (§6), que é o ponto de entrada dos humanos:

```markdown
Este projeto segue o [Padrão de Desenvolvimento da Rech](PADRAO-DESENVOLVIMENTO-RECH.md)
(documento único: stack homologada + arquitetura de código).
```

Os dois são complementares e nenhum substitui o outro: o `CLAUDE.md` / `AGENTS.md` é carregado
automaticamente pelo agente e **instrui a máquina**; o `README.md` não é lido por padrão, mas
**avisa a pessoa** de que o projeto está sujeito ao padrão.

### 1.2 O que fazer ao ler este documento

Ao ler este documento — esteja ele presente no diretório do projeto, tenha sido carregado da URL
canônica ou alcançado por referência — o agente deve aplicá-lo ao projeto em que está trabalhando
(o diretório de trabalho atual) e:

1. **Auditar** o projeto atual contra o checklist da seção 2 — que cobre as duas partes: as regras
   de stack e governança (§3 a §10) e as regras de arquitetura do código (§13 a §21).
2. **Reportar** ao humano, de forma agrupada, cada não conformidade encontrada — indicando a regra
   violada, o impacto e a correção sugerida. O relatório termina com o **"Plano de adequação"**
   (§11): um plano ordenado, com o executor de cada item, que o humano possa simplesmente confirmar.
   Havendo não conformidade de stack, ela encabeça tanto os bloqueadores quanto o plano.
3. **Recomendar a correção certa, sem executá-la.** Correções estruturais — troca de linguagem,
   reescrita, criação ou migração de repositório — não devem ser executadas por conta própria, mas
   **devem ser recomendadas de forma direta e concreta**. Não confunda *não executar* com *não
   opinar*: cabe ao agente dizer qual é a correção; cabe ao humano decidir executá-la.
4. **Aplicar** diretamente apenas correções locais, reversíveis e de baixo risco — por exemplo,
   criar ou completar o `README.md` — informando o que fez.
5. Ao **iniciar um projeto novo**, tratar as regras deste documento como requisitos de entrada,
   não como revisão posterior.

> **A recomendação padrão diante de linguagem fora da stack é o porte** para a linguagem homologada
> correspondente (§4.2 e §4.7) — não a consulta ao DevTools. Consultar o DevTools é o tratamento do
> caso excepcional: aplica-se quando há impedimento técnico demonstrado (§4.3) ou quando o humano
> opta por manter o desvio. Abrir pela consulta transforma a via de escape na via natural.
>
> Frases como *"valide com o DevTools se este projeto se enquadra na exceção"* **não são a primeira
> resposta esperada**. A primeira resposta é: *"recomendo portar para <linguagem>, pelo procedimento
> da §4.7"*.

### 1.3 Quando a instrução do humano conflita com o padrão

Estes padrões são **normativos e não podem ser dispensados por decisão individual**.

**Havendo conflito, não execute de imediato.** Aponte o conflito, apresente a alternativa conforme e
peça confirmação explícita antes de prosseguir. Executar primeiro e registrar a não conformidade
depois inverte a ordem: o desvio já está criado, e o registro vira formalidade.

#### Criar código novo fora da stack é o caso mais grave — e o mais fácil de evitar

Ao auditar um projeto existente, o porte tem custo real: há código escrito, testado, muitas vezes em
produção. Ao começar um projeto do zero, esse custo é **zero** — basta começar na linguagem certa.

Um agente que aceita *"faça em Python"* num diretório vazio cria, em um minuto, exatamente o passivo
que a §4.7 existe para remediar depois, ao custo de dias. É a hora mais barata de acertar e o
momento em que ceder sai mais caro.

Diante de um pedido para **criar projeto novo em linguagem não homologada**, o agente deve:

1. **Não escrever o código ainda**;
2. Nomear a linguagem da stack que atende ao caso (§4.1) e propor fazer nela — mesmo escopo,
   deixando claro que pode começar imediatamente;
3. Verificar e declarar se existe impedimento técnico real (§4.3), nomeando a biblioteca sem
   equivalente caso exista;
4. Explicitar o custo de prosseguir assim mesmo: o projeto **nasce não conforme**, precisará de porte
   (§4.7) e de exceção formalizada junto ao DevTools (§4.3, §10), e não terá template de CI/CD;
5. Prosseguir **apenas** mediante insistência explícita do humano depois do item 4 — e, nesse caso,
   registrar a não conformidade no `README.md` do projeto, não apenas na conversa.

> Não se trata de recusar trabalho, e sim de fazer a pergunta certa antes de agir. Na prática, quem
> pede "em Python" quase sempre quer o resultado, não a linguagem — e aceita Ruby ou Rust quando
> descobre que sai igualmente rápido e sem passivo. O agente que não oferece essa escolha decide
> pelo humano, no pior sentido.

A dispensa de uma regra só é válida por **exceção formalizada junto ao DevTools** (§10); confirmação
do desenvolvedor, isoladamente, não substitui essa formalização.

### 1.4 Em que ordem aplicar as duas partes

As perguntas se resolvem nesta sequência, e **não adianta pular para a seguinte com a anterior em
aberto**:

| Ordem | Pergunta | Onde |
|---|---|---|
| 1º | Isso precisa ser desenvolvido, ou já existe pronto (inclusive como funcionalidade do SICLA)? | §9 |
| 2º | Onde o repositório vai morar, com que nome? | §3, §8 |
| 3º | Em que linguagem/framework/banco? | §4, §5 |
| 4º | **Como o código se organiza dentro dessa escolha?** | §13 a §17 |
| 5º | Como se prova que está certo — testes, cobertura, guardas? | §18, §20, §21 |
| 6º | Como se entrega e se documenta — README, pipeline, segurança? | §6, §7, §19 |

Escrever código antes de responder o 3º é o erro caro descrito na §1.3. Escrever código antes de
responder o 4º é o erro barato de arrumar no início e caro depois: mover regra de negócio do
controller para o service custa minutos no primeiro módulo e vira projeto no trigésimo — daí a
adequação faseada da §20.2 existir como remédio de legado.

**Projeto novo começa conforme nas duas partes.** A adequação faseada da §20.2 é o tratamento de
código legado, não um cronograma que projeto novo possa invocar para nascer devendo.

---

## 2. Checklist de conformidade

Um projeto só é **conforme** quando passa nos dois blocos. Reprovar no bloco B não é "dívida
técnica aceitável": é não conformidade, e entra no relatório da §11 como qualquer outra.

### Bloco A — stack e governança (Parte I)

| # | Verificação | Como checar | Regra |
|---|---|---|---|
| 1 | Projeto versionado em Git | Existe `.git/`? | §3 |
| 2 | Remoto aponta para o GitLab interno | `git remote -v` contém `gitlab.rech.com.br` ou `gitlab.rechinfo.local` | §3 |
| 3 | Não está em conta pessoal externa | Remoto **não** é `github.com` (salvo open source aprovado) | §3.3 |
| 4 | Linguagem dentro da stack homologada | Arquivos de manifesto (`Cargo.toml`, `pom.xml`, `Gemfile`, `package.json`, `pubspec.yaml`) | §4 |
| 5 | Ausência de antipadrão de stack | Não há `requirements.txt`/`pyproject.toml`, `*.csproj`, `go.mod`. Encontrando algum, **recomende o porte** — a consulta ao DevTools é o caso excepcional | §4.2 |
| 6 | Banco de dados homologado | Strings de conexão / drivers usam MariaDB ou SQLite | §5 |
| 7 | `README.md` presente e completo | Cobre os 6 blocos obrigatórios, incluindo a vinculação a este padrão | §6 |
| 7a | Projeto vinculado ao padrão para sessões futuras | `README.md` e `CLAUDE.md`/`AGENTS.md` apontam para a URL canônica | §1.1, §6 |
| 8 | `.gitlab-ci.yml` presente | Inclui template oficial quando disponível | §7 |
| 9 | Nome do projeto segue a convenção | Prefixo correto para a linguagem | §8 |
| 10 | Reuso avaliado | Bibliotecas internas existentes foram consideradas | §8.3 |
| 11 | Não duplica solução pronta | Não reimplementa ferramenta já disponível | §9 |
| 12 | Dependências com licença compatível | Manifesto revisado; SCA no pipeline | §10 |
| 13 | Projeto Ruby com gems está habilitado e isolado | `.ruby_use_gems`, `Gemfile.lock` e `.bundle/config` versionados; `BUNDLE_GEMFILE` sobrescrito no `.bat` | §4.5 |
| 14 | Aplicação web usa a stack de referência | Frontend Angular (`angular.json`) e backend NestJS (`@nestjs/core` no `package.json`) | §4.8 |
| 15 | Angular dentro da janela de suporte | `@angular/core` no `package.json` não está fora do suporte oficial | §4.8.2 |
| 16 | Acesso a dados por TypeORM, com migrations | `typeorm` no `package.json`; pasta de migrations versionada; `synchronize` desligado fora de dev | §4.8.4 |

### Bloco B — arquitetura do código (Parte II)

| # | Verificação | Como checar | Regra |
|---|---|---|---|
| 17 | Fluxo em camadas respeitado | Existe `Controller → Service → Repository`; nenhum salto de camada | §13 |
| 18 | Controller sem regra de negócio e sem banco | Nenhum controller importa ORM, repository do ORM ou executa consulta | §13.1 |
| 19 | Repository é a única porta do banco | SQL/ORM só em `repositories/`; repository sem regra de negócio e sem exceção de HTTP | §13.3 |
| 20 | Dependência sempre por injeção | Nenhum `new` para instanciar dependência injetável | §13.4 |
| 21 | Estrutura de módulo completa | Cada módulo com `controllers/`, `services/`, `repositories/`, `dto/`, `entities/`, `tests/`, `docs/` e seu `*.module.ts` | §14 |
| 22 | Entrada validada por DTO na borda | DTO declarado e validador ativo globalmente | §14.3, §4.8.3 |
| 23 | Esquema evolui por migration versionada | Pasta de migrations no repositório; nada de alteração manual em produção | §16 |
| 24 | Documentação do módulo presente | Os 6 arquivos em `<modulo>/docs/` | §17 |
| 25 | Testes nos três níveis e cobertura ≥ 80% | Unitário, integração e E2E; relatório de cobertura no pipeline | §18 |
| 26 | Controles de segurança ativos | JWT, RBAC, Helmet, CORS, rate limit, validação, sanitização | §19 |
| 27 | Norma verificada por teste, não por revisão | Existe spec de conformidade de arquitetura rodando no CI | §20 |

> **Itens 17 a 20 são os que mais aparecem violados na prática**, e são os mais baratos de acertar
> desde o início. Os itens 24 e 25 são os que mais costumam exigir adequação faseada em código
> legado (§20.2).

---

## Parte I — O QUE usar

> As seções §3 a §10 são a norma da **empresa**, homologada pelo DevTools, com versão canônica no
> GitLab interno (§1.1). Elas definem onde o código mora, em que linguagem é escrito, sobre qual
> banco roda e como é entregue. Prevalecem sobre a Parte II em caso de conflito (§1.4).

---

## 3. Versionamento — GitLab interno é o repositório oficial

### 3.1 Regra

Todo o código-fonte oficial da empresa deve estar centralizado no **GitLab interno (on-premise)**
em `https://gitlab.rech.com.br/gitlab/`. Este é o **único repositório oficial, seguro e respaldado
por backup**, controlado pela área de gestão de TI.

A obrigação **não se limita a código de aplicação**. Vale para todo ativo digital versionável:

- scripts de automação e diagnóstico (Suporte técnico);
- playbooks, arquivos de configuração, containers e scripts de provisionamento (Infraestrutura);
- códigos de ETL, coleta de dados e dashboards (BI/Analytics);
- artefatos de WEB, QA, DevOps e GTI;
- qualquer parametrização de sistema mantida em arquivo.

A regra independe da tecnologia — Java, Batch do Windows, Ruby, PowerShell, Rust, Delphi, Shell
Script, SQL, YAML, Docker, Flutter, JavaScript, TypeScript ou qualquer outra homologada.

### 3.2 Por que isso importa

| Vantagem | Efeito prático |
|---|---|
| **Segurança máxima** | O código não fica exposto externamente; há políticas de backup e redundância. |
| **Gestão centralizada** | Controle de acessos, permissões e auditoria feitos internamente, reduzindo risco de vazamento, perda ou manipulação não autorizada. |
| **Padrão único** | Facilita suporte, colaboração entre equipes e onboarding; evita dispersão em múltiplas ferramentas. |
| **Backup e recuperação** | Todo o conteúdo entra no backup corporativo, com restauração garantida. |
| **Compliance e auditoria** | Atende requisitos legais, contratuais e normativos de segurança da informação, rastreabilidade e governança. |

### 3.3 O que não é permitido

- Repositórios corporativos em contas pessoais;
- Código corporativo em GitHub pessoal;
- Aplicações críticas armazenadas apenas localmente;
- Uso de tecnologias não homologadas sem autorização;
- Compartilhamento de código corporativo fora dos ambientes aprovados.

Armazenar código em máquinas locais, repositórios pessoais externos, pastas de rede comuns,
máquinas virtuais, Dropbox e similares é **terminantemente desaconselhado e não garantido** em
termos de backup, governança, rastreabilidade e segurança.

### 3.4 GitHub — quando é permitido

O GitHub é utilizado **exclusivamente para projetos open source previamente aprovados pela direção
da empresa**. Não é alternativa ao GitLab interno para código corporativo. Na dúvida, o projeto vai
para o GitLab.

### 3.5 Fluxo de protótipos e POCs

Exceções são toleradas **apenas para protótipos iniciais e MVPs experimentais** — cada vez mais
frequentes com o uso de IA — quando a agilidade da prova de conceito é essencial.

Caminho recomendado para um protótipo:

1. Crie o repositório no **namespace pessoal do GitLab interno**
   (`https://gitlab.rech.com.br/gitlab/<seu-usuario>/<projeto>`). Isso já garante backup,
   rastreabilidade e histórico desde o primeiro commit, sem exigir homologação prévia.
2. Se o protótipo nascer em máquina local, mantenha-o em pasta de rede com cobertura de backup
   até que o repositório exista.
3. **Migre imediatamente** para o grupo oficial correspondente (§8.1) e solicite homologação ao
   **DevTools** assim que qualquer destas condições ocorrer:
   - o protótipo evoluir para projeto estável;
   - for compartilhado entre colegas;
   - envolver dados sensíveis;
   - passar a fazer parte de qualquer fluxo corporativo da Rech.

> **Atenção do agente:** namespace pessoal *dentro do GitLab interno* é aceitável para protótipo.
> Isso é diferente de "conta pessoal externa", que é proibida (§3.3). Se o protótipo já atende
> alguma das condições do item 3, o agente deve alertar que a migração está atrasada.

### 3.6 Como criar ou migrar um repositório

```bash
# 1. Crie o projeto pela interface do GitLab interno, a partir de um modelo oficial (§7.1).

# 2. Projeto novo, ainda sem Git local:
git init
git remote add origin https://gitlab.rech.com.br/gitlab/<grupo>/<projeto>.git
git add .
git commit -m "Commit inicial"
git push -u origin main

# 3. Protótipo local existente que precisa subir:
git remote add origin https://gitlab.rech.com.br/gitlab/<seu-usuario>/<projeto>.git
git push -u origin main

# 4. Promover protótipo do namespace pessoal para o grupo oficial:
#    (transfira o projeto pelo GitLab em Settings > General > Advanced > Transfer project,
#     preservando histórico, issues e merge requests — depois atualize o remoto local)
git remote set-url origin https://gitlab.rech.com.br/gitlab/<grupo>/<projeto>.git
```

Antes de criar ou migrar, **consulte sempre o time DevTools** (§10).

---

## 4. Stack tecnológica homologada

### 4.1 Linguagem por finalidade

| Linguagem | Finalidades | Grupo no GitLab |
|---|---|---|
| **Ruby** | Scripts e rotinas CLI de processamento leve (ex.: automação) | `rech/ruby` |
| **Java** | Rotina CLI de processamento moderado; aplicação desktop com UI gráfica (Swing); backend (ex.: CRUD REST) com **Spring Framework / Spring Boot** (§4.8.3) | `rech/java` |
| **Rust** | Rotina CLI de qualquer porte, de automação simples a processamento pesado (§4.6); desktop com UI gráfica (egui/Tauri); desenvolvimento de baixo nível; backend (ex.: CRUD REST); servidor web Axum com frontend Askama+HTMX ou Leptos (Tailwind + daisyUI) | `rech/rust` |
| **Node.js / TypeScript** | Backend de aplicação web com **NestJS + TypeORM** sobre Node LTS — a opção padrão para web (§4.8); frontend **Angular** | `rech/javascript` |
| **Flutter** | Aplicação mobile | `rech/web/mobile` |
| **COBOL (isCobol)** | Desenvolvimento no sistema **SIGER** | `rech/cobol` |
| **Delphi** | Desenvolvimento no sistema **SICLA** | `rech/delphi` |

Quando mais de uma linguagem atende ao caso, o **peso do processamento** orienta a escolha — Ruby
para carga leve, Java para carga moderada, Rust para carga pesada — mas é guia, não barreira. O
limite inferior do Rust é aberto: ele é escolha legítima também para automação e CLI simples, pelos
motivos da §4.6.

**Aplicação web com interface de usuário é o caso em que a tabela acima não basta**, porque a
escolha não é só de linguagem: envolve framework de frontend, framework de backend, camada de acesso
a dados e banco, que precisam combinar entre si. Esse recorte está na **§4.8**, e é lá que a
recomendação padrão da casa está fixada — **Angular no frontend, NestJS + TypeORM no backend,
MariaDB no banco**.

### 4.2 Antipadrões — desvios frequentes que devem ser sinalizados

| Encontrado | Deveria ser | Sinal no projeto |
|---|---|---|
| **Python** | Ruby (scripts/CLI leve) ou Node.js/TypeScript | `requirements.txt`, `pyproject.toml`, `*.py` |
| **C#** | Java | `*.csproj`, `*.sln`, `*.cs` |
| **Go** | Rust | `go.mod`, `go.sum` |

Estes três são os desvios mais comuns e o principal motivo pelo qual este documento existe. Um
projeto isolado em linguagem fora da stack gera custo permanente: ninguém mais na empresa o mantém,
não há template de CI/CD, não há biblioteca interna reaproveitável e o onboarding fica travado em
uma pessoa.

> O grupo `rech/c-sharp` existe, mas é **legado** — dois de seus três projetos estão sem atividade
> desde 2023. A existência do grupo não autoriza novos projetos em C#.

#### Ação esperada do agente, nesta ordem

**1. Recomende o porte.** Esta é a recomendação padrão e deve ser a primeira coisa apresentada ao
humano: portar o projeto para a linguagem homologada correspondente, seguindo o procedimento da
§4.7. Indique a linguagem destino, o que já existe pronto nas bibliotecas internas (§8.3) e o
caminho de menor risco.

**2. Verifique se há impedimento técnico real.** Só existe exceção quando uma biblioteca essencial
não tem equivalente em nenhuma linguagem da stack (§4.3). Isso precisa ser **demonstrado**, nomeando
a biblioteca e o que ela faz — não presumido porque o projeto já está escrito em outra linguagem.

**3. Escalone ao DevTools apenas então** — quando o impedimento do item 2 se confirmar, ou quando o
humano decidir manter o desvio mesmo sem impedimento técnico. Aí sim a permanência exige exceção
formalizada (§10).

> **Não abra pela escalação.** "Formalize uma exceção junto ao DevTools" não é a recomendação padrão
> para um projeto fora da stack: é o tratamento do caso excepcional. Apresentada primeiro, ela
> transforma a via de escape na via natural, e o desvio se perpetua sem que ninguém tenha avaliado o
> porte. O porte é o caminho normal; a exceção é o desvio dele.

### 4.3 Exceção: Python

Python é aceitável **quando não existe alternativa viável na stack** — tipicamente quando uma
biblioteca essencial não tem equivalente em nenhuma linguagem homologada. O caso mais comum hoje é
integração com modelos de linguagem (LLM) e ecossistema de IA.

#### Citar "IA" não dispensa a verificação — cheque a alternativa em Rust

**Mencionar LLM ou IA não é passe livre.** Antes de invocar a exceção, verifique explicitamente se o
ecossistema Rust não cobre o caso, e registre o resultado dessa verificação. Situações bem distintas
costumam ser confundidas sob o mesmo rótulo:

| O que o projeto realmente faz | Exceção se justifica? |
|---|---|
| **Consumir uma API de LLM** por HTTP — enviar prompt, tratar a resposta, encadear chamadas | **Não.** Isso é requisição HTTP com JSON: `reqwest` + `serde` resolvem em Rust, e Java e Node/TS também atendem. Não há biblioteca insubstituível envolvida. |
| **Processar dados em volume** — o que se faria com Pandas | **Não, e aqui o Rust tende a ser a escolha melhor.** `polars` é escrito em Rust e foi projetado para volume — o pacote Python é um vínculo para ele. Para uso em estilo NumPy, `ndarray`. |
| **Inferência local de modelo** | **Verifique antes.** `candle` (framework de ML da Hugging Face, escrito em Rust) e `ort` (vínculo para o ONNX Runtime) cobrem parte relevante. Note que `tokenizers`, da Hugging Face, **é escrito em Rust** — o pacote Python é apenas um vínculo. |
| **Treinar ou ajustar modelos de aprendizado profundo** — PyTorch, `transformers` | **Frequentemente sim — por efeito de rede, não por limitação da linguagem.** `burn` e `candle` treinam em Rust, mas pesos pré-treinados, exemplos, artigos e ferramental de pesquisa estão majoritariamente atrelados ao Python. Declare qual desses fatores pesa no seu caso. |

Repare que o Rust aparece com força justamente onde a intuição diz o contrário: `tokenizers` e
`polars` **são projetos Rust** que o Python consome por vínculo. "É Python porque é IA" descreve o
hábito do mercado, não uma limitação técnica.

A maior parte do que se faz na empresa sob o rótulo de IA cai na **primeira linha** — consumir uma
API. Nesse caso a exceção não se aplica, e a recomendação segue sendo a stack padrão.

Ao invocar essa exceção, o agente deve:

1. Nomear a biblioteca específica que não tem equivalente;
2. **Declarar que verificou a alternativa em Rust** e por que ela não atende — citando o crate
   avaliado, não apenas afirmando que não existe;
3. Registrar a justificativa e essa verificação no `README.md` do projeto;
4. Orientar o humano a validar a exceção com o **DevTools**;
5. Isolar a parte Python no menor escopo possível, mantendo o restante do sistema na stack padrão —
   em especial, não deixar que a dependência de IA arraste para Python a API, a interface ou o
   acesso a banco, que continuam na stack homologada.

"É mais rápido em Python" ou "eu conheço melhor Python" **não** são justificativas válidas.
**"O projeto já está escrito em Python" tampouco** — isso é o custo do porte (§4.7), não um
impedimento técnico. Se existe equivalente na stack, a recomendação continua sendo portar.

### 4.4 Stack não uniforme

Se o projeto misturar linguagens sem justificativa — por exemplo, um utilitário Python dentro de um
projeto Rust, ou scripts C# ao lado de código Java — o agente deve sugerir ao humano **adaptar ou
reescrever** o componente destoante, apresentando:

- o esforço estimado da adaptação;
- a biblioteca interna equivalente que já resolve o problema (§8.3);
- o risco de manter como está (manutenção, CI/CD, onboarding).

Vale aqui a mesma ordem da §4.2: **a adaptação é a recomendação padrão**, e o procedimento está na
§4.7 — portar sem antes cobrir o original com testes é a forma mais comum de perder comportamento
que ninguém documentou.

O que fica a critério do desenvolvedor é **como** e **quando** adequar — não se a regra se aplica.
Manter a stack não uniforme exige **exceção formalizada junto ao DevTools** (§10). Enquanto essa
formalização não ocorrer, o agente mantém a não conformidade registrada no relatório (§11), e ela
reaparece a cada nova auditoria.

### 4.5 Ruby — habilitação de bibliotecas (gems)

O Ruby da Rech é executado pelo wrapper `f:\bat\ruby.bat`, que sincroniza o interpretador de
`F:\DIV\Ruby` para `C:\RECH\Ruby` e **desabilita o RubyGems por padrão** (`--disable=gems`, para
acelerar o boot). Um projeto Ruby que dependa de gems não funciona sem configuração explícita, e as
falhas são pouco óbvias.

Esta seção existe para sustentar a §4.2: de nada adianta orientar Ruby no lugar de Python se o
desenvolvedor esbarrar em erro obscuro ao usar a primeira biblioteca. Uso de gems remotas
(`rubygems.org`) foi validado no spike `spike-gems`, **inclusive gems com extensões nativas**.

#### Três configurações obrigatórias

**1. Habilitar o RubyGems.** Versione um arquivo vazio `.ruby_use_gems` na raiz do projeto. O
wrapper também aceita a variável de ambiente `RUBY_GEMS=S`, mas ela depende da configuração da
estação e não consta do ambiente persistente — o arquivo é local ao projeto e funciona em qualquer
máquina.

**2. Sobrescrever o `BUNDLE_GEMFILE`.** As estações definem essa variável apontando para o Gemfile
do Ruby LSP (`S:\BAT\.ruby-lsp\Gemfile`). Sem sobrescrever, o bundler ignora o Gemfile do projeto e
falha com `Bundler::GemfileNotFound`. Faça no `.bat` de execução do projeto:

```batch
set BUNDLE_GEMFILE=%~dp0Gemfile
```

**3. Isolar as gems no projeto.**

```batch
call f:\bat\ruby.bat bundle config set --local path vendor/bundle
call f:\bat\ruby.bat bundle install
```

Sem isso, as gems são instaladas no Ruby compartilhado da estação — onde desaparecem na próxima
sincronização e mascaram dependências ausentes, fazendo o projeto funcionar em uma máquina e quebrar
em outra. **A falha é silenciosa:** a saída do `bundle install` é praticamente idêntica nos dois
casos. Confirme a linha `Bundled gems are installed into ./vendor/bundle` e a existência de
`.bundle/config`.

#### Versionamento

| Versiona | Ignora |
|---|---|
| `.ruby_use_gems`, `Gemfile`, `Gemfile.lock`, `.bundle/config` | `vendor/bundle/` |

O `Gemfile.lock` é obrigatório: sem ele a instalação não é reproduzível entre estações. As licenças
das gems declaradas no `Gemfile` entram na análise do §10.3.

> Não existe template de CI/CD Ruby em `rech/gitlab-ci-lib` (§7.1). Projetos Ruby que precisem de
> pipeline devem acionar o DevTools.

### 4.6 Rust — alcance e controles

**Rust não está restrito a processamento pesado.** É escolha legítima para automação e utilitários
de linha de comando de qualquer porte, e é o que a prática da empresa já demonstra: boa parte dos
projetos de `rech/rust` são utilitários pequenos — `ri-clip`, `ri-path`, `ri-del-tmp`,
`ri-alias-prog`, `ri-enconv`, `ri-logs-cleaner`.

A adoção reflete isso. Em 18/07/2026: **Rust 93 projetos**, Java 42, JavaScript 9, Ruby 2.

Quatro razões para preferir Rust mesmo em rotina simples:

#### 1. CI/CD com a maior cobertura de plataformas e destinos

| | Rust | Java |
|---|---|---|
| Plataformas de build | Windows 64 e 32 bits; Linux com e sem musl | Windows |
| Destinos de deploy | interno, SIGER, Data Server, update-artifacts, Docker | interno, SIGER, MinIO, Docker |
| Versionamento automático | `bump-version` (patch/minor/major) | — |
| Testes de integração | — | disponível |
| Cobertura de testes | — | disponível |
| Estágio `security` / SCA | **em desenvolvimento pelo DevTools** | disponível |

O binário estático Linux com musl e o build 32 bits são exclusivos do template Rust, e cobrem
cenários de distribuição que os demais templates não atendem.

#### 2. Segurança garantida pela linguagem

O sistema de ownership e o *borrow checker* eliminam **em tempo de compilação** classes inteiras de
vulnerabilidade que dominam os CVEs de código nativo: use-after-free, double-free, estouro de buffer
e condições de corrida entre threads. Não há ponteiro nulo, e todo trecho que abre mão dessas
garantias exige o marcador `unsafe` — explícito, pesquisável e auditável.

Para código de baixo nível e para tudo que hoje é escrito em Delphi ou C, essa é a diferença mais
relevante: o erro deixa de ser detectável em produção e passa a ser impossível de compilar.

#### 3. Ecossistema interno maduro

As bibliotecas `ri-lib-*` (§8.3) cobrem arquivos, strings, log, criptografia, compactação,
processos, sistema operacional, e-mail, S3/MinIO, GitLab e sincronização. Uma rotina nova começa com
boa parte da infraestrutura pronta e já validada em produção.

#### 4. Distribuição sem runtime

O artefato é um binário único, sem dependência de runtime instalado na estação. Compare com Ruby,
que depende do wrapper `f:\bat\ruby.bat`, da sincronização de rede e das três configurações da
§4.5; ou com Java, que exige JRE compatível.

#### Como montar o `.gitlab-ci.yml` de um projeto Rust

O `rust.gitlab-ci.yml` (§7.1) oferece os jobs; cada projeto declara **apenas os que usa**, herdando
com `extends`. Duas decisões definem o conjunto: **para onde vai o artefato** e **em que plataformas
ele roda**.

**1. Destino do artefato**

| Padrão | Job de deploy | Quando usar | Referência |
|---|---|---|---|
| **Distribuído** | `rust-deploy-siger-*` | O executável é entregue ao cliente junto com o SIGER | `ri-file-sender` |
| **Interno** | `rust-deploy-interno-*` | Roda apenas na infraestrutura da Rech | `ri-file-receiver`, `ri-vm` |

Existem ainda `rust-deploy-data-server-*`, para artefatos publicados no Data Server, e
`rust-deploy-update-artifacts-*`, para o fluxo de atualização.

**2. Plataformas**

Declare um par `build` + `deploy` para cada alvo. Um projeto distribuído tende a cobrir mais alvos,
porque não controla o parque instalado do cliente — inclusive estações 32 bits. Um projeto interno
cobre apenas onde de fato roda.

| Alvo | Jobs | Observação |
|---|---|---|
| Windows 64 | `rust-build-windows`, `rust-deploy-*-windows` | o caso mais comum |
| Windows 32 | `rust-build-windows-32`, `rust-deploy-*-windows-32` | típico de software distribuído, para parque antigo |
| Linux | `rust-build-linux`, `rust-deploy-*-linux` | binário estático com musl |
| Linux sem musl | `rust-build-linux-no-musl`, `rust-deploy-interno-linux-no-musl` | quando há dependência de biblioteca nativa do sistema |

**Projeto que roda só em uma plataforma declara só os jobs dela.** É o caso do `ri-vm`, que interage
com recursos do Windows e não tem contraparte Linux — seu `.gitlab-ci.yml` traz apenas
`rust-prepare-windows`, `rust-test-windows`, `rust-code-quality-windows`, `rust-build-windows` e
`rust-deploy-interno-windows`. Declarar jobs Linux nesse caso produziria falha de pipeline sem
motivo.

**Modelo — aplicação distribuída** (`ri-file-sender`, Windows 64 e 32 mais Linux):

```yaml
include: 'https://gitlab.rech.com.br/gitlab/rech/gitlab-ci-lib/raw/main/rust.gitlab-ci.yml'

rust-prepare-windows:      { extends: .rust-prepare-windows }
rust-test-windows:         { extends: .rust-test-windows }
rust-code-quality-windows: { extends: .rust-code-quality-windows }
rust-build-windows:        { extends: .rust-build-windows }
rust-deploy-siger-windows: { extends: .rust-deploy-siger-windows }
rust-build-windows-32:        { extends: .rust-build-windows-32 }
rust-deploy-siger-windows-32: { extends: .rust-deploy-siger-windows-32 }
rust-prepare-linux:      { extends: .rust-prepare-linux }
rust-test-linux:         { extends: .rust-test-linux }
rust-build-linux:        { extends: .rust-build-linux }
rust-deploy-siger-linux: { extends: .rust-deploy-siger-linux }
```

**Modelo — aplicação interna** (`ri-file-receiver`): o mesmo conjunto trocando `deploy-siger` por
`deploy-interno` e dispensando o 32 bits.

**Modelo — aplicação só Windows** (`ri-vm`): apenas os cinco jobs `*-windows` listados acima.

> Use sempre `https://gitlab.rech.com.br/...` no `include`. Alguns projetos antigos apontam para
> `http://gitlab.rechinfo.local/...`, que resolve apenas em parte da rede.

#### Enquanto o SCA para Rust não entra em produção

O estágio de análise de composição de software para projetos Rust está em desenvolvimento pelo
DevTools. Até que esteja disponível no template, projetos Rust devem tratar a verificação de
dependências como responsabilidade explícita — revisando o que entra no `Cargo.toml` e submetendo
dependências novas à avaliação do §10. Isso não desqualifica a escolha por Rust; apenas significa
que, neste item específico, o controle ainda é manual.

### 4.7 Portar para a stack homologada

Quando a §4.2 ou a §4.4 identificam um projeto fora da stack, o remédio é portá-lo. Reescrita é a
operação de maior risco em software: o código original costuma carregar anos de comportamento não
documentado — casos de borda, contornos para bugs de terceiros, regras de negócio descobertas em
produção. **Portar lendo o código perde exatamente aquilo que não está escrito nele.**

O mecanismo que evita essa perda são os testes. Eles transferem a especificação real do sistema
antigo para o novo e são a evidência objetiva de que o porte ficou bom.

#### 1. Antes de portar, cubra o original com testes

Escreva o máximo possível de testes **unitários e de integração contra o código original, na
linguagem original**, antes de escrever a primeira linha na linguagem destino.

São testes de caracterização: documentam o que o sistema **faz**, não o que deveria fazer. Se um
comportamento parecer errado, capture-o como está e registre a suspeita à parte — decidir se é bug é
uma decisão separada, que não deve se misturar ao porte.

Nesta etapa, **priorize testes de integração sobre unitários**: são eles que capturam o
comportamento ponta a ponta, inclusive o que ninguém documentou. Testes presos à estrutura interna
valem menos aqui, porque essa estrutura vai mudar no porte.

Onde possível, capture entradas e saídas reais de produção e converta-as em casos de teste.

#### 2. Registre o comportamento observável

| Superfície | O que fixar |
|---|---|
| CLI | argumentos, códigos de saída, formato de `stdout` e `stderr` |
| Arquivos | formato, layout, **encoding** (UTF-8 × Windows-1252), quebra de linha |
| Banco | esquema, consultas, transações |
| Integrações | endpoints, payloads, cabeçalhos, timeouts |
| Agendamento | periodicidade, concorrência, comportamento em falha |

#### 3. Porte os testes junto com o código

Os testes migram junto com a implementação, traduzidos para o framework de teste da linguagem
destino. Sempre que possível, **porte o teste antes da implementação correspondente** — ele define o
contrato que o código novo precisa cumprir.

A suíte portada deve cobrir no mínimo o que a original cobria. Cobertura menor depois do porte é
regressão, não simplificação.

#### 4. Confirme a equivalência antes de desativar o original

Não basta a suíte nova passar. Rode as duas versões contra as mesmas entradas e compare as saídas:

- **CLI e lote:** execute ambas sobre a mesma massa real e faça `diff` dos resultados;
- **Serviços:** mantenha as duas em paralelo por um período, comparando as respostas;
- desative o original apenas depois que a comparação estiver estável.

#### 5. Não misture porte com melhoria

Porte primeiro com **equivalência funcional**; melhorias, refatorações e funcionalidades novas vêm
depois, em alterações separadas. Misturar as três torna impossível saber o que quebrou — e é a causa
mais comum de reescritas que atrasam ou são abandonadas.

A exceção legítima é o reuso: ao portar, substitua rotinas feitas à mão pelas bibliotecas internas
equivalentes (§8.3). Reimplementar em Rust o que o `ri-lib-file-utils` já resolve é repetir o
problema em outra linguagem.

#### Critérios de um porte concluído

| Critério | Referência |
|---|---|
| Suíte de testes com cobertura igual ou maior que a do original | §4.7 |
| Equivalência de saída confirmada contra o original | §4.7 |
| `README.md` completo | §6 |
| `.gitlab-ci.yml` a partir do template da linguagem | §7 |
| Nome conforme o prefixo da linguagem | §8.2 |
| Bibliotecas internas reutilizadas no lugar de código próprio | §8.3 |
| Original desativado e retirado do fluxo | §4.7 |

> **Se o original não tem testes e cobri-lo for inviável** — código sem pontos de entrada testáveis,
> dependência forte de ambiente, ausência de massa de dados —, isso é uma constatação a reportar, não
> um detalhe a contornar. O porte passa a ser de alto risco, e a decisão de seguir cabe ao humano
> junto ao DevTools (§10), ciente de que a equivalência não poderá ser demonstrada.

### 4.8 Aplicações web — stack de referência

Vale para todo sistema acessado pelo navegador: interface de usuário servida por HTTP mais um
backend próprio. Não vale para página estática, relatório publicado no Portal BI, nem para serviço
sem interface — esse último é backend puro e segue a §4.1.

| Camada | Tecnologia | Detalhe |
|---|---|---|
| **Frontend** | **Angular** (TypeScript) | §4.8.2 |
| **Backend** | **NestJS** sobre **Node.js LTS** | §4.8.3 |
| **Acesso a dados** | **TypeORM** | §4.8.4 |
| **Banco** | **MariaDB** | §5 |
| **Entrega** | build do Angular servido pelo próprio NestJS | §4.8.5 |
| **Grupo no GitLab** | `rech/javascript` | §8.1 |

#### 4.8.1 Por que uma combinação fixa, e não escolha caso a caso

Cada camada isolada teria várias opções defensáveis. O custo não está em escolher errado uma vez —
está em cada projeto escolher diferente. Com a combinação fixa:

- **TypeScript ponta a ponta.** Uma linguagem só no projeto inteiro; tipos de contrato (DTO,
  enumerações, formato de resposta) podem ser compartilhados entre frontend e backend em vez de
  reescritos e dessincronizados.
- **Onboarding e substituição de responsável.** Quem entra em um projeto web da casa encontra a
  mesma estrutura; a manutenção não fica presa na pessoa que escolheu o framework.
- **Um processo, uma porta.** Menos superfície de deploy e de infraestrutura (§4.8.5).
- **Convergência com o parque instalado.** É a stack em que a empresa já tem projetos web em
  produção, e é sobre ela que o DevTools irá construir o template de CI/CD (§4.8.7).

Divergir de qualquer linha da tabela acima exige justificativa **registrada no `README.md`** e, para
troca de banco ou de ORM, exceção formalizada junto ao DevTools (§10).

#### 4.8.2 Frontend — Angular

**Angular com TypeScript é o framework de frontend homologado.** React, Vue, Svelte e jQuery não
são alternativas: um projeto novo em qualquer um deles nasce não conforme e cai na §4.7.

**Versão.** Projeto novo nasce na **versão estável mais recente** do Angular. Projeto existente não
pode sair da **janela de suporte oficial** do framework (a versão maior recebe suporte ativo por
cerca de 6 meses e correções de segurança por cerca de mais 12) — fora dela, o projeto deixa de
receber correção de vulnerabilidade e a atualização acumulada passa a ser um projeto por si só.

A base instalada hoje está majoritariamente na **16**. Isso não bloqueia projeto novo, que deve
nascer atualizado; para os existentes, a atualização é incremental:

```bash
# um major por vez — nunca pule versões
npx ng update @angular/core@17 @angular/cli@17
npm test
```

Regras que acompanham:

- **`strict: true`** no `tsconfig.json`. TypeScript sem modo estrito entrega boa parte do que
  justifica usá-lo;
- **componentes standalone** no código novo;
- **ESLint + Prettier** configurados e versionados, rodando no pipeline;
- **testes automatizados** obrigatórios, executados no pipeline antes do build;
- **CSS**: use a biblioteca de componentes já adotada pelo projeto; não introduza uma segunda.

> **AngularJS (1.x) é tecnologia descontinuada**, sem relação de compatibilidade com o Angular
> atual. Encontrado em projeto vivo, é não conformidade a reportar, e o remédio é porte (§4.7), não
> atualização.

#### 4.8.3 Backend — NestJS é a opção padrão

Três opções são homologadas para backend web, com ordens de preferência distintas:

| Opção | Quando usar | Referência |
|---|---|---|
| **NestJS + TypeORM** (Node LTS) | **Padrão para toda aplicação web nova.** É a escolha na ausência de motivo específico para as outras | §4.8.4 |
| **Spring Boot** (Java) | Quando o serviço se integra fortemente a base Java existente, ou reaproveita bibliotecas internas Java (`JRIUtil`, `JRILib`) | §4.1, §8.3 |
| **Rust + Axum** | Serviço sem interface rica, exigência de desempenho, ou projeto que já é Rust | §4.6 |

**Não é escolha livre entre iguais.** Havendo dúvida, é NestJS. Optar por Spring Boot ou Axum é
legítimo, mas exige que o motivo esteja escrito no `README.md` — "preferência da equipe" não é
motivo. As três estão dentro da stack; nenhuma delas dispensa o registro da decisão.

**Versão do Node.** Use a **LTS ativa**. Nunca versão ímpar (não recebe LTS) nem versão fora de
suporte. A versão fica declarada em dois lugares, e ambos são versionados:

```jsonc
// package.json
"engines": { "node": ">=22 <23" }
```

```
// .nvmrc
22
```

**Convenções mínimas do NestJS:**

- **um módulo por domínio** (`src/<dominio>/`), com controller, service e entities juntos;
- **DTO com `class-validator`** e `ValidationPipe` global em modo `whitelist` — validar na borda,
  não dentro da regra de negócio;
- **configuração por variável de ambiente** (`@nestjs/config`). Segredo — senha de banco, chave de
  API, segredo de JWT — **nunca** é versionado; o repositório traz apenas o `.env.example` com as
  chaves e valores de exemplo;
- **testes com Jest**, rodando no pipeline;
- **erros pelas exceções do próprio framework** (`HttpException` e derivadas), para que o formato de
  resposta de erro seja o mesmo em toda a aplicação.

#### 4.8.4 Acesso a dados — TypeORM sobre MariaDB

**TypeORM é a camada de acesso a dados homologada para backend NestJS.** Prisma, Sequelize, Knex e
uso direto do driver são desvios: trocam a camada que o resto da casa conhece e quebram o padrão de
migrations. Substituí-la exige exceção formalizada junto ao DevTools (§10).

| Regra | Motivo |
|---|---|
| **Entities versionadas** no repositório | são a definição do esquema, não artefato gerado |
| **Toda alteração de esquema entra por migration versionada** | é o que torna o banco reproduzível entre estações, homologação e produção |
| **`synchronize: true` é proibido fora de desenvolvimento local** | ele altera o esquema de produção sozinho, a partir do código, sem revisão e sem histórico — inclusive removendo coluna |
| **SQL cru só onde o ORM não atende**, sempre parametrizado | concatenar valor em string de consulta é injeção de SQL, não estilo de código |

O banco é **MariaDB** (§5). SQLite é aceitável apenas para teste automatizado e protótipo local —
nunca como banco de uma aplicação web multiusuário, e nunca em uma configuração que faça o
desenvolvedor testar em um banco e publicar em outro.

#### 4.8.5 Entrega — um processo, uma porta

O padrão é o **backend NestJS servir o build do Angular** (`@nestjs/serve-static`): um único
processo, uma única porta, um único artefato de deploy. Isso elimina configuração de CORS, proxy
reverso e sincronização de duas publicações.

Servir o frontend em separado é aceitável quando há motivo real — CDN, escala independente,
frontend consumido por mais de um backend — e o motivo vai no `README.md`.

O `README.md` (§6) de uma aplicação web precisa trazer, no bloco "Onde é acessado", a **URL, a porta
e o host** de cada ambiente, e no bloco de dependências de runtime a **versão do Node**, a **versão
do MariaDB** e as **variáveis de ambiente obrigatórias**.

#### 4.8.6 Antipadrões web

| Encontrado | Deveria ser | Sinal no projeto |
|---|---|---|
| React, Vue, Svelte, jQuery | Angular | `react`, `vue`, `svelte`, `jquery` no `package.json` |
| AngularJS 1.x | Angular atual (porte, §4.7) | `angular.js`, diretivas `ng-app`/`ng-controller` |
| Express ou Fastify "puro" em projeto novo | NestJS | `express`/`fastify` sem `@nestjs/core` |
| Prisma, Sequelize, Knex, driver direto | TypeORM | `prisma/`, `sequelize`, `knex` no manifesto |
| JavaScript sem TypeScript | TypeScript | ausência de `tsconfig.json` |
| PostgreSQL, MongoDB, SQL Server | MariaDB | driver `pg`, `mongodb`, `mssql` |
| Angular fora da janela de suporte | atualizar, um major por vez | `@angular/core` em versão sem suporte |
| Segredo versionado (`.env` no repositório) | `.env.example` + variável de ambiente | `.env` rastreado pelo Git |

Vale aqui a mesma ordem da §4.2: **a recomendação padrão é adequar**, pelo procedimento da §4.7 —
não consultar o DevTools primeiro.

#### 4.8.7 CI/CD enquanto não há template Node/TypeScript

Não existe template compartilhado de pipeline para Node/TypeScript em `rech/gitlab-ci-lib` (§7.1).
Isso **não dispensa o `.gitlab-ci.yml`**: até o template existir, o projeto define o seu, cobrindo no
mínimo `test` (backend e frontend), `code-quality` (lint) e `build`. Acione o DevTools ao criar o
projeto, para que o pipeline nasça alinhado ao que virará template.

### 4.9 Escolhida a stack, a organização do código é a Parte II

Esta seção termina a pergunta *"com o quê construir"*. Ela **não** responde *"como organizar o que
for construído"* — e stack certa com código desorganizado produz o mesmo custo de manutenção que a
§4.2 tenta evitar: ninguém encontra a regra de negócio, o teste não isola nada e o onboarding
continua travado em uma pessoa.

A partir daqui vale a **Parte II (§13 a §21)**: camadas, estrutura de módulo, Clean Code, SOLID,
persistência, documentação, testes e segurança. Ela se aplica a qualquer linguagem da §4.1 — o
vocabulário muda (§13.5), o desenho não.

---

## 5. Banco de dados

A stack homologada de banco de dados é:

- **MariaDB** — banco relacional servidor, para aplicações multiusuário;
- **SQLite** — banco embarcado, para aplicações locais, CLI, cache e protótipos.

Outros SGBDs exigem justificativa e homologação do DevTools. O agente deve inspecionar drivers,
strings de conexão e dependências do manifesto para detectar desvios (PostgreSQL, SQL Server,
MongoDB, Oracle etc.) e reportá-los.

**Aplicação web é sempre MariaDB** (§4.8.4). SQLite ali só se justifica em teste automatizado e
protótipo local — desenvolver contra um banco e publicar em outro produz falha que só aparece em
produção.

Esta seção escolhe **qual** banco. **Como o código fala com ele** — camada Repository única,
migrations, seeds, índices, constraints e chaves estrangeiras — está na **§16**.

---

## 6. README.md obrigatório

Todo projeto deve conter um `README.md` na raiz. Ele é o ponto de entrada tanto para humanos quanto
para agentes de IA que venham a trabalhar no projeto depois.

### 6.1 Blocos obrigatórios

1. **Propósito** — o que o projeto faz, em uma a três frases.
2. **Onde é acessado** —
   - CLI: caminho completo do executável distribuído;
   - Servidor: IP/URL e host onde roda (e o ambiente correspondente);
   - Biblioteca: como declarar a dependência.
3. **Como compilar e/ou executar** — comandos exatos, incluindo os principais argumentos de CLI.
4. **Dependências de runtime** — versões de JDK, Rust, Ruby, Node, isCobol, Delphi, bibliotecas
   nativas, variáveis de ambiente e arquivos de configuração requeridos.
5. **Justificativas de exceção**, quando houver (ex.: uso de Python conforme §4.3).
6. **Vinculação a este padrão** — uma linha declarando que o projeto o segue, com link para este
   documento único e para a URL canônica da Parte I (§1.1). É o que faz um agente de IA, em qualquer
   sessão futura, descobrir sozinho que o projeto está sujeito a estas regras. Sem essa linha, cada
   nova conversa começa do zero e a conformidade depende de alguém lembrar de mencioná-la.

> O `README.md` da raiz descreve **o projeto**. Ele não substitui a documentação **por módulo**
> exigida pela §17 (`README.md`, `arquitetura.md`, `api.md`, `regras-negocio.md`, `casos-de-uso.md`,
> `fluxo.md` em `<modulo>/docs/`) — são dois níveis distintos e ambos obrigatórios.

### 6.2 Modelo

````markdown
# <nome-do-projeto>

<Uma a três frases sobre o que o projeto faz e para quem.>

> Este projeto segue o [Padrão de Desenvolvimento da Rech](PADRAO-DESENVOLVIMENTO-RECH.md) —
> documento único: stack homologada (Parte I) e arquitetura de código (Parte II). A Parte I tem
> [versão canônica no GitLab interno](https://gitlab.rech.com.br/gitlab/rech/ia/padrao-ia/raw/master/PADRAO-RECH.md).

## Acesso

- **Executável:** `\\servidor\dist\<projeto>\<projeto>.exe`
- **Servidor:** http://<host>:<porta> (host: `<nome-do-host>`)
- **Como dependência:**
  ```toml
  [dependencies]
  <projeto> = { git = "https://gitlab.rech.com.br/gitlab/rech/rust/<projeto>.git" }
  ```

## Uso

```
<projeto>.exe --opcao <VALOR> <comando>
```

### Comandos
```
  comando-a   Descrição do comando A
  comando-b   Descrição do comando B
```

### Opções
```
  -o, --opcao <VALOR>   Descrição da opção
  -h, --help            Exibe a ajuda
```

## Compilação

```bash
cargo build --release
```

## Dependências de runtime

- <runtime e versão mínima>
- <variáveis de ambiente / arquivos de configuração>

## Troubleshooting

<Problemas conhecidos e suas soluções.>
````

Referências reais de README no padrão da casa: `rech/rust/ri-ci-cd` (aplicação CLI) e
`rech/rust/ri-lib-file-utils` (biblioteca).

---

## 7. CI/CD

### 7.1 Modelos oficiais

Todo repositório novo deve ser criado a partir dos **modelos oficiais disponíveis no próprio
GitLab**. A estrutura de pastas, a nomeação do projeto, o fluxo de branches e as rotinas de CI/CD
seguem as boas práticas definidas pelo time **DevTools**.

Os templates compartilhados de pipeline ficam em **`rech/gitlab-ci-lib`**:

| Linguagem | Template | Situação |
|---|---|---|
| Rust | `rust.gitlab-ci.yml` | Disponível |
| Java | `java.gitlab-ci.yml` | Disponível |
| Ruby, Node/TypeScript, Flutter, Delphi | — | Sem template compartilhado; consultar DevTools |

Projeto web (Angular + NestJS) segue sem template compartilhado, mas **não sem pipeline** — o
mínimo exigido está na §4.8.7.

Exemplo de inclusão em um projeto Rust:

```yaml
include: "https://gitlab.rech.com.br/gitlab/rech/gitlab-ci-lib/raw/main/rust.gitlab-ci.yml"

rust-prepare-windows:
  extends: .rust-prepare-windows

rust-test-windows:
  extends: .rust-test-windows

rust-code-quality-windows:
  extends: .rust-code-quality-windows

rust-build-windows:
  extends: .rust-build-windows

rust-deploy-interno-windows:
  extends: .rust-deploy-interno-windows
```

### 7.2 Etapas do pipeline

Os pipelines são executados pela ferramenta interna **`ri-ci-cd`**, acionada pelo GitLab. É
obrigatório que o projeto tenha um `.gitlab-ci.yml` definido. Etapas disponíveis:

| Etapa | Função |
|---|---|
| `prepare` | Preparação do ambiente de build |
| `test` | Testes unitários |
| `integration-tests` | Testes de integração |
| `build` | Compilação do artefato |
| `code-quality` | Métricas de qualidade de código |
| `code-coverage` | Cobertura de testes unitários |
| `sca` | Análise de composição de software — vulnerabilidades em bibliotecas de terceiros |
| `dependencies` | Geração do arquivo de dependências |
| `deploy` | Deploy conforme a linguagem do projeto |
| `deploy-siger` | Deploy de aplicação distribuída junto com o SIGER |
| `deploy-interno` | Deploy de aplicação interna |
| `deploy-minio` | Deploy de artefatos no MinIO |
| `deploy-data-server` | Deploy de artefatos no Data Server |
| `create-merge-request` | Criação da merge request |
| `bump-version` | Incremento de versão (`patch`/`minor`/`major`) |

As etapas `code-quality`, `code-coverage` e `sca` são o mecanismo prático pelo qual qualidade e
segurança deixam de depender de disciplina individual. Um projeto sem pipeline não tem nenhuma
delas.

> **Nem todo template implementa todas as etapas.** Hoje o `java.gitlab-ci.yml` traz o estágio
> `security` (SCA), cobertura de testes e testes de integração; o `rust.gitlab-ci.yml` traz
> `code-quality`, `bump-version` e a maior cobertura de plataformas e destinos de deploy, com o SCA
> em desenvolvimento pelo DevTools (§4.6). Confirme com o DevTools o que está disponível para a
> linguagem do projeto antes de assumir que uma etapa existe.

---

## 8. Nomenclatura e reuso

### 8.1 Grupos do GitLab

```
rech/ruby          rech/java        rech/rust         rech/javascript
rech/web/mobile    rech/cobol       rech/delphi       rech/containers
rech/ia            rech/powerbi     rech/documentos   rech/c-sharp (legado)
```

### 8.2 Prefixos por linguagem

| Linguagem | Prefixo | Estilo | Exemplos reais |
|---|---|---|---|
| Java | `JRI` | PascalCase | `JRISiger`, `JRIUtil`, `JRICobolParser`, `JRIScheduler` |
| Rust | `ri-` | kebab-case | `ri-siger-web`, `ri-ci-cd`, `ri-catalogo` |
| Rust (biblioteca) | `ri-lib-` | kebab-case | `ri-lib-file-utils`, `ri-lib-crypt-utils`, `ri-lib-s3` |
| Rust (CLI) | `ri-` + sufixo `-cli` | kebab-case | `ri-s3-cli`, `ri-cluster-cli`, `ri-scheduler-cli` |
| Flutter | `fri` | minúsculas | `frisigerapp`, `fripedidomobile` |
| Flutter (pacote) | — | snake_case | `rech_app_components` |
| Delphi | `ri` | minúsculas | `riconcha`, `riatsi`, `risinc` |
| Ruby | sem prefixo | kebab-case | `code-refactor`, `robo` |
| Node/TypeScript (web) | sem prefixo consolidado | kebab-case | convenção a confirmar com o DevTools ao criar o projeto |

Ao criar um projeto, o agente deve propor um nome que siga a convenção da linguagem e verificar se
já não existe projeto equivalente no grupo.

### 8.3 Basear-se no que já existe

Antes de implementar qualquer rotina de uso geral, verifique se já existe biblioteca interna. Em
Rust, o prefixo `ri-lib-` cobre boa parte das necessidades recorrentes:

| Necessidade | Biblioteca interna |
|---|---|
| Manipulação de arquivos | `ri-lib-file-utils` |
| Strings | `ri-lib-string-utils` |
| Logs | `ri-lib-log-utils` |
| Criptografia | `ri-lib-crypt-utils` |
| Compactação | `ri-lib-zip-utils` |
| Processos | `ri-lib-process-utils` |
| Sistema operacional | `ri-lib-system` |
| E-mail | `ri-lib-email-utils` |
| S3 / MinIO | `ri-lib-s3` |
| GitLab | `ri-lib-gitlab` |
| Arquivos INI com tags | `ri-lib-tag-ini` |
| Sincronização | `ri-lib-sync` |

Em Java, o mesmo papel é cumprido por `JRIUtil`, `JRILib`, `JRISocketUtils` e correlatos.
`rech/rust/ri-padrao` é o projeto-exemplo de uso das principais rotinas em Rust.

Reimplementar uma dessas rotinas localmente é não conformidade: duplica manutenção, perde correções
de bug feitas na biblioteca e diverge de comportamento já validado em produção (por exemplo, a
detecção automática de encoding UTF-8/Windows-1252 em `ri-lib-file-utils`).

---

## 9. Não desenvolver o que já existe pronto

O desenvolvimento deve ser **desencorajado quando já existir alternativa gratuita e adequada** —
controle de TODO, agenda, wiki, gestão de tarefas, gerador de relatórios genérico e similares.

Ao identificar que a proposta recai nesse caso, o agente deve, **antes de escrever código**:

1. Declarar ao humano que a necessidade já é atendida por solução existente;
2. Apresentar alternativas concretas — a começar por **pedir a funcionalidade no SICLA** quando a
   necessidade for do domínio dele (§9.1), e incluindo as demais ferramentas já disponíveis
   internamente (Wiki, Chamados, Portal BI, Grafana, CRM RechCloud, Organograma, o próprio GitLab
   com issues, boards e milestones);
3. Estimar o custo real do desenvolvimento próprio: implementação, manutenção contínua, backup,
   segurança, treinamento e substituição do responsável;
4. Só prosseguir mediante decisão explícita do humano.

Software interno tem custo permanente. Ele só se justifica quando resolve algo específico da Rech
que nenhuma alternativa pronta resolve — tipicamente integração com SIGER, SICLA ou processos
próprios da empresa.

### 9.1 Antes de criar: avalie pedir a funcionalidade no SICLA

O **SICLA** (`rech/delphi/riconcha`) é o sistema interno da empresa e já controla boa parte da
operação — **agenda, compromissos, tarefas** e o relacionamento com o cliente. Boa parte do que
chega como *"preciso de um sisteminha para controlar X"* é, na prática, **uma funcionalidade a pedir
no SICLA**, não um projeto novo.

Essa avaliação vem **antes** da escolha de linguagem (§4) e do porte (§4.7): não faz sentido decidir
entre Ruby e Rust para um sistema que talvez não deva existir.

| | Funcionalidade no SICLA | Aplicação nova |
|---|---|---|
| **Dado** | fica junto do resto da operação | nasce em silo, e a integração vira problema depois |
| **Acesso e treinamento** | o usuário já entra e já sabe usar | novo login, nova interface, novo treinamento |
| **Backup, segurança, auditoria** | já cobertos pelo sistema | tudo a montar do zero |
| **Manutenção** | equipe que já mantém o sistema | mais um projeto, com frequência sustentado por uma só pessoa |

**Quando propor o SICLA:** a necessidade pertence ao domínio dele — agenda, compromisso, tarefa,
chamado, cliente, ou qualquer registro que o resto da empresa vá querer consultar junto do que já
existe lá.

**Quando um projeto novo se justifica:** a necessidade é técnica ou está fora desse domínio —
automação de infraestrutura, processamento de arquivos, integração entre sistemas, ferramenta de
desenvolvimento, rotina de servidor.

Ao identificar o primeiro caso, o agente deve dizer isso ao humano **antes de escrever qualquer
código**, e orientar a levar o pedido a quem mantém o SICLA. Se ainda assim a decisão for construir
em separado, registre no `README.md` por que a funcionalidade não coube no SICLA.

---

## 10. Homologação DevTools e licenciamento

### 10.1 Quando acionar

Consulte o time **DevTools sempre antes** de criar, organizar, migrar ou publicar repositórios, e
antes de adotar tecnologia nova. Isso evita duplicidades, desalinhamento de estrutura e uso
ineficiente dos recursos do ambiente.

### 10.2 O que é avaliado

A homologação garante que novas iniciativas estejam alinhadas aos padrões técnicos da empresa e
identifica riscos de segurança, conformidade, manutenção e licenciamento. São analisados:

- linguagens e frameworks utilizados;
- dependências e bibliotecas de terceiros;
- compatibilidade com a infraestrutura existente;
- requisitos de segurança;
- licenciamento dos componentes utilizados;
- impactos operacionais e de manutenção.

### 10.3 Licenças

Algumas licenças de código aberto impõem **obrigações específicas** que afetam como a solução pode
ser usada ou distribuída. A análise prévia evita a adoção inadvertida de bibliotecas com licenças
**incompatíveis** com os modelos de distribuição e uso adotados pela empresa — um risco jurídico,
não apenas técnico.

O agente deve sinalizar dependências com licenças copyleft fortes (GPL, AGPL, SSPL) em projetos
distribuídos a clientes, e recomendar validação com o DevTools. A etapa `sca` do pipeline (§7.2)
complementa essa análise verificando vulnerabilidades conhecidas.

---

## 11. Modelo de relatório de conformidade

Ao concluir a auditoria, o agente deve produzir um relatório neste formato — **cobrindo as duas
partes**, com os achados de stack e os de arquitetura separados, porque têm remédios e prazos
diferentes:

```markdown
## Conformidade com o Padrão de Desenvolvimento — <nome-do-projeto>

**Situação geral:** <Conforme | Conforme com ressalvas | Não conforme>
**Parte I (stack e governança):** <situação> · **Parte II (arquitetura do código):** <situação>

### Bloqueadores
- [§X.Y] <Não conformidade> → <correção recomendada, concreta> (requer decisão humana)

### Ressalvas
- [§X.Y] <Desvio menor> → <correção sugerida>

### Arquitetura do código (Parte II)
- [§13.1] <ex.: 4 controllers acessam o ORM direto> → <correção; se legado, fase e catraca>
- <medição objetiva: nº de módulos com camada Repository, cobertura medida × meta de 80%>

### Corrigido automaticamente
- [§X.Y] <O que foi feito>

### Verificado e conforme
- <Lista resumida dos itens do checklist aprovados, Bloco A e Bloco B>

### Plano de adequação — aguardando confirmação
1. **[agente]** <ação que o agente executa sozinho assim que autorizado>
2. **[você]** <ação que depende do humano — com o comando pronto, quando houver>
3. **[você + DevTools]** <ação que exige homologação>

Confirme os itens que autoriza; executo os marcados como **[agente]** e reporto o resultado.
```

**A Parte II se mede, não se opina.** Um achado de arquitetura vale como bloqueador ou ressalva
quando vem com número — *"47 arquivos injetam `Repository<T>` no Service"*, *"cobertura 60,07% de
linhas contra os 80% da §18"* —, não como impressão de leitura. Achado sem medição não entra no
relatório.

O relatório **deve terminar pelo "Plano de adequação"**. Sem ele, o humano recebe um diagnóstico
e precisa montar o plano sozinho. Regras da seção:

- **Havendo porte a fazer, ele encabeça o plano.** A escolha da linguagem destino é a primeira
  decisão, porque determina o grupo do repositório (§8.1), o nome do projeto (§8.2), o conteúdo do
  `README.md` (§6) e o template de CI/CD (§7.1). Propor `git init`, README ou pipeline antes dela
  obriga a refazer os três — se o plano contiver ressalvas como *"assumindo Ruby, ajuste depois"*, a
  ordem está errada;
- **Projeto vazio ou recém-iniciado é o caso oposto:** não há o que portar, e o primeiro item passa
  a ser **criar um `README.md` de rascunho já com a vinculação a este padrão** (§6, bloco 6) e o
  `CLAUDE.md`/`AGENTS.md` apontando para a URL canônica (§1.1). É ação `[agente]` — local,
  reversível e de baixo risco (§1.2, item 4) — e deve ser feita antes de qualquer decisão de stack,
  porque é o que garante que a **próxima** sessão de IA encontre estas regras sozinha, em vez de
  depender de alguém lembrar de carregá-las. Só então vêm a escolha da linguagem e o versionamento;
- **Ordene o restante por dependência**, não por gravidade — não adianta propor `.gitlab-ci.yml`
  antes de o repositório existir;
- **Marque o executor de cada item**: `[agente]`, `[você]` ou `[você + DevTools]`;
- **Seja concreto**: comando pronto para colar, nome de arquivo, linguagem destino escolhida. "Avaliar
  a situação" não é um passo;
- **Deixe explícito o que trava o quê**, quando um passo depende de uma decisão ainda não tomada;
- **DevTools só aparece nos passos finais e condicionais**, nunca como primeiro item;
- **Um item, uma ação.** Não junte no mesmo passo coisas que se decidem separadamente — "avaliar
  licenças e, se optar por permanecer em Python, formalizar a exceção" são duas decisões distintas,
  com destinos distintos;
- **Não ofereça a exceção quando ela já foi descartada.** Se a verificação do §4.3 não encontrou
  biblioteca sem equivalente na stack, a permanência na linguagem atual está **descartada, não
  pendente**. Registre a conclusão no bloqueador — *"verifiquei `requests` e `tabulate`, ambas com
  equivalente; a exceção do §4.3 não se aplica"* — e **omita** do plano qualquer passo do tipo
  *"somente se optar por permanecer em X"*. Oferecê-lo depois de tê-lo descartado reabre como opção
  o que a auditoria já fechou, e é por essa fresta que o desvio se perpetua. O passo de exceção só
  entra no plano quando a auditoria **identificou um candidato real** a impedimento técnico — aí ele
  é pendência legítima a resolver com o DevTools.

### Ordem dos bloqueadores

**Havendo não conformidade de stack (§4.2), ela é o primeiro e principal bloqueador.** Versionamento,
README e CI/CD são todos determinados pela linguagem destino: qual grupo do GitLab receberá o
projeto (§8.1), que nome ele terá (§8.2), o que o README descreverá (§6) e qual template de pipeline
se aplica (§7.1).

Listar "falta `git init`" ou "falta `.gitlab-ci.yml`" antes do porte sugere que são problemas
independentes, resolvíveis em qualquer ordem — não são. São consequências da decisão de linguagem, e
quem os resolver antes vai refazê-los depois.

Os demais bloqueadores seguem a mesma lógica de dependência, não a de gravidade.

### Formulação de cada bloqueador

Cada bloqueador deve nomear **a correção**, não o próximo interlocutor. Exemplo de bloqueador bem
formulado, para um projeto encontrado em Python:

```markdown
### Bloqueadores
- [§4.2] Projeto escrito em Python, fora da stack homologada → **recomendo portar para Ruby**
  (automação e CLI leve), pelo procedimento da §4.7: cobrir o original com testes de caracterização
  antes de iniciar, priorizando integração sobre unitários. Existe biblioteca essencial sem
  equivalente na stack? Se sim, nomeie-a — só nesse caso a permanência em Python configura exceção
  a formalizar junto ao DevTools (§4.3).
```

Compare com a formulação **a evitar**, que devolve a decisão sem recomendar nada:

```markdown
- [§4.2] Projeto em Python → valide com o DevTools se se enquadra na exceção do §4.3 ou se deve
  ser reescrito.
```

E o "Plano de adequação" correspondente, para esse mesmo projeto — um CRUD web em Python/Flask, sem
Git e sem README:

```markdown
### Plano de adequação — aguardando confirmação

> Antes de tudo: se a necessidade já for atendida por ferramenta pronta (§9), descontinuar o projeto
> substitui todo o plano abaixo. Verifiquei e não é o caso aqui.

1. **[você]** **Confirmar a linguagem destino do porte — recomendo Node.js/TypeScript**, por ser
   backend web (§4.1). Esta é a primeira decisão porque define o grupo do repositório, o nome do
   projeto, o conteúdo do README e o template de CI/CD; tudo abaixo depende dela.
2. **[você]** Versionar no GitLab interno já com o grupo e o nome do destino (§3.6, §8.1, §8.2), de
   modo que o histórico do porte fique registrado desde o código original:
   `git init && git remote add origin https://gitlab.rech.com.br/gitlab/rech/javascript/<projeto>.git`
3. **[agente]** Cobrir o código Python atual com testes de caracterização (§4.7, passo 1),
   priorizando integração: rotas, códigos de status, formato do JSON e o esquema do SQLite.
4. **[agente]** Portar testes e implementação para a linguagem escolhida (§4.7, passo 3).
5. **[agente]** Criar o `README.md` (§6) e o `.gitlab-ci.yml` a partir do template da linguagem
   (§7.1), já descrevendo o projeto portado.
6. **[você]** Rodar as duas versões sobre a mesma massa, comparar as saídas e desativar a original
   (§4.7, passo 4).

Confirme os itens que autoriza; executo os marcados como **[agente]** e reporto o resultado.
```

Repare que **não há passo "somente se optar por permanecer em Python"**. A verificação do §4.3 já
foi feita e não encontrou biblioteca sem equivalente — a permanência está descartada, e o plano
reflete isso.

E o plano para o caso oposto — **diretório vazio ou projeto recém-iniciado**, sem código a portar:

```markdown
### Plano de adequação — aguardando confirmação

1. **[agente]** Criar o `README.md` de rascunho com a vinculação a este padrão (§6, bloco 6) e o
   `CLAUDE.md` apontando para a URL canônica (§1.1). Posso fazer agora — ação local e reversível
   (§1.2, item 4). Isso garante que a próxima sessão de IA encontre estas regras sozinha.
2. **[você]** Confirmar a finalidade do projeto e, com ela, a linguagem da stack (§4.1). Isso define
   o grupo do GitLab, o nome do projeto e o template de CI/CD dos passos seguintes.
3. **[você]** Antes de escrever código: confirmar que a necessidade não é atendida por ferramenta
   pronta (§9).
4. **[você]** Criar o repositório no GitLab interno, no grupo e nome da linguagem escolhida
   (§3.6, §8.1, §8.2).
5. **[agente]** Completar o `README.md` com os demais blocos do §6 e criar o `.gitlab-ci.yml` a
   partir do template da linguagem (§7.1).

Confirme os itens que autoriza; executo os marcados como **[agente]** e reporto o resultado.
```

---

## 12. Resumo executivo

> Os itens 1 a 11 resumem a **Parte I** (§3 a §10) e os itens 12 a 18 resumem a **Parte II**
> (§13 a §21), detalhada logo adiante.

1. **GitLab interno é o único repositório oficial.** GitHub só para open source aprovado pela direção.
2. **Protótipo pode nascer em namespace pessoal do GitLab interno**, mas migra para o grupo oficial assim que estabilizar, for compartilhado, envolver dado sensível ou entrar em fluxo corporativo.
3. **Stack:** Ruby (leve) · Java (moderado, Swing, backend Spring Boot) · Rust (CLI de qualquer porte, desktop, baixo nível, web) · Node/TS (backend NestJS, frontend Angular) · Flutter (mobile) · COBOL (SIGER) · Delphi (SICLA).
   Rust é a stack mais adotada da casa e serve também para automação simples — ver §4.6.
4. **Aplicação web:** **Angular** no frontend, **NestJS + TypeORM** sobre Node LTS no backend, **MariaDB** no banco, entregues como um processo só (§4.8). Backend em Spring Boot ou Axum é alternativa homologada, mas exige o motivo escrito no `README.md`. React/Vue, Express puro, Prisma e `synchronize: true` em produção são os desvios a caçar.
5. **Não use** Python, C# ou Go no lugar de Ruby/Node, Java e Rust. Encontrado um projeto fora da stack, **a recomendação padrão é portar** (§4.2, §4.7); a exceção formalizada junto ao DevTools é para quando existe impedimento técnico demonstrado — biblioteca essencial sem equivalente na stack (§4.3).
6. **Banco:** MariaDB ou SQLite — e, em aplicação web, sempre MariaDB.
7. **README.md** com acesso, execução, argumentos e dependências de runtime é obrigatório.
8. **`.gitlab-ci.yml`** a partir dos templates de `rech/gitlab-ci-lib`; não havendo template para a linguagem, o projeto define o seu (§4.8.7).
9. **Nomeie** conforme o prefixo da linguagem e **reutilize** as bibliotecas internas.
10. **Não construa** o que já existe pronto e gratuito.
11. **Consulte o DevTools** antes de criar, migrar ou adotar tecnologia nova.
12. **Camadas:** `Cliente → Controller → Service → Repository → Banco`. Controller sem regra de
    negócio e sem banco; Service sem SQL/ORM; Repository sem regra de negócio e sem exceção de HTTP
    (§13).
13. **Dependência entra por injeção do framework.** `new` para instanciar dependência injetável é
    não conformidade (§13.4).
14. **Um módulo por domínio**, com `controllers/ services/ repositories/ entities/ dto/ tests/ docs/`
    e seu `*.module.ts`. Entidade usada por vários módulos tem repository em ponto único (§14).
15. **Esquema só muda por migration versionada.** Nada de alteração manual, nada de `synchronize`
    fora de dev local (§16, §4.8.4).
16. **Seis documentos por módulo** em `docs/` — README, arquitetura, api, regras-negócio,
    casos-de-uso, fluxo (§17).
17. **Testes unitário + integração + E2E, cobertura mínima de 80%** (§18).
18. **Segurança sempre ligada:** JWT, RBAC, Helmet, CORS, rate limit, validação, sanitização (§19).
    E a norma se verifica **por teste no CI**, não por revisão de código (§20).

---

## Parte II — COMO construir

> As seções §13 a §21 são a norma de **arquitetura**. Elas valem depois que a Parte I definiu a
> stack, e se aplicam a qualquer linguagem da §4.1 — o vocabulário muda (§13.5), o desenho não.
>
> Havendo conflito com a Parte I, **a Parte I prevalece** (§1.4).

---

## 13. Arquitetura obrigatória — Controller → Service → Repository

Todo projeto deve ter arquitetura limpa, baixo acoplamento e alta coesão. Os princípios que a
sustentam são: **organização, escalabilidade, manutenibilidade, reutilização, performance,
segurança, legibilidade, testabilidade, documentação, baixo acoplamento e alta coesão**.

O fluxo é fixo, e **cada seta é obrigatória** — não se pula camada:

```text
Cliente
   │
   ▼
Controller
   │
   ▼
Service
   │
   ▼
Repository
   │
   ▼
Banco de Dados
```

### 13.1 Controller

| Faz | Não faz |
|---|---|
| recebe a requisição | regra de negócio |
| valida a entrada (DTO, §14.3) | acesso a banco, ORM ou SQL |
| chama o Service | orquestração de vários passos de negócio |
| devolve a resposta e o código de status | conhecer estrutura de tabela |

**Controller que injeta repository do ORM é o desvio mais comum e o mais caro.** Ele coloca
persistência e regra dentro da camada de entrada: a regra deixa de ser testável sem HTTP, e passa a
ser reescrita a cada nova porta de entrada (job, CLI, fila).

### 13.2 Service

Concentra **regra de negócio, validações de domínio, processamento, integrações e orquestração**.
É a camada que responde "o que o sistema faz".

Não emite SQL nem usa o ORM direto: quando precisa de dado, chama o Repository. Um Service que
monta consulta espalha persistência pelo código — exatamente o que a camada Repository existe para
concentrar.

### 13.3 Repository

Faz **`SELECT`, `INSERT`, `UPDATE`, `DELETE` e persistência**, e só isso.

Não contém regra de negócio e **não lança exceção de HTTP**: um repository que devolve `404` amarra
a persistência ao protocolo de entrega e deixa de servir a um job ou a uma CLI. Ele devolve o dado
ou a ausência dele; quem traduz ausência em `404` é o Service ou o Controller.

### 13.4 Injeção de dependência

- **Sempre** a DI do framework;
- **nunca** `new` para instanciar dependência;
- **prefira interfaces** para desacoplar — é o que torna o Service testável sem banco.

### 13.5 O mesmo desenho, em vocabulários diferentes

O guia é escrito sobre um backend. Frentes diferentes realizam as mesmas camadas com outros nomes:

| Camada | Backend NestJS | Frontend Angular | Serviço Python (FastAPI) |
|---|---|---|---|
| Controller | `*.controller.ts` | componente (`*.component.ts`) | rota |
| Service | `*.service.ts` | `core/services/*.service.ts` | módulo de domínio |
| Repository | `repositories/*.repository.ts` | — (o service é quem conhece a API) | módulo de acesso a dados |
| DI | `@Injectable` + construtor | `inject()` | import de módulo |

**No frontend, a regra equivalente é: componente não fala HTTP direto.** Ele chama um service; o
service conhece a API. Componente com `HttpClient` embutido é o mesmo defeito do controller com
ORM, deslocado de camada.

---

## 14. Estrutura de projeto e de módulo

### 14.1 Raiz do código

```text
src/
├── common/
├── config/
├── database/
├── shared/
├── modules/
│   ├── usuarios/
│   ├── clientes/
│   ├── produtos/
│   └── ...
```

### 14.2 Módulo

**Um módulo por domínio.** Cada um traz:

```text
produto/
├── controllers/
├── services/
├── repositories/
├── entities/
├── dto/
├── interfaces/
├── validators/
├── exceptions/
├── events/
├── tests/
├── docs/
└── produto.module.ts
```

Pasta sem conteúdo não precisa existir — `events/` só aparece quando há evento. O que **não** é
opcional: `controllers/`, `services/`, `repositories/`, `dto/`, `tests/`, `docs/` e o `*.module.ts`.

### 14.3 DTO e validação na borda

Toda entrada externa entra por **DTO declarado**, validado pelo validador do framework em modo
restritivo (no NestJS, `class-validator` + `ValidationPipe` global com `whitelist`, §4.8.3).

Validar na borda, não dentro da regra de negócio: campo inesperado é descartado antes de chegar ao
Service, e a regra recebe dado já no formato que espera.

### 14.4 Onde mora cada repository

| Situação | Local |
|---|---|
| Entidade usada só por um módulo | `<modulo>/repositories/` |
| Entidade transversal, usada por vários módulos | pasta compartilhada (ex.: `database/repositories/`), exportada por um módulo de repositórios |

Repetir o registro da mesma entidade em cada módulo que a consome é o que espalha persistência pelo
código — por isso o ponto único para as transversais.

---

## 15. Clean Code e SOLID

**Clean Code:** métodos pequenos · classe com responsabilidade única · nomes claros · sem duplicação
· sem número mágico · código autoexplicativo.

**SOLID:** SRP · OCP · LSP · ISP · DIP.

Comentário não substitui nome ruim, e código autoexplicativo não dispensa a documentação da §17 —
são coisas diferentes: um explica *como*, a outra explica *por quê* e *para quem*.

---

## 16. Persistência — migrations, seeds, índices, constraints

A §5 escolhe **qual** banco. Esta seção define **como o esquema evolui**:

| Item | Regra |
|---|---|
| **Migrations** | toda alteração de esquema entra por migration versionada no repositório. É o que torna o banco reproduzível entre estações, homologação e produção |
| **Seeds** | dado inicial obrigatório entra por seed versionado, não por `INSERT` manual em produção |
| **Índices** | criados junto da migration que os torna necessários, não depois que a consulta ficou lenta |
| **Constraints** | `NOT NULL`, `UNIQUE` e `CHECK` no banco, não só na aplicação — a aplicação não é o único caminho até a tabela |
| **Foreign Keys** | declaradas; integridade referencial é do banco |

**SQL cru só onde o ORM não atende, e sempre parametrizado** — concatenar valor em string de
consulta é injeção de SQL, não estilo de código (§4.8.4).

**Alteração manual de esquema em produção é não conformidade**, mesmo quando funciona: ela não tem
histórico, não é revisável e não se reproduz no próximo ambiente.

---

## 17. Documentação por módulo

Cada módulo deve ter, em `<modulo>/docs/`:

| Arquivo | Responde |
|---|---|
| `README.md` | o que este módulo é, e por onde começar |
| `arquitetura.md` | como as camadas do módulo se organizam e por quê |
| `api.md` | endpoints, parâmetros, respostas e erros |
| `regras-negocio.md` | as regras que o Service implementa, em linguagem de negócio |
| `casos-de-uso.md` | os cenários de uso, do ponto de vista de quem usa |
| `fluxo.md` | o caminho de uma requisição ponta a ponta |

Isso é adicional ao `README.md` da raiz do projeto (§6), que descreve o projeto como um todo.

> **Documentação desatualizada é pior que ausente**, porque é lida como verdade. Ao alterar a regra,
> altere `regras-negocio.md` na mesma entrega — não em uma tarefa "de documentação" depois.

---

## 18. Testes e cobertura

| Nível | Cobre |
|---|---|
| **Unitário** | regra isolada, com dependências substituídas por dublês |
| **Integração** | módulo real contra banco e dependências reais ou equivalentes |
| **E2E** | o caminho do usuário, ponta a ponta |

**Cobertura mínima: 80%.** O número é do relatório do pipeline (§7.2), não de estimativa.

**Os três níveis são obrigatórios** — cobertura de 80% só com teste unitário não demonstra que o
sistema funciona montado, que é justamente o que quebra em produção.

> **Código legado abaixo de 80%:** o gate do CI fica no **patamar medido**, funcionando como
> catraca — pode subir, nunca descer —, com prazo registrado no backlog do projeto. Catraca não é
> exceção: dívida existente não vira licença para dívida nova (§20.2).

---

## 19. Segurança da aplicação

Obrigatórios e ativos, não "previstos":

| Controle | Papel |
|---|---|
| **JWT** | autenticação, com expiração e rotação de refresh |
| **RBAC** | autorização por papel/permissão, verificada no servidor |
| **Helmet** | cabeçalhos de segurança HTTP |
| **CORS** | origens explicitamente permitidas, nunca `*` em produção |
| **Rate Limit** | proteção contra abuso e força bruta |
| **Validação** | toda entrada externa, na borda (§14.3) |
| **Sanitização** | tudo que for renderizado ou concatenado |

**Erro não vaza detalhe interno.** Resposta `5xx` devolve mensagem genérica; caminho de arquivo,
`stack trace`, string de conexão e detalhe de ambiente ficam no log, nunca no corpo da resposta.

**Segredo nunca é versionado** — o repositório traz apenas o `.env.example` com as chaves e valores
de exemplo (§4.8.3).

---

## 20. A norma é verificada por teste, não por revisão de código

**Desvio de arquitetura entra por pressa, não por decisão.** Revisão humana não pega o que é
sistemático: o quinto controller que acessa o banco passa porque os quatro anteriores passaram.

Por isso cada frente do projeto deve ter uma **spec de conformidade de arquitetura** que roda no
`test` do pipeline (§7.2) e **falha o build**. O que ela trava, no mínimo:

- controller não acessa banco nem conhece ORM (§13.1);
- repository só em `repositories/`, sem exceção de HTTP e sem depender de Service (§13.3);
- nenhum `new` em dependência injetável (§13.4);
- todo controller tem o seu `*.module.ts` (§14.2);
- os controles da §19 ligados;
- no frontend, componente não fala HTTP direto (§13.5);
- resposta `5xx` sem detalhe interno (§19).

### 20.1 Catraca, não exceção aberta

Onde a conformidade total ainda não é possível, vale **catraca**: o limite fica no valor medido hoje
e **só pode melhorar**. A lista de arquivos em dívida é explícita e versionada — um arquivo novo em
desacordo quebra o CI. Isso é o oposto de desligar a regra "até arrumar".

### 20.2 Adequação faseada de código legado

Aplicar esta Parte de uma vez a um sistema grande **em produção** pode significar reescrever quase
todo o código, com risco alto e sem ganho proporcional. O tratamento correto é **adequação faseada
com guarda no CI**:

1. **Meça antes de mudar** e registre os números (quantos módulos, quantos arquivos, qual cobertura);
2. **Eleja um módulo de referência** e adeque-o por completo — camadas, `repositories/`, os 6
   documentos da §17, testes. Ele vira o modelo a copiar;
3. **Ligue as guardas da §20** já no patamar atual, como catraca;
4. **Registre os desvios com fase e prazo** no backlog do projeto — desvio reconhecido e datado, não
   silenciado;
5. **Adeque os demais módulos por fase**, copiando do módulo de referência.

> **Isso vale para legado, não para projeto novo** (§1.4). Projeto que nasce hoje nasce conforme:
> o custo de fazer certo no primeiro módulo é de minutos.

---

## 21. Checklist final de entrega

Antes de dar uma entrega por concluída:

- [ ] Arquitetura respeitada — `Controller → Service → Repository`, sem salto de camada (§13)
- [ ] Controller sem regra de negócio e sem acesso a banco (§13.1)
- [ ] Service centralizando a lógica, sem SQL/ORM direto (§13.2)
- [ ] Repository apenas persistência, sem exceção de HTTP (§13.3)
- [ ] Dependências por injeção, nenhum `new` em dependência injetável (§13.4)
- [ ] DTOs criados e validados na borda (§14.3)
- [ ] Migrations criadas e versionadas (§16)
- [ ] Testes implementados nos três níveis, cobertura ≥ 80% (§18)
- [ ] Documentação completa — 6 arquivos em `<modulo>/docs/` (§17) e `README.md` do projeto (§6)
- [ ] Logs implementados, sem vazar segredo nem dado pessoal (§19)
- [ ] Segurança aplicada — JWT, RBAC, Helmet, CORS, rate limit, validação, sanitização (§19)
- [ ] Guardas de conformidade passando no CI (§20)

---

## Parte III — Governança do documento

---

## 22. Controle de revisões

### 22.1 Deste documento único

| Revisão | Data | Alterações |
|---|---|---|
| `1.0.0` | 03/08/2026 | Versão inicial do documento único. Consolida em um arquivo o **Padrão Rech rev. `2.0.0`** (Parte I, §3 a §10 — texto normativo preservado sem alteração de conteúdo) e o **Guia Mestre de Arquitetura de Desenvolvimento** de 31/07/2026 (Parte II, §13 a §21). Acrescenta: a §1.4 (ordem de aplicação e precedência entre as partes), o **Bloco B do checklist** (itens 17 a 27, §2), a §4.9 (ponte da stack para a arquitetura), a nota de persistência na §5, a nota de documentação por módulo na §6.1, o bloco de arquitetura no relatório de conformidade (§11) e os itens 12 a 18 do resumo executivo (§12). O "Controle de revisões", antes §13, passou a **§22**. Corrige um resíduo de digitação no modelo de relatório da §11 (`autorizado>rpr`). **MAJOR:** o Bloco B do checklist cria obrigações verificáveis — projetos já auditados só pela Parte I devem ser reavaliados. |

### 22.2 Da Parte I, antes da consolidação

Histórico do *Padrões de Desenvolvimento da Rech*, cuja versão canônica segue publicada no GitLab
interno (§1.1):

| Revisão | Data | Alterações |
|---|---|---|
| `1.0.0` | 18/07/2026 | Versão inicial. Consolida o post nº 48347 da intranet, as convenções observadas nos grupos do GitLab e os achados do spike `spike-gems` sobre habilitação de gems em projetos Ruby (§4.5). Comportamento do agente calibrado com auditorias de projetos reais. |
| `2.0.0` | 21/07/2026 | Acrescenta a **§4.8 — Aplicações web**, fixando a stack de referência (Angular · NestJS + TypeORM sobre Node LTS · MariaDB · entrega em processo único) e os antipadrões web correspondentes. Corrige a §4.1, que citava "AngularJS", e registra Spring Boot como framework de backend Java. Novos itens 14 a 16 no checklist (§2), nota de banco em aplicação web (§5), exigência de pipeline próprio na ausência de template Node/TS (§7.1, §4.8.7), linha de nomenclatura Node/TS (§8.2) e item 4 do resumo executivo (§12). **MAJOR:** cria obrigações — projetos web já auditados devem ser reavaliados. |

### 22.3 Critério de numeração e rito

Alinhado ao `bump-version` do `ri-ci-cd` (§7.2):

- **MAJOR** — cria, remove ou altera uma obrigação. Projetos já auditados devem ser reavaliados.
- **MINOR** — acrescenta orientação, exemplo ou seção sem alterar obrigações vigentes.
- **PATCH** — correção de redação, link ou erro material.

Toda alteração entra por merge request com revisão do time **DevTools**, e deve incrementar a
revisão no cabeçalho e registrar a linha correspondente na tabela da §22.1.

**Quando a canônica da Parte I subir de revisão**, reincorpore o texto novo nas §3 a §10, registre
na §22.1 qual revisão foi incorporada e incremente este documento pelo mesmo critério da mudança
recebida (uma MAJOR na canônica é uma MAJOR aqui). Alterar a Parte II é decisão do projeto e não
depende do ciclo da canônica.

> **Incrementar não é formalidade.** A revisão é o único sinal pelo qual um agente detecta que está
> operando com cópia desatualizada (§1.1) — e cópias desatualizadas são a regra, não a exceção:
> ferramentas de IA mantêm o documento em cache de sessão que sobrevive a trocas de projeto e de
> diretório. Publicar alteração de conteúdo normativo sem incrementar a revisão torna essa
> verificação inócua, porque a cópia velha e a canônica passam a declarar o mesmo número.

---

*Em caso de dúvida sobre criação, organização, migração ou padronização de repositórios, entre em
contato com o time DevTools antes de iniciar uma nova iniciativa.*