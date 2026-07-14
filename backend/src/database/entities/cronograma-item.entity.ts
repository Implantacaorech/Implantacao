import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type StatusCronogramaItem = 'Previsto' | 'Agendado' | 'Concluído' | 'Cancelado';

export const CRONO_STATUS: StatusCronogramaItem[] = ['Previsto', 'Agendado', 'Concluído', 'Cancelado'];

/** Linha EDITÁVEL do documento Cronograma, rastreada durante a implantação (status por
 * linha) — NÃO confundir com `AtividadeCronograma`/`SlotCronograma` (o motor de
 * AGENDAMENTO de visitas técnicas do Agendador, item 1, em `backend/src/cronograma/*`).
 * Esta entidade espelha webapp/db.py:CronogramaItem — as linhas do plano de
 * implantação (etapa/tópicos/horas/data/modalidade), editáveis manualmente após a
 * geração do documento. Vive em `plano-cronograma/` de propósito, para não colidir com
 * o módulo `cronograma/` já existente. */
@Entity({ name: 'cronograma_itens' })
export class CronogramaItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  @Column({ default: 0 })
  ordem: number;

  @Column({ type: 'text', default: '' })
  etapa: string;

  @Column({ type: 'text', default: '' })
  topicos: string;

  @Column({ length: 20, default: '' })
  horas: string;

  // "DD/MM/AAAA" (texto livre, igual ao Flask original) — não é a mesma convenção
  // "AAAA-MM-DD" usada pelas datas do Projeto/Agendador.
  @Column({ length: 20, default: '' })
  data: string;

  @Column({ length: 40, default: '' })
  modalidade: string;

  @Column({ type: 'varchar', length: 30, default: 'Previsto' })
  status: StatusCronogramaItem;
}
