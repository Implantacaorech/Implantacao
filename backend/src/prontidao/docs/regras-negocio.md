# Prontidão do Sistema — regras de negócio

- **RN-1 — Retrato datado.** Os eixos e achados são um retrato da auditoria de `2026-08-12`
  (`PRONTIDAO_DATA_AUDITORIA`). Não se atualizam sozinhos; mudam quando alguém revisa a
  auditoria e comita.
- **RN-2 — Status muda à mão, com o commit.** `corrigido`/`mitigado`/`aberto` de cada achado é
  atualizado por quem aplica a correção, junto do commit que a entrega. Um "corrigido"
  automático (sem verificação) seria pior que nenhum status.
- **RN-3 — Maturidade 1..5.** Por eixo: 1 = ausente, 3 = funciona mas frágil, 5 = melhor prática
  com verificação automática. A média é só informativa (cartão de topo).
- **RN-4 — Sinal ao vivo é calculado no request.** `privacidadeAoVivo` vem de
  `IaService.avisosPrivacidade()` a cada chamada — a config de IA pode mudar sem redeploy, e a
  tela precisa mostrar o estado atual, não o do dia da auditoria. Se houver item aqui, dado de
  cliente está indo para provedor externo **agora** (achado A1).
- **RN-5 — Só o Administrador.** Menu de Sistema (`prontidao`, `fixaAdm`): o ADM sempre vê;
  ninguém mais. A rota exige `@Permissao('prontidao', 'consulta')`.
