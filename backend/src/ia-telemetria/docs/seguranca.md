# Telemetria de IA — segurança

- **Acesso:** `GET /api/ia/telemetria` exige `JwtAuthGuard` + `PermissaoGuard` com
  `@Permissao('centro_operacional', 'consulta')` — mesma chave do Centro de Monitoramento, sem
  RBAC novo. Somente leitura; não há rota de mutação.
- **LGPD — não guarda conteúdo:** a entidade grava METADADOS (finalidade, provedor, modelo,
  quem, quando, tokens, custo, status). **Nunca** o prompt nem a resposta — a transcrição de
  cliente não é copiada para cá. O `contexto` é um rótulo curto, truncado em 160 caracteres.
- **Não vaza segredo:** nenhuma chave de IA passa por este módulo; ele só recebe do `IaService`
  o provedor/modelo/tokens/quem — jamais a `apiKey`.
- **Trilha de auditoria (A10):** por ser somente-leitura e por registrar quem/quando/o quê, o
  módulo é ele mesmo um instrumento de auditoria — responde "quem disparou qual IA e quando".
- **Contenção de custo (A9):** o teto diário é a única parte que pode INTERROMPER (503) — e só
  quando explicitamente configurado (`MIGRACAO_IA_TETO_DIARIO_USD`), nunca por acidente
  (valor mal digitado é normalizado para 0/desligado em `configuration.ts`).
