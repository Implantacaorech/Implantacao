# Fluxo — `plano-cronograma`

## Salvar o Cronograma, ponta a ponta

```mermaid
sequenceDiagram
    autonumber
    participant T as Tela (Angular)
    participant C as PlanoCronogramaController
    participant S as PlanoCronogramaService
    participant CI as CronogramaItensService
    participant M as ModificacoesService
    participant R as CronogramaItensRepository
    participant P as ProjetoRepository
    participant E as EventoRepository
    participant DB as MariaDB

    T->>C: POST /api/projetos/5/cronograma { linhas }
    Note over C: JwtAuthGuard → RolesGuard → ValidationPipe
    C->>S: salvarCronograma(5, linhas, "Ana")
    S->>P: porId(5)
    P->>DB: SELECT projeto
    alt projeto não existe
        S-->>C: NotFoundException (404)
    end
    S->>CI: salvar(5, linhas, "Ana")
    CI->>R: doProjeto(5)
    R->>DB: SELECT itens ORDER BY ordem
    Note over CI: diffLinhas(antigas, novas) — comparação POSICIONAL
    loop cada diferença
        CI->>M: registrar(...)
        M->>DB: INSERT modificacao
    end
    Note over CI: aplica os defaults (status 'Previsto', '' no lugar de nulo)
    CI->>R: substituir(5, linhasProntas)
    R->>DB: DELETE itens do projeto
    R->>DB: INSERT itens
    CI-->>S: mudancas = 2
    S->>E: registrar(5, 'nota', "Cronograma editado (2 alteração(ões)).", "Ana")
    E->>DB: INSERT evento
    S->>CI: doProjeto(5)
    CI->>R: doProjeto(5)
    R->>DB: SELECT itens (estado final)
    S-->>C: { itens, mudancas }
    C-->>T: 200 ApiEnvelope
```

## Carregar o plano automático (seed)

```mermaid
flowchart TD
    A[POST /cronograma/seed] --> B{projeto existe?}
    B -- não --> B404[404]
    B -- sim --> C[Monta as etapas: plano padrão + etapas dos módulos contratados]
    C --> D{módulo reconhecido?}
    D -- não --> D1[Bloco genérico 'Treinamento das rotinas']
    D -- sim --> D2[Etapas específicas dos módulos]
    D1 --> E{horasCobradas informadas?}
    D2 --> E
    E -- sim --> E1[Distribui pelos pesos - método do maior resto]
    E -- não --> E2[peso x 2 por etapa]
    E1 --> F{consultor designado?}
    E2 --> F
    F -- não --> G[Cadência fixa: 1a na dataInicio, +5 dias úteis]
    F -- sim --> H[Consulta a agenda no SICLA]
    H -- falhou --> G
    H -- ok --> I[Cadência de 5 dias úteis pulando dias ocupados]
    G --> J[salvar - mesmo caminho do diagrama acima]
    I --> J
    J --> K[Evento na timeline: 'carregado do plano automático - N agendas']
    K --> L[200 com o estado relido]
```

## Onde cada decisão acontece

| Decisão | Camada | Arquivo |
|---|---|---|
| Autenticação, perfil, forma do payload | Controller (guards/pipe) | `plano-cronograma.controller.ts` |
| 404 de projeto inexistente | Service | `plano-cronograma.service.ts` |
| Registrar na timeline | Service | `plano-cronograma.service.ts` |
| Reler o estado antes de responder | Service | `plano-cronograma.service.ts` |
| Diff e contagem de mudanças | Service de recurso | `cronograma-itens.service.ts` |
| Defaults por campo | Service de recurso | `cronograma-itens.service.ts` |
| Datas, dias úteis, distribuição de horas | Utils puros | `datas-plano.util.ts`, `cronograma-itens.service.ts` |
| `DELETE` + `INSERT` | Repository | `repositories/cronograma-itens.repository.ts` |
