# Fluxo — módulo `agenda`

```
Tela Execução → Agenda (Angular)
  │  GET /agenda/calendario?ini=AAAA-MM-DD&fim=AAAA-MM-DD
  ▼
AgendaController            (JwtAuthGuard + PermissaoGuard, menu `agenda`)
  │  valida o DTO (ini/fim opcionais, texto)
  ▼
AgendaService.periodo()     sane a janela: default = semana de hoje (dom→sáb);
  │                         inverte se trocada; apara em 62 dias
  ▼
AgendaService.calendario()
  │  disponibilidade.configurado()? ──não──► { erro amigável, listas vazias } ──► 200
  │  executarSql(SQL_CALENDARIO_ALOCACAO, { mes_ini: ini, mes_fim: fim+1 })
  │            (fim EXCLUSIVO no SQL herdado do BI; a janela da tela é inclusiva)
  │  ok=false ────────────────────────────► { erro: mensagem Oracle, ... } ──► 200
  ▼
normalizarLinhaAlocacao()   (compartilhada com bi-agenda-alocacao)
  ▼
agrega: 1 item POR DIA da janela · compromissos ordenados por hora ·
responsáveis distintos · resumo por status (cor/percentual) ·
totalCompromissos por CODIGO distinto
  ▼
ApiEnvelope ──► tela (que aplica o filtro "minhas agendas ⇄ todas" em memória)
```
