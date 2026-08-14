# Módulo `agenda` — tela Execução → Agenda

Calendário de compromissos dos técnicos (agendas do SICLA) dentro do Painel, aberto **já
filtrado no usuário logado** e em **visão semanal por padrão**, com opções mensal e diária.

É o porte, para o dia a dia da equipe, da página "Alocações de Agendas - Calendário" do
BI Implantação — mesma origem de dado, recorte diferente: janela livre de dias (semana/mês/
dia da tela) em vez de mês fechado, e gate de menu próprio (`agenda`, grupo Execução) em vez
de `dashboards`.

## Arquivos

| Arquivo                              | Papel                                                       |
| ------------------------------------ | ----------------------------------------------------------- |
| `agenda.controller.ts`               | `GET /agenda/calendario` e `GET /agenda/usuarios`           |
| `agenda.service.ts`                  | Janela saneada + leitura do SICLA + usuários p/ o filtro    |
| `dto/query-agenda-calendario.dto.ts` | Janela `ini`/`fim` (opcionais)                              |
| `agenda.module.ts`                   | Amarra tudo; importa `DisponibilidadeModule` e `UsersModule`|

Não há camada Repository nem entity própria: o módulo **não persiste nada** — só lê a view
`POWERBI.POWERBI_IMP_LISTACOMPROMISSOS_2` pela conexão Oracle do `DisponibilidadeModule`,
com o SQL compartilhado com `bi-agenda-alocacao/` (ver `regras-negocio.md`).

Documentos irmãos: [arquitetura.md](arquitetura.md) · [api.md](api.md) ·
[regras-negocio.md](regras-negocio.md) · [casos-de-uso.md](casos-de-uso.md) ·
[fluxo.md](fluxo.md).
