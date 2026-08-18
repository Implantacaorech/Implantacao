import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Um chat direto com o bot Wall-e (técnico 900 do SICLA), visto pelo Painel.
 *
 * A linha nasce da INDEXAÇÃO do acervo documental (`R:\GRM\CHAT_WALLE\<codigo>\` — fonte
 * somente leitura, ver walle/docs/regras-negocio.md) e, quando a conexão SICLA estiver
 * disponível, é ENRIQUECIDA com os metadados da tabela Oracle `SICLA.CHAT_WALLE`
 * (descrição/técnico/sistema). `origemMetadados` diz de onde veio o que está gravado:
 * `acervo` = só o que dá para deduzir das pastas; `oracle` = enriquecido pela Fonte B. */
@Entity({ name: 'walle_chats' })
export class WalleChat {
  @PrimaryGeneratedColumn()
  id: number;

  /** Código do chat no SICLA — é o nome da subpasta no acervo (ex.: 42). */
  @Index({ unique: true })
  @Column()
  codigo: number;

  @Column({ length: 256, default: '' })
  descricao: string;

  @Column({ length: 120, default: '' })
  tecnico: string;

  @Column({ length: 120, default: '' })
  sistema: string;

  @Column({ name: 'origem_metadados', length: 10, default: 'acervo' })
  origemMetadados: 'acervo' | 'oracle';

  @Column({ name: 'total_arquivos', default: 0 })
  totalArquivos: number;

  /** Última modificação entre os arquivos do chat — ordena os cards por atividade. */
  @Column({ name: 'ultimo_arquivo_em', type: 'datetime', nullable: true })
  ultimoArquivoEm: Date | null;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;
}
