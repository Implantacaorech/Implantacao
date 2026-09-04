import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Coluna do quadro. A coluna é do FLUXO, não da audiência: arrastar um cartão de "A fazer"
 * para "Em andamento" não muda quem o vê (docs/controle-atividades.md §2.2).
 *
 * `visivelCliente` existe só para a coluna de BASTIDOR ("Bastidor Rech"): uma coluna interna
 * não aparece para o cliente, nem vazia. Nasce `false` pelo mesmo motivo do cartão — o
 * default seguro é não mostrar. */
@Entity({ name: 'atividade_listas' })
@Index(['quadroId', 'ordem'])
export class AtividadeLista {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'quadro_id' })
  quadroId: number;

  @Column({ length: 80 })
  titulo: string;

  /** Ordem por PONTO MÉDIO — ver `ordem.util.ts`. `double` (e não decimal) porque o driver
   * do MariaDB devolve DECIMAL como string, e a conta do ponto médio precisa de número. */
  @Column({ type: 'double', default: 0 })
  ordem: number;

  @Column({ name: 'visivel_cliente', type: 'boolean', default: false })
  visivelCliente: boolean;

  @Column({ type: 'boolean', default: false })
  arquivada: boolean;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
