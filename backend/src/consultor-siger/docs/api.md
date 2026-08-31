# API — Consultor SIGER

Prefixo: `/api/consultor-siger` · Auth: JWT + `@Permissao('consultor_siger')` (nível
`consulta` basta para todos os endpoints).

## GET /status

Estado da base derivada: `{ disponivel, caminho, entidades, chunks, atualizadoEm,
versaoCobol, versaoAtual }`. Com a base ausente, `disponivel:false` e contagens zeradas —
nunca 500.

## GET /pesquisa?q=…&visao=funcional|tecnica

Pergunta em linguagem natural. Resposta (`ApiEnvelope`):

```jsonc
{
  "pergunta": "...", "visao": "funcional", "disponivel": true,
  "interpretacao": { "acao": "configuracao", "termos": [...], "termosExpandidos": [...] },
  "secoes": {            // só as com evidência; itens = { texto, fonte }
    "resumo": [...], "comoFunciona": [...], "regrasValidacoes": [...],
    "configuracoes": [...], "cadastros": [...], "telasMenus": [...],
    "alteracoesRecentes": [...], "origemTecnica": [...]   // só na visão técnica
  },
  "assuntosRelacionados": [{ "titulo": "...", "pesquisa": "..." }],
  "sugestoes": ["..."],
  "fontes": [{ "arquivo": "F:\\SIGER\\...", "linha": 1, "versao": "23.10b", "referencia": "...", "tipo": "help" }],
  "confianca": "alta|media|baixa|nao_confirmado",
  "aviso": null
}
```

Sem evidência: `confianca:"nao_confirmado"` + aviso "Não foi localizada evidência…" e
`secoes` vazio — o consultor nunca recebe conteúdo inventado.

## POST /feedback

Body `{ pergunta, util, observacao? }`. Registra JSONL ao lado da base derivada (fora da
fonte). Falha de disco degrada para `{ ok:false }` sem derrubar a consulta.
