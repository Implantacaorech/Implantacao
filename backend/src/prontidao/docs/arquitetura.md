# Prontidão do Sistema — arquitetura

Segue o Guia Mestre (Controller → Service → Repository). Aqui **não há Repository**: o módulo
não persiste dado nenhum — os achados vivem em código (`prontidao.dados.ts`) e o único estado
dinâmico é lido de outro módulo (`IaService`).

```
GET /api/prontidao
   → ProntidaoController (entrada/saída, guard de permissão 'prontidao')
       → ProntidaoService.resumo()
           ├── PRONTIDAO_EIXOS / PRONTIDAO_ACHADOS   (dados datados, prontidao.dados.ts)
           └── IaService.avisosPrivacidade()          (sinal AO VIVO, calculado no request)
```

- **Controller** não tem regra nem acesso a banco: só embrulha `service.resumo()` no
  `ApiEnvelope`.
- **Service** orquestra: soma achados por severidade/status, calcula a maturidade média e cruza
  os dados datados com o estado ao vivo da IA.
- **Dependência:** `IaModule` (exporta `IaService`). Sem `TypeOrmModule`.

Por que os dados ficam em código e não no banco: a auditoria é um retrato datado revisado por
pessoas; cada correção conclui com um commit. Versionar "achado × status × correção" junto do
código é o que mantém o histórico honesto. O status só muda à mão, com o commit da correção.
