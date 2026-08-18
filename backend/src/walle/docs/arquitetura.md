# Arquitetura — módulo Wall-e

## Camadas (Guia Mestre §13)

`WalleController` → services (`WalleService` fachada, `BuscaWalleService`,
`IndexacaoWalleService`, `WalleOracleService`, `WalleIaService`) → `repositories/`
(`AcervoFsRepository` para o share; `Walle*Repository` para TypeORM). Controller não toca
banco nem regra; repositories não lançam exceção HTTP nem importam service.

## Arquitetura híbrida (duas fontes)

- **Fonte A — acervo (`R:\GRM\CHAT_WALLE\`)**: SOMENTE LEITURA. Indexada de forma
  incremental para `walle_chats`, `walle_arquivos` (texto extraído LONGTEXT) e
  `walle_entidades` (migration `1787011200000-Walle`). Controle por tamanho+mtime
  (fast-path) e SHA-256 (decisão). Arquivo removido da fonte vira `removido = true`.
- **Fonte B — Oracle/SICLA (`CHAT_WALLE`)**: enriquecimento OPCIONAL de metadados
  (descrição/técnico/sistema) pela mesma conexão somente-SELECT da Disponibilidade/RNS
  (driver `oracledb` já homologado — nenhum driver novo). SQL semeado no Consultas BD
  (slug `walle_chats_sicla`), editável sem deploy. SICLA fora ⇒ `disponivel: false`,
  módulo segue com o acervo.

## Busca

Em memória, molde do Dicionário Inteligente: pesos por campo (entidade 8 > título 5 >
assunto 4 > resumo 3 > conteúdo 1), normalização sem acento, expansão por dicionário de
sinônimos com peso 0,5 — **match só-semântico nunca vira resultado principal**, cai em
"também pode ser útil". Confiança: alta ≥65%, média ≥35%, baixa <35% (baixa nunca lidera).

## IA (finalidade `walle`)

`WalleIaService` → `IaService.completar('walle', …)`. A finalidade está em
`FINALIDADES_SO_LOCAL` (**§21-A.10**: o acervo cita clientes/logs de produção; o texto não
sai da rede — OpenRouter/Anthropic são recusados na configuração). Herda telemetria de
custo, teto diário e kill switch do núcleo `src/ia/`. Sem provedor: degrada para
busca-guiada (fontes sem síntese), nunca falha a tela (§21-A.8).

## Evolução registrada (não implementada)

Embeddings/banco vetorial (RAG completo): decisão de hospedagem/custo já mapeada no
roadmap do Vault ("RAG de verdade — não iniciado"). Caminho natural: endpoint
`/embeddings` no docservice (Python local, privacidade por construção). Registrado em
`docs/pendencias.md`; com ~20 documentos, a busca lexical + entidades cobre o caso real.
