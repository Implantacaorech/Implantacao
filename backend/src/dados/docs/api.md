# API — `dados` (contrato `v1`)

Prefixo global `/api`. Base do módulo: **`/api/dados/v1`**.
Toda resposta vem no envelope padrão do projeto (`{ success, data, message, timestamp }`).

## Autenticação

Duas portas, e só duas:

| Chamador | Cabeçalho | Gate |
|---|---|---|
| Pessoa (Painel) | `Authorization: Bearer <jwt>` | **Menu** — precisa de nível `consulta` em ao menos um dos menus da consulta |
| Máquina (sistema, agente de IA, BI) | `X-API-Key: rd_<prefixo>_<segredo>` | **Lista de consultas do token** — a autorização é por CONSULTA, nome a nome |

A chave é verificada **primeiro**: um cliente de máquina não depende de saber montar um JWT
de pessoa. Chave inválida, expirada ou de cliente revogado devolve sempre a mesma mensagem
(`401 Chave de API inválida`) — distinguir "prefixo não existe" de "segredo errado"
transformaria o endpoint num oráculo de chaves válidas.

## Rotas

### `GET /api/dados/v1/consultas`
Catálogo publicado — **sem o SQL**. Para cliente de máquina, já vem recortado pelas consultas
que o token autoriza.

```jsonc
{ "data": { "versao": "v1", "total": 19, "consultas": [
    { "nome": "sicla.rns.listar",
      "titulo": "RNS — assuntos por período de criação",
      "descricao": "Itens de pedido do SICLA (LISTA_ITEMPED) criados na janela informada…",
      "conexao": "sicla",
      "parametros": [
        { "nome": "data_ini", "tipo": "data", "obrigatorio": true,
          "descricao": "Início do período (AAAA-MM-DD), inclusive." },
        { "nome": "data_fim", "tipo": "data", "obrigatorio": true,
          "descricao": "Fim do período (AAAA-MM-DD)." } ],
      "limiteLinhas": 5000, "cacheSegundos": 60, "desde": "v1" } ] } }
```

### `GET /api/dados/v1/consultas/{nome}`
O contrato de uma consulta só. Mesmo objeto de cima.

### `POST /api/dados/v1/consultas/{nome}/executar`
Executa. **Não existe campo `sql`, `conexao` nem `limite`** — os três são do servidor, e é
essa ausência que faz a regra valer em vez de apenas trocar o transporte do mesmo SQL solto.

```jsonc
// requisição
{ "parametros": { "data_ini": "2026-08-01", "data_fim": "2026-08-31" },
  "pagina": 1,
  "tamanho": 500 }
```

```jsonc
// resposta
{ "success": true,
  "message": "500 linha(s).",
  "pagination": { "pagina": 1, "tamanho": 500, "retornadas": 500,
                  "totalCarregado": 1320, "temMais": true,
                  "truncadoNoLimite": false },
  "data": {
    "consulta": "sicla.rns.listar",
    "versao": "v1",
    "conexao": "sicla",
    "colunas": ["PEDIDO", "ITEM", "CLIENTE", "…"],
    "linhas": [ { "PEDIDO": 5001, "ITEM": 1, "CLIENTE": "…" } ],
    "paginacao": { /* idem acima */ },
    "limiteLinhas": 5000,
    "ms": 412,
    "cache": false,
    "geradoEm": "2026-08-25T13:04:11.482Z" } }
```

`tamanho` tem teto de **5000**. Quatro consultas carregam mais linhas do que cabe numa
página (`sicla.bi.extrato-horas`, `sicla.agenda.horas-aplicadas`, `portal.visitas.listar`,
`sicla.disponibilidade.ocupacao`) — nelas o consumidor **precisa** paginar.

### Tipos de parâmetro

| Tipo | Envie | O servidor faz |
|---|---|---|
| `data` | `"2026-08-01"` | Valida o calendário (rejeita `2026-02-31`) |
| `competencia` | `"2026-08"` | Converte para o `AAAA/MM` que a view guarda |
| `datahora_minuto` | `"2026-08-25 14:30"` | — |
| `inteiro` | `5001` | — |
| `texto` | `"A-1"` | Apara, aplica teto de tamanho |
| `texto_busca` | `"melbros"` | Apara **e** envolve em `%…%` |
| `lista_texto` | `["Ana", "Bruno"]` | Reescreve `:nome` como `(:nome_0, :nome_1)`; lista vazia vira `(NULL)` |

`truncadoNoLimite: true` significa que o banco devolveu exatamente o teto da consulta: pode
haver mais dado do que a API enxergou. Estreite o período.

### `GET /api/dados/v1/conexoes`
Bancos vinculados e se estão cadastrados/ativos — o que responde "está fora do ar ou não
está configurado?" antes de abrir um chamado.

## De onde vem o SQL de cada consulta

Três origens, declaradas no catálogo e invisíveis para quem chama:

| Origem | Onde o texto mora | Muda como |
|---|---|---|
| `fixo` | `catalogo/sql/*.sql.ts` | Por PR |
| `consulta_salva` | tabela `consultas_bd` | Sistema → Consultas BD, sem release |
| `config_conexao` | configuração da conexão | Sistema → Ferramentas → Disponibilidade |

O contrato (nome, parâmetros, teto) é o mesmo nos três casos.

## Códigos

| Código | Quando | O que fazer |
|---|---|---|
| `400` | Parâmetro faltando, fora do formato, acima do tamanho, ou não declarado | A mensagem lista **todos** os problemas de uma vez; nada foi enviado ao banco |
| `401` | Sem credencial, JWT expirado ou chave inválida | Renove o token / confira a chave |
| `403` | Sem o menu (pessoa) ou consulta fora do token (máquina) | A mensagem diz qual menu falta, ou que o token não autoriza aquela consulta |
| `404` | Consulta fora do catálogo | Liste `GET /consultas`; confira a grafia |
| `429` | Rate limit global do Painel | Reduza a frequência |
| `502` | O banco de ORIGEM falhou (ORA-…, erro MySQL) | Não é erro seu nem da API — a mensagem original vai junto |
| `503` | Conexão não cadastrada/inativa, ou SQL salvo ausente | Ação do Administrador, na tela indicada pela mensagem |

O `502` é deliberado: um `500` faria o consumidor culpar a API de Dados e o monitoramento
apontar para o lugar errado.

## Administração (ADM, JWT — nunca por chave)

Uma chave comprometida não pode emitir outra: as rotas abaixo exigem pessoa com perfil ADM.

| Rota | O que faz |
|---|---|
| `GET /api/dados/v1/admin/clientes` | Lista os clientes de máquina (nunca a chave) |
| `GET /api/dados/v1/admin/clientes/consultas-disponiveis` | Universo de consultas que um token pode autorizar |
| `POST /api/dados/v1/admin/clientes` | Cadastra e devolve a chave — **única exibição** |
| `PATCH /api/dados/v1/admin/clientes/{id}` | Nome, consultas autorizadas, observação |
| `PATCH /api/dados/v1/admin/clientes/{id}/ativo` | Revoga (`false`) / reativa (`true`) |
| `POST /api/dados/v1/admin/clientes/{id}/rotacionar` | Chave nova; a anterior morre na hora |
| `DELETE /api/dados/v1/admin/clientes/{id}` | Apaga o cadastro (prefira revogar) |
| `GET /api/dados/v1/admin/metricas` | Uso por consulta desde o último boot |
| `POST /api/dados/v1/admin/cache/limpar` | Descarta o cache (use após editar um SQL salvo) |

### Consultas criadas pela TELA

| Rota | O que faz |
|---|---|
| `GET /api/dados/v1/admin/consultas` | Consultas salvas, com os campos de publicação |
| `GET /api/dados/v1/admin/consultas/{slug}` | Uma consulta, para edição |
| `POST /api/dados/v1/admin/consultas/analisar` | **Testar**: roda com limite 1 e devolve `binds`, `colunas` e uma amostra |
| `POST /api/dados/v1/admin/consultas` | Salva; se `publicada`, valida o contrato inteiro antes |
| `DELETE /api/dados/v1/admin/consultas/{slug}` | Apaga a consulta |

`analisar` e `salvar` são o único lugar da API onde SQL **entra** — e são rotas de ADM, pela
mesma razão de sempre: quem escreve o SQL ali é o Administrador do Painel, não o consumidor.
`POST /consultas` recusa qualquer coisa que não seja `SELECT`/`WITH … SELECT`, e a recusa vem
como **lista** de problemas, para o operador corrigir todos de uma vez.

### Conexões (Portal API)

| Rota | O que faz |
|---|---|
| `GET /api/dados/v1/admin/conexoes` | Configuração das duas conexões — **nunca a senha**, só `temSenha` |
| `POST /api/dados/v1/admin/conexoes/{chave}` | Grava (senha em branco **mantém** a atual) |
| `POST /api/dados/v1/admin/conexoes/{chave}/testar` | Abre a conexão e roda `SELECT 1` |

O `testar` prova a **credencial**, não o privilégio de leitura nas views: são problemas
diferentes, e misturá-los mandaria o Administrador procurar no lugar errado. Conexão fora do
conjunto conhecido é `404`, não `500`.

## Lado CONSUMIDOR — `/api/dados/v1/tokens` (só no Painel)

Estas rotas **não existem no Portal API**: ele é a ponta que executa. São a tela Sistema →
Tokens da API de Dados, onde se cola o token gerado do outro lado.

| Rota | O que faz |
|---|---|
| `GET /api/dados/v1/tokens` | Tokens cadastrados (**só o prefixo**), o que ainda não tem token, e se o consumo remoto está ativo |
| `POST /api/dados/v1/tokens/sondar` | Pergunta ao Portal API o catálogo que AQUELE token enxerga |
| `POST /api/dados/v1/tokens` | Cadastra |
| `PUT /api/dados/v1/tokens/{id}` | Atualiza (chave em branco mantém a atual) |
| `PATCH /api/dados/v1/tokens/{id}/ativo` | Liga/desliga sem apagar |
| `DELETE /api/dados/v1/tokens/{id}` | Apaga |

Com um token ativo, as consultas que **ele autoriza** deixam de abrir conexão local e passam a
ser pedidas ao Portal API pelo nome. O que ele não cobre continua local — a virada é por
consulta.

## Exemplo — consumidor externo

```bash
curl -s -X POST \
  http://I7M1700-01-EVE:5100/api/dados/v1/consultas/sicla.bi.indicadores/executar \
  -H "X-API-Key: rd_ab12cd34ef56_..." \
  -H "Content-Type: application/json" \
  -d '{"parametros":{"comp_ini":"2026-01","comp_fim":"2026-08"},"tamanho":1000}'
```

Datas sempre em `AAAA-MM-DD` e competências em `AAAA-MM`, em toda a API — a conversão para
o formato interno de cada banco (o `AAAA/MM` da view de indicadores, por exemplo) é do
servidor.

## Versionamento

`v1` está no caminho. A versão sobe **só** em mudança incompatível — coluna removida ou
renomeada, parâmetro que vira obrigatório, consulta removida — e aí `/v1` e `/v2` convivem
até o último consumidor migrar. Acrescentar consulta, ou parâmetro opcional, é compatível e
**não** sobe a versão.
