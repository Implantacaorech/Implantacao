# Telemetria de IA — testes

- **`precos-ia.spec.ts`**: custo de modelo conhecido, proporcional aos tokens; local = 0;
  modelo desconhecido e usage ausente = `null`.
- **`ia-telemetria.service.spec.ts`**: `registrar` calcula o custo e persiste; nunca lança
  (banco fora é engolido); `tetoAtingido` respeita o teto, não bloqueia se a consulta falhar;
  `resumo` agrega custo/execuções/erros e marca o teto. O repository é substituído por dublê.
- **`ia.service.spec.ts` (bloco telemetria)**: com um `IaTelemetriaService` dublê, `completar`
  registra tokens do OpenRouter (usage), registra `status='erro'` na falha, o teto atingido
  interrompe provedor externo ANTES do fetch, e o provedor local nunca é barrado pelo teto.

Rodar: `cd backend && npm test -- ia-telemetria ia/ia.service`.

Não coberto de propósito: os valores exatos da tabela de preços (mudam com o mercado — são
dado editorial, revisado à mão) e a agregação SQL real por dialeto (exercitada pelo e2e/uso).
