# Fluxos — módulo Wall-e

## Indexação incremental (Atualizar acervo / boot com índice vazio)

```
R:\GRM\CHAT_WALLE\  (SOMENTE LEITURA)
        │  AcervoFsRepository.listar()  — pastas numéricas = chats
        ▼
para cada arquivo da fonte:
  tamanho+mtime iguais ao índice? ──sim──▶ inalterado (nem lê)
        │ não
        ▼
  ler bytes → SHA-256 igual? ──sim──▶ só atualiza metadados
        │ não
        ▼
  decodificar (utf8→latin1) → título, resumo, categoria, origem,
  entidades (regex/dicionário), assuntos → UPSERT walle_arquivos
  → substitui walle_entidades do arquivo
        ▼
sobrou no índice e não está na fonte → removido = true (nunca DELETE)
        ▼
consolida walle_chats (placar por chat; zera chat sem arquivos)
        ▼
WalleOracleService.enriquecer()  — best-effort; SICLA fora não invalida nada
```

## Pesquisa (GET /walle/busca)

```
pergunta → normaliza (sem acento) → termos diretos + sinônimos (peso 0,5)
        ▼
pontua cada documento ativo: entidade exata 8 · título 5 · assunto 4 · resumo 3 · conteúdo 1
        ▼
pontos DIRETOS > 0 → resultados (relevância % do topo; confiança alta/média/baixa)
pontos só de sinônimo → "também pode ser útil" (com motivo)
        ▼
agrega: assuntos relacionados · SQLs (documentais) · relacionados por entidade ·
sugestões · resumo honesto · cobertura (§24)
```

## Pergunta com IA (GET /walle/pergunta)

```
busca (acima) → 4 melhores com conteúdo → sem doc? → frase-contrato (§28)
        │                                     ▲
        ▼                                     │
IaService.disponivel('walle')? ──não──▶ degrada: fontes sem síntese (§21-A.8)
        │ sim
        ▼
IaService.completar('walle', contexto numerado)  — provedor LOCAL apenas,
telemetria/teto/kill-switch herdados → resposta com citações [n] + fontes
```
