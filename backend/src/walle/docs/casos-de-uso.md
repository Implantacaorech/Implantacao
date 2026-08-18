# Casos de uso — módulo Wall-e

## UC1 — "Já resolvemos algo parecido?"
O consultor digita em linguagem natural ("já foi investigado problema de integração com
WhatsApp?") e clica **Perguntar**. O backend busca no índice, monta o contexto com os 4
melhores documentos e pede a síntese à IA local. A resposta vem com fontes numeradas
[1][2]…, cada uma abrindo o documento original. Sem IA configurada, a mesma tela mostra
as fontes com o aviso de degradação.

## UC2 — Busca direta por identificador
"322037" (Ficha), "563996-1" (RNS), "ORA-01400" (erro) ou "FILA_WALLE" (tabela) no campo
de pesquisa + **Pesquisar**: o índice de entidades acha o documento mesmo quando o texto
da pergunta não coincide com o texto do arquivo.

## UC3 — Navegar pelo acervo
Sem termos, a tela lista os documentos mais recentes (sem % de relevância inventado).
Filtros por categoria (SQL, investigação, causa-raiz…), origem (produzido × insumo) e
chat. Assuntos são chips clicáveis que viram nova pesquisa (§15).

## UC4 — Visão completa de um chat (§21)
"Ver chat" abre: metadados (descrição/técnico/sistema — do SICLA quando enriquecidos),
assuntos, tabela de arquivos e **chats relacionados** por entidade compartilhada (mesma
RNS/Ficha/tabela/repo), com o motivo no tooltip.

## UC5 — Reutilizar um SQL documentado
A seção "SQLs relacionados" lista objetivo, tabelas e operações de cada script encontrado.
O consultor abre, lê o script com o preview/commit/rollback documentados e decide fora do
Painel — o módulo nunca executa SQL do acervo.

## UC6 — Atualizar o acervo (ADM)
"Atualizar acervo" reindexa incrementalmente (novos/alterados/removidos no placar, §36) e
tenta enriquecer os metadados pelo SICLA. Fonte fora do ar: o índice existente continua
valendo e a tela avisa.

## UC7 — Ver uma imagem de evidência
Card/arquivo de categoria `imagem` abre a foto lida da fonte na hora (blob autenticado),
sem nunca alterá-la (§20).
