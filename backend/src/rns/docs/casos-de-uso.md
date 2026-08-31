# Casos de uso — módulo `rns`

## UC-1 — Pesquisar um assunto e achar as RNS relacionadas

**Ator**: consultor de implantação (qualquer papel com o menu `rns` liberado).
O consultor abre Execução → RNS, digita um assunto ("comissão por representante",
"conversão de produtos", o nome fantasia do cliente) e a lista reduz na hora às RNS cujo
texto (sugestão, visão geral, cliente, tipo, status, responsáveis…) contém o termo — sem
acento/caixa. Cada linha mostra **Pedido + Item**, criação, tipo, status, assunto, cliente,
consultor e previsão.

## UC-2 — Abrir o detalhe de uma RNS

Clicando na linha, o detalhe expande com todos os campos da consulta, nos grupos do
SELECT: identificação/classificação, disponibilidade, descrições/status, datas,
cliente/produto, versões, responsáveis, organização/produção, protocolo/RNS filhas e
valor de cobrança.

## UC-3 — Mudar o período pesquisado

O default cobre do mês anterior ao mês seguinte (por data de criação). Para achar uma RNS
mais antiga, o consultor ajusta "Criadas de/até" — a tela recarrega o período novo do
SICLA (até 366 dias por consulta).

## UC-4 — Refinar por status ou tipo

Os filtros de Status e Tipo (montados com os valores distintos do período carregado)
refinam a lista em memória, combinados com o termo de busca.

## UC-5 — SICLA fora do ar / conexão não configurada

A tela abre com o aviso amigável no topo (o `erro` do payload) e a lista vazia — sem tela
branca e sem 5xx. Configuração em Ferramentas → Disponibilidade (só ADM).
