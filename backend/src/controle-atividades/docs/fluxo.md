# Fluxo — Controle de Atividades

## O caminho de uma atividade

```
1. Consultor abre o quadro do cliente
   └─ escolhe um PROJETO em que está designado
      └─ o quadro nasce com 5 colunas e com os designados como responsáveis

2. Consultor cria o cartão               → nasce INTERNO (só a Rech vê)
   ├─ descreve, põe prazo, etiqueta
   ├─ inclui consultores (membros internos)
   └─ inclui contatos do cliente (SICLA) quando a tarefa é de alguém de lá

3. Consultor COMPARTILHA o cartão        → evento gravado + e-mail aos contatos
   └─ agora o cliente o vê (se a coluna também for compartilhada)

4. Cliente entra no Painel
   ├─ vê só o quadro da própria empresa
   ├─ vê só os cartões compartilhados, nas colunas compartilhadas
   ├─ marca checklist, comenta, anexa arquivo/foto/link
   └─ arrasta para "Concluído"

5. Cartão chega em "Concluído"           → concluido_em preenchido
```

## O caminho de uma solicitação (do cliente para a Rech)

```
1. Cliente abre solicitação numa coluna compartilhada
   └─ nasce COMPARTILHADA, origem = 'cliente'
      └─ designa UM consultor da Rech

2. Pop-up no canto inferior direito para os responsáveis e o designado
   + e-mail
      └─ o pop-up fica aberto até ser fechado; clicar abre o cartão

3. Consultor responde no próprio cartão
   └─ comentário da Rech → e-mail para os contatos do cartão
```

## Quem vê o quê, no mesmo quadro

```
                     ┌─ Consultor responsável ─── lê tudo, escreve tudo
Quadro do cliente ───┼─ Outro consultor da Rech ─ lê tudo, NÃO escreve nada
                     └─ Contato do cliente ────── lê o compartilhado, interage
```

## O que dispara aviso

| Gatilho | Onde | Para quem |
|---|---|---|
| Cliente cria solicitação | `CartoesService.criar` | Responsáveis + designado |
| Cartão compartilhado | `CartoesService.definirVisibilidade` | Contatos do cartão (e-mail) |
| Comentário | `CartoesService.comentar` | O outro lado da mesa |
| Prazo vencido | `RoboPrazosService` (diário, 8h) | Responsáveis, 1× por cartão |

O robô roda por `setInterval` registrado no `SchedulerRegistry` — mesmo padrão do
`RoboDigestService` — e é pulado em teste (`NODE_ENV=test`).

## Ordenação ao mover

```
mover(cartão, coluna, índice)
  ├─ ordem = média entre os vizinhos     → UPDATE de UMA linha
  └─ vizinhos próximos demais?
       └─ renumera a coluna inteira      → raro; é onde se paga o custo
```
