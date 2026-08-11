# Arquitetura — `saude`

Segue o Guia Mestre (Controller → Service → Repository), com uma particularidade: as fontes
de dados aqui **não são só o banco**.

```
saude.controller.ts        entrada: 1 rota, permissão, envelope. Nada mais.
saude.service.ts           decide o que cada leitura SIGNIFICA (nível, mensagem, o que fazer)
repositories/
  operacao-arquivos.repository.ts   disco: zips do dump + logs do backup e do Guardião
  saude-banco.repository.ts         banco: SELECT 1, e-mails falhos, protocolos em processamento
  docservice-saude.repository.ts    HTTP: GET /health do docservice (8001)
```

## Por que três repositories, e não um service que lê tudo

A camada Repository do guia é "acesso a dado", não "acesso a tabela". Log em disco e
serviço HTTP são fontes de dados como o banco — e são justamente as que mais mudam de
formato. Com a leitura isolada:

- o `SaudeService` é testável sem tocar em disco, rede ou banco (é o que a spec faz);
- o parsing de log (dois formatos de data e **encoding misturado**) tem teste próprio, com
  arquivos de verdade em pasta temporária;
- trocar o local dos artefatos é mexer em um arquivo.

## Decisões que valem registrar

**Tudo é tolerante a falha.** Pasta inexistente, arquivo travado por outro processo, linha
ilegível: os repositories devolvem vazio, nunca lançam. Uma tela de diagnóstico que quebra
porque não conseguiu ler um log some justamente quando algo está errado na máquina.

**Um `HttpModule` próprio, com timeout de 4 s.** O do `TranscricaoModule` tem 30 s,
dimensionado para transcrição. Aqui a pergunta é "está no ar?", e esperar 30 s por um
serviço caído transforma o diagnóstico numa espera.

**As checagens rodam em paralelo** (`Promise.all`). São independentes, e a mais lenta
(docservice fora do ar) seguraria as outras numa fila.

**Nenhuma escrita.** O módulo só lê — inclusive dos artefatos de operação. Nada aqui
conserta nada sozinho: quem conserta é a pessoa, com o que o `detalhe` mandou fazer.

## Quem consome

- `SaudeController` → tela do Centro de Monitoramento (`GET /api/saude`).
- `DigestService` → bloco "Saúde do sistema" no resumo diário (`problemas()`).

O `DigestModule` importa o `SaudeModule`; a seta nunca aponta de volta.
