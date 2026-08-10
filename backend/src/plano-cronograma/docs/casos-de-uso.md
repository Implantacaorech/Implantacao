# Casos de uso — `plano-cronograma`

Ator principal: **Consultor de Implantação (GCI)**. Também acessam ADM, Coordenador e
Administrativo.

Contexto de processo: o Cronograma é **documento obrigatório** e tem prazo de **≤ 5 dias
úteis** após a liberação do levantamento (RNS(I) já criada) — ver
`docs/processo-implantacao.md`.

---

## UC-01 · Montar o cronograma do zero a partir do plano automático

**Pré:** projeto cadastrado, com `dataInicio`, módulos contratados e, de preferência,
consultor designado e horas contratadas.

1. O consultor abre a aba Cronograma do projeto.
2. Clica em **Carregar plano automático**.
3. O sistema descarta o que houver e gera as etapas com horas distribuídas e datas em
   cadência de 5 dias úteis, desviando dos dias já ocupados na agenda do consultor no SICLA.
4. O consultor ajusta etapas, tópicos e datas na grade e salva.
5. A timeline do projeto passa a mostrar as duas ações (carga e edição).

**Alternativo 3a — sem consultor designado:** não consulta o SICLA; usa a cadência fixa.
**Alternativo 3b — SICLA indisponível:** cai na cadência fixa e a geração conclui normalmente.
**Alternativo 3c — nenhum módulo reconhecido:** gera o bloco genérico "Treinamento das rotinas".

> **Destrutivo:** o passo 3 apaga o plano existente. Quem já ajustou a grade não deve usar o
> botão de carga — deve editar e salvar (UC-02).

---

## UC-02 · Ajustar a grade e preservar o rastro

1. O consultor edita células da grade (ex.: troca a data de uma visita, muda `status` para
   `Realizado`).
2. Salva.
3. O sistema compara com o estado anterior, registra uma linha de histórico por campo
   alterado e devolve a contagem.
4. O painel de histórico, abaixo da grade, mostra "linha 3 · data: 17/08/2026 → 18/08/2026",
   com autor e horário.

**Alternativo 2a — inseriu/removeu linha no meio:** o histórico fica ruidoso (todas as linhas
seguintes aparecem alteradas). É esperado — ver RN-02.

---

## UC-03 · Montar o Check List pelos módulos contratados

1. O consultor abre a aba Check List e clica em **Carregar roteiro dos módulos**.
2. O sistema busca no catálogo `ChecklistModelo` os itens das siglas contratadas do projeto.
3. Cada item nasce como `item — ação`, atribuído ao consultor do projeto, com o menu do
   SIGER® na observação e `status: Pendente`.
4. O consultor ajusta responsáveis e salva.

**Alternativo 2a — catálogo desatualizado:** o ADM edita em Cadastros → Check List e o
consultor recarrega. Não existe segunda fonte a sincronizar (ver RN-07).

---

## UC-04 · Acompanhar a execução

Durante a implantação, o consultor volta à grade e move `status` (`Previsto` → `Realizado`,
`Pendente` → `Concluído`). Cada mudança fica no histórico, o que dá à Coordenação a
rastreabilidade de quem executou o quê e quando.

---

## UC-05 · Tentativa de acesso por perfil sem permissão

Um usuário de perfil Comercial ou Levantador que chame qualquer rota deste módulo recebe
**403** — inclusive nas rotas de leitura.
