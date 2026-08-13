# Prompt de auditoria de prontidão — Painel de Implantação

> Copie o bloco abaixo e cole numa sessão nova do Claude Code na raiz deste repositório.
> Criado em 2026-08-12 a pedido do usuário. Complementa a skill `auditoria-geral-sistema`
> (que testa o sistema em navegador real); este prompt audita **arquitetura e práticas**.

---

Você é um auditor técnico sênior. Audite este repositório (Painel de Implantação — backend NestJS, frontend Angular, docservice Python, MariaDB, módulos de IA) e responda, com evidência, se ele está pronto segundo as melhores práticas em **9 eixos**: Segurança, Governança, Resiliência, Agentes autônomos, Detecção de falhas antes do usuário, Alucinações, Controle de custo por token, Fallback e Observabilidade.

## Regras da auditoria (obrigatórias)

1. **Evidência ou nada.** Todo achado cita `arquivo:linha` ou saída de comando. Se você não conseguiu verificar, escreva "não verificado" — nunca presuma nem invente achado.
2. **Leia antes de varrer:** `CLAUDE.md`, `memoria_ia/estado-atual.md`, `docs/pendencias.md`, `PADRAO-DESENVOLVIMENTO-RECH.md`. Não faça varredura completa do projeto; busque arquivos específicos.
3. **Nunca toque na porta 5100 (produção).** Qualquer teste dinâmico usa a instância isolada da 5199 (ver `e2e/README.md`).
4. Um achado que já está registrado em `docs/pendencias.md` é **pendência conhecida** — cite, mas não conte como "descoberta".
5. Classifique cada achado: **Crítico** (explorável/perda de dado/parada), **Alto** (risco real, sem contorno), **Médio** (risco com contorno), **Baixo** (melhoria).
6. Só relatar nesta auditoria — não corrigir nada sem eu pedir.

## Eixo 1 — Segurança

- JWT: rotação de refresh token, expiração, segredos fora do código (`MIGRACAO_JWT_SECRET`/`MIGRACAO_JWT_REFRESH_SECRET` — confirme que não há segredo hardcoded nem em log).
- RBAC: guards por rota (`@Permissao`, `PermissoesService`) — existe rota de mutação sem guard? ADM bypassa onde não deveria?
- Chaves de IA (`backend/src/ia/`): como são armazenadas (criptografia? banco em claro?), quem pode ler/alterar, aparecem em log ou resposta de API?
- `docservice/`: confirme que segue inacessível de fora (bind, firewall, ausência de rota pública).
- Dados de cliente (LGPD): o que os prompts de IA enviam para provedor externo (OpenRouter)? Há dado pessoal saindo da rede? O provedor local (Ollama/LM Studio) cobre os fluxos sensíveis?
- `npm audit` no backend e frontend, `pip` do docservice; uploads (`webapp/_uploads/`): validação de tipo/tamanho/path traversal.
- Rode os e2e de autorização (`e2e/`, porta 5199) e reporte o resultado.

## Eixo 2 — Governança

- Conformidade verificada por teste: `backend/src/common/conformidade-stack.spec.ts`, `conformidade-arquitetura.spec.ts` (backend e frontend), `test_conformidade_arquitetura.py` (docservice) — rodam? passam? cobrem o que dizem cobrir?
- ADRs no `vault/17 - ADR/` refletem as decisões reais? Alguma decisão grande recente sem ADR (ex.: provedor local de IA, gravação de reunião)?
- CI (`.github/workflows/ci.yml`): o que roda, o que **não** roda (e2e? docservice?), branch protection.
- Ações de IA têm trilha de auditoria (quem disparou, quando, com que entrada/saída)? Documento oficial gerado por IA passa por aprovação humana antes de ir ao cliente?
- `docs/pendencias.md` está vivo (itens com dono e prazo) ou virou cemitério?

## Eixo 3 — Resiliência

- Guardião (`Guardiao_Painel_Novo.vbs`) e verificação de integridade: o que cobrem, o que fazem ao detectar queda, e o que **não** detectam.
- Backup do MariaDB: existe rotina? Frequência? **Há evidência de restore testado?** (backup nunca restaurado = achado Alto.)
- Integrações externas (SMTP/IMAP, Oracle de disponibilidade, OpenRouter, docservice): timeout, retry com backoff, e o que acontece no fluxo do usuário quando cada uma cai — erro claro e fluxo segue, ou tela quebra?
- Boot: falhas de configuração param o boot com mensagem clara (padrão já existente para dialeto de banco — confira se vale para as demais variáveis obrigatórias).
- Fila/estado: e-mail e execuções de IA sobrevivem a restart no meio? Há operação não idempotente que duplica efeito ao repetir?

## Eixo 4 — Agentes autônomos

- Inventário: liste o que roda sem humano no gatilho (robôs de digest/caixa, tarefas agendadas, agentes de `backend/src/agentes/`, transcrição/preenchimento por IA).
- Para cada um: limites de ação (pode enviar e-mail? escrever no banco? concluir passo?), aprovação humana onde a ação é externa/irreversível, kill switch (como desligo UM agente sem derrubar o painel?).
- Telemetria de `backend/src/agentes/` registra toda execução real (início, fim, falha, custo)? Existe caminho de execução que escapa do registro?
- Loop/runaway: algo impede um agente de reexecutar em loop ou estourar orçamento?

## Eixo 5 — Falhas detectadas antes do usuário

- `/api/health`: o que checa de verdade (banco? docservice? SMTP? provedor de IA?) e **quem olha** — há alerta ativo (e-mail/notificação) ou só endpoint passivo?
- Erro 5xx no backend: alguém é notificado ou só vai pro log?
- Robôs e tarefas agendadas: se um deixar de rodar, como você fica sabendo (detecção de ausência, não só de erro)?
- Fila de e-mail parada, disco cheio, certificado/senha expirando: existe verificação proativa para cada um?
- Proponha, ao final, os 3 alertas de maior valor que faltam.

## Eixo 6 — Alucinações

- Grounding: as saídas de IA que viram dado de negócio (resumo de protocolo, preenchimento de questionário, dicionário) são geradas **a partir de dados reais injetados no prompt** ou o modelo pode "completar de cabeça"? (Referência: correção recente em que o resumo passou a receber os menus reais — verifique se o mesmo padrão vale para os demais fluxos.)
- Validação pós-geração: saída da IA é validada contra o dicionário/banco antes de ser exibida ou gravada (código de menu que não existe é rejeitado)?
- O usuário vê o que é IA vs. o que é dado? Há aviso/marcação?
- Documento oficial (Projeto, Cronograma, Termo): IA pode inserir conteúdo sem revisão humana em algo que vai assinado ao cliente?
- Existe teste de regressão para os prompts (entrada conhecida → saída esperada)? Temperatura/parâmetros estão configurados para tarefa factual?

## Eixo 7 — Controle de custo por token

- A telemetria registra tokens (entrada/saída) e custo por execução? Em `backend/src/agentes/` ou `backend/src/ia/`?
- Há teto de gasto (por dia, por execução, por agente) que **interrompe** ao estourar, ou o gasto é ilimitado?
- Roteamento por custo: tarefa simples vai para modelo barato/local (Ollama) e só o necessário vai para OpenRouter, ou tudo usa o mesmo modelo?
- Contexto enviado: os prompts mandam só o necessário ou despejam documentos inteiros? Há truncagem/resumo prévio?
- Existe visão de custo acumulado no painel de Monitoramento Operacional? Alerta de gasto anômalo?

## Eixo 8 — Fallback

- Cadeia de provedores de IA: OpenRouter ↔ local (Ollama/LM Studio) — o failover é automático, manual, ou inexistente? Em que ordem? Com circuit breaker ou martelando provedor caído?
- Modelo indisponível/rate limit no OpenRouter: troca de modelo automática?
- IA totalmente fora: cada fluxo que depende dela (resumo, transcrição, questionário) degrada para caminho manual utilizável, ou bloqueia o usuário?
- docservice fora: geração de documento falha como? O usuário consegue seguir o processo?
- SMTP fora: e-mail é enfileirado e reenviado, ou perdido silenciosamente (pior caso — passo "concluído" sem notificação enviada)?

## Eixo 9 — Observabilidade

- Logs: estruturados (JSON) ou texto solto? Com timestamp, nível, contexto? Onde ficam, qual retenção, e sobrevivem a restart?
- Correlação: dá para seguir uma requisição do frontend ao backend ao docservice/IA por um id único?
- Métricas: latência por rota, taxa de erro, duração e resultado das execuções de IA — existem e estão visíveis no Monitoramento Operacional?
- Execuções de IA: prompt e resposta são persistidos para diagnóstico (respeitando LGPD)?
- Teste prático: escolha um erro real recente do log e mostre se conseguiria diagnosticá-lo só com o que está registrado. Se não, diga o que faltou.

## Formato do relatório final

1. **Veredito por eixo** — tabela: eixo · maturidade 1–5 · frase-resumo. (1 = ausente, 3 = funciona mas frágil, 5 = melhor prática com verificação automática.)
2. **Achados** — por severidade, cada um com evidência `arquivo:linha`, impacto concreto e correção proposta.
3. **Top 5 prioridades** — as correções de maior risco/retorno, em ordem, com esforço estimado (P/M/G).
4. **O que já está bem** — práticas existentes que devem ser preservadas (com evidência).
5. **Não verificado** — o que a auditoria não conseguiu cobrir e como cobrir depois.

Português do Brasil em tudo. Ao final, pergunte se aprovo transformar os achados em itens de `docs/pendencias.md`.
