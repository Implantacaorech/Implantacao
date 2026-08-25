# Fluxo — uma execução, ponta a ponta

`POST /api/dados/v1/consultas/sicla.rns.listar/executar`

```
Consumidor
   │ { parametros: { data_ini, data_fim }, pagina, tamanho }
   ▼
ThrottlerGuard (global)                      → 429 se estourar o rate limit
   ▼
AcessoDadosGuard
   ├─ tem X-API-Key?
   │    ├─ SIM → ClienteApiService.autenticar   → 401 se inválida/revogada
   │    │        grava ultimoUsoEm (sem segurar a requisição)
   │    │        nome da consulta ∈ consultas do token?  → 403 se não
   │    └─ NÃO → passport-jwt                   → 401 se ausente/expirado
   │             PermissoesService.nivelEfetivo → 403 se nenhum menu atende
   │  (em ambos: grava `identidadeDados` no request)
   ▼
ValidationPipe (global) → DTO: pagina/tamanho inteiros, tamanho ≤ 5000
   ▼
DadosController.executar
   ▼
DadosService.executar
   │
   ├─ 1. consultaPorNome(nome)                  → 404 se fora do catálogo
   │
   ├─ 2. sqlVigente(consulta)
   │       fixo            → o texto de catalogo/sql/
   │       consulta_salva  → ConsultaBdService.porSlug → texto de consultas_bd
   │       config_conexao  → o SELECT da tela Disponibilidade
   │                         (vazio e sem fallback     → 503)
   │       envelopar?      → recorte (ex.: WHERE PEDIDO = :pedido)
   │
   ├─ 3. validarParametros(consulta, entrada, sql)
   │       formato, obrigatoriedade, tamanho    → 400 com TODOS os erros
   │       converte (AAAA-MM → AAAA/MM, %termo%)
   │       lista_texto: REESCREVE o SQL (:tecnicos → (:tecnicos_0, …))
   │       descarta bind que o SQL vigente não cita
   │
   ├─ 4. conexoes.configurada(conexao)          → 503 com a tela onde se resolve
   │
   ├─ 5. cache[consulta|binds] ainda vale?
   │       SIM → devolve (ms: 0, cache: true) ─────────────┐
   │       NÃO ↓                                           │
   │                                                       │
   ├─ 6. ConexoesService.executar(conexao, sql, binds, limiteLinhas)
   │       'sicla'       → ConexaoSiclaService  (oracledb, callTimeout 15 s)
   │       'portal_rech' → ConexaoPortalService (mysql2,   timeout 15 s)
   │       falhou → auditar(erro) + 502 com a mensagem da origem
   │
   ├─ 7. guarda no cache se cacheSegundos > 0
   ├─ 8. auditar (log estruturado, com correlation-id) + contar métrica
   └─ 9. montar: recorte da página + paginação + metadados ◄────────────┘
   ▼
ResponseInterceptor → { success, data, message, pagination, timestamp }
```

## Onde cada erro nasce

| Passo | Falha | Código | Quem resolve |
|---|---|---|---|
| Guard | sem credencial / chave inválida | `401` | Consumidor |
| Guard | sem menu / consulta fora do token | `403` | ADM (Permissões ou cadastro do cliente) |
| 1 | nome fora do catálogo | `404` | Consumidor |
| 2 | consulta salva ausente, ou SELECT de ocupação em branco | `503` | ADM (Consultas BD / Disponibilidade) |
| 3 | parâmetro inválido | `400` | Consumidor |
| 4 | conexão inativa | `503` | ADM (Disponibilidade / Consultas BD) |
| 6 | erro do Oracle/MySQL | `502` | DBA / dono do sistema de origem |

## O que NÃO acontece em nenhum ponto

- O consumidor **nunca** manda SQL, nome de conexão ou teto de linhas.
- O SQL **nunca** sai na resposta — nem na listagem do catálogo.
- Um parâmetro inválido **nunca** chega ao banco (o `400` é antes do passo 6).
- A chave de API **nunca** volta numa listagem — só na criação e na rotação.

## E quando o chamador é um módulo do Painel

Mesmo caminho, com duas diferenças: entra por `DadosService.consultar` (sem guard, sem
DTO — quem gateou foi o controller do módulo) e sai por `{ ok, mensagem, colunas, linhas }`
em vez de exceção. O passo 9 (paginação) não roda: o módulo recebe o conjunto inteiro, já
limitado pelo teto da consulta.
