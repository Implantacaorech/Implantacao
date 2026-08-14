# Regras de negócio — módulo `agenda`

- **RN-1 · Origem única.** Os compromissos vêm de `POWERBI.POWERBI_IMP_LISTACOMPROMISSOS_2`
  (com `LEFT JOIN` em `POWERBI_IMP_RNIMPLANTACAO_2` e `SICLA.LISTA_CLIENTES`), o MESMO SQL
  do BI "Alocação de Agendas - Calendário". Uma linha é **por técnico**: compromisso com 2
  participantes tem 2 linhas com o mesmo `CODIGO`.
- **RN-2 · Contagem por código distinto.** "Quantos compromissos" conta `CODIGO` distinto —
  multiparticipação não infla o total (herdada do BI, provada por teste).
- **RN-3 · Janela padrão = semana de hoje**, domingo→sábado (o desenho da grade semanal da
  tela). A visão semanal é o padrão da tela por decisão do usuário (2026-08-14).
- **RN-4 · Filtro do usuário logado é da TELA, alimentado pela tabela `usuarios`.** O
  filtro de técnicos nasce de `GET /agenda/usuarios` (a tabela do Painel, não só quem tem
  compromisso no período); na carga inicial a tela seleciona o usuário logado resolvido
  NESSA tabela (comparação sem acento/caixa, com tolerância de abreviação) e permite
  alternar para todas. O backend devolve o período inteiro — a troca de filtro é em
  memória, sem outra ida ao SICLA.
- **RN-5 · Status com o vocabulário do BI**: `1-Solicitada`, `3-Agendada`, `6-Realizada`,
  `7-Não realizada` (a view não guarda 8/9), com as mesmas cores.
- **RN-6 · Falha externa não derruba a tela.** SICLA fora/consulta inválida → `erro`
  amigável no corpo, listas vazias, HTTP 200.
- **RN-7 · Teto de janela** de 62 dias por chamada (`MAX_DIAS_JANELA`) e teto de linhas
  herdado do BI (`LIMITE_CALENDARIO`).
- **RN-8 · Permissão.** Menu `agenda` (grupo Execução), semeado em `PADRAO_PERMISSOES` para
  todo o time interno em `consulta` (ADM em `alteracao`); Comercial fica de fora por padrão,
  ajustável em Gestão → Permissões.
