# Acesso do CLIENTE ao BI "Implantação Clientes SIGER" — desenho

> Escrito em 2026-08-31, a partir das decisões do usuário na abertura da frente. Descreve o
> que precisa existir para um cliente da Rech abrir o Painel e ver **o BI dele, e só o dele**.
>
> **Estado (2026-08-31): F1–F5 implementadas e cobertas por teste** (§13), incluindo o
> cadastro de acesso por CONTATO do cliente (§10). O que falta é infraestrutura e borda
> externa — não código de recorte. O acesso do cliente **ainda não está no ar**, porque
> depende de §11.

## 1. As quatro decisões que abrem a frente (2026-08-31)

| # | Decisão | Valor |
|---|---------|-------|
| D1 | **Chave do recorte** | **Código do cliente no SICLA** (`SICLA.LISTA_CLIENTES.CODIGO`) — o campo que já amarra todas as views do BI. |
| D2 | **Abas visíveis** | **Todas** — Resumo, Extrato de Protocolo/Horas, RNS Vinculadas, Agendas (e o painel Visitas do Portal, dentro do Resumo). |
| D3 | **Campos** | **Todos** — inclusive descrição da visita, nome do consultor, horas cobradas/bonificadas e status interno da RNS. Nenhuma máscara de campo. |
| D4 | **Topologia** | **Mesmo app, mesmo link**, com um perfil novo `Cliente`. Marcação visível "Consultor"/"Cliente". |

Consequência direta de D2+D3: **o trabalho inteiro é recorte de LINHAS.** Não há campo a
esconder, não há aba a suprimir. O que existe é uma pergunta que precisa ser respondida
identicamente em todos os caminhos de dado: *estas linhas são deste cliente?*

## 2. O princípio inegociável

> **O escopo do cliente nasce da IDENTIDADE, nunca do pedido.**

O front de um usuário-cliente **não manda** `?cliente=X`. O backend deriva o recorte de
`req.user`, resolvido contra o banco. Três regras que decorrem disso:

1. **Filtro vindo do cliente é sugestão, não permissão.** Se um usuário-cliente mandar
   `?cliente=OUTRO`, o parâmetro é *interceptado e sobrescrito* — não é validado e recusado,
   é substituído. Recusar cria uma superfície de sondagem (o erro revela que o outro código
   existe); sobrescrever não revela nada.
2. **Fail-closed no vínculo.** Papel `Cliente` **sem** código vinculado = **403**. Jamais
   "sem filtro". Um bug de cadastro tem que virar tela vazia com aviso, nunca a carteira
   inteira.
3. **Fail-closed na linha.** Linha cujo código de cliente venha nulo, vazio ou ilegível
   **não aparece** para um usuário-cliente (para os internos continua aparecendo como hoje).
   Isso importa porque uma das origens é SQL **editável pela tela** — ver §6.

## 3. Modelo de dados

**Perfil novo.** `Cliente` entra em `PERFIS` ([perfis.ts](../backend/src/common/constants/perfis.ts)).
É o primeiro perfil **externo** do sistema — os 7 atuais são todos internos, e várias
constantes assumem isso. Precisa ficar **fora** de: `PERFIS_SISTEMA`, `PERFIS_DESIGNA`,
`PERFIS_VEEM_TODOS_PROJETOS`, `PERFIS_CARTEIRA_VE_TODOS`, `PERFIS_GERA_*`,
`PERFIS_AGENDAMENTO`, `PERFIS_DEFINE_GCI`, `PERFIS_DESIGNA_CONSULTORES`. Ficar de fora é o
comportamento correto por omissão em todas elas — mas isso é sorte, não desenho, então
merece um teste que fixe a expectativa (§12).

**Vínculo.** Coluna `codigo_cliente_sicla` em `usuarios`, seguindo o precedente exato de
`codigo_sicla` (varchar 40, default vazio) — mesma tabela, mesma forma, uma migration.

> **Assunção declarada:** D1 fala em *um* código. O resolvedor abaixo devolve uma LISTA de
> códigos desde o primeiro dia, mesmo lendo uma coluna única. Cliente com várias empresas no
> SICLA é caso previsível, e a diferença entre "expandir o cadastro" e "refatorar todos os
> chamadores" está inteira nessa escolha de assinatura. Custo hoje: zero.

**Regra de integridade:** `Cliente` é papel **exclusivo**. Um usuário não pode acumular
`Cliente` com qualquer papel interno — a tela de Usuários bloqueia, e o backend recusa a
gravação. Sem isso, um cliente que também fosse `Consultor` cairia no ramo "interno vê tudo"
de cada verificação.

## 4. O resolvedor de escopo

`EscopoClienteService` ([backend/src/permissoes/escopo-cliente.service.ts](../backend/src/permissoes/escopo-cliente.service.ts)).
Dado o usuário autenticado, devolve um de três resultados:

- **interno** — qualquer papel interno: vê tudo, exatamente como hoje;
- **cliente com vínculo** — a lista de códigos de cliente que ele pode enxergar;
- **403** — papel `Cliente` sem vínculo cadastrado (a regra 2 do §2).

**Resolve do BANCO, não do token.** O access token carrega um retrato do login
([auth.service.ts:46](../backend/src/auth/auth.service.ts#L46)); o refresh recarrega do banco
([auth.service.ts:105](../backend/src/auth/auth.service.ts#L105)). Se o escopo viajasse no
token, **revogar o vínculo de um cliente só teria efeito no próximo refresh** — janela em que
um token válido continua abrindo dados. Resolvendo do banco a cada requisição, a revogação
(e a desativação do usuário) vale na hora.

**Sem cache**, ao contrário do `PermissoesService` que serviu de molde: é um `findOne` por
chave primária numa tabela de dezenas de linhas, dentro de uma requisição que logo depois vai
buscar milhares de linhas no Oracle. O cache não compraria nada mensurável e custaria a
invalidação — justamente a peça que, ao falhar, mantém vivo um acesso revogado.

## 5. Inventário: as oito portas do BI

Todas em [bi-implantacao.controller.ts](../backend/src/bi-implantacao/bi-implantacao.controller.ts),
todas hoje atrás de `@Permissao('bi_implantacao')` — que libera a **tela**, não a **linha**.

| # | Endpoint | O que muda |
|---|----------|-----------|
| 1 | `GET /resumo` | Recorte por `CLIENTE`. |
| 2 | `GET /extrato` | Recorte por `IMP_CLIENTE`. |
| 3 | `GET /rns` | Recorte por `CLIENTE`. |
| 4 | `GET /agendas` | Recorte por `CLIENTE`. |
| 5 | `GET /visitas-portal` | Recorte por `CODIGO_CLIENTE`. |
| 6 | `GET /extrato/descricao` | **Era um IDOR**, anterior a esta frente: recebia `protocolo`+`datahora` e devolvia o CLOB **sem checar de quem é** — numerar protocolos lia a descrição de visita de qualquer cliente. Corrigido: a consulta passou a trazer `IMP_CLIENTE` (não exibido) e o serviço confere a posse antes de devolver o texto. A recusa usa a **mesma** mensagem do lançamento inexistente, para o endpoint não virar detector de protocolos válidos. |
| 7 | `POST /visitas-portal/enviar-email` | **Negado ao usuário-cliente.** Não é questão de recorte: as linhas do PDF vêm do corpo do pedido e o destinatário é livre — para um usuário externo seria um relay de e-mail saindo do domínio da Rech, com conteúdo escolhido por ele. O BI do cliente é leitura. |
| 8 | `GET /visitas-portal/modelo-email` | Texto interno, par do envio — negado junto. |

O caminho 6 era o mais grave dos oito e **existia antes** desta frente: valia corrigir mesmo
que o acesso do cliente não saísse do papel.

## 6. Onde vaza mesmo filtrando as linhas

Este é o ponto que uma implementação apressada erra. Filtrar `linhas` **não basta**, porque a
resposta carrega mais coisa do que a listagem:

**As listas de filtro.** `filtros.clientes`, `filtros.grupos`, `filtros.tecnicos` e
`filtros.rns` são montados em cascata sobre o conjunto **completo** e antes do filtro final
([bi-implantacao.service.ts:838-846](../backend/src/bi-implantacao/bi-implantacao.service.ts#L838-L846)).
Pior: `opcoesRns` rotula cada RNS com o nome do cliente, para dar contexto ao número. Um
cliente com a tabela corretamente recortada **veria a carteira inteira da Rech no dropdown**.

A correção estrutural: o recorte entra **antes** de `todas` — não como mais um predicado na
lista `preds`, mas como um corte aplicado ao resultado da consulta, do qual tudo o mais
deriva. Filtros, totais, gráficos e agrupamentos passam a ser calculados sobre um universo
que já é só do cliente. Um predicado a mais em `preds` deixaria as listas de filtro
intactas — é exatamente o erro a evitar.

**Os totais e agregados.** `totais`, `porStatus`, `porSigla` e o resumo do calendário saem do
mesmo universo. Derivando do conjunto recortado, ficam corretos de graça.

**O SQL editável.** `portal.visitas.listar` é `consulta_salva`: o Administrador edita o texto
em Sistema → Consultas BD, e o comentário do próprio SQL avisa que os aliases são o contrato
com a tela ([portal-rech.sql.ts](../backend/src/dados/catalogo/sql/portal-rech.sql.ts)). Se
alguém editar e derrubar `CODIGO_CLIENTE`, o recorte perde a chave. Daí a regra 3 do §2:
linha sem código identificável **não aparece** para o cliente. A tela degrada; não vaza.

## 7. Recorte também na origem (defesa em profundidade)

O filtro no service é a garantia **funcional**. Mas hoje o BI puxa o período inteiro de
**todos** os clientes do Oracle e descarta em memória — para um cliente, isso significa
trafegar milhares de linhas alheias para mostrar dezenas.

Acrescentar um bind opcional `:cliente` às consultas do catálogo (`sicla.bi.*` e
`portal.visitas.listar`), no mesmo padrão `(:cliente IS NULL OR ... = :cliente)` que os binds
de período já usam, dá três ganhos: menos dado sensível sai do banco de origem, a resposta
fica muito mais rápida para o cliente, e passa a haver **duas** barreiras independentes entre
clientes distintos. O filtro em memória permanece — o bind é reforço, não substituto, porque
um deles vive em SQL editável.

## 8. Menu, navegação e a marcação

**O menu já é dirigido por banco**, então o cliente enxergar só o BI é cadastro, não código:
em `PADRAO_PERMISSOES`, `Cliente` recebe `bi_implantacao: 'consulta'` e **nada mais**.
Especialmente **não** `dashboards` — esse é o *BI Interno*, outra coisa, que compartilha a
entrada de menu "BI" com o BI de clientes.

A navegação já está pronta para isso: as abas de 1º nível são condicionais por permissão
([bi-abas-principais.component.ts](../frontend/src/app/features/bi-implantacao/bi-abas-principais.component.ts)),
então a aba "BI Implantação" some sozinha para quem não tem `dashboards`.

**A marcação "Consultor"/"Cliente"** (pedido do usuário) vai no shell, ao lado do nome —
faixa discreta, cor distinta. Serve a dois propósitos: o consultor que abre o Painel do lado
do cliente sabe imediatamente em que modo está, e o cliente entende que aquilo é o portal da
Rech, não um sistema dele.

**Rota inicial** do perfil Cliente é `/bi/clientes-siger/resumo`, não `/home`: a Visão Geral
não é dele.

## 9. O que muda por o usuário ser EXTERNO

Hoje todo usuário do Painel é interno e confiável, na rede da empresa. Um cliente logando
muda a categoria do sistema, não só a lista de telas:

- **Força bruta e enumeração de login** — hoje não há freio. Precisa de limite por IP/conta.
- **Senha e ciclo de vida** — quem cria o usuário-cliente, quem revoga no fim da implantação,
  o que acontece quando o contato do cliente muda de emprego. Sem processo de revogação, o
  acesso sobrevive ao projeto.
- **Auditoria de acesso** — quem viu o quê e quando. É a evidência de que o isolamento
  funcionou, e é o que se apresenta quando um cliente pergunta.
- **LGPD** — o BI expõe nomes de contatos e descrições de visita. Base legal e retenção
  precisam estar claras antes de o primeiro cliente entrar.
- **Sessão** — access token de vida curta faz mais diferença aqui do que na rede interna.
  **Resolvido em 2026-09-03:** a sessão cai após **30 minutos sem atividade de gente**, nos
  dois lados (`InatividadeService`). Antes, o access token durava 15 min mas o refresh renovava
  sozinho, então uma aba esquecida aberta ficava logada indefinidamente — inclusive numa
  máquina compartilhada do cliente. O que conta como atividade é gesto (ponteiro, teclado,
  rolagem, toque) e troca de tela; a batida de presença de 45 s e o resto do tráfego de fundo
  **não** contam, senão o temporizador nunca venceria e a guarda existiria só no papel. A marca
  de atividade fica em `localStorage` para ser compartilhada entre as abas: quem trabalha numa
  não pode ser derrubado na outra.

## 10. Ciclo de vida do acesso — quem entra, quem libera, quem revoga

> **Revisado em 2026-08-31, no mesmo dia.** A primeira versão desta seção dizia que o ADM
> digitava o vínculo à mão. O usuário então trouxe a regra que faltava: **quem entra são os
> CONTATOS do cliente**, e quem diz quais contatos podem entrar é o **SICLA**.

**A autorização não nasce no Painel.** `SICLA.LISTA_CONTATOS` tem a coluna
`PORTAL_RECH_CLIENTES`; valendo `1`, aquele contato pode acessar o portal. A consulta
`sicla.contatos.listar` traz **só** esses — a marcação está no `WHERE`, e não num filtro de
tela, porque uma lista que mostrasse contato não liberado convidaria a liberar quem o SICLA
não liberou.

**Sistema → Acesso de Clientes** (menu `acesso_clientes`, fixo em ADM como Usuários) é onde
o ADM informa o código do cliente, vê os contatos liberados no SICLA — com nome, cargo,
e-mail, situação e status — e concede a **conta**. A mecânica é a mesma de Usuários →
Técnicos do SICLA, a pedido do usuário: "Buscar no SICLA", "Buscar novos", seleção por linha.

**O login é o e-mail, e a senha ninguém escolhe.** `LISTA_CONTATOS` não expõe código de
contato: a identidade é o e-mail. Ao liberar, o usuário nasce com papel `Cliente`, o
`codigo_cliente_sicla` vindo da coluna `CLIENTE` e uma senha **aleatória que nunca é
exibida** — o contato define a dele pelo "Esqueci minha senha" que o Painel já tem. Nenhum
mecanismo novo, e a senha não trafega por WhatsApp nem telefone. Contato sem e-mail no SICLA
não vira acesso: entra na lista de ignorados, com o motivo.

**A revogação deixou de depender de alguém lembrar.** O login do usuário-cliente revalida
contra o SICLA a cada entrada: perdeu `PORTAL_RECH_CLIENTES = 1`, não entra mais. É o que
fecha o furo que esta mesma seção registrava antes — o acesso sobrevivendo ao fim do
projeto. O ADM ainda pode revogar pela tela (desativa, não apaga; o histórico fica e dá para
reativar), mas isso passou a ser o caminho de exceção, não a única barreira.

**Três respostas na revalidação, e a diferença entre as duas últimas é deliberada:**

| Situação | O que significa | Login |
|---|---|---|
| `liberado` / `nao-liberado` | O SICLA respondeu | entra / não entra |
| `indisponivel` | A conexão EXISTE e falhou (Oracle fora) | **não entra** |
| `sem-integracao` | Não há conexão SICLA cadastrada nesta instância | **entra** |

`indisponivel` é fail-closed porque deixar entrar sem conseguir conferir seria abrir a porta
justamente quando não se sabe quem está do outro lado — e não tira nada de ninguém, já que o
BI lê o SICLA e viria vazio. `sem-integracao` é aberto porque instância sem SICLA é dev ou
teste, não produção: ali não há dado de cliente para proteger, e recusar tornaria o acesso do
cliente impossível de exercitar fora de produção (é o que permite os 21 casos de e2e).

**O que continua fora desta tela:** criar usuário INTERNO segue exclusivo da tela de
Usuários. O endpoint de liberação tem papel fixo em `Cliente` e vínculo vindo do SICLA — não
há campo de entrada por onde alguém crie um usuário interno ou aponte para outro cliente. Um
e-mail que já pertença a alguém da casa é recusado, com o motivo.

## 11. Pré-requisito de infraestrutura (bloqueio real)

Produção é o notebook `I7M1700-01-EVE`, HTTP, porta 5100, rede interna. **Um cliente externo
não alcança esse endereço.** O acesso do cliente depende das decisões D3 (DNS próprio) e D4
(HTTPS pela CA interna) de [migracao-servidor.md](migracao-servidor.md) — e, além delas, de
uma publicação para fora da rede que ainda não foi desenhada.

Isso **não** trava a construção: todo o §2–§10 é código, testável na instância isolada da
5199. Trava a **entrada em serviço**. Vale decidir cedo, porque "expor para a internet" é uma
conversa com a TI, não uma configuração.

## 12. O que prova que funciona

O padrão do repositório é testar o que não pode voltar a quebrar. Os dois primeiros itens
estão escritos e verdes (§13); o terceiro é o que falta.

- **Spec de conformidade** (falha o CI, no molde de `conformidade-api-dados.spec.ts`): para
  cada endpoint do BI, um usuário-cliente **não** recebe nenhuma linha, nenhuma opção de
  filtro e nenhum total de outro código de cliente. Escrito sobre a resposta inteira, não
  sobre `linhas` — é o §6 virando teste.
- **Spec de perfil**: `Cliente` fora de todas as constantes de perfil interno, e a exclusão
  mútua com papéis internos.
- **e2e** ([e2e/](../e2e/README.md)) — **ainda não escrito**: dois clientes cadastrados, cada
  um enxergando só o seu; o `?cliente=` forjado sendo sobrescrito; o `extrato/descricao` de um
  protocolo alheio recusado. Cada caso do e2e nasceu de um defeito real de autorização, e o
  navegador real cobre o que o spec de serviço não vê (o menu montado, o guard de rota, a
  sessão inteira). Vale escrever antes de F6 — mas exige a instância isolada da 5199 com dois
  usuários-cliente semeados, e é a peça de maior custo desta frente.

## 13. Estado da execução

| Fase | Entrega | Estado |
|------|---------|--------|
| **F1** | Perfil `Cliente`, coluna `codigo_cliente_sicla` + migration, exclusividade do papel, `PADRAO_PERMISSOES`, campo na tela de Usuários. | **feito** |
| **F2** | `EscopoClienteService` + recorte nas 5 leituras do BI, aplicado **antes** dos filtros derivados. | **feito** |
| **F3** | Portas laterais: posse no `extrato/descricao`, e-mail negado ao cliente. | **feito** |
| **F4** | Marcação Consultor/Cliente no cabeçalho e rota inicial do cliente no BI. | **feito** |
| **F5** | Binds `:cliente` no catálogo; e2e do papel Cliente (21 casos). | **feito** |
| **F6** | **Acesso de Clientes** (§10): consulta `sicla.contatos.listar`, módulo `contatos-sicla`, tela do ADM e revalidação no login. | **feito** |
| **F7** | Borda externa (§9) e publicação (§11) — junto da migração de servidor. | pendente |

**F7 não é código** — é a conversa de DNS/HTTPS/publicação com a TI, e é o que separa
"pronto" de "no ar".

### O que sustenta as fases feitas

- `escopo-cliente.service.spec.ts` — as regras do resolvedor (fail-closed, papel lido do
  banco, usuário desativado).
- `conformidade-escopo-cliente.spec.ts` — para cada endpoint, procura vestígio de outro
  cliente na resposta **inteira**, não só em `linhas`; mais uma guarda estrutural que lê o
  código do controller e falha se algum handler deixar de resolver o escopo; e o bind
  `:cliente` conferido em todas as consultas do SICLA.
- `contatos-sicla.service.spec.ts` — o mapeamento das colunas do SICLA, a senha aleatória
  que não vaza, a reativação sem trocar senha, a recusa de e-mail de usuário interno e as
  quatro respostas da revalidação.
- `perfis.spec.ts` — `Cliente` fora de todas as constantes de papel interno.
- `rota-inicial.guard.spec.ts` — inclusive o caso que evita o laço `/home` ↔ BI.
- `e2e/testes/09-acesso-cliente-bi.spec.ts` — 21 casos: sessão, menu, rotas, portas da API,
  regras de cadastro e a tela do ADM.
- Verificação por mutação (2026-08-31): desligar o recorte derruba 10 testes; movê-lo para
  depois dos filtros derruba os das listas de filtro; liberar `carteira` ao papel `Cliente`
  derruba o caso de menu do e2e. Os specs têm poder de detecção real, não só cobertura.

### Pendente de configuração em produção

O SQL de `sicla.contatos.listar` é `consulta_salva`: o texto vigente é o de **Sistema →
Consultas BD**. As colunas foram confirmadas com o usuário, mas **a consulta ainda não foi
executada contra o Oracle** — se algum nome divergir, o ajuste é na tela, sem deploy.
