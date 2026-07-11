# Checklist de produção

> Passos para atualizar o servidor real (`I7M1700-01-EVE`). Complementa
> `PLANO_DE_IMPLANTACAO_E_ROLLBACK.md` com um checklist rápido de execução.

## Antes de atualizar o servidor

- [ ] `CHECKLIST_DE_HOMOLOGACAO.md` 100% cumprido.
- [ ] CI verde no commit que será colocado em produção.
- [ ] Se a mudança tocar `db.py`: backup manual feito **antes** do `git pull`
  (`bash tools/painel-backup.sh` ou equivalente).
- [ ] Horário de baixo uso escolhido, se possível (a atualização derruba o processo por alguns
  segundos).

## Durante a atualização

- [ ] `git pull` no servidor.
- [ ] Parar o processo atual (se estiver rodando) antes de reiniciar — evita dois processos
  disputando a porta 5000.
- [ ] Reiniciar via `Iniciar_Servidor.bat`.
- [ ] Confirmar `GET /health` → `{"status":"ok"}` em até 1 minuto.

## Depois de atualizar

- [ ] `python webapp/verificar_tudo.py` no servidor — rotas, banco, e-mail, disponibilidade,
  idade do backup.
- [ ] Testar manualmente 1 fluxo crítico na UI (ex.: abrir uma ficha de projeto existente) —
  smoke humano além do automatizado.
- [ ] Confirmar que a Tarefa Agendada do watchdog (`Painel - Guardiao`) segue ativa:
  `schtasks /Query /TN "Painel - Guardiao" /V /FO LIST`.
- [ ] Registrar a atualização (mensagem de commit já serve como changelog — não duplicar em
  outro lugar, ver `CHANGELOG.md` desta auditoria para o formato).

## Se algo falhar

Seguir `PLANO_DE_IMPLANTACAO_E_ROLLBACK.md` §3 (rollback) e, se for um incidente com impacto
percebido pela equipe, `RUNBOOK_DE_INCIDENTES.md`.
