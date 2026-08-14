# API — módulo `rechedu`

Base: `/api/rechedu` · Autenticação: Bearer JWT · Gate de menu: `rechedu` (nível consulta
basta — ver regras-negocio.md).

## `GET /rechedu/credencial`

Status da credencial do usuário logado.

```json
{ "data": { "tem": true, "login": "consultor@rech.com.br" } }
```

`tem` só é `true` com login **e** senha salvos. A senha nunca é devolvida.

## `POST /rechedu/credencial`

Salva/atualiza a credencial do próprio usuário.

Corpo (`SalvarCredencialRecheduDto`):

```json
{ "login": "consultor@rech.com.br", "senha": "opcional-na-edicao" }
```

- `login`: obrigatório, 1–120 caracteres.
- `senha`: opcional, até 200 caracteres — **em branco na edição mantém a senha atual**
  (o consultor corrige só o login sem redigitar a senha).

Resposta: o mesmo shape do GET, já refletindo o que ficou salvo.

## `DELETE /rechedu/credencial`

Remove a credencial do próprio usuário. Resposta: `{ "data": { "tem": false } }`.

## Erros

- `400` — DTO inválido (campo faltando/extra: a validação global recusa não declarados).
- `401` — sem token / token vencido.
- `403` — usuário sem o menu `rechedu` liberado no painel de Permissões.
