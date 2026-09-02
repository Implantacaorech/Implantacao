# Controle de acessos — quem está no Painel agora

> Pedido do usuário em 2026-09-01: *"preciso saber quem está acessando no momento e em que
> menu/rotina está"*, com um botão **Online** na tela de Usuários que abre uma tela de
> acompanhamento.

**Sistema → Usuários → botão Online** → tela `/usuarios/online`. Só Administrador.

---

## 1. Como a presença é medida

Por **batida do navegador**, não pelas requisições que chegam à API.

A alternativa óbvia — um interceptor no backend marcando "fulano fez uma requisição agora" —
não responde a pergunta, por duas razões:

1. **Quem está parado lendo uma tela não gera requisição nenhuma** e sumiria da lista. Ler o
   Projeto de um cliente por dez minutos é uso legítimo, e apareceria como ausência.
2. **O endpoint não identifica a TELA.** Várias telas chamam `GET /projetos`; saber que houve
   uma chamada não diz em que rotina a pessoa está — que é justamente o que foi pedido.

A SPA sabe as duas coisas (rota e título da tela) e as anuncia a cada **45 segundos**, mais
uma batida imediata a cada troca de tela. Quem fica **120 segundos** sem dar sinal sai da
lista — o dobro do intervalo, para uma batida perdida não fazer a tela piscar gente entrando
e saindo.

## 2. O que NÃO é gravado

**Não há histórico.** A linha de presença é sobrescrita a cada batida e apagada quando
esfria: o que fica é *onde a pessoa está agora*, nunca *por onde ela passou*.

Isso foi decisão de desenho, não limitação. Uma trilha de navegação por pessoa é vigilância
de outra natureza, com outras implicações — e não é o que foi pedido. Se um dia for preciso
(auditoria de acesso a dado sensível, por exemplo), é uma tabela nova e uma decisão nova, não
um efeito colateral desta.

A tela diz isso ao usuário, em texto, no rodapé.

## 3. A unidade é a ABA, não a pessoa

A chave é `(usuario_id, sessao)`, onde `sessao` é um identificador gerado pelo navegador e
guardado no `sessionStorage` — some quando a aba fecha, que é exatamente o ciclo de vida que
se quer medir.

Com uma linha por *usuário*, a segunda aba sobrescreveria a primeira e a tela mostraria a
pessoa num lugar só, sem jeito de perceber o erro. Como está, a tela mostra "Everton — 2
abas" e, ao detalhar, cada uma com a sua tela, IP e navegador.

Quando há várias, **a tela mostrada é a da aba que bateu por último** — é a melhor resposta
disponível para "onde a pessoa está".

## 4. Ativo × ocioso

Uma sessão aparece como **ociosa** quando:

- a aba está em **segundo plano** (`document.visibilityState`), ou
- passaram mais de **5 minutos** desde a última batida.

Sem essa distinção, toda aba esquecida aberta contaria como alguém usando o sistema — e o
número do botão viraria ficção.

## 5. Modelo de dados

```
presenca_sessoes
  id · usuario_id · sessao          UNIQUE (usuario_id, sessao)
  nome · perfil                     retrato do momento da batida
  rota · titulo                     onde está: endereço e nome da tela
  visivel                           aba em primeiro plano?
  ip · navegador
  iniciado_em · ultimo_ping         INDEX em ultimo_ping
```

Uma tabela, nova, sem tocar em nada existente — migration `1788070000000-PresencaSessoes.ts`.

Dois índices importam: o **único** em `(usuario_id, sessao)` é o que torna a batida
idempotente (a mesma aba atualiza a própria linha em vez de acumular uma por batida — sem
ele, um usuário sozinho geraria 80 linhas por hora); e o de `ultimo_ping`, por onde passam
todas as leituras e a poda.

**A tabela se mantém pequena sozinha:** cada batida poda as sessões frias *daquele usuário*.
Quem está usando limpa o próprio rastro, então não há robô nem tarefa agendada para isso.

## 6. API

| Verbo | Rota | Quem |
|---|---|---|
| POST | `/presenca/ping` | Qualquer autenticado |
| POST | `/presenca/sair` | Qualquer autenticado (logout) |
| GET | `/presenca` | **Só ADM** |
| GET | `/presenca/quantos` | **Só ADM** — o selo do botão |

A batida é de todos e a lista é só do Administrador: todo mundo precisa poder anunciar a
própria presença, e ninguém além do ADM precisa ver a dos outros. As duas convivem no mesmo
controller porque o `RolesGuard` deixa passar rota sem `@Roles`.

O logout chama `/sair` **antes** de derrubar o token — depois a chamada voltaria 401 e a
pessoa ficaria "online" na tela por mais dois minutos depois de ter saído.

## 7. Arquivos

```
backend/src/presenca/
  presenca.controller.ts · presenca.service.ts · presenca.constants.ts
  dto/presenca.dto.ts · repositories/presenca.repository.ts
frontend/src/app/
  core/services/presenca.service.ts      a batida (iniciada pelo shell)
  core/models/presenca.model.ts
  features/usuarios/online.component.*   a tela de acompanhamento
```

A batida é iniciada **no shell**, e não numa tela: precisa acompanhar o usuário por todas
elas, e o shell só existe autenticado.

## 8. Comportamento atrás de proxy

O IP sai de `x-forwarded-for` quando houver, com recuo para `req.ip`. Hoje o Painel é
acessado direto e `req.ip` bastaria — a leitura do cabeçalho já está lá porque a virada para
o servidor na nuvem provavelmente põe um proxy na frente, e sem isso a tela mostraria o IP do
proxy para todo mundo.
