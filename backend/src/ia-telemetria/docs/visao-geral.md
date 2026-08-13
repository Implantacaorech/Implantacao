# Telemetria de IA — visão geral

Módulo `backend/src/ia-telemetria/`. Registra **cada chamada de IA do produto** e responde
"quanto se gastou?" e "quem chamou o quê, quando, com qual provedor/modelo?". Fecha os achados
**A9 (custo por token)** e **A10 (trilha de auditoria de IA)** da auditoria de 2026-08-12.

- **A9 — custo/tokens:** o `usage` do provedor (antes descartado) vira `tokens_entrada`/
  `tokens_saida`; o custo é estimado por uma tabela de preços por modelo. Há um **teto diário**
  opcional que interrompe novas chamadas externas ao ser atingido.
- **A10 — auditoria:** cada linha grava finalidade, provedor, modelo, **quem** disparou,
  quando, duração e status (ok/erro).

**LGPD:** guarda só METADADOS — nunca o conteúdo do prompt/resposta. O `contexto` é um rótulo
curto (ex.: "protocolo: reuniao.mp4"), não o texto enviado.

Alimenta a seção **"Custo de IA"** do Centro de Monitoramento (`GET /api/ia/telemetria`).

Arquivos: `execucao-ia.entity.ts` (em `database/entities/`), `repositories/execucao-ia.repository.ts`,
`ia-telemetria.service.ts`, `ia-telemetria.controller.ts`, `precos-ia.ts`, migration
`1784920000000-ExecucoesIa.ts`.
