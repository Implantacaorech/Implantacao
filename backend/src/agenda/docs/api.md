# API — módulo `agenda`

Todas as rotas exigem JWT e o menu **`agenda`** liberado (RBAC do painel — `PermissaoGuard`).
Como a tela é só leitura, o nível `consulta` basta.

## `GET /agenda/calendario`

Compromissos dos técnicos numa janela livre de dias.

| Query | Tipo         | Obrigatório | Descrição                                        |
| ----- | ------------ | ----------- | ------------------------------------------------ |
| `ini` | `AAAA-MM-DD` | não         | Primeiro dia da janela                           |
| `fim` | `AAAA-MM-DD` | não         | Último dia, **inclusive**                        |

Saneamento (no serviço): sem `ini` → semana de hoje (domingo→sábado); só `ini` → a semana
que começa nele; janela invertida é ordenada; mais que 62 dias é aparada pelo fim; data
inválida (ex.: `2026-13-45`) conta como ausente.

### Resposta (`ApiEnvelope<ResultadoAgendaCalendario>`)

```jsonc
{
  "data": {
    "ini": "2026-08-09",
    "fim": "2026-08-15",
    "dias": [
      // um item POR DIA da janela, mesmo vazio
      { "dia": "2026-08-12", "numero": 12, "diaSemana": 3, "compromissos": [ /* LinhaAlocacao */ ] }
    ],
    "responsaveis": ["Giomar", "Liliana"],        // técnicos distintos no período
    "resumo": [{ "status": "3-Agendada", "quantidade": 1, "percentual": 100, "cor": "#E0FFE0" }],
    "totalCompromissos": 1,                        // DISTINTOS por código
    "erro": null                                   // texto amigável quando o SICLA falha
  }
}
```

Falha de conexão/SQL **não** vira HTTP 5xx: volta `200` com `erro` preenchido e listas
vazias — a tela mostra o aviso e continua de pé (mesmo contrato dos BIs).

## `GET /agenda/usuarios`

Usuários **ativos** da tabela `usuarios` do Painel (importada de `SICLA.LISTA_TECNICOS`),
só `id` e `nome` — nada do resto do cadastro. É a fonte do filtro de técnicos da tela e é
nela que a carga inicial resolve o usuário logado (a grafia da tabela é a que bate com o
`TECNICO` dos compromissos).

```jsonc
{ "data": [ { "id": 1, "nome": "Liliana Côrtes" }, { "id": 4, "nome": "Bruna Prado" } ] }
```
