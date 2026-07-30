import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** Conclusão de um dos 21 passos operacionais em um projeto.
 *
 * Só existe linha para passo CONCLUÍDO — a ausência é o "pendente". A partir do passo 14 a
 * conclusão é IRREVERSÍVEL (ver `DefinicaoPasso.irreversivel`): a linha não pode ser
 * apagada, e é isso que impede reabrir uma etapa já formalizada com o cliente.
 *
 * `conferido` atende os passos 11 e 19, em que o Administrativo precisa marcar que conferiu
 * o documento (validado com GCI ou Coordenador) antes de liberar o passo seguinte. */
@Entity({ name: 'projeto_passos' })
@Unique(['projetoId', 'passo'])
export class ProjetoPasso {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  /** Número do passo (1 a 21) — ver `PASSOS` em passos.constants.ts. */
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

  /** Marcação que o passo cobra antes de fechar — "contrato assinado" (passo 7) e "projeto
   * assinado" (passo 12). Genérico de propósito: é a mesma pergunta feita duas vezes, e um
   * par de colunas por passo faria a tabela crescer a cada revisão do processo. Ver
   * `PASSOS_COM_MARCACAO`. */
  @Column({ default: false })
  marcado: boolean;

  /** Data da assinatura informada junto com `marcado`. ISO `aaaa-mm-dd`, string como todas
   * as datas do Painel — comparação e exibição já assumem esse formato. */
  @Column({ name: 'data_marcada', length: 10, default: '' })
  dataMarcada: string;

  /** Texto que a pessoa escreveu ao concluir. No passo 5 é a descrição da negociação, que o
   * e-mail do passo seguinte carrega no corpo ({{DESCRICAO_PASSO}}). */
  @Column({ type: 'text', default: '' })
  observacao: string;
}
