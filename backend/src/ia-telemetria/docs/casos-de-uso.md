# Telemetria de IA — casos de uso

## UC-1 — Ver o custo de IA (Centro de Monitoramento)
Ator: quem tem `centro_operacional`. `GET /api/ia/telemetria` devolve custo estimado de hoje e
dos últimos 7 dias, execuções e erros, o gasto por finalidade e as últimas 20 chamadas. A tela
mostra os cartões e a tabela; se o teto diário estiver configurado, mostra quanto falta.

## UC-2 — Auditar uma chamada de IA
Cada linha tem finalidade, provedor, modelo, **quem** disparou, quando e status. Responde
"com que modelo o protocolo #123 foi resumido?" e "quem pediu esta sugestão de levantamento?".

## UC-3 — Conter gasto anômalo (teto diário)
Com `MIGRACAO_IA_TETO_DIARIO_USD=20`, ao passar de US$ 20 no dia, novas chamadas a provedor
externo respondem 503 ("teto diário atingido"). O provedor local segue funcionando. No dia
seguinte o contador zera.

## Endpoint
`GET /api/ia/telemetria` → `{ custoHojeUsd, custo7diasUsd, execucoesHoje, execucoes7dias,
errosHoje, porFinalidade[], ultimas[], teto{diarioUsd, atingido} }`.
