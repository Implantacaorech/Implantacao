# Telemetria de IA — regras de negócio

- **RN-1 — Toda chamada é registrada.** Cada `IaService.completar` grava uma linha em
  `execucoes_ia` (ok ou erro). Não há caminho de IA do produto que escape do registro.
- **RN-2 — Só metadados (LGPD).** Guarda finalidade, provedor, modelo, quem, quando, tokens,
  custo, duração, status. **Nunca** o conteúdo do prompt/resposta; o `contexto` é um rótulo.
- **RN-3 — Registro é best-effort.** Uma falha ao gravar telemetria (banco fora) **não** derruba
  a chamada de IA — o erro é engolido e logado. Trabalho de IA sempre prevalece sobre telemetria.
- **RN-4 — Custo é estimativa.** Calculado por tabela de preços por modelo (`precos-ia.ts`), em
  USD. Modelo desconhecido → custo `null` (tokens continuam contados). Provedor `local` → 0.
- **RN-5 — Teto diário interrompe (opt-in).** `MIGRACAO_IA_TETO_DIARIO_USD > 0` liga o teto: ao
  ser atingido, nova chamada a provedor **externo** é recusada com erro claro (503) até o dia
  virar. O provedor **local** nunca é barrado (não tem custo por token). `0` = sem teto (padrão).
- **RN-6 — "Quem" é o solicitante, ou robô/sistema.** As rotas sob demanda (Dicionário,
  Levantamento) passam o usuário; o pipeline automático de protocolos registra `null`
  (robô/sistema) — a finalidade + contexto identificam a origem.
