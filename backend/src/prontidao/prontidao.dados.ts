/**
 * Dados da Auditoria de Prontidão dos 9 eixos (2026-08-12) — fonte única do módulo
 * `Sistema → Prontidão do Sistema`. É a versão estruturada e navegável do relatório em
 * `docs/pendencias.md` §"Auditoria de prontidão dos 9 eixos".
 *
 * Por que os dados vivem aqui, em código, e não no banco: a auditoria é um retrato datado,
 * revisado por pessoas, e cada correção conclui com um commit — versioná-la junto do código é
 * o que mantém "achado × status × correção" honesto ao longo do tempo. O status de cada achado
 * é atualizado À MÃO quando a correção entra (com o commit), nunca por rotina automática — um
 * "corrigido" que ninguém verificou seria pior que nenhum status. A parte AO VIVO (ex.: se uma
 * finalidade de IA sensível está saindo da rede agora) é calculada em tempo de request pelo
 * service, não fica congelada aqui.
 */

/** Severidade do achado — mesma escala do relatório. */
export type Severidade = 'critico' | 'alto' | 'medio' | 'baixo';

/** Situação da correção. `corrigido` = feito e coberto por teste nesta base; `mitigado` =
 * defesa parcial no lugar, ainda depende de ação humana; `aberto` = pendente. */
export type StatusAchado = 'corrigido' | 'mitigado' | 'aberto';

export interface EixoProntidao {
  numero: number;
  nome: string;
  /** 1 = ausente · 3 = funciona mas frágil · 5 = melhor prática com verificação automática. */
  maturidade: number;
  resumo: string;
}

export interface AchadoProntidao {
  codigo: string;
  titulo: string;
  severidade: Severidade;
  /** Número do eixo (1..9) a que o achado pertence. */
  eixo: number;
  /** Onde foi comprovado — `arquivo:linha` ou saída de comando. */
  evidencia: string;
  /** Correção proposta (ou aplicada, quando `status !== 'aberto'`). */
  correcao: string;
  status: StatusAchado;
  dono: string;
  prazo?: string;
}

/** Data da auditoria — retrato datado, não "agora". */
export const PRONTIDAO_DATA_AUDITORIA = '2026-08-12';

export const PRONTIDAO_EIXOS: EixoProntidao[] = [
  {
    numero: 1,
    nome: 'Segurança',
    maturidade: 2,
    resumo:
      'Fundamentos bons (Helmet, CSP, RBAC dinâmico, rotação de refresh); dois furos exploráveis já corrigidos (segredo JWT e path traversal).',
  },
  {
    numero: 2,
    nome: 'Governança',
    maturidade: 2,
    resumo:
      'Testes de conformidade e CI bloqueante existem, mas main sem proteção em repositório público, sem trilha de auditoria de IA e decisões sem ADR.',
  },
  {
    numero: 3,
    nome: 'Resiliência',
    maturidade: 2,
    resumo:
      'Recuperação de transcrição e IMAP exemplares; backup nunca restaurado, runbook aponta para infra extinta, faltam timeouts em Oracle/OpenRouter.',
  },
  {
    numero: 4,
    nome: 'Agentes autônomos',
    maturidade: 2,
    resumo:
      'Salvaguardas reais (nada é gravado sozinho, dedup), mas sem kill switch em runtime e telemetria não registra execução real.',
  },
  {
    numero: 5,
    nome: 'Detecção antes do usuário',
    maturidade: 2,
    resumo:
      'Diagnóstico (/api/saude) é bom; o canal de alerta (digest) nunca enviou em produção e 5xx só vai para log.',
  },
  {
    numero: 6,
    nome: 'Alucinações',
    maturidade: 3,
    resumo:
      'Grounding real e a invariante "IA não escreve no documento oficial" confirmada; falta validação pós-geração, teste de regressão e temperatura factual.',
  },
  {
    numero: 7,
    nome: 'Custo por token',
    maturidade: 3,
    resumo:
      'Agora há telemetria de tokens/custo por execução, teto diário que interrompe (opt-in) e custo visível no Monitoramento; falta roteamento por custo (modelo barato para tarefa simples).',
  },
  {
    numero: 8,
    nome: 'Fallback',
    maturidade: 2,
    resumo:
      'docservice e SMTP degradam bem e registram; não há failover entre provedores de IA nem reenvio de e-mail falho.',
  },
  {
    numero: 9,
    nome: 'Observabilidade',
    maturidade: 2,
    resumo:
      'Log persiste e sobrevive a restart, mas é texto sem correlação, o docservice não loga nada e não há métricas técnicas.',
  },
];

export const PRONTIDAO_ACHADOS: AchadoProntidao[] = [
  // ---- Crítico ----
  {
    codigo: 'C1',
    titulo: 'Segredo JWT de desenvolvimento ativo em produção',
    severidade: 'critico',
    eixo: 1,
    evidencia: 'configuration.ts:87,96 — NODE_ENV nunca era production',
    correcao:
      'NODE_ENV=production no boot + ehProducao() trata banco MariaDB como produção; guarda em configuration.spec.ts.',
    status: 'corrigido',
    dono: 'software',
    prazo: 'feito (rotacionar segredos: usuário, 2026-08-19)',
  },
  {
    codigo: 'C2',
    titulo: 'Path traversal na gravação de anexos',
    severidade: 'critico',
    eixo: 1,
    evidencia: 'documentos.service.ts:200 — originalname cru no caminho',
    correcao:
      'nomeArquivoSeguro() sanitiza o nome; teste nome-arquivo-seguro.spec.ts.',
    status: 'corrigido',
    dono: 'software',
    prazo: 'feito',
  },
  {
    codigo: 'CR-1',
    titulo: 'main sem branch protection em repositório público',
    severidade: 'critico',
    eixo: 2,
    evidencia: 'gh api .../branches/main/protection → 404; private:false',
    correcao:
      'Proteger main (status checks + review) e priorizar a migração ao GitLab interno.',
    status: 'aberto',
    dono: 'usuário',
    prazo: '2026-08-26',
  },
  // ---- Alto ----
  {
    codigo: 'A1',
    titulo: 'Transcrição de cliente ia ao OpenRouter, sem trava',
    severidade: 'alto',
    eixo: 1,
    evidencia:
      'ia.constants.ts + config real: protocolos=openrouter; a regra era só comentário',
    correcao:
      'FINALIDADES_SO_LOCAL + trava em IaService.salvar + avisosPrivacidade(); trocar a config de produção para local (usuário).',
    status: 'mitigado',
    dono: 'software + usuário',
    prazo: '2026-08-19',
  },
  {
    codigo: 'A6',
    titulo: 'POST /projetos/:id/email sem guard de permissão',
    severidade: 'alto',
    eixo: 1,
    evidencia: 'projeto-email.controller.ts — só JwtAuthGuard',
    correcao: '@Permissao(carteira, …) adicionado.',
    status: 'corrigido',
    dono: 'software',
    prazo: 'feito',
  },
  {
    codigo: 'A7',
    titulo: 'Ticket de mídia aceito como token de sessão',
    severidade: 'alto',
    eixo: 1,
    evidencia: 'jwt.strategy.ts — escopo não conferido',
    correcao:
      'JwtStrategy rejeita token com escopo; streaming valida o ticket à parte.',
    status: 'corrigido',
    dono: 'software',
    prazo: 'feito',
  },
  {
    codigo: 'A4',
    titulo: 'Uploads sem limite de tamanho (DoS por OOM) em 10 rotas',
    severidade: 'alto',
    eixo: 1,
    evidencia: 'Nenhum FileInterceptor com limits; sem MulterModule',
    correcao:
      'limits.fileSize em todos os 12 interceptores (mídia 2 GB, doc 25 MB); MulterError vira 413.',
    status: 'corrigido',
    dono: 'software',
    prazo: 'feito',
  },
  {
    codigo: 'A5',
    titulo: 'Auto-cadastro público cria conta com acesso a dado de cliente',
    severidade: 'alto',
    eixo: 1,
    evidencia: 'cadastro.controller.ts:34,69 — sem domínio corporativo',
    correcao: 'Allowlist de domínio + aprovação, ou desativar o auto-cadastro.',
    status: 'aberto',
    dono: 'usuário + software',
    prazo: '2026-08-26',
  },
  {
    codigo: 'A8',
    titulo: 'ADM/Coordenador leem toda transcrição de todo cliente',
    severidade: 'alto',
    eixo: 1,
    evidencia: 'protocolos.acesso.ts:31-35',
    correcao: 'Decidir se a aprovação exige leitura integral ou só metadados.',
    status: 'aberto',
    dono: 'usuário + software',
    prazo: '2026-09-02',
  },
  {
    codigo: 'A9',
    titulo: 'Custo de IA invisível e ilimitado',
    severidade: 'alto',
    eixo: 7,
    evidencia: 'ia.service.ts:326-329,388-391 — usage descartado; sem teto',
    correcao:
      'Módulo ia-telemetria: capta o usage → tokens/custo por execução; teto diário que interrompe (MIGRACAO_IA_TETO_DIARIO_USD); custo visível no Monitoramento.',
    status: 'corrigido',
    dono: 'software',
    prazo: 'feito',
  },
  {
    codigo: 'A10',
    titulo: 'Sem trilha de auditoria de IA',
    severidade: 'alto',
    eixo: 2,
    evidencia:
      'levantamento.controller.ts:114 — sem @CurrentUser; nada persistido',
    correcao:
      'Tabela execucoes_ia grava cada chamada (quem, quando, finalidade, provedor, modelo, tokens, custo, status); @CurrentUser adicionado no levantamento/dicionário. Metadados apenas (LGPD).',
    status: 'corrigido',
    dono: 'software',
    prazo: '2026-09-09',
  },
  {
    codigo: 'A11',
    titulo: 'Canal de alerta (digest) nunca funcionou em produção',
    severidade: 'alto',
    eixo: 5,
    evidencia: '0 envios em 7,5 MB de log; MIGRACAO_DIGEST_PARA não definida',
    correcao:
      'Software: o digest agora LOGA (1×/dia) que não enviou por falta de destinatário. Falta: definir MIGRACAO_DIGEST_PARA (usuário).',
    status: 'mitigado',
    dono: 'usuário + software',
    prazo: '2026-08-19',
  },
  {
    codigo: 'A12',
    titulo: '5xx e falhas só vão para o log, sem notificação',
    severidade: 'alto',
    eixo: 5,
    evidencia: 'http-exception.filter.ts:63-68',
    correcao:
      'Contador de 5xx (24h) alimentado pelo filtro e exposto como checagem no /api/saude (sai no digest).',
    status: 'corrigido',
    dono: 'software',
    prazo: 'feito',
  },
  {
    codigo: 'A13',
    titulo: 'E-mail de passo sem fila, sem retry, sem reenvio',
    severidade: 'alto',
    eixo: 8,
    evidencia: 'passos.service.ts:551 (void); sem endpoint de reenvio',
    correcao:
      'Endpoint de reenvio a partir de emails_passo, ou fila persistida.',
    status: 'aberto',
    dono: 'software',
    prazo: '2026-09-09',
  },
  {
    codigo: 'A14',
    titulo: 'Oracle e OpenRouter sem timeout',
    severidade: 'alto',
    eixo: 3,
    evidencia: 'disponibilidade.service.ts:217; ia.service.ts:299-301',
    correcao:
      'callTimeout na conexão Oracle e timeout de 2 min no OpenRouter/Anthropic (catálogo 10s).',
    status: 'corrigido',
    dono: 'software',
    prazo: 'feito',
  },
  {
    codigo: 'A15',
    titulo: 'Sem validação pós-geração da saída de IA',
    severidade: 'alto',
    eixo: 6,
    evidencia: 'protocolo-ia.service.ts:314-328,363 — só enum de módulo',
    correcao: 'Conferir o código de menu contra o dicionário antes de gravar.',
    status: 'aberto',
    dono: 'software',
    prazo: '2026-09-09',
  },
  {
    codigo: 'A16',
    titulo: 'docservice sem log',
    severidade: 'alto',
    eixo: 9,
    evidencia: 'docservice/iniciar.bat:10 — uvicorn sem redirecionamento',
    correcao:
      'iniciar.bat passou a gravar em C:\\PainelBackups\\docservice_stdout.log.',
    status: 'corrigido',
    dono: 'software',
    prazo: 'feito',
  },
  {
    codigo: 'A17',
    titulo:
      'Backup nunca restaurado + runbook aponta para Postgres/Docker extinto',
    severidade: 'alto',
    eixo: 3,
    evidencia:
      'PLANO_DE_BACKUP_E_RECUPERACAO.md:43; runbooks-operacao.md:124-128',
    correcao:
      'Restore cronometrado num banco descartável, corrigir o runbook, cópia off-site.',
    status: 'aberto',
    dono: 'usuário + software',
    prazo: '2026-08-26',
  },
  {
    codigo: 'A18',
    titulo:
      'Guarda do ADR-0002 não trava os 43 services que injetam Repository<T>',
    severidade: 'alto',
    eixo: 2,
    evidencia: 'conformidade-arquitetura.spec.ts — sem asserção sobre Services',
    correcao: 'Apertar a catraca por módulo já portado.',
    status: 'aberto',
    dono: 'software',
    prazo: '2026-09-16',
  },
  {
    codigo: 'A19',
    titulo: 'Suíte e2e/Playwright fora do CI',
    severidade: 'alto',
    eixo: 2,
    evidencia: 'ci.yml não referencia e2e/',
    correcao: 'Job de CI (self-hosted ou instância efêmera).',
    status: 'aberto',
    dono: 'software',
    prazo: '2026-09-16',
  },
  // ---- Médio (seleção) ----
  {
    codigo: 'M1',
    titulo: 'Swagger /api/docs público',
    severidade: 'medio',
    eixo: 1,
    evidencia: 'main.ts:111-120',
    correcao: 'Swagger sobe só fora de produção (mesmo sinal do C1).',
    status: 'corrigido',
    dono: 'software',
    prazo: 'feito',
  },
  {
    codigo: 'M2',
    titulo: '12 rotas de escrita atrás de permissão de consulta',
    severidade: 'medio',
    eixo: 1,
    evidencia: 'passos.controller.ts:77 (concluir) e outras',
    correcao: 'Exigir nível de alteração nas rotas de escrita.',
    status: 'aberto',
    dono: 'software',
    prazo: '2026-09-09',
  },
  {
    codigo: 'M3',
    titulo: 'POST /fluxo/inbox sem @Permissao (lê a caixa IMAP)',
    severidade: 'medio',
    eixo: 1,
    evidencia: 'fluxo.controller.ts:67',
    correcao: "@Permissao('novo_cliente','alteracao') como na rota irmã criar.",
    status: 'corrigido',
    dono: 'software',
    prazo: 'feito',
  },
  {
    codigo: 'M5',
    titulo: 'Credenciais em claro em backend/dados/',
    severidade: 'medio',
    eixo: 1,
    evidencia: 'ia_config.json, mariadb.env, smtp.json, imap.json, CSV',
    correcao: 'Proteger por ACL, considerar cifra.',
    status: 'aberto',
    dono: 'usuário + software',
    prazo: '2026-09-02',
  },
  {
    codigo: 'M6',
    titulo: 'Detecção de ausência só para backup (robôs sem heartbeat)',
    severidade: 'medio',
    eixo: 5,
    evidencia: 'saude.service.ts — sem heartbeat de digest/robôs',
    correcao: 'Heartbeat de última execução por robô.',
    status: 'aberto',
    dono: 'software',
    prazo: '2026-09-09',
  },
  {
    codigo: 'M7',
    titulo: 'Log de integridade ilegível (UTF-16 por Out-File sem -Encoding)',
    severidade: 'medio',
    eixo: 9,
    evidencia: 'Verificar_Integridade_Novo.ps1:49',
    correcao:
      'npm test capturado e anexado em UTF-8 sem BOM (mesmo helper do resto do script).',
    status: 'corrigido',
    dono: 'software',
    prazo: 'feito',
  },
  {
    codigo: 'M9',
    titulo: 'Sem correlation-id ponta a ponta',
    severidade: 'medio',
    eixo: 9,
    evidencia: 'busca no repo = 0; só response.interceptor.ts',
    correcao:
      'Middleware de correlation-id no log e propagado ao docservice/IA.',
    status: 'aberto',
    dono: 'software',
    prazo: '2026-09-16',
  },
  {
    codigo: 'M11',
    titulo: 'Sem detecção de reuso de refresh token',
    severidade: 'medio',
    eixo: 1,
    evidencia: 'auth.service.ts:71-76',
    correcao: 'Revogar a família de tokens do usuário no replay.',
    status: 'aberto',
    dono: 'software',
    prazo: '2026-09-16',
  },
];
