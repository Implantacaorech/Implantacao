# Casos de uso — Consultor SIGER

## UC1 — Entender uma funcionalidade
O consultor pergunta "como funciona o faturamento de pedidos?". Recebe a visão do módulo
FAT (grupos de menu reais), helps da versão atual, validações de telas e menus envolvidos,
com fontes citadas. Clica em assuntos relacionados para navegar.

## UC2 — Preparar uma configuração na implantação
"O que preciso configurar para emitir NF?" → seção Configurações com parâmetros nomeados
(ex.: `mk-dfn` — atualiza data do faturamento ao emitir NF) e telas de configuração
(ex.: TABLOC "Configurações para emissão de Nota Fiscal"), prontos para conferir com o
cliente.

## UC3 — Levantar cadastros necessários
"Quais cadastros são necessários para compras?" → tabelas de cadastro e telas de
manutenção (fornecedores homologados, padrões de fornecedor com lead time), além do menu
COM "1-Cadastros".

## UC4 — Diagnosticar um bloqueio
"Por que o sistema bloqueia o pedido?" → telas de Bloqueios (FTR607), tipos de bloqueio
(`WNTIPBLO`) e mensagens — o consultor vê ONDE cada bloqueio é configurado.

## UC5 — Visão técnica
Alternando para "técnica", a resposta acrescenta código, programas e campos de tabela —
para suporte/desenvolvimento localizarem a implementação.

## UC6 — Base indisponível
Drive F: fora do ar ou base não gerada → tela avisa e orienta (gerar com o indexador /
conferir `MIGRACAO_CONSULTOR_SIGER_DB`); nenhum 500.
