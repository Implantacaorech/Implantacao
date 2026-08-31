# Arquitetura — módulo `agenda`

```
AgendaController ──► AgendaService ──► DisponibilidadeService (Oracle/SICLA)
      │                    │
  Guards: JWT +       constantes/normalização compartilhadas com
  Permissao('agenda')  bi-agenda-alocacao (SQL, status, cores, LinhaAlocacao)
```

- **Controller** — só entrada: valida `QueryAgendaCalendarioDto`, chama o service e devolve
  `ApiEnvelope`. Nenhuma regra, nenhum acesso a dado.
- **Service** — concentra a regra: saneamento da janela (`periodo`), execução do SQL pela
  conexão do `DisponibilidadeModule`, montagem da grade (um item por dia, mesmo vazio),
  lista de responsáveis, resumo por status e contagem de compromissos distintos.
- **Sem Repository** — o módulo não tem entity nem persistência própria; o acesso externo
  (Oracle) já é a responsabilidade encapsulada do `DisponibilidadeService`, que faz o papel
  de camada de dado aqui, como nos módulos de BI.

## Decisões

1. **Reuso por constante, não por herança**: o SQL, o vocabulário de status, as cores e a
   normalização de linha vêm de `bi-agenda-alocacao/bi-agenda-alocacao.constants.ts`
   (`normalizarLinhaAlocacao`). As duas telas leem a mesma view e qualquer divergência de
   leitura seria defeito.
2. **Filtro do usuário na TELA, não no SQL**: o serviço devolve o período inteiro; a troca
   "minhas agendas ⇄ todas" no frontend não custa outra ida ao SICLA.
3. **Janela livre com teto** (`MAX_DIAS_JANELA = 62`): atende semana/mês/dia da tela e
   impede varrer o histórico inteiro numa chamada.
