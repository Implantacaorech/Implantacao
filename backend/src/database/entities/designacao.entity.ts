import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Consultor responsável por um módulo do projeto, ordem de treinamento (usada na
 * distribuição automática) e flags de sobreposição. Espelha webapp/db.py:Designacao. */
@Entity({ name: 'designacoes' })
export class Designacao {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  @Column({ length: 80, default: '' })
  modulo: string;

  @Column({ length: 160, default: '' })
  consultor: string;

  // 0 para todos os módulos = distribuição cai na ordem alfabética.
  @Column({ default: 0 })
  ordem: number;

  @Column({ name: 'nao_distribuir', default: false })
  naoDistribuir: boolean;

  // "" = usa o analista padrão do projeto (CronogramaConfig.analistaPadrao).
  @Column({ length: 160, default: '' })
  analista: string;
}
