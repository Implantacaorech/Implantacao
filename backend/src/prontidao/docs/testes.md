# Prontidão do Sistema — testes

- **`prontidao.service.spec.ts`** (unit, Jest): garante os 9 eixos, todos os achados, a
  contagem por severidade e por status (soma = total de achados), a maturidade média e o
  repasse do sinal ao vivo de `IaService.avisosPrivacidade()`. O `IaService` é substituído por
  um dublê.
- **Frontend:** `prontidao.component.spec.ts` (Vitest) cobre o caminho feliz (dados exibidos) e
  o de erro (mensagem de falha), com o `ProntidaoService` trocado por stub.

Rodar: `cd backend && npm test -- prontidao` e `cd frontend && npm test`.

O que os testes **não** cobrem de propósito: o conteúdo textual de cada achado (é dado
editorial, revisado por pessoas). Eles fixam a estrutura e a aritmética, não a prosa.
