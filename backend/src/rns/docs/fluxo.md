# Fluxo — módulo `rns`

```text
Tela Execução → RNS (Angular)
  │  abre / muda "Criadas de/até"
  ▼
GET /rns?ini&fim ──► JwtAuthGuard ──► PermissaoGuard (menu `rns`, nível consulta)
  │
  ▼
RnsController.consultar(dto)
  │
  ▼
RnsService.periodo()        sanea a janela (default mês-1 → mês+1; teto 366 dias)
RnsService.consultar()
  │  configurado? ─── não ──► { itens: [], erro: "Conexão com o SICLA não configurada…" }
  │  sim
  ▼
RnsService.sqlConsulta()      SQL vigente: Consultas BD `rns_lista_itemped`, ou o default
  │                           (só passa os binds que o SQL vigente referencia)
  ▼
DisponibilidadeService.executarSql(sql, {data_ini?, data_fim?}, LIMITE)
  │  ok? ─── não ──► { itens: [], erro: mensagem amigável (ORA-…, timeout…) }
  │  sim
  ▼
normalizarLinhaRns() por linha ──► { itens, total, limite, truncado, erro: null }
  │
  ▼
Tela: busca por assunto + filtros de status/tipo EM MEMÓRIA (sem nova ida ao SICLA),
linha clicada expande o detalhe com todos os campos.
```

## Resumo completo (clique no calendário da Agenda)

```text
Tela Execução → Agenda (Angular) — clique num compromisso COM rns
  │
  ▼
GET /rns/detalhe?numero ──► JwtAuthGuard ──► PermissaoGuard (menu `rns`, nível consulta)
  │
  ▼
RnsController.detalhar(dto) ──► RnsService.detalhar(numero)
  │  número inválido / sem conexão ──► { itens: [], erro: amigável }
  ▼
SELECT * FROM ( SQL vigente ) WHERE PEDIDO = :pedido ORDER BY ITEM
  │  (binds de data, se referenciados, recebem o intervalo total — sem janela)
  ▼
normalizarLinhaRns() ──► { numero, itens, total, erro }
  │
  ▼
Modal da Agenda: a ficha `app-rns-detalhe` (a mesma da tela RNS), um bloco por item.
```

Pontos de atenção:

- O `callTimeout` da conexão (A14, no `DisponibilidadeService`) limita o tempo de uma
  consulta pesada — o handler HTTP não fica pendurado.
- `maxRows = LIMITE_CONSULTA_RNS` corta o resultado no Oracle; o serviço sinaliza o corte
  via `truncado` para a tela avisar em vez de esconder.
