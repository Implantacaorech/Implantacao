# Fluxo — Consultor SIGER

```text
F:\SIGER (fonte, SOMENTE LEITURA — o Painel nunca a acessa)
   │  indexador externo (F:\CONSULTOR-SIGER\indexer\extrair.py, guarda testada)
   ▼
consultor.db (SQLite derivado: entidades + relações + chunks FTS5)
   │  aberto readonly (better-sqlite3)
   ▼
ConsultorSigerService
   1. interpretar()  → intenção (funcionamento/configuração/cadastros/diagnóstico/processo)
                       + termos + expansão por sinônimos do domínio
   2. buscarChunks() → FTS5 (match OR) → reponderação por tipo×intenção (bm25 NEGATIVO:
                       divide pelo peso) → filtro de ruído de menu → penalidade de módulo
                       de cliente → dedupe por referência (RLS repete programas por era)
   3. montagem       → resumo (visão de módulo quando a pergunta cita um sistema) +
                       seções por tipo de fonte + relacionados (módulos/vizinhos/tabelas)
                       + sugestões por intenção + fontes consolidadas
   4. confiança      → cobertura dos termos originais × diversidade de evidência
   ▼
ConsultorSigerController (ApiEnvelope) → tela Angular (Execução → Consultor SIGER)
```

Feedback do consultor (👍/👎) → JSONL ao lado da base derivada, fora da fonte.
