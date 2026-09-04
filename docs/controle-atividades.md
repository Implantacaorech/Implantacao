# Controle de Atividades — desenho do módulo

> **rev. 3 (2026-09-01) — IMPLEMENTADO.** O módulo está no código: backend
> `backend/src/controle-atividades/` (com os 6 docs do Guia Mestre), frontend
> `frontend/src/app/features/controle-atividades/`, migration
> `1788060000000-ControleAtividades.ts`. Este arquivo continua sendo o desenho e o registro
> das decisões; a documentação operacional do módulo está em
> [`backend/src/controle-atividades/docs/`](../backend/src/controle-atividades/docs/README.md).
>
> Histórico: **rev. 1** desenho + protótipo · **rev. 2** consulta geral, leitura de todos os
> quadros e abas *Meus clientes* / *Demais consultores* · **rev. 3** as 6 decisões do usuário
> respondidas (§9) + filtro de consultor na aba dos outros.

Quadro de atividades no molde do Trello, **por cliente**, dentro do Painel. O consultor
organiza as tarefas internas da implantação e **designa tarefas ao cliente**; o cliente entra
no mesmo Painel (perfil `Cliente`, que já existe desde `docs/acesso-cliente-bi.md`) e vê
apenas o que lhe foi designado.

---

## 1. O que o módulo é — e o que não é

| É | Não é |
|---|---|
| Quadro Kanban por cliente, com colunas e cartões arrastáveis | Substituto do fluxo de 21 passos (`projeto_passos`) |
| Combinado de trabalho entre consultor e cliente | Cronograma contratual (esse é o `plano-cronograma`) |
| Anexo de arquivo, foto e link no cartão | Repositório de documentos oficiais (esse é `documentos`) |
| Conversa por cartão | Canal de e-mail (esse é `emails_passo`) |

A tela existente **Gestão → Atividade** (chave `atividade`) é outra coisa: feed e KPIs de uso
da operação. O módulo novo é **Execução → Controle de Atividades**, chave
`controle_atividades` — chave deliberadamente distinta para não colidir com a antiga em
`permissoes_menu`.

---

## 2. Decisões de desenho

### 2.1 A unidade é o CLIENTE, não o projeto

O quadro é **um por cliente**, chaveado pelo **código do cliente no SICLA**
(`LISTA_CLIENTES.CODIGO`) — a mesma chave do recorte do acesso do cliente
(`usuarios.codigo_cliente_sicla`).

Motivo: `projetos` não guarda código SICLA (só `cliente` como texto e `cnpj`), e o
usuário-cliente é vinculado por código. Chavear o quadro por projeto deixaria o recorte do
cliente sem chave comum, e um cliente com dois projetos teria dois quadros — o oposto do
pedido ("sequenciado por cliente"). O vínculo com um projeto fica **opcional** no cartão,
para quem quiser amarrar uma atividade a uma implantação específica.

### 2.2 Visibilidade é do CARTÃO, e nasce fechada

Esta é a decisão central do módulo, porque é a que separa o bastidor da Rech do que o cliente
enxerga.

- **Todo cartão nasce `interno`.** Compartilhar com o cliente é um ato explícito, com
  etiqueta visível no cartão e registro em `atividade_eventos`.
- **A coluna é do fluxo, não da audiência** — arrastar um cartão de "A fazer" para "Fazendo"
  não muda quem o vê.
- **Coluna interna (opcional):** uma coluna pode ser marcada `interna` para o bastidor
  ("Pendências Rech", "Aguardando TI"). O cliente não a enxerga.
- **Regra final (fail-closed):** o cliente vê `cartao.visivel_cliente = true` **E**
  `lista.visivel_cliente = true`. Compartilhar um cartão que está numa coluna interna é
  permitido, mas a tela avisa que ele só aparecerá quando chegar a uma coluna compartilhada.

O filtro mora no **repositório**, não no componente: uma resposta para papel `Cliente` nunca
carrega cartão interno, nem para ser escondido no navegador.

### 2.3 Nível cliente × nível usuário do cliente

O mesmo cartão atende os dois níveis, pela lista de **membros**:

- **Cartão sem membro do lado cliente** → tarefa **da empresa**. Todos os contatos do cliente
  a veem como "do cliente".
- **Cartão com membro do lado cliente** → tarefa **daquela pessoa**. Continua visível aos
  demais contatos do mesmo cliente (com filtro "Minhas atividades" para separar) — coerente
  com a decisão 3 do acesso ao BI: dentro do cliente não há máscara.

### 2.4 Membros vêm de duas origens

| Origem | De onde | Como entra |
|---|---|---|
| Consultores da Rech | `usuarios` do Painel | Seleção direta |
| Contatos do cliente | `SICLA.LISTA_CONTATOS`, via API de Dados | Consulta `sicla.contatos.do-cliente` |

Um contato pode ser membro **mesmo sem conta no Painel** — vira destinatário e responsável
nominal; quando o ADM liberar o acesso dele em Sistema → Acesso de Clientes, o cartão já
estará esperando.

> ⚠️ **Corrigido em 2026-09-03.** O desenho original mandava reusar `sicla.contatos.listar`,
> dizendo que nenhuma consulta nova era necessária — e isso contradizia a própria frase acima.
> Aquela consulta filtra `PORTAL_RECH_CLIENTES = 1`, ou seja, **exatamente quem PODE ter conta
> no Painel**; com ela, o seletor "do lado do cliente" só oferecia os contatos já liberados no
> Portal — num cliente com um liberado só, uma pessoa só. São duas perguntas diferentes e por
> isso são duas consultas:
>
> | Consulta | Pergunta que responde | Quem usa |
> |---|---|---|
> | `sicla.contatos.listar` | "quem pode ter conta no Painel?" — **autorização** | Acesso de Clientes, revalidação do login |
> | `sicla.contatos.do-cliente` | "quem são as pessoas deste cliente?" — **agenda** | membro de cartão, aqui |
>
> A da agenda exige `:cliente` (a irmã o tem opcional): sem o filtro de autorização, um código
> nulo despejaria a agenda de contatos da base inteira.

### 2.4-A O que o CLIENTE pode fazer no cartão (2026-09-03)

Três ajustes pedidos pelo usuário depois de usar a tela, e o fio que liga os três é o mesmo:
**abrir uma solicitação só significa alguma coisa se houver onde dizer do que ela se trata.**

| Regra | Por quê |
|---|---|
| O cliente **edita o cartão que ele abriu** (título, descrição, prazo, etiquetas) | Antes a descrição nascia somente-leitura, com "Sem descrição." — ele criava a solicitação e não tinha onde descrevê-la. Continua **sem** poder reescrever cartão redigido pela Rech: isso seria falar pela Rech no quadro dela. `projetoId` também fica de fora — é vínculo administrativo, não conteúdo. |
| Criar um cartão **abre o cartão** | O campo da coluna pede só o TÍTULO. Sem abrir, é preciso descobrir sozinho que o cartão se clica. Vale para os dois lados. |
| O seletor de consultor oferece **só quem participa** | São os designados no projeto (consultores e GCI, sem o levantador) mais os responsáveis do quadro. Antes vinha o cadastro interno inteiro, e dava para apontar um cartão para quem não atende aquele cliente. Vale para os dois lados. |

A regra de edição mora em `podeEditarCartao` (`acesso.ts`), ao lado das demais, e não espalhada
nos services — é a parte do módulo em que um engano não dá erro, dá vazamento.

### 2.4-B Para quem o e-mail vai (2026-09-03)

Regra do usuário, e ela é absoluta: **o e-mail de atividade nova sai só para quem está
vinculado ao cartão. NUNCA para todos os integrantes da implantação.**

Antes, criar uma solicitação avisava por e-mail todos os responsáveis pelo quadro — a equipe
inteira recebia aviso de cartão que não era dela.

Os dois canais passaram a ter audiências diferentes, porque o custo de errar é diferente:

| Canal | Quem recebe | Por quê |
|---|---|---|
| **E-mail** | só quem está **vinculado ao cartão** | é ativo: chega na caixa de entrada de quem não pediu. Equipe recebendo aviso alheio aprende a ignorar TODOS os avisos do Painel, inclusive os que importam. |
| **Aviso na tela** (sino) | quem responde pelo quadro | é passivo: quem abre o Painel vê, e um a mais não incomoda. É o que impede a solicitação de se perder quando o cliente não designa ninguém. |

**Cartão sem ninguém vinculado não manda e-mail nenhum** — lista vazia é "para ninguém", não
"para todos". A solicitação continua visível no sino de quem responde pelo quadro.

Vale para os dois eventos que avisavam o quadro inteiro: **criação de solicitação** e
**comentário do cliente**. O mecanismo é o parâmetro `emailPara` de
`NotificacoesAtividadeService.avisar()`; quem o remover numa refatoração cai em três testes
vermelhos (`cartoes.notificacao.spec.ts`), porque o estrago não aparece em tela nenhuma.

### 2.5 Nada de banco externo fora da API de Dados

Tudo do quadro (quadros, listas, cartões, membros, anexos, comentários) mora no
`painel_novo`, por Repository/TypeORM — ADR-0002. Cliente e contatos vêm do SICLA **só** pelas
consultas nomeadas do catálogo (ADR-0003): `sicla.clientes.buscar` e
`sicla.contatos.do-cliente` — a primeira já existia; a segunda entrou em 2026-09-03, quando
se descobriu que reusar a consulta de AUTORIZAÇÃO para montar a agenda do cliente escondia
quase todo mundo (ver o aviso na §2.4).

### 2.6 Arrastar sem dependência nova

O frontend não tem Angular CDK, e o projeto mantém as dependências enxutas. O arraste usa a
**API nativa de drag and drop do HTML5** (`draggable` + `dragover`/`drop`), com dois
complementos obrigatórios:

- **Alternativa por teclado** — as setas `←`/`→` movem o cartão em foco entre colunas. É
  acessibilidade e é o caminho que o e2e consegue exercitar de forma estável.
- **Ordenação por ponto médio** — `ordem DOUBLE` (ver nota abaixo). Mover um cartão grava
  **uma** linha (a média entre os vizinhos), não a lista inteira. Renumeração da coluna só
  quando o intervalo entre vizinhos fica menor que o limite (`ordem.util.ts`).

> **Correção da rev. 1:** o desenho dizia `DECIMAL(20,10)`. Na implementação virou `double` —
> o driver do MariaDB devolve DECIMAL como **string**, e a conta do ponto médio precisa de
> número.

### 2.7 Leitura é geral; escrita é do responsável (rev. 2)

Os três acréscimos do usuário encostam no mesmo ponto — quem lê o quê — e por isso viraram
uma decisão só.

**Interno quer dizer "só a Rech", não "só eu".** A fronteira que `visivel_cliente` protege é
Rech ↔ cliente, nunca consultor ↔ consultor. Logo:

- **Todo usuário interno LÊ todos os quadros**, cartões internos inclusive.
- **Escreve só onde é responsável.** Fora disso a tela é declaradamente somente-consulta:
  faixa âmbar no topo, ações desabilitadas, arraste desligado, checklist travado, sem caixa de
  comentário.

**O que define "meu cliente".** Como `projetos` **não** guarda o código do cliente no SICLA, o
vínculo não pode sair de `projeto_pessoas`. Vem de tabela própria,
`atividade_quadro_responsaveis`: quem abre o quadro entra como responsável, outros são
acrescentados à mão, e quando o quadro é vinculado a um projeto o Painel **sugere** os
designados daquele projeto — sugere, não impõe.

**Abas na coluna de clientes.** *Meus clientes* (contador) e *Demais consultores* (contador),
com **Meus clientes sempre selecionada na abertura**, para quem estiver logado. Na aba dos
outros, cada item mostra o nome de quem responde por ele e o selo `consulta`. O filtro de texto
age dentro da aba escolhida; não achando nada ali mas havendo do outro lado, a coluna avisa e
oferece o pulo, em vez de dar "nada encontrado".

**Consulta geral de cartões.** Campo único na barra de cima, buscando em todos os quadros de
uma vez — **título, descrição e etiquetas**. Cada resultado traz o cartão, o cliente, a coluna,
se é interno ou compartilhado e se aquele quadro é de outro consultor; clicar leva ao quadro
com o cartão aberto (e troca a aba sozinho, quando for o caso).

> ⚠️ A busca **reusa o mesmo recorte do quadro** — nunca uma consulta paralela. Uma busca com
> filtro próprio é exatamente onde o recorte do cliente seria esquecido: papel `Cliente` busca
> só no próprio quadro e só entre cartões compartilhados.

Comentários e conteúdo de anexo ficam fora da busca nesta fase.

### 2.8 O que o usuário decidiu (2026-09-01) — e como ficou

As seis perguntas em aberto foram respondidas e já estão no código.

| # | Pergunta | Decisão | Onde |
|---|---|---|---|
| 1 | Cliente pode criar cartão? | **Sim**, e designa **apenas consultor da Rech** | `acesso.ts` · `cartoes.service.ts` |
| 2 | Contato vê cartão de outro contato do mesmo cliente? | **Sim** | recorte por quadro, não por pessoa |
| 3 | Colunas padrão | A fazer · Em andamento · Com o cliente · Concluído · **Bastidor Rech** (interna) | `controle-atividades.constants.ts` |
| 4 | Aviso por e-mail | **Sim** — e mais: **pop-up** no canto inferior direito, aberto até fechar, que abre o cartão ao clicar | `notificacoes-atividade.service.ts` · `avisos-atividades.component.ts` |
| 5 | Quem abre o quadro | **Quem está designado a atender o cliente** (GCI ou consultor) — vínculo que já existe no cadastro de etapas | `designados.repository.ts` |
| 6 | Consulta pode comentar? | **Não** — consulta é leitura estrita | `podeInteragirCartao` |

Três delas mudaram o desenho de forma relevante:

**A solicitação do cliente nasce COMPARTILHADA** (`origem = 'cliente'`). A regra "nasce
fechado" existe para proteger o bastidor da Rech — e um cartão aberto pelo cliente não é
bastidor da Rech; nascer interno o esconderia de quem acabou de criá-lo. Duas restrições
sobram: só em coluna compartilhada, e o único membro que ele designa é consultor da Rech.

**O quadro nasce da DESIGNAÇÃO, não de quem clicou.** A abertura pede um **projeto** em que a
pessoa está designada, e os designados daquele projeto (consultores e GCI, não o levantador)
entram como responsáveis. É isso que faz o quadro aparecer em "Meus clientes" de toda a
equipe que atende o cliente, sem ninguém cadastrar nada. Isso **substitui** o que a rev. 2
dizia ("quem abre entra como responsável, outros à mão") — o cadastro manual continua
existindo, mas como exceção.

**O aviso é persistente.** O pop-up fica aberto até a pessoa fechar, o que exige uma linha em
banco (`atividade_notificacoes`) e não um evento em memória: fechar precisa valer entre
sessões, máquinas e reinícios. Os avisos de prazo não se repetem — só há um pendente por
cartão e por pessoa.

**Filtro de consultor** (acréscimo do mesmo dia): a aba *Demais consultores* tem um seletor
com quem responde por aqueles quadros. A lista vem do backend (`/quadros` → `consultores`) e
só traz quem de fato responde por um quadro **daquela aba** — oferecer um nome que não filtra
nada é ruído. O mesmo filtro existe na busca (`GET /busca?consultor=`).

---

## 3. Modelo de dados

Todas as tabelas com prefixo `atividade_`, no `painel_novo`.

```
atividade_quadros
  id · codigo_cliente_sicla (UNIQUE) · nome_cliente · projeto_id? · arquivado
  criado_por · criado_em · atualizado_em

atividade_quadro_responsaveis     <- define "meus clientes" (rev. 2)
  id · quadro_id · usuario_id · principal BOOL · criado_em

atividade_listas
  id · quadro_id → quadros · titulo · ordem DOUBLE
  visivel_cliente BOOL default 0 · arquivada

atividade_cartoes
  id · lista_id → listas · quadro_id (desnormalizado, recorte barato)
  titulo · descricao TEXT · ordem DOUBLE
  visivel_cliente BOOL default 0        <- nasce fechado
  origem ENUM('consultor','cliente')
  prazo DATE? · concluido_em DATETIME? · projeto_id?
  criado_por_usuario_id · criado_em · atualizado_em · arquivado
  INDEX (quadro_id, titulo)             <- por onde entra a busca geral (rev. 2)

atividade_etiquetas          id · quadro_id · nome · cor
atividade_cartao_etiquetas   cartao_id · etiqueta_id

atividade_membros
  id · cartao_id · tipo ENUM('interno','cliente')
  usuario_id?            <- consultor da Rech, ou contato COM conta
  contato_email · contato_nome · codigo_cliente_sicla   <- contato do SICLA

atividade_checklist_itens    id · cartao_id · texto · feito · ordem · feito_por · feito_em
atividade_anexos             id · cartao_id · tipo ENUM('arquivo','imagem','link')
                             nome · caminho? · url? · mime · tamanho · enviado_por · criado_em
atividade_comentarios        id · cartao_id · autor_usuario_id · autor_nome
                             autor_tipo ENUM('interno','cliente') · texto · criado_em
atividade_eventos            id · cartao_id · quadro_id · tipo · detalhe JSON
                             autor_usuario_id · criado_em
atividade_notificacoes       id · usuario_id · quadro_id · cartao_id? · codigo_cliente_sicla
                             tipo('solicitacao','compartilhado','comentario','prazo')
                             titulo · texto · lida · criado_em        <- alimenta o pop-up
```

`atividade_eventos` não é opcional: o cartão cruza a fronteira Rech <-> cliente, e "quem
compartilhou isto, e quando" precisa ter resposta.

Anexos de arquivo/imagem seguem a convenção já usada em `documentos` — gravados em disco com
o teto de `LIMITE_UPLOAD_DOC` (`common/upload.constants.ts`), nunca no banco. Anexo do tipo
`link` guarda só a URL.

---

## 4. API

Rota base `/api/atividades`, guardada por `@Permissao('controle_atividades', …)` e recortada
por `EscopoClienteService` em **toda** leitura.

| Verbo | Rota | Para quê |
|---|---|---|
| GET | `/quadros?aba=meus\|demais` | Rail lateral: clientes com quadro + contadores |
| POST | `/quadros` | Abre quadro para um cliente do SICLA |
| GET | `/quadros/:codigoCliente` | Quadro inteiro (listas + cartões + membros + etiquetas) |
| POST/PATCH/DELETE | `/listas[/:id]` | Colunas |
| POST/PATCH | `/cartoes[/:id]` | Cartões |
| PATCH | `/cartoes/:id/mover` | `{ listaId, antesDe?, depoisDe? }` → grava só a `ordem` |
| PATCH | `/cartoes/:id/visibilidade` | Compartilhar/recolher (registra evento) |
| POST/DELETE | `/cartoes/:id/membros[/:membroId]` | Consultores e contatos |
| POST/PATCH/DELETE | `/cartoes/:id/checklist[/:itemId]` | Checklist |
| POST/DELETE | `/cartoes/:id/anexos[/:anexoId]` | Multipart (arquivo/foto) ou link |
| GET | `/cartoes/:id/anexos/:anexoId/download` | Entrega do arquivo |
| POST | `/cartoes/:id/comentarios` | Conversa no cartão |
| GET | `/busca?termo=` | **Consulta geral** — todos os quadros que o usuário pode ler; teto de 50 |
| GET/POST/DELETE | `/quadros/:cod/responsaveis[/:usuarioId]` | Quem responde pelo quadro |
| GET | `/clientes?termo=` | `sicla.clientes.buscar` (catálogo) |
| GET | `/contatos/:codigoCliente` | `sicla.contatos.do-cliente` (catálogo) — a AGENDA, não a autorização |
| GET | `/consultores?codigo=` | designados do projeto + responsáveis do quadro — **não** o cadastro interno inteiro |

---

## 5. Permissões

Menu novo em `common/constants/menus.ts`:

```ts
{ chave: 'controle_atividades', rotulo: 'Controle de Atividades', grupo: 'Execução' }
```

Padrão por papel:

| Papel | Nível | Observação |
|---|---|---|
| ADM, Coordenador, GCI, Consultor, Levantador, Administrativo | `alteracao` | Time interno |
| Comercial | `consulta` | Acompanha, não mexe |
| **Cliente** | `alteracao` | O que ele pode fazer é limitado no **service**, não no menu |

O nível do menu é a permissão de **tela**. Dentro dela, quem manda é a regra de service
(rev. 2):

| Quem | Ler o próprio | Escrever no próprio | Ler o de outro consultor | Escrever no de outro | Buscar |
|---|---|---|---|---|---|
| Consultor responsável | sim | sim | **sim** | não | todos os quadros |
| Coordenador · GCI · ADM | sim | sim | **sim** | não¹ | todos os quadros |
| Comercial | sim | não | **sim** | não | todos os quadros |
| Cliente | só compartilhado | limitado | não | não | só o próprio quadro |

¹ O ADM mantém a trava de segurança de sempre e alcança tudo; a linha vale para o uso normal.
Se Coordenação e GCI devem poder **escrever** em qualquer quadro, é uma linha de configuração
— está na §8.

O que o papel `Cliente` **pode**: mover cartão compartilhado entre colunas compartilhadas,
marcar checklist, comentar, anexar arquivo/foto/link, concluir.
O que ele **não pode**: ver cartão ou coluna interna, criar/apagar coluna, alterar
visibilidade, remover membro interno, abrir quadro de outro cliente.

Se a criação de cartão pelo cliente for liberada (decisão em aberto), ele nasce
`origem='cliente'` e `visivel_cliente=true`, numa coluna de entrada — nunca interno.

---

## 6. Frontend

```
frontend/src/app/features/controle-atividades/
  controle-atividades.component.*      <- rail de clientes + quadro
  rail/                                <- abas Meus/Demais + filtro (rev. 2)
  busca/                               <- consulta geral de cartões (rev. 2)
  quadro/lista.component.*             <- coluna
  quadro/cartao.component.*            <- cartão no quadro
  cartao-detalhe/                      <- modal do cartão
core/services/controle-atividades.service.ts
core/models/controle-atividades.model.ts
```

Rotas `/atividades` e `/atividades/:codigoCliente`, com `permissaoGuard('controle_atividades')`.
Visual pelos tokens já existentes em `frontend/src/styles.css` — sem paleta nova, salvo o par
de estados de visibilidade (interno / compartilhado), que precisa ser inconfundível.

---

## 7. Entrega faseada

| Fase | Escopo | Fecha quando |
|---|---|---|
| **F1** | Quadro por cliente, colunas, cartões, arraste, membros internos, **abas Meus/Demais**, **leitura geral**, **busca geral** | Todo consultor acha qualquer cartão e organiza os seus |
| **F2** | Visibilidade do cartão, lado do cliente, contatos do SICLA como membros | Cliente entra e vê só o que é dele |
| **F3** | Anexos (arquivo/foto/link), checklist, prazos, comentários | Cartão vira o lugar da conversa |
| **F4** | Modelos de quadro a partir do processo de implantação, aviso por e-mail, e2e do papel Cliente | Quadro novo nasce pronto |

Os três acréscimos da rev. 2 entraram todos na **F1** de propósito: abas, leitura geral e
busca são navegação, e navegação errada depois vira migração de permissão.

Cada fase entra com os 6 documentos de `docs/` no molde de `backend/src/plano-cronograma/`,
teste de conformidade verde e `npm test` nos dois lados.

---

## 8. Decisões do usuário — RESPONDIDAS em 2026-09-01

> As seis perguntas abaixo foram respondidas pelo usuário e já estão implementadas. O quadro
> comparativo está na §2.8; o texto original fica como registro do que se perguntou.


1. **O cliente pode CRIAR cartão?** (solicitação para a Rech) — ou o quadro é só de mão única?
2. **Um contato vê os cartões designados a outro contato do mesmo cliente?** O desenho acima
   diz que sim (coerente com o BI). Confirmar.
3. **Colunas padrão** de um quadro novo — proposta: `A fazer` · `Em andamento` ·
   `Com o cliente` · `Concluído`, mais `Bastidor Rech` (interna).
4. **Aviso por e-mail** ao compartilhar/vencer um cartão: entra na F4 ou fica de fora?
5. **Quem abre o quadro** de um cliente: qualquer consultor, ou só Coordenador/GCI?
6. **Consulta é mesmo só leitura?** (rev. 2) Desenhei estrito: quem não é responsável não
   comenta. Coordenação e GCI provavelmente vão querer comentar sem virar responsável —
   liberar o comentário na consulta?
