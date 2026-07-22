import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Tipo da RNS registrada no projeto. `RNI` é a RNS de Implantação; as demais são o par
 * ORC → COB de conversões e desenvolvimentos. */
export type TipoRns = 'RNI' | 'COB' | 'Conversão';

/** RNS vinculada ao projeto (passo 7 do processo).
 *
 * É tabela, e não colunas no projeto, porque a QUANTIDADE é variável: o Administrativo
 * acrescenta quantos registros o cliente exigir. Não há número fixo de RNS por implantação. */
@Entity({ name: 'projeto_rns' })
@Index(['projetoId', 'tipo'])
export class ProjetoRns {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoRns;

  @Column({ length: 40, default: '' })
  numero: string;

  @Column({ type: 'text', default: '' })
  descricao: string;

  @Column({ length: 60, default: '' })
  situacao: string;

  @Column({
    name: 'criado_em',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  criadoEm: Date;
}
