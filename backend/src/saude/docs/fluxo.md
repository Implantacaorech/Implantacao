# Fluxo — `saude`

## Um diagnóstico, ponta a ponta

```mermaid
sequenceDiagram
    participant T as Tela (Monitoramento)
    participant C as SaudeController
    participant S as SaudeService
    participant A as OperacaoArquivosRepository
    participant B as SaudeBancoRepository
    participant D as DocserviceSaudeRepository
    participant X as docservice (8001)

    T->>C: GET /api/saude
    C->>S: diagnostico()
    par as seis checagens saem juntas
        S->>B: conexaoResponde()
        S->>A: ultimoBackup() + errosDeBackup(24h)
        S->>A: reiniciosDoGuardiao(24h)
        S->>D: responde()
        D->>X: GET /health (timeout 4s)
        S->>B: protocolosEmProcessamento()
        S->>B: emailsQueFalharam(24h)
    end
    S-->>C: { nivel, itens[6], verificadoEm }
    C-->>T: envelope
```

A tela carrega esse bloco **por conta própria**, não junto com o resto do Monitoramento:
uma das checagens é bater no docservice, que quando está fora só responde no timeout — e é
justamente aí que ela mais importa.

## Confirmação de transcrição presa

```mermaid
flowchart TD
    A[protocolos em Transcrevendo/Analisando] --> B{status = Transcrevendo?}
    B -- não --> C[não confere: Analisando é etapa de IA, sem job no docservice]
    B -- sim --> D[consulta o job no docservice]
    D -- sem resposta --> E[desconhecido: o outro lado nem respondeu]
    D -- não conhece / erro --> F[preso -> aviso + Cancelar processamento]
    D -- processando/concluido --> G[ok: há trabalho ativo]
```

## O caminho até quem precisa saber

```mermaid
flowchart LR
    S[SaudeService] --> T[Tela do Centro de Monitoramento]
    S -->|problemas| G[DigestService]
    G --> M[Resumo diário por e-mail]
```

Dois canais de propósito. O primeiro serve a quem abre o painel; o segundo, a quem não
abre — que era exatamente o caso em todos os incidentes que motivaram o módulo.

## O que roda quando

| Momento | O que acontece |
|---|---|
| Alguém abre o Centro de Monitoramento | diagnóstico completo |
| Alguém clica em *Verificar agora* | diagnóstico completo, de novo |
| `MIGRACAO_DIGEST_HORA` (padrão 08:00) | `problemas()` entra no e-mail diário |

Nada é agendado por este módulo: ele não tem laço próprio nem grava histórico. É lido sob
demanda, e o único agendamento envolvido é o do digest, que já existia.
