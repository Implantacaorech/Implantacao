# Telemetria de IA — arquitetura

Controller → Service → Repository (Guia Mestre §13).

```
IaService.completar(finalidade, opcoes, meta?)
   ├── teto? IaTelemetriaService.tetoAtingido()  → interrompe provedor externo se estourou
   ├── despacha ao provedor e captura o `usage`
   └── IaTelemetriaService.registrar({finalidade, provider, modelo, solicitante, contexto,
          tokens, duracao, status})   (best-effort — nunca derruba a chamada)
                └── custoEstimadoUsd(precos-ia) → ExecucaoIaRepository.salvar()

GET /api/ia/telemetria
   → IaTelemetriaController → IaTelemetriaService.resumo()
        → ExecucaoIaRepository (agregações: custo hoje/7d, por finalidade, últimas, erros)
```

**Sem ciclo de dependência:** `IaModule` importa `IaTelemetriaModule` (para o `IaService`
registrar); o `IaTelemetriaModule` **não** importa o `IaModule`. A dependência é numa direção só.

**Injeção opcional:** o `IaTelemetriaService` entra no `IaService` com `@Optional()`. Em teste, o
`IaService` é criado com `new IaService()` (sem DI) e a telemetria simplesmente não acontece; em
produção o Nest injeta o serviço real.

**Persistência:** a entidade `ExecucaoIa` fica em `database/entities/` (padrão do projeto). Em
dev/teste (SQLite) nasce por `synchronize`; em produção (MariaDB) pela migration
`1784920000000-ExecucoesIa.ts`. Custo é `float` de propósito (aproximação; `SUM(float)` volta
número, o `decimal` voltaria string).
