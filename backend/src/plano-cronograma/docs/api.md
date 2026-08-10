# API — `plano-cronograma`

Prefixo global `/api`. Todas as rotas exigem **Bearer JWT** (`JwtAuthGuard`) e um dos
perfis de `PERFIS_GERA_CRONOGRAMA`: **ADM · Coordenador · Administrativo · Consultor**
(`RolesGuard`).

Toda resposta vem no envelope padrão do projeto (`ApiEnvelope`).

## Cronograma

### `GET /api/projetos/:id/cronograma`
Linhas atuais + histórico de edições.

```jsonc
{ "data": { "itens": [ /* CronogramaItem[], ordem ASC */ ],
            "historico": [ /* Modificacao[], criadoEm DESC, máx. 200 */ ] } }
```

### `POST /api/projetos/:id/cronograma` → `200`
**Substitui todas** as linhas do projeto (apaga e reinsere).

```jsonc
// requisição
{ "linhas": [ { "etapa": "Abertura", "topicos": "…", "horas": "4",
                "data": "10/08/2026", "modalidade": "Presencial",
                "status": "Previsto" } ] }
// resposta
{ "data": { "itens": [ /* estado RELIDO do banco */ ], "mudancas": 2 } }
```

`status` aceita apenas os valores de `CRONO_STATUS`; campos ausentes assumem o default
(ver [regras-negocio.md](regras-negocio.md)). `linhas: []` apaga tudo.

### `POST /api/projetos/:id/cronograma/seed` → `200`
**Destrutivo.** Descarta as linhas atuais e carrega o plano automático (etapas padrão da
implantação SIGER®, horas distribuídas pelos pesos, datas em cadência de 5 dias úteis
desviando da agenda ocupada do consultor no SICLA).

## Check List

Mesma forma, trocando o recurso:

| Rota | Efeito |
|---|---|
| `GET /api/projetos/:id/checklist` | linhas + histórico |
| `POST /api/projetos/:id/checklist` | substitui todas as linhas |
| `POST /api/projetos/:id/checklist/seed` | **destrutivo** — carrega o roteiro dos módulos contratados (catálogo `ChecklistModelo`) |

Campos da linha: `modulo`, `item`, `responsavel`, `status`, `obs`.

## Códigos

| Código | Quando |
|---|---|
| `200` | sucesso (inclusive nos POST — não há criação de recurso novo, é substituição) |
| `400` | DTO inválido (`ValidationPipe` global, `forbidNonWhitelisted`) |
| `401` | sem token / token expirado |
| `403` | perfil fora de `PERFIS_GERA_CRONOGRAMA` |
| `404` | projeto inexistente |
| `429` | rate limit global (300 req/min por IP, ajustável por `MIGRACAO_RATE_LIMIT`) |

## Nota de controle de acesso

No Flask original, **só** a geração do documento tinha gate de perfil; as rotas de edição e
de seed exigiam apenas login. Esta conversão aplicou `PERFIS_GERA_CRONOGRAMA` a **todas** as
rotas — inclusive as destrutivas. É uma divergência deliberada: endpoint de escrita sem gate
não é comportamento a preservar por fidelidade.
