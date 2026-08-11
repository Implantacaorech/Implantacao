# Casos de uso — `saude`

Quem usa: **ADM e Coordenação** (permissão `centro_operacional`), na tela do Centro de
Monitoramento; e quem recebe o **digest diário**, mesmo sem abrir o painel.

## CU-1 · "O backup de ontem saiu?"

Antes, responder isso exigia entrar na máquina do servidor, abrir `C:\PainelBackups`,
comparar datas e ler um log que estava ilegível. Agora está na tela, com nome do arquivo,
tamanho e há quantas horas.

## CU-2 · O painel andou caindo e ninguém sabe

O bloco mostra quantas vezes o Guardião reergueu o serviço nas últimas 24 h e qual foi a
última. Três ou mais é **crítico**: não é "uma queda", é algo derrubando o painel de novo e
de novo — o caso das 159 vezes em 13 h de 22/07/2026.

## CU-3 · "A gravação de reunião não inicia"

Sintoma que chega ao usuário como `ECONNREFUSED 127.0.0.1:8001`, sem relação aparente com
a causa. O item **Serviço de documentos e transcrição** diz na hora se o docservice está
fora, e o `detalhe` diz o que rodar (`docservice\iniciar.bat`).

## CU-4 · Um protocolo parece travado

O item **Transcrições em andamento** separa "em andamento com trabalho ativo" de
"presa: o registro diz Transcrevendo, mas não há trabalho rodando", lista quais são e manda
usar *Cancelar processamento* na ficha.

## CU-5 · Um e-mail do processo não chegou ao cliente

O item **Envio de e-mail** conta as falhas das últimas 24 h e mostra o último erro (chave
inválida, autenticação recusada). Antes, isso só aparecia para quem abrisse o passo daquele
projeto — ou seja, para quem já estava procurando.

## CU-6 · Ninguém abriu o painel a semana inteira

É o caso que motivou o módulo. O digest diário passa a trazer o bloco **Saúde do sistema**
com o que não está ok e o que fazer. Quando está tudo certo, uma linha — para a seção
continuar valendo a leitura no dia em que disser outra coisa.

## Fora de escopo (de propósito)

- **Consertar sozinho.** O módulo só lê. Reiniciar serviço, refazer backup e destravar
  protocolo são ações com consequência, e ficam com a pessoa.
- **Histórico.** Cada consulta é uma foto do momento; nada é gravado. Tendência exigiria
  tabela e retenção — se um dia fizer falta, é decisão nova.
