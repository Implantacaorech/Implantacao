# API — `saude`

## `GET /api/saude`

Diagnóstico completo da infraestrutura. Permissão **`centro_operacional`** — a mesma do
Centro de Monitoramento, deliberadamente: é o mesmo público (quem opera) e o mesmo lugar na
tela. Uma chave de permissão nova exigiria semear a tabela de RBAC e ninguém lembraria de
liberá-la.

### Resposta (200)

```jsonc
{
  "data": {
    "nivel": "critico",              // o PIOR dos itens
    "verificadoEm": "2026-08-11T13:00:00.000Z",
    "itens": [
      {
        "chave": "backup",           // estável: a tela usa para ícone, o digest para ordenar
        "titulo": "Backup do banco",
        "nivel": "critico",          // ok | aviso | critico | desconhecido
        "mensagem": "O último backup é de 72 h atrás.",
        "detalhe": "painel_novo_mariadb_20260808_220000.zip (0.99 MB, há 72 h). Confira a Tarefa Agendada e C:\\PainelBackups\\backup_novo_mariadb.log."
      }
    ]
  }
}
```

Sempre vêm os **seis** itens, na mesma ordem: `banco`, `backup`, `guardiao`, `docservice`,
`transcricao`, `email`. Item que não pôde ser verificado vem com `nivel: "desconhecido"` —
nunca é omitido nem convertido em `ok`.

### Níveis

| Nível | Significa | Na tela |
|---|---|---|
| `ok` | Verificado, está certo | ponto verde |
| `aviso` | Funciona, mas algo pede atenção | ponto amarelo |
| `critico` | Está quebrado ou vai quebrar | ponto vermelho, cartão destacado |
| `desconhecido` | Não foi possível verificar | ponto cinza |

`nivel` do topo é o pior de todos, na ordem `ok < desconhecido < aviso < critico`.

### Erros

- **401** sem token · **403** sem a permissão `centro_operacional`.
- Não há 5xx previsto: falha de leitura vira `desconhecido` no item correspondente.

## Não confundir

`GET /api/health` (módulo `health/`) é público, sem autenticação, responde
`{"status":"ok","db":"mariadb"}` e existe para o Guardião. Está **fora do rate limit**; este
aqui não.
