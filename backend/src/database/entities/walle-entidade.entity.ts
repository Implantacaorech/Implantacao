import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Tipos de entidade que o indexador reconhece nos documentos do acervo Wall-e. */
export type TipoWalleEntidade =
  | 'rns'
  | 'ficha'
  | 'tabela'
  | 'repositorio'
  | 'programa'
  | 'tecnologia'
  | 'erro'
  | 'cliente';

/** Uma entidade citada em um arquivo do acervo Wall-e (RNS 563996-1, Ficha 324397, tabela
 * FILA_WALLE, repo ri-walle, erro ORA-01400…), extraída por regex/dicionário na indexação.
 *
 * É o que liga a busca por identificador ("853") ao documento certo e o que sustenta o
 * relacionamento entre chats (§14 da especificação: mesmo RNS/tabela/repo ⇒ chats
 * relacionados). Dado 100% derivado — recriado a cada sincronização do arquivo. */
@Entity({ name: 'walle_entidades' })
@Index(['arquivoId', 'tipo', 'valor'], { unique: true })
export class WalleEntidade {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'arquivo_id' })
  arquivoId: number;

  @Index()
  @Column({ name: 'chat_codigo' })
  chatCodigo: number;

  @Index()
  @Column({ length: 20 })
  tipo: TipoWalleEntidade;

  /** Valor normalizado (maiúsculas para tabela/erro, minúsculas para repo/tecnologia). */
  @Index()
  @Column({ length: 200 })
  valor: string;
}
