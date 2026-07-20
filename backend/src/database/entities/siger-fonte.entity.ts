import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Um arquivo do código-fonte do SIGER® (origem: F:\Fontes, servidor
 * \\VC-FONTES-VS22\DRIVE-F) indexado pela ferramenta de auditoria externa
 * (repo BaseConhecimentoSiger). `conteudo` só é preenchido para arquivos que a conta de
 * indexação conseguiu de fato ler — hoje uma fração pequena do total por restrição de ACL
 * do servidor (ver `status` em base-conhecimento.service.ts). Alimenta a busca textual da
 * tela "Base SIGER". */
@Entity({ name: 'siger_fontes' })
export class SigerFonte {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 500 })
  caminho: string;

  @Index()
  @Column({ length: 20 })
  extensao: string;

  @Index()
  @Column({ name: 'pasta_raiz', length: 255 })
  pastaRaiz: string;

  @Column({ name: 'tamanho_bytes' })
  tamanhoBytes: number;

  @Column({ name: 'modificado_em' })
  modificadoEm: Date;

  @Column({ name: 'hash_sha256', length: 64 })
  hashSha256: string;

  // 'text' (não 'longtext') de propósito — mesmo padrão de doc-conteudo.entity.ts, e
  // portável para o better-sqlite3 usado em dev/testes (que não conhece 'longtext'). O
  // exportador do BaseConhecimentoSiger trunca o conteúdo pro limite de TEXT do MariaDB
  // (64KB) antes de gerar a exportação — ver dado truncado sinalizado no relatório de lá.
  @Column({ type: 'text', nullable: true })
  conteudo: string | null;

  @CreateDateColumn({ name: 'indexado_em' })
  indexadoEm: Date;
}
