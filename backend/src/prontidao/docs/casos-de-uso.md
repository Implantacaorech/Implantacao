# Prontidão do Sistema — casos de uso

## UC-1 — Ver a prontidão geral do Painel
Ator: Administrador. Abre `Sistema → Prontidão do Sistema`. O front chama `GET /api/prontidao`
e mostra: os 9 eixos com a maturidade (1..5) e a frase-resumo, os cartões de contagem por
severidade e por status, e a lista de achados filtrável.

## UC-2 — Acompanhar o que já foi corrigido
Cada achado traz `status` (`corrigido`/`mitigado`/`aberto`), `dono` e `prazo`. O Administrador
vê de relance o que a última rodada de correções fechou e o que continua em aberto.

## UC-3 — Descobrir vazamento de privacidade AO VIVO
Se alguma finalidade de IA sensível (Protocolos/Levantamento) estiver configurada para um
provedor externo **neste momento**, `privacidadeAoVivo` traz o item e a tela destaca em
vermelho — mesmo que o achado A1 esteja marcado como mitigado, o alerta ao vivo reflete a
config atual do servidor.

## Endpoint
`GET /api/prontidao` → `{ dataAuditoria, eixos[], achados[], totais{porSeveridade,porStatus,maturidadeMedia}, privacidadeAoVivo[] }`
