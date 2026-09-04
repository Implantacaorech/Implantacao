# Regras de negócio — Controle de Atividades

## 1. A unidade é o CLIENTE, não o projeto

O quadro é chaveado pelo **código do cliente no SICLA** — a mesma chave do recorte do acesso
do cliente ao BI (`usuarios.codigo_cliente_sicla`).

`projetos` guarda o nome do cliente como texto, não o código. Chavear o quadro por projeto
deixaria o recorte do usuário-cliente sem chave comum, e um cliente com dois projetos teria
dois quadros. O vínculo com o projeto existe (`atividade_quadros.projeto_id`) e serve para
outra coisa: dizer quem responde pelo quadro.

## 2. Visibilidade é do cartão, e nasce fechada

- Todo cartão criado pela Rech nasce **interno** (`visivel_cliente = 0`).
- Compartilhar é ato explícito, e fica gravado em `atividade_eventos`.
- A **coluna é do fluxo, não da audiência**: mover de "A fazer" para "Em andamento" não muda
  quem vê. A exceção é a coluna de **bastidor** (`visivel_cliente = 0` na lista), que o
  cliente não enxerga nem vazia.
- **Regra fail-closed:** o cliente vê `cartao.visivel_cliente` **E** `lista.visivel_cliente`.
  Compartilhar um cartão que está numa coluna interna é permitido — ele só não aparece até
  chegar a uma coluna compartilhada.

O filtro mora no **repositório**: `CartoesRepository` exige o argumento
`somenteCompartilhados`, sem default. Esquecer não compila.

## 3. Interno quer dizer "só a Rech", não "só eu"

A fronteira que a visibilidade protege é **Rech ↔ cliente**, nunca consultor ↔ consultor.

| Quem | Ler o próprio | Escrever no próprio | Ler o de outro | Escrever no de outro |
|---|---|---|---|---|
| Consultor responsável | sim | sim | **sim** | não |
| Coordenador · GCI · ADM | sim | sim | **sim** | não |
| Comercial | sim | não | **sim** | não |
| Cliente | só compartilhado | limitado | não | não |

**Consulta é leitura estrita** — quem não é responsável não move, não edita e **não comenta**
(decisão do usuário, 2026-09-01).

## 4. "Meu cliente" vem da designação

Quem abre o quadro de um cliente é **quem está designado a atendê-lo** (GCI ou consultor), e
esse vínculo já existe em `projeto_pessoas`. Ao abrir, os designados do projeto entram como
responsáveis — o quadro nasce na aba "Meus clientes" de toda a equipe, sem ninguém cadastrar
nada. O levantador fica de fora: o levantamento acaba antes da implantação.

`atividade_quadro_responsaveis` materializa esse conjunto. Sincronizar
(`POST /quadros/:cod/responsaveis/sincronizar`) só **acrescenta**: tirar acesso de alguém que
está no meio de um trabalho é decisão de gente, não efeito colateral.

**Um quadro nunca fica sem responsável** — remover o último é recusado, porque incluir
responsável exige ser responsável, e o quadro ficaria sem quem o edite.

## 5. O membro define o nível cliente × usuário do cliente

- Cartão **sem** membro do lado cliente → tarefa da **empresa**.
- Cartão **com** membro do lado cliente → tarefa **daquela pessoa**.

Um contato vê os cartões designados a outros contatos do mesmo cliente (confirmado pelo
usuário em 2026-09-01) — coerente com o acesso ao BI, onde dentro do cliente não há máscara.

## 6. O cliente pode abrir solicitação

Decisão do usuário (2026-09-01): o cliente **cria cartão**, e ele nasce **compartilhado**
(`origem = 'cliente'`) — nascer interno o esconderia de quem acabou de abri-lo. Duas
restrições:

- só em **coluna compartilhada** (senão a solicitação cairia no bastidor da Rech);
- **designa apenas consultor da Rech** — ele pede à Rech, não distribui tarefa entre os
  próprios colegas. Pode corrigir a designação da própria solicitação.

## 7. O cliente não empurra cartão para o bastidor

Mover exige que o **destino** seja coluna compartilhada quando quem move é o cliente.

## 8. Concluir é chegar na coluna "Concluído"

Chegar conclui (`concluido_em`), sair reabre. A comparação ignora acento e caixa, para um
rename cosmético da coluna não quebrar o comportamento em silêncio.

## 9. Avisos

| Evento | Quem é avisado | Como |
|---|---|---|
| Cliente abre solicitação | Responsáveis + consultor designado | Pop-up + e-mail |
| Cartão compartilhado | Contatos do cliente no cartão | E-mail |
| Comentário | O **outro lado** da mesa | Pop-up (Rech) / e-mail (cliente) |
| Prazo vencido | Responsáveis do quadro | Pop-up + e-mail, 1× por cartão |

**Recolher um cartão não avisa**, de propósito: mandar "este cartão não é mais seu" chamaria
atenção justamente para o que se quis tirar de vista.

O aviso é **efeito colateral**: a ação que o gerou já foi gravada e não se desfaz porque o
servidor de e-mail está fora. Toda falha de envio vira log.
