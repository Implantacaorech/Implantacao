# Arquitetura — módulo `rns`

Camadas do Guia Mestre, sem persistência própria:

```
RnsController  ── valida a query (DTO) e devolve ApiEnvelope
      │
RnsService     ── sanea a janela de datas, decide "configurado?", normaliza as linhas
      │
DisponibilidadeService.executarSql  ── conexão Oracle configurada em
      │                                Ferramentas → Disponibilidade (a MESMA dos BIs)
SICLA.LISTA_ITEMPED (Oracle)
```

- **Controller** não conhece Oracle nem regra: recebe `ini`/`fim`, chama o serviço e
  envelopa. Gate de menu `rns` na classe (`@Permissao('rns')` + `PermissaoGuard`), nível
  `consulta` — a tela é só leitura.
- **Service** é dono da janela (default, ordenação, teto de 366 dias) e do contrato de
  erro: falha de conexão/SQL vira `erro` no payload com listas vazias, nunca HTTP 5xx —
  mesmo contrato dos BIs, para a tela ficar de pé e explicar o que houve.
- **Constants** concentram o SQL (com binds `:data_ini`/`:data_fim`), o teto de linhas
  (`LIMITE_CONSULTA_RNS`) e `normalizarLinhaRns` — a tradução de linha crua do Oracle
  (chaves em qualquer caixa, tipos soltos) para o `LinhaRns` tipado que sai na API.
- **Sem Repository/entity**: nada é gravado no MariaDB do Painel; a view é lida sob
  demanda a cada abertura/troca de período da tela.

A busca por assunto e os filtros (status, tipo) são **da tela** (Angular), em memória,
sobre o período inteiro que o backend entregou — cada tecla digitada não custa uma ida ao
SICLA, e a troca de filtro é instantânea.
