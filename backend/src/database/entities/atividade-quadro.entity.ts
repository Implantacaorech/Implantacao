import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Quadro de atividades de UM cliente (docs/controle-atividades.md §2.1).
 *
 * A chave do quadro é o **código do cliente no SICLA** (`SICLA.LISTA_CLIENTES.CODIGO`), a
 * mesma de `usuarios.codigo_cliente_sicla`. Não é o `projeto_id`: `projetos` guarda o nome
 * do cliente como TEXTO e não o código, então um quadro por projeto deixaria o recorte do
 * usuário-cliente sem chave comum — e um cliente com dois projetos teria dois quadros, o
 * oposto de "sequenciado por cliente".
 *
 * `projetoId` é o vínculo OPCIONAL com uma implantação: serve para sugerir responsáveis a
 * partir de `projeto_pessoas` e para amarrar o quadro a um projeto quando faz sentido. */
@Entity({ name: 'atividade_quadros' })
export class AtividadeQuadro {
  @PrimaryGeneratedColumn()
  id: number;

  /** Código do cliente no SICLA. Texto, e não inteiro, pelo mesmo motivo de
   * `usuarios.codigo_cliente_sicla`: é código de sistema externo e o SICLA manda no formato. */
  @Index({ unique: true })
  @Column({ name: 'codigo_cliente_sicla', length: 40 })
  codigoClienteSicla: string;

  /** Nome do cliente como veio do SICLA na abertura do quadro. É RÓTULO — quem identifica é
   * o código acima. Guardado para a tela não depender do Oracle só para listar quadros. */
  @Column({ name: 'nome_cliente', length: 200, default: '' })
  nomeCliente: string;

  @Index()
  @Column({ name: 'projeto_id', type: 'int', nullable: true })
  projetoId: number | null;

  @Column({ type: 'boolean', default: false })
  arquivado: boolean;

  @Column({ name: 'criado_por_usuario_id', type: 'int', nullable: true })
  criadoPorUsuarioId: number | null;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;
}
