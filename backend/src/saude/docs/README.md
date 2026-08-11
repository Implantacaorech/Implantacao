# Módulo `saude`

Vigilância da **infraestrutura do próprio Painel**: banco, backup, Guardião, docservice,
transcrições em andamento e envio de e-mail.

> **Não confundir com `health/`**, que responde `GET /api/health` em uma linha para o
> Guardião decidir se reinicia o processo. Aqui é o relatório para **gente ler** — e para
> ser lido, ele vai junto no digest diário.
>
> **Nem com o `saude` do Centro de Monitoramento**, que é o percentual de projetos
> saudáveis. Aquilo é negócio; isto é máquina.

## Por que este módulo existe

Todo incidente sério deste projeto passou dias despercebido — não por falta de log, mas por
falta de alguém lendo o log:

| Quando | O que aconteceu | Por que ninguém viu |
|---|---|---|
| 27–29/07/2026 | Backup gravando **176 bytes** por 3 dias | O script logava `ok`; o painel seguia no ar |
| 30/07–02/08/2026 | **4 dias sem dump nenhum** (senha obsoleta no ambiente) | As linhas de ERRO saíam ilegíveis no log (UTF-16) |
| 22/07/2026 | Guardião reiniciou o painel **159 vezes em 13 h** | O guardião funcionou; o alarme é que não existia |
| 04/08/2026 | docservice ficou fora depois de um reinício do painel | Só apareceu horas depois, ao usuário, como `ECONNREFUSED` |

Em todos, o painel continuava respondendo e ninguém tinha motivo para desconfiar. O módulo
troca "ninguém foi avisado" por dois canais: a **tela** (quem olha) e o **digest diário**
(quem não olha).

## Documentos

| Arquivo | Conteúdo |
|---|---|
| [arquitetura.md](arquitetura.md) | Camadas, arquivos e por que cada fonte virou um repository |
| [api.md](api.md) | `GET /api/saude`, formato da resposta e permissão |
| [regras-negocio.md](regras-negocio.md) | Cada checagem, os limiares e por que são esses |
| [casos-de-uso.md](casos-de-uso.md) | O que a pessoa faz com cada resultado |
| [fluxo.md](fluxo.md) | Sequência de um diagnóstico, ponta a ponta |
