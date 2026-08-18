# Regras de negócio — módulo `rns`

1. **Fonte única**: `SICLA.LISTA_ITEMPED`, lida com o SELECT fornecido pelo usuário
   (revisão de 2026-08-17: + `DETALHAMENTO`, `MOTIVO`, `PARECERENG`). As datas fixas
   viraram binds e as colunas DATE saem por `TO_CHAR` (formato estável no fio).

2. **SQL editável no Consultas BD**: o default (`SQL_CONSULTA_RNS_PADRAO`) é semeado no
   boot como a consulta nomeada `rns_lista_itemped` (Sistema → Consulta BD) e a tela passa
   a usar a versão gravada lá — o Administrador edita sem deploy. O serviço só passa os
   binds `:data_ini`/`:data_fim` que o SQL vigente referencia (versão colada sem binds roda
   sem filtro de período em vez de cair em ORA-01036). Nomes de coluna são o contrato com
   a tela — mantê-los ao editar.

3. **Pais E filhas**: desde a revisão de 2026-08-17 NÃO há filtro de `PEDIDOPAI` — todos
   os itens do período entram na lista (a coluna `RNSFILHAS` segue mostrando as filhas
   agregadas de cada pai).

4. **Identidade da RNS na tela**: **Pedido + Item** (`PEDIDO`/`ITEM`). `CODIGO` vem junto
   como referência interna do SICLA.

5. **Janela por data de criação** (`DATACRI`): default do 1º dia do mês anterior ao último
   dia do mês seguinte — o recorte da consulta original (em agosto: 01/07 → 30/09), que
   cobre o backlog recente e o previsto. A tela pode ampliar até 366 dias; acima disso a
   janela é aparada pelo fim.

6. **Ordem é a do SICLA**: o ORDER BY original (backlog desc, descrição do backlog,
   prioridade com nulos por último, status, data prevista ordenável, criação desc, código
   desc) é preservado — a tela **não** reordena, porque essa ordem é a fila de trabalho.

7. **Busca por assunto é da tela**, em memória e sem acento/caixa, sobre os campos de
   texto relevantes (sugestão, visão geral, detalhamento, motivo, parecer da engenharia,
   cliente, sigla, tipo, status, backlog, fase, responsáveis, menu, célula, protocolo…) e
   sobre os números (pedido, item, código) — o molde de uso é o Dicionário Inteligente:
   digitou, filtrou.

8. **Teto de linhas** (`LIMITE_CONSULTA_RNS = 5000`): ao bater, o payload marca
   `truncado: true` e a tela avisa para refinar o período — truncar em silêncio faria a
   busca "não achar" uma RNS que existe.

9. **Falha do SICLA não derruba a tela**: conexão não configurada ou erro de SQL viram
   `erro` amigável no payload (HTTP 200), como nos BIs e na Agenda.
