import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** Conclusão de um dos 18 passos operacionais em um projeto.
 *
 * Só existe linha para passo CONCLUÍDO — a ausência é o "pendente". A partir do passo 11 a
 * conclusão é IRREVERSÍVEL (ver `DefinicaoPasso.irreversivel`): a linha não pode ser
 * apagada, e é isso que impede reabrir uma etapa já formalizada com o cliente.
 *
 * `conferido` atende os passos 9 e 16, em que o Administrativo precisa marcar que conferiu
 * o documento (validado com GCI ou Coordenador) antes de liberar o passo seguinte. */
@Entity({ name: 'projeto_passos' })
@Unique(['projetoId', 'passo'])
export class ProjetoPasso {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  /** Número do passo (1 a 18) — ver `PASSOS` em passos.constants.ts. */
  @Column()
  passo: number;

  @Column({
    name: 'concluido_em',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  concluidoEm: Date;

  @Column({ name: 'concluido_por', length: 160, default: '' })
  concluidoPor: string;

  @Column({ default: false })
  conferido: boolean;

  @Column({ type: 'text', default: '' })
  observacao: string;
}
