# Casos de uso — módulo `agenda`

## UC-1 — Consultar a própria semana (o caminho de todo dia)

**Ator:** qualquer usuário interno com o menu `agenda` liberado.
1. Abre Execução → Agenda. A tela pede `GET /agenda/calendario` sem parâmetros (semana de
   hoje) e abre em **visão semanal**, filtrada em "minhas agendas".
2. Vê os próprios compromissos por dia, com hora, cliente, status e assunto.

## UC-2 — Consultar a agenda de todos (a pergunta "quem está onde?")

1. No mesmo lugar, alterna o filtro para "todas" (ou escolhe técnicos específicos).
2. A tela refiltra em memória — sem nova chamada — e mostra a equipe inteira no período.

## UC-3 — Mudar o recorte de tempo

1. Alterna a visão para **mensal** (planejamento) ou **diária** (o dia em detalhe);
   navega com ‹ / Hoje / › em qualquer visão.
2. Cada mudança de período pede ao backend só a janela visível (semana, mês ou dia).

## UC-4 — SICLA indisponível

1. A consulta volta com `erro` amigável ("Conexão com o SICLA não configurada ou inativa…"
   ou a mensagem do Oracle) e listas vazias.
2. A tela mostra o aviso no lugar da grade; nada quebra, nenhum 5xx no log de acesso.
