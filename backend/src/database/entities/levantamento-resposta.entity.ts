import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Uma linha do questionário do Levantamento (semeada do Índice de Tópicos dos módulos
 * contratados) com a resposta digitada pelo consultor. Espelha
 * webapp/db.py:LevantamentoResposta. */
@Entity({ name: 'levantamento_respostas' })
export class LevantamentoResposta {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  @Column({ default: 0 })
  ordem: number;

  @Column({ name: 'modulo_sigla', length: 10, default: '' })
  moduloSigla: string;

  @Column({ length: 120, default: '' })
  modulo: string;

  @Column({ length: 120, default: '' })
  adicional: string;

  @Column({ type: 'text', default: '' })
  topico: string;

  @Column({ type: 'text', default: '' })
  resposta: string;

  /** "Não será utilizado." — marcado ao lado da pergunta quando o cliente não usa aquela
   * funcionalidade. Com a flag ligada a `resposta` é sempre TEXTO_NAO_UTILIZADO (o backend
   * força, não confia na tela) e o campo fica bloqueado para digitação. */
  @Column({ name: 'nao_utilizado', default: false })
  naoUtilizado: boolean;

  /** Concorrência otimista da edição a várias mãos (dois técnicos na mesma tela, cada um no
   * seu computador). Toda gravação da linha incrementa; o cliente devolve a versão que tinha
   * em tela e o backend recusa (409) se já mudou, em vez de sobrescrever o colega. */
  @Column({ default: 0 })
  versao: number;

  @Column({ name: 'atualizado_por', length: 120, default: '' })
  atualizadoPor: string;

  /** Marca d'água da última gravação — é o `desde` do polling de sincronização (só as linhas
   * que mudaram trafegam a cada tique). */
  @Column({ name: 'atualizado_em', nullable: true })
  atualizadoEm: Date;
}
