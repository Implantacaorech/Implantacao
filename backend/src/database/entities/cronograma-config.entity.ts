import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ModoDisponibilidade = 'conjunta' | 'individual';

/** Configuração da distribuição automática por projeto (uma linha por projeto). Espelha
 * webapp/db.py:CronogramaConfig. */
@Entity({ name: 'cronograma_config' })
export class CronogramaConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ name: 'projeto_id' })
  projetoId: number;

  // "conjunta" (em grupo — bloqueia o turno se QUALQUER técnico envolvido estiver ocupado)
  // ou "individual" (cada técnico só olha a própria agenda).
  @Column({
    type: 'varchar',
    name: 'modo_disponibilidade',
    length: 20,
    default: 'conjunta',
  })
  modoDisponibilidade: ModoDisponibilidade;

  // "AAAA-MM-DD"; "" = começa hoje.
  @Column({ name: 'data_inicio', length: 10, default: '' })
  dataInicio: string;

  // "0-manha,2-tarde" (seg=0..sex=4); "" = considera todos os dias úteis, manhã e tarde.
  @Column({ name: 'dias_turnos_excluidos', length: 200, default: '' })
  diasTurnosExcluidos: string;

  // Analista responsável do cliente (texto livre); cada módulo pode sobrepor em Designacao.analista.
  @Column({ name: 'analista_padrao', length: 160, default: '' })
  analistaPadrao: string;
}
