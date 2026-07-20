import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type StatusAgenteExecucao = 'em_execucao' | 'concluido' | 'falhou';

export const STATUS_AGENTE_EXECUCAO: StatusAgenteExecucao[] = [
  'em_execucao',
  'concluido',
  'falhou',
];

/** Registro de uma execução real de agente/subagente do Claude Code (ver `.claude/agents/`)
 * — telemetria de verdade, criada pelo próprio agente ao iniciar/concluir uma tarefa via
 * `POST /api/agentes/execucoes` + `PATCH /api/agentes/execucoes/:id`. Não é simulação: só
 * existe uma linha aqui quando um agente de fato chamou a API. Alimenta o painel "Agentes de
 * IA" em Monitoramento Operacional. */
@Entity({ name: 'agente_execucoes' })
export class AgenteExecucao {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ length: 60 })
  agente: string;

  // Se este agente foi acionado por outro (ex.: qualidade chamado por painel-core) —
  // hierarquia pai/filho para o grafo. Sem FK real, mesmo padrão do resto do schema.
  // type: 'int' explícito — com a propriedade `number | null`, o design:type refletido
  // vira "Object" e o TypeORM não infere a coluna sozinho (mesma causa-raiz documentada em
  // usuario.entity.ts para `import type`).
  @Index()
  @Column({ name: 'agente_pai_id', type: 'int', nullable: true })
  agentePaiId: number | null;

  @Column({ length: 255, default: '' })
  tarefa: string;

  @Column({ type: 'varchar', length: 20, default: 'em_execucao' })
  status: StatusAgenteExecucao;

  @Column({ type: 'text', nullable: true })
  resultado: string | null;

  @CreateDateColumn({ name: 'iniciado_em' })
  iniciadoEm: Date;

  // Sem `type` explícito de propósito (mesmo motivo de protocolo.entity.ts:processadoEm) —
  // precisa ser exatamente `Date` (não `Date | null`) pro TypeORM inferir certo por driver;
  // `nullable: true` já permite gravar/ler null mesmo assim.
  @Column({ name: 'concluido_em', nullable: true })
  concluidoEm: Date;
}
