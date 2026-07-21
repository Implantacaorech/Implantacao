---
name: codigo-para-regra
description: Lê o código de uma tela ou funcionalidade e transcreve o comportamento que ele implementa para linguagem de regra de negócio, gerando uma descrição que um analista ou solicitante entende sem ler código. Use sempre que o usuário pedir para "entender o que essa tela faz", "transcrever o código em regra de negócio", "documentar o comportamento atual", "extrair as regras de negócio do código", ou quando precisar levantar o "como a regra é hoje" antes de uma análise de mudança. Dispare também quando o usuário anexar o arquivo de uma tela/funcionalidade e pedir para descrever o que ela faz em termos de negócio. A skill é autocontida e pensada para código vivo: regenera as regras a partir do código atual, sob demanda, em vez de depender de uma base de regras mantida à parte.
---

# Código para regra de negócio

Lê o código de uma funcionalidade — a tela e os arquivos relevantes — e transcreve o que ele faz para linguagem de regra de negócio. A saída descreve o **comportamento atual** do sistema de forma que alguém sem acesso ao código consiga entender, validar e usar como base para analisar mudanças.

## Filosofia

Num código vivo, manter uma base de regras escrita à parte é trabalho perdido: ela envelhece a cada commit. O código, ao contrário, está sempre atual e é a fonte da verdade sobre o que o sistema faz. Esta skill não cria conhecimento novo — ela **revela** o que já está no código, traduzindo-o para a língua do negócio. Assim, em vez de manter uma base de regras, você a regenera sob demanda, sempre fiel ao estado real do sistema.

A regra de ouro: **transcrever, não inventar.** Descreva o que o código faz, com base no que está escrito. Onde a intenção não estiver clara no código, marque como ambíguo em vez de supor.

## Entrada

- **Obrigatório:** o arquivo da tela/funcionalidade a ser transcrita.
- **Útil quando houver:** arquivos relacionados que o principal chama (funções de apoio, queries, validações em outro lugar), para não perder regras que moram fora da tela.

Leia os arquivos fornecidos just-in-time. Foque na funcionalidade pedida; siga as chamadas para outros arquivos só o quanto for necessário para entender uma regra — não transcreva o sistema inteiro.

## O que ler no código

Cada um destes sinais carrega uma regra de negócio. Percorra-os e traduza cada um em uma afirmação na língua do usuário.

- **Elementos de tela:** campos, botões, menus, abas, grids — o que o usuário vê e manipula.
- **Tooltips, labels e títulos:** dão o significado de cada elemento em linguagem de negócio.
- **Nomes de funções/métodos e seus parâmetros:** revelam as operações e suas variações (cada valor de um parâmetro de tipo costuma ser uma variação de comportamento).
- **Validações:** campos obrigatórios, formatos, faixas de valor, mensagens de erro → restrições de negócio.
- **Condicionais e ramificações:** o "quando X, então Y" do sistema → as regras de decisão.
- **Transições de estado:** mudanças de status, o que habilita ou bloqueia cada ação.
- **Checagens de permissão:** quais perfis podem fazer o quê.
- **Queries e acesso a dados:** o que é lido e gravado, com quais filtros → regras sobre os dados.
- **Chamadas a outras rotinas:** dependências e efeitos colaterais (o que mais acontece ao executar a ação).

## Princípios da transcrição

- **Linguagem de negócio pura no corpo das regras.** Quem lê a regra é um analista ou solicitante, não um desenvolvedor. Nada de nomes de função ou variáveis no texto da regra.
- **Rastreabilidade à parte.** Cada regra registra, num campo separado, de qual trecho do código ela veio. Em código vivo, é isso que permite saber qual regra revisar quando aquele trecho mudar.
- **Separe fato de inferência.** O que o código faz é fato; *por que* faz é inferência. Se precisar inferir intenção, deixe claro que é interpretação.
- **Ambiguidade é informação, não falha.** Se o código não deixa claro o propósito de algo, registre em "Pontos ambíguos" e siga. É melhor sinalizar do que preencher com suposição.

## Processo

1. **Mapeie a superfície:** identifique a tela e seus elementos (campos, botões, ações).
2. **Para cada ação, encontre a regra:** siga o que acontece quando ela é acionada — validações, condicionais, gravações, transições, permissões.
3. **Traduza cada regra** para uma afirmação de negócio, registrando sua origem no código.
4. **Levante os dados envolvidos:** o que a funcionalidade lê e grava, e sob quais condições.
5. **Liste dependências e efeitos colaterais** — o que mais é disparado pelas ações.
6. **Registre os pontos ambíguos** — o que o código não esclarece.

## Formato de saída

SEMPRE use exatamente esta estrutura em Markdown:

```markdown
# Regras de negócio — [nome da tela/funcionalidade]

## Visão geral
[Uma a duas frases: o que essa funcionalidade permite ao usuário fazer.]

## Elementos da tela
- [Campo/botão/ação]: [o que é/faz, em linguagem de negócio]

## Regras de negócio
- RN-01: [regra em linguagem de negócio] — origem: [função/trecho de código]
- RN-02: [...] — origem: [...]

## Validações e restrições
- [Restrição em linguagem de negócio] — origem: [...]

## Permissões
- [Quem pode fazer o quê] — origem: [...]

## Dados envolvidos
- Lê: [o que e de onde]
- Grava: [o que e sob quais condições]

## Fluxos e transições de estado
- [Estado A → Estado B quando ...] — origem: [...]

## Dependências e efeitos colaterais
- [O que mais acontece ao executar X] — origem: [...]

## Pontos ambíguos
- [O que o código não deixa claro — a confirmar com o time] (ou "nenhum")
```

Regras de preenchimento:
- O texto de cada regra é uma afirmação verificável de negócio. "Ao lançar um adiantamento, o sistema exige o valor e o tipo (a pagar ou a receber) antes de gravar" — não "a função recebe os parâmetros valor e tipo".
- O campo **origem** sempre aponta o trecho do código que sustenta a regra.
- Não afirme nada que não esteja no código lido. Lacuna vira "Ponto ambíguo", não chute.

## Exemplo

Trecho lido (uma tela de lançamento):
- Botão com tooltip "Lançar adiantamento".
- Função de lançamento que recebe um tipo com os valores "a pagar" e "a receber".
- Antes de gravar, há uma checagem que rejeita valor vazio e uma que exige perfil Financeiro.

Transcrição:

```
## Regras de negócio
- RN-01: O usuário pode lançar adiantamentos de dois tipos: a pagar e a receber. — origem: função de lançamento, parâmetro de tipo
- RN-02: O valor do adiantamento é obrigatório; sem ele, o lançamento é bloqueado. — origem: validação antes da gravação

## Permissões
- Apenas usuários do perfil Financeiro podem lançar adiantamentos. — origem: checagem de perfil antes da gravação
```

## Como esta skill se encaixa

A saída desta skill é o "como a regra é hoje" que alimenta a skill de análise — ali você acrescenta "como deve ficar" e gera a especificação de desenvolvimento. A mesma leitura de sinais também serve à skill de plano de testes. É a primitiva que sustenta as outras: o conhecimento de negócio passa a ser regenerado do código, nunca mantido à parte.
