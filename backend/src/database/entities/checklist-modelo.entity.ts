import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Catálogo de referência (roteiro/check-list por módulo) — fonte da agrupação em Visitas
 * (campo `seq`) usada pelo Agendador de Visitas. Espelha webapp/db.py:ChecklistModelo.
 * Populado por seed a partir de tools/data/checklist_modulos.yaml (dado local, fora do
 * git — ver seed-checklist.ts). CRUD completo (Cadastros → Check List) é pendência do
 * item 6 da migração; aqui só é consumido para leitura. */
@Entity({ name: 'checklist_modelo' })
export class ChecklistModelo {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ default: 0 })
  ordem: number;

  @Column({ length: 40, default: '' })
  modulo: string;

  @Column({ length: 40, default: '' })
  adicional: string;

  @Column({ length: 60, default: '' })
  tipo: string;

  @Column({ type: 'text', default: '' })
  integracoes: string;

  @Column({ length: 20, default: '' })
  golive: string;

  @Column({ length: 60, default: '' })
  menu: string;

  @Column({ type: 'text', default: '' })
  item: string;

  @Column({ type: 'text', default: '' })
  acao: string;

  @Column({ length: 20, default: '' })
  seq: string;
}
