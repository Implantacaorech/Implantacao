# Regras de negócio — módulo `rns`

1. **Fonte única**: `SICLA.LISTA_ITEMPED`, lida com o SELECT fornecido pelo usuário em
   2026-08-14 (`SQL_CONSULTA_RNS`). Nenhuma coluna foi acrescentada ou removida — só as
   datas fixas viraram binds e as colunas DATE saem por `TO_CHAR` (formato estável no fio).

2. **Só o item PAI**: `PEDIDOPAI IS NULL` — a linha é a RNS em si; as filhas aparecem
   agregadas na coluna `RNSFILHAS` da própria linha.

3. **Identidade da RNS na tela**: **Pedido + Item** (`PEDIDO`/`ITEM`). `CODIGO` vem junto
   como referência interna do SICLA.

4. **Janela por data de criação** (`DATACRI`): default do 1º dia do mês anterior ao último
   dia do mês seguinte — o recorte da consulta original (em agosto: 01/07 → 30/09), que
   cobre o backlog recente e o previsto. A tela pode ampliar até 366 dias; acima disso a
   janela é aparada pelo fim.

5. **Ordem é a do SICLA**: o ORDER BY original (backlog desc, descrição do backlog,
   prioridade com nulos por último, status, data prevista ordenável, criação desc, código
   desc) é preservado — a tela **não** reordena, porque essa ordem é a fila de trabalho.

6. **Busca por assunto é da tela**, em memória e sem acento/caixa, sobre os campos de
   texto relevantes (sugestão, visão geral, cliente, sigla, tipo, status, backlog, fase,
   responsáveis, menu, célula, protocolo…) e sobre os números (pedido, item, código) — o
   molde de uso é o Dicionário Inteligente: digitou, filtrou.

7. **Teto de linhas** (`LIMITE_CONSULTA_RNS = 5000`): ao bater, o payload marca
   `truncado: true` e a tela avisa para refinar o período — truncar em silêncio faria a
   busca "não achar" uma RNS que existe.

8. **Falha do SICLA não derruba a tela**: conexão não configurada ou erro de SQL viram
   `erro` amigável no payload (HTTP 200), como nos BIs e na Agenda.
