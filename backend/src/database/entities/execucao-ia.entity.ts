import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type StatusExecucaoIa = 'ok' | 'erro';

/**
 * Registro de UMA chamada real de IA do produto (não confundir com `AgenteExecucao`, que é a
 * telemetria dos agentes de desenvolvimento do Claude Code). Achados A9 (custo por token) e A10
 * (trilha de auditoria de IA) da auditoria de 2026-08-12: antes, o `usage` do provedor era
 * descartado e nenhum registro dizia quem disparou, quando, com qual provedor/modelo e a que
 * custo. Agora TODA chamada de `IaService.completar` grava uma linha aqui.
 *
 * LGPD: guarda METADADOS (finalidade, provedor, modelo, tokens, custo, quem/quando), NUNCA o
 * conteúdo do prompt nem da resposta — a transcrição de cliente não é copiada para cá. O
 * `contexto` é um rótulo curto (ex.: "protocolo: reuniao.mp4"), não o texto enviado.
 */
@Entity({ name: 'execucoes_ia' })
export class ExecucaoIa {
  @PrimaryGeneratedColumn()
  id: number;

  /** protocolos | dicionario | levantamento. */
  @Index()
  @Column({ length: 20 })
  finalidade: string;

  /** anthropic | openrouter | local. */
  @Column({ length: 20 })
  provider: string;

  @Column({ length: 120, default: '' })
  modelo: string;

  /** Quem disparou (nome do usuário). `null` = robô/sistema (ex.: robô de protocolos). */
  @Column({ type: 'varchar', length: 120, nullable: true })
  solicitante: string | null;

  /** Rótulo curto de contexto — NUNCA o conteúdo do prompt. */
  @Column({ length: 160, default: '' })
  contexto: string;

  // type: 'int' explícito + `number | null`: com a propriedade anulável, o design:type
  // refletido vira "Object" e o TypeORM não infere a coluna sozinho (mesma nota das outras
  // entidades). `null` quando o provedor não devolveu `usage` (alguns servidores locais).
  @Column({ name: 'tokens_entrada', type: 'int', nullable: true })
  tokensEntrada: number | null;

  @Column({ name: 'tokens_saida', type: 'int', nullable: true })
  tokensSaida: number | null;

  /** Custo ESTIMADO em USD (tabela de preços por modelo). `float` de propósito: é aproximação
   * para acompanhamento, não contabilidade — e `SUM(float)` volta como número, não string
   * (o `decimal` do TypeORM voltaria string e complicaria a agregação). `null` quando o modelo
   * não tem preço conhecido; `0` no provedor local (auto-hospedado). */
  @Column({ name: 'custo_usd', type: 'float', nullable: true })
  custoUsd: number | null;

  @Column({ name: 'duracao_ms', type: 'int', default: 0 })
  duracaoMs: number;

  @Column({ type: 'varchar', length: 10, default: 'ok' })
  status: StatusExecucaoIa;

  @Column({ type: 'varchar', length: 400, nullable: true })
  erro: string | null;

  @Index()
  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
