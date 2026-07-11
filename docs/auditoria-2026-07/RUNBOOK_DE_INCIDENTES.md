# Runbook de incidentes

> Complementa `docs/runbooks-operacao.md` (diagnóstico por sintoma técnico) com o processo de
> **resposta a incidente** (classificação, comunicação, causa raiz). Para o "como consertar
> tecnicamente", sempre volte ao runbook de operação — não duplicado aqui.

## 1. Classificação de severidade

| Severidade | Definição | Exemplo |
|---|---|---|
| **S1 — Crítico** | Painel totalmente fora do ar, ninguém consegue trabalhar | `/health` não responde e watchdog não recupera |
| **S2 — Alto** | Funcionalidade essencial quebrada, painel no ar | Geração de documento falhando para todos, e-mail não envia |
| **S3 — Médio** | Funcionalidade secundária degradada | Robô de protocolos parado, disponibilidade (Oracle) fora |
| **S4 — Baixo** | Incômodo sem bloqueio | Erro cosmético, lentidão pontual |

## 2. Fluxo de resposta

```
Detecção (watchdog/robô/usuário reporta)
  → Classificar severidade (§1)
  → Diagnóstico rápido: docs/runbooks-operacao.md §1 (verificar_tudo.py)
  → Conter (ex.: reiniciar servidor, desabilitar integração com problema)
  → Corrigir causa raiz
  → Validar (verificar_tudo.py + smoke manual)
  → Comunicar encerramento
  → Registrar (causa raiz + prevenção, neste arquivo ou em CHANGELOG.md)
```

## 3. Cenários cobertos

### 3.1 Painel fora do ar (S1)
1. `GET http://I7M1700-01-EVE:5000/health` — sem resposta?
2. Verificar se a máquina `everton` está ligada/logada (SPOF conhecido, F-02).
3. Forçar o watchdog: `schtasks /Run /TN "Painel - Guardiao"`.
4. Se não resolver: subir manualmente via `Iniciar_Servidor.bat`.
5. Ler `C:\PainelBackups\guardiao.log` para entender a causa (quantas quedas, quando).
6. **Causa raiz comum:** logoff/reinício da máquina — ver `docs/runbooks-operacao.md` §1c.

### 3.2 Banco inacessível (S1/S2)
1. `/health` retorna `degraded`/503.
2. `docker ps` — container `painel-db` rodando?
3. `docker logs painel-db` — erro de storage/permissão?
4. Se o container caiu e não sobe: verificar espaço em disco (`pgdata` volume).
5. Último recurso: restaurar do backup mais recente (`PLANO_DE_BACKUP_E_RECUPERACAO.md` §3).

### 3.3 E-mail parou de enviar (S2/S3)
Ver `docs/runbooks-operacao.md` §2-3 — não duplicado aqui. Resumo: checar
`verificar_email.py`, testar Gmail API se SMTP estiver bloqueado.

### 3.4 Robô da caixa não cria projetos (S3)
Ver `docs/runbooks-operacao.md` §4.

### 3.5 Disponibilidade/Oracle fora (S3)
Ver `docs/runbooks-operacao.md` §5 (tabela de erros DPY-3015/DPI-1047).

### 3.6 Deploy quebrou produção (S1/S2)
Seguir `PLANO_DE_IMPLANTACAO_E_ROLLBACK.md` §3 (rollback via `git revert`).

### 3.7 Suspeita de exposição/vazamento de dado (S1, sempre)
1. Não esperar o ciclo normal — reportar imediatamente ao usuário.
2. Envolver `seguranca-permissoes` para avaliar o alcance real.
3. Se confirmado: revogar acesso/sessões afetadas, corrigir a causa, documentar.

## 4. Comunicação

Canal único hoje: e-mail (mesmo usado pelos alertas automáticos). Para S1/S2, notificar
diretamente a Coordenação/ADM além do canal automático — não depender só do e-mail se o
próprio e-mail for a causa do incidente.

## 5. Pós-incidente (causa raiz)

Para S1/S2, registrar em 3-5 linhas: o que aconteceu, causa raiz, correção aplicada, e se
virou um item do `PLANO_DE_MELHORIAS.md`/`ROADMAP_TECNICO.md` para prevenir recorrência.
Local sugerido: `CHANGELOG.md` desta auditoria, ou `memoria_ia/pendencias.md` se gerar uma
ação pendente.

## 6. O que este runbook não cobre (por não existir)

Failover de banco, múltiplas réplicas, balanceamento de carga — não existem no projeto atual;
não há procedimento a documentar para algo que não existe.
