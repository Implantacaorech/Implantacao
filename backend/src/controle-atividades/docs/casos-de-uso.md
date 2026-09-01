# Casos de uso — Controle de Atividades

## CU-01 · Consultor organiza a implantação

**Ator:** consultor designado ao cliente.
**Pré:** estar em `projeto_pessoas` do projeto daquele cliente.

1. Abre Execução → Controle de Atividades. A aba **Meus clientes** já vem selecionada.
2. "Novo quadro" → escolhe o projeto que atende → confirma o cliente no SICLA.
3. O quadro nasce com A fazer · Em andamento · Com o cliente · Concluído · Bastidor Rech.
4. Cria cartões, arrasta entre colunas, põe prazo e etiqueta.

**Resultado:** o trabalho da implantação organizado, e nada disso visível ao cliente ainda.

## CU-02 · Consultor designa uma tarefa ao cliente

1. Abre o cartão, inclui o contato do cliente como membro (vindo do SICLA).
2. Clica em **Compartilhar com o cliente**.

**Resultado:** o contato recebe e-mail e passa a ver o cartão no Painel. O evento fica
gravado com quem compartilhou e quando.

**Variação:** cartão sem membro do lado cliente → a tarefa é da **empresa**, e todos os
contatos a veem como tal.

## CU-03 · Cliente responde uma atividade

**Ator:** contato do cliente com acesso liberado (Sistema → Acesso de Clientes).

1. Entra no Painel e vê só o quadro da própria empresa.
2. Abre o cartão, marca itens do checklist, anexa a planilha preenchida, comenta.
3. Arrasta para "Concluído".

**Resultado:** o consultor recebe o pop-up do comentário; o checklist registra que **o
cliente** marcou.

## CU-04 · Cliente abre uma solicitação

1. Numa coluna compartilhada, clica em **Abrir solicitação**.
2. Digita o título e escolhe **um consultor da Rech**.

**Resultado:** cartão compartilhado com `origem = 'cliente'`; pop-up e e-mail para os
responsáveis e para o consultor escolhido.

**Não pode:** designar outro contato do próprio cliente, nem criar em coluna interna.

## CU-05 · Coordenação acompanha o quadro de outro consultor

1. Aba **Demais consultores** → filtra pelo consultor.
2. Abre o quadro.

**Resultado:** lê tudo, **inclusive os cartões internos** — a faixa âmbar avisa que é somente
consulta, e nada de escrita é oferecido (nem comentar).

## CU-06 · Achar um cartão sem saber de que cliente é

1. Digita na busca da barra de cima ("NCM", "conversão", "Fiscal").
2. Cada resultado mostra o cliente, a coluna, se é interno ou compartilhado e se o quadro é
   de outro consultor.
3. Clica → o quadro abre com o cartão, trocando a aba sozinho quando preciso.

**Recorte:** o cliente busca só no próprio quadro e só entre cartões compartilhados — a busca
reusa o mesmo filtro do quadro, nunca um paralelo.

## CU-07 · Prazo vencido

O robô varre uma vez por dia. Cada responsável recebe **um** aviso por cartão vencido, que
fica no canto inferior direito até ser fechado. Clicar abre o cartão.

## CU-08 · Alguém entra na equipe depois do quadro criado

O responsável clica em sincronizar; os designados do projeto entram como responsáveis. Só
acrescenta — ninguém é removido automaticamente.
