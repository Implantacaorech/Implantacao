# Regras — `saude`

Cada limiar aqui saiu de um incidente real. Estão em constantes no topo do
`saude.service.ts`, com o caso que as motivou.

## RN-S1 · Backup: idade **e** tamanho, nunca só um

| Situação | Nível |
|---|---|
| Nenhum zip `painel_novo_mariadb_*.zip` na pasta | crítico |
| Último zip com **menos de 100 KB** | crítico |
| Último zip com **48 h ou mais** | crítico |
| Zip em dia, mas com linha de `ERRO` no log nas últimas 24 h | aviso |
| Resto | ok |

**Por que tamanho também:** em 27–29/07/2026 o `docker exec` falhava, o `Out-File` gravava
vazio e o script logava `ok` — três dias de zips de **176 bytes**. A idade estava perfeita.

**Por que 48 h e não 24 h:** a tarefa roda às 22:00 e a máquina às vezes está desligada
nesse horário. Reclamar de uma noite perdida geraria ruído diário — e ruído diário é o que
faz alarme ser ignorado. Duas noites seguidas, não.

## RN-S2 · Guardião: reinício isolado é aviso; em série é laço

Menos de 3 reinícios em 24 h → **aviso**. Três ou mais → **crítico**.

Em 22/07/2026 o Guardião reergueu o painel **159 vezes em 13 h** e ninguém foi avisado. Ele
fez o trabalho dele; o que faltava era alguém notar que ele estava fazendo o tempo todo.

## RN-S3 · "Preso" só se afirma perguntando aos dois lados

Um protocolo em `Transcrevendo` parece perfeitamente saudável no banco. Só é dado como
preso quando o docservice **não conhece** o job (ou o job morreu em erro).

- `Analisando` **não** é conferido: essa etapa é chamada de IA, que não tem job no
  docservice — perguntar marcaria como preso todo protocolo em análise normal.
- Docservice sem resposta → `desconhecido`, nunca "preso": não dá para afirmar que o
  trabalho se perdeu quando o outro lado nem respondeu.

O `detalhe` aponta o caminho da correção: abrir a ficha e usar *Cancelar processamento*.

## RN-S4 · E-mail: falha registrada é falha invisível

`emails_passo` já guardava o que não saiu, de propósito — mas só aparecia para quem abrisse
o passo daquele projeto. Qualquer falha nas últimas 24 h vira **aviso**, com o último erro.

## RN-S5 · Não verificado nunca vira "ok"

Exceção em qualquer checagem produz `desconhecido`, que entra no nível geral acima de `ok`
e abaixo de `aviso`. Silenciar como "ok" seria mentir; tratar como "crítico" geraria alarme
falso toda vez que um arquivo estivesse momentaneamente travado.

## RN-S6 · No digest, silêncio quando está tudo bem

O bloco do e-mail lista **só o que não está ok**; quando tudo está certo, ocupa uma linha.
Um bloco que aparece todo dia dizendo "ok" treina o leitor a pular a seção — e aí ele pula
no dia em que ela diz outra coisa.

Falha no diagnóstico **não derruba o digest**: o resumo é do processo de implantação, e
perdê-lo inteiro porque a vigilância de infraestrutura tropeçou seria trocar um problema
por outro.
