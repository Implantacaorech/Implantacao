# Plano de monitoramento

> Sem ferramenta de APM/observabilidade (Sentry/Grafana/Prometheus) — não recomendado introduzir
> uma para 1 servidor/1 aplicação sem histórico de incidentes que justifique o custo operacional
> de mantê-la. O monitoramento real hoje é feito por scripts dedicados, já eficazes para o porte.

## 1. O que já é monitorado (e como)

| O quê | Como | Frequência | Ação em falha |
|---|---|---|---|
| App no ar | `GET /health` (`{"status":"ok"}`) | Contínuo (watchdog a cada 5 min) | `Guardiao_Painel.vbs` reinicia via `Iniciar_Servidor.bat` |
| Rotas registradas | `webapp/verificar_app.py` | CI + robô diário 07:30 | Alerta por e-mail (robô) / falha do PR (CI) |
| Banco acessível | `/health` retorna `degraded`/503 se banco inacessível; `verificar_tudo.py` | Contínuo (health) + diário (robô) | E-mail para `INTEGRIDADE_PARA` / ADM-Coordenadores |
| E-mail configurado e funcional | `webapp/verificar_email.py` | Manual + robô diário | E-mail de alerta (se outro canal funcionar) |
| Disponibilidade (Oracle) | `verificar_tudo.py` | Diário (robô) | E-mail de alerta |
| Idade do backup | `verificar_tudo.py` (checa `C:\PainelBackups`) | Diário (robô) | E-mail de alerta se backup atrasado |
| Suíte completa (regressão) | pytest via robô | Diário 07:30 | E-mail de alerta em falha |

Ver `docs/runbooks-operacao.md` §1 e §8 para o detalhe operacional — este plano não duplica,
só formaliza a cobertura como "plano".

## 2. O que NÃO é monitorado hoje (gaps)

| Gap | Risco | Recomendação |
|---|---|---|
| CPU/memória/disco do servidor | Esgotamento de disco silencioso (ex.: uploads, logs, backups acumulando) | Checagem simples periódica (`Get-PSDrive`/`wmic` no `robo_integridade.py` ou tarefa separada) — baixo esforço, sem ferramenta nova |
| Tamanho de `_uploads/`/`exemplos/` | Cresce sem quota (F-05) | Incluir no mesmo script de checagem de disco acima |
| Certificados | Não aplicável — não há HTTPS/certificado hoje | N/A |
| Tempo de resposta / latência | Sem indício de problema; sem instrumentação | Não recomendado introduzir ferramenta de APM sem sinal de lentidão real |
| Logs centralizados | 4 arquivos de log separados (app, backup, guardiao, integridade) | Aceitável para 1 servidor; não centralizar sem necessidade real |

## 3. Alertas — canal único (e-mail)

Todo alerta hoje vai por e-mail (`INTEGRIDADE_PARA` ou cadastro de ADM/Coordenadores). Isso é
adequado para o volume atual. Se o e-mail em si falhar (ver F-runbook "SMTP bloqueado"), o
alerta de e-mail também falha — é uma dependência circular conhecida, mitigada por ter Gmail
API como fallback do SMTP (`docs/runbooks-operacao.md` §3).

## 4. Ação recomendada (fechamento de gap, esforço baixo)

Adicionar ao `robo_integridade.py` (território `integracoes-operacao`) uma checagem simples de
espaço em disco (`C:` e a pasta de uploads), reportando no mesmo e-mail diário já existente —
sem introduzir ferramenta nova, sem custo de infraestrutura.

## 5. Indicadores sugeridos (ver também seção de indicadores da auditoria completa)

- Disponibilidade do `/health` (dado indireto: nº de reinícios do watchdog no `guardiao.log`).
- Idade do backup mais recente (já monitorado).
- Resultado do robô diário (verde/vermelho) — série histórica simples, mesmo que só nos logs.
- Nº de falhas de e-mail na timeline (`verificar_email.py` já expõe isso).
