import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Quem criou o cartão. `cliente` só existe se a criação pelo cliente for liberada — hoje
 * não é (decisão 1 do §8 do desenho), e o valor fica reservado para quando for. */
export type OrigemCartao = 'consultor' | 'cliente';

/** Cartão do quadro — a unidade de trabalho do módulo.
 *
 * **`visivelCliente` nasce `false` e essa é a decisão central do módulo.** Compartilhar com
 * o cliente é ato explícito, registrado em `atividade_eventos`. O filtro mora no
 * REPOSITÓRIO: uma resposta para papel `Cliente` nunca carrega cartão interno, nem para ser
 * escondido no navegador.
 *
 * `quadroId` é desnormalizado (deriva de `lista_id → listas.quadro_id`) de propósito: o
 * recorte por cliente e a busca geral filtram por quadro, e sem esta coluna toda leitura
 * pagaria um JOIN só para descobrir de quem é o cartão. */
@Entity({ name: 'atividade_cartoes' })
@Index(['listaId', 'ordem'])
@Index(['quadroId', 'visivelCliente'])
export class AtividadeCartao {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'lista_id' })
  listaId: number;

  @Index()
  @Column({ name: 'quadro_id' })
  quadroId: number;

  @Column({ length: 200 })
  titulo: string;

  @Column({ type: 'text', default: '' })
  descricao: string;

  /** Ver o comentário de `AtividadeLista.ordem`. */
  @Column({ type: 'double', default: 0 })
  ordem: number;

  @Column({ name: 'visivel_cliente', type: 'boolean', default: false })
  visivelCliente: boolean;

  // type: 'varchar' explícito — union de string precisa do tipo declarado, senão o TypeORM
  // não infere a coluna (mesmo motivo de `Projeto.etapa`).
  @Column({ type: 'varchar', length: 20, default: 'consultor' })
  origem: OrigemCartao;

  /** Etiquetas como lista de CHAVES separadas por vírgula (`'conv,fisc'`), do catálogo fixo
   * em `controle-atividades.constants.ts`. Catálogo fixo em vez de tabela: são cinco
   * etiquetas do processo de implantação, iguais em todo quadro — uma tabela e uma tela de
   * cadastro para isso seria custo sem retorno. Vira tabela no dia em que o usuário pedir
   * etiqueta por cliente. */
  @Column({ type: 'varchar', length: 200, default: '' })
  etiquetas: string;

  /** Data (YYYY-MM-DD) como TEXTO, no mesmo idioma de `Projeto.dataInicio` e companhia: as
   * datas do Painel são digitadas e exibidas, nunca calculadas em fuso. */
  @Column({ length: 20, default: '' })
  prazo: string;

  @Column({ name: 'concluido_em', type: 'datetime', nullable: true })
  concluidoEm: Date | null;

  @Column({ name: 'projeto_id', type: 'int', nullable: true })
  projetoId: number | null;

  @Column({ name: 'criado_por_usuario_id', type: 'int', nullable: true })
  criadoPorUsuarioId: number | null;

  @Column({ name: 'criado_por_nome', length: 160, default: '' })
  criadoPorNome: string;

  @Column({ type: 'boolean', default: false })
  arquivado: boolean;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;
}
