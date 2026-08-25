# API — módulo `rns`

Todas as rotas exigem JWT e o menu **`rns`** liberado (RBAC do painel — `PermissaoGuard`).
Como a tela é só leitura, o nível `consulta` basta.

## `GET /rns`

RNS (pedidos/itens de `SICLA.LISTA_ITEMPED` — pais **e** filhas desde a revisão
2026-08-17) criadas numa janela de datas.

| Query | Tipo         | Obrigatório | Descrição                        |
| ----- | ------------ | ----------- | -------------------------------- |
| `ini` | `AAAA-MM-DD` | não         | Criadas a partir de (`DATACRI`)  |
| `fim` | `AAAA-MM-DD` | não         | Criadas até, **inclusive**       |

Saneamento (no serviço): sem parâmetros → do 1º dia do mês **anterior** ao último dia do
mês **seguinte** (a janela da consulta original); janela invertida é ordenada; mais que
366 dias é aparada pelo fim; data inválida (ex.: `2026-13-45`) conta como ausente.

### Resposta (`ApiEnvelope<ResultadoConsultaRns>`)

```jsonc
{
  "data": {
    "ini": "2026-07-01",
    "fim": "2026-09-30",
    "itens": [ /* LinhaRns — ver rns.constants.ts; ordem de backlog/prioridade do SICLA */ ],
    "total": 412,
    "limite": 5000,
    "truncado": false,   // bateu no teto de linhas → refine o período
    "erro": null         // texto amigável quando o SICLA falha
  }
}
```

Falha de conexão/SQL **não** vira HTTP 5xx: volta `200` com `erro` preenchido e `itens`
vazio — a tela mostra o aviso e continua de pé (mesmo contrato dos BIs e da Agenda).

## `GET /rns/detalhe`

Resumo completo de **UMA** RNS: todos os itens do pedido, em ordem de item. É o que o
**calendário da Agenda** abre num modal ao clicar num compromisso com RNS vinculada (a
ficha é a mesma da tela Execução → RNS — componente `app-rns-detalhe`).

| Query    | Tipo        | Obrigatório | Descrição                         |
| -------- | ----------- | ----------- | --------------------------------- |
| `numero` | inteiro ≥ 1 | sim         | Número da RNS (`PEDIDO` no SICLA) |

O serviço **embrulha o SQL vigente** do Consultas BD numa inline view
(`SELECT * FROM (…) WHERE PEDIDO = :pedido ORDER BY ITEM`) — o contrato de colunas e
qualquer correção de schema feita pelo Administrador valem aqui também, sem duplicar a
consulta. Os binds `:data_ini`/`:data_fim` (se o SQL vigente os referencia) são supridos
com o intervalo total (`1900-01-01` → `2999-12-31`): o detalhe busca por número, e a
janela de criação não pode esconder uma RNS antiga.

### Resposta (`ApiEnvelope<ResultadoDetalheRns>`)

```jsonc
{
  "data": {
    "numero": 138643,
    "itens": [ /* LinhaRns — todos os itens do pedido, item 1, 2, 3… */ ],
    "total": 2,
    "erro": null   // "A RNS N não foi encontrada no SICLA." quando não há linhas
  }
}
```

Mesmo contrato de falha do `GET /rns`: erro de conexão/SQL volta `200` com `erro`
preenchido — o modal mostra a mensagem dentro dele.
