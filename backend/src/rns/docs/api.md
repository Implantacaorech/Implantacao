# API — módulo `rns`

Todas as rotas exigem JWT e o menu **`rns`** liberado (RBAC do painel — `PermissaoGuard`).
Como a tela é só leitura, o nível `consulta` basta.

## `GET /rns`

RNS (itens PAI de `SICLA.LISTA_ITEMPED`) criadas numa janela de datas.

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
