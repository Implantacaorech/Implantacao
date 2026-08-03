# Regras de negócio — `plano-cronograma`

## RN-01 · Gravação é substituição total

Salvar **apaga todas** as linhas do projeto e reinsere as enviadas, com `ordem` = posição no
array. Não existe edição de linha isolada nem `PATCH`. Herdado de
`webapp/db.py:salvar_linhas`.

**Consequência:** enviar `linhas: []` apaga o plano inteiro. A tela sempre manda a grade
completa.

## RN-02 · Histórico por diferença, comparação posicional

Antes de gravar, compara-se a grade antiga com a nova **por índice** (linha 1 × linha 1) e
registra-se um `Modificacao` por campo alterado. O retorno `mudancas` é a contagem desses
registros.

**Limitação conhecida e preservada de propósito:** como a comparação é por posição e não por
id, inserir ou remover uma linha no meio faz **todas as seguintes** aparecerem como "todo
campo mudou". É ruído de histórico, não perda de dado. É o comportamento que o Flask sempre
teve (`linhas-diff.util.ts` documenta o porquê de não ter sido "corrigido" na conversão).

Campos comparados:

| Recurso | Campos | Resumo da linha no histórico |
|---|---|---|
| Cronograma | `etapa`, `topicos`, `horas`, `data`, `modalidade`, `status` | `etapa · topicos` |
| Check List | `modulo`, `item`, `responsavel`, `status`, `obs` | `modulo · item` |

Histórico devolvido: **máx. 200** registros, mais recentes primeiro.

## RN-03 · Defaults por campo

Campo ausente ou nulo **nunca** vira `NULL` no banco:

| Recurso | Default |
|---|---|
| Cronograma | textos → `''`; `status` → `'Previsto'` |
| Check List | textos → `''`; `status` → `'Pendente'` |
| Histórico | `autor` → `''` quando não informado |

## RN-04 · Toda edição deixa rastro na timeline

Cada salvar/seed grava um `Evento` de tipo `nota` no projeto, com o autor e a contagem:

- `Cronograma editado (N alteração(ões)).`
- `Cronograma carregado do plano automático (N agendas).`
- `Check-list editado (N alteração(ões)).`
- `Check-list carregado do roteiro dos módulos (N itens).`

## RN-05 · A resposta é o estado relido, não o enviado

Depois de gravar, o service **relê** as linhas do banco e devolve isso. A tela nunca assume
que o que mandou é o que ficou (a `ordem` e os defaults são atribuídos na gravação).

## RN-06 · Plano automático do Cronograma (seed)

Ponto de partida editável, gerado a partir do projeto:

1. **Etapas** — plano padrão da implantação SIGER®, acrescido das etapas dos módulos
   contratados (`resolverModulos`). Sem módulo reconhecido, cai no bloco genérico
   "Treinamento das rotinas".
2. **Horas** — `horasCobradas` distribuídas pelos pesos das etapas pelo **método do maior
   resto** (a soma bate exatamente com o total). Sem horas informadas, cada etapa recebe
   `peso × 2`.
3. **Datas** — 1ª visita na `dataInicio` do projeto; as seguintes a cada **5 dias úteis**.
   Havendo consultor designado, consulta a agenda dele no SICLA e **pula os dias ocupados**.
   Se a consulta falhar (ex.: `DPY-3015` do Oracle), cai na cadência fixa — falha de sistema
   externo não impede gerar o plano.
4. Toda linha nasce `status: 'Previsto'`, `modalidade: 'A combinar'`.

## RN-07 · Roteiro do Check List (seed)

Lido do catálogo `ChecklistModelo` (editável em Cadastros → Check List), filtrado pelas
**siglas contratadas** do projeto.

- O item final é `item — ação`; sem ação, fica só o item (sem travessão solto).
- `adicional` tem precedência sobre `modulo` como rótulo.
- `responsavel` nasce com o consultor do projeto; `obs` recebe o menu do SIGER®.

**Divergência deliberada do Flask:** lá o seed relia `tools/data/checklist_modulos.yaml`
direto, e as edições feitas pelo ADM no catálogo nunca chegavam ao roteiro por projeto —
duas fontes divergentes. Aqui há **uma só**.

> `Projeto.modulos` guarda **códigos** desde que o passo 1 virou consulta ao SICLA, e o
> catálogo é indexado por **sigla**: sem a tradução de `siglasContratadas`, o roteiro vinha
> vazio.

## RN-08 · Projeto inexistente

Qualquer das seis operações em um `:id` que não existe responde **404** e não toca em dado
nenhum — nem grava evento.

## RN-09 · Quem pode

**ADM · Coordenador · Administrativo · Consultor.** Vale para leitura, edição e seed
destrutivo — inclusive nas rotas que no Flask não tinham gate algum (ver [api.md](api.md)).
