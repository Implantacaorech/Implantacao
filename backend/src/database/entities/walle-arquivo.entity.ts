import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Categorias reconhecidas pela classificação automática do indexador (heurística sobre o
 * conteúdo/extensão — ver `IndexacaoWalleService.classificar`). `outro` é o fallback. */
export type CategoriaWalleArquivo =
  | 'analise'
  | 'investigacao'
  | 'causa-raiz'
  | 'sql'
  | 'log'
  | 'planejamento'
  | 'estatistica'
  | 'proposta'
  | 'imagem'
  | 'outro';

/** Produzido pelo Wall-e, recebido como insumo, ou não foi possível determinar — a distinção
 * evita tratar um log recebido como se fosse conclusão do bot (§38 da especificação). */
export type OrigemWalleArquivo = 'produzido' | 'insumo' | 'indeterminado';

/** Um arquivo do acervo documental dos chats do Wall-e, INDEXADO no banco do Painel.
 *
 * A fonte (`R:\GRM\CHAT_WALLE\`) é oficial e SOMENTE LEITURA — esta tabela é o derivado
 * pesquisável: texto extraído, título, resumo, assuntos e classificação. O controle
 * incremental é por `hashConteudo` + `modificadoEm`; arquivo que sumiu da fonte não é
 * apagado daqui — vira `removido = true` (a tela avisa e o card sai da busca).
 *
 * ⚠️ `conteudo` no MariaDB é **LONGTEXT** (ver migration Walle) — `type: 'text'` aqui é o
 * que o SQLite de dev/teste entende; como `synchronize` é FALSE no MariaDB, o tipo alargado
 * pela migration prevalece (mesmo desenho do `dicionario_documentos.conteudo`). */
@Entity({ name: 'walle_arquivos' })
export class WalleArquivo {
  @PrimaryGeneratedColumn()
  id: number;

  /** Caminho relativo à raiz do acervo, com `/` (ex.: `42/robo-integracao-whatsapp.md`). */
  @Index({ unique: true })
  @Column({ name: 'caminho_relativo', length: 400 })
  caminhoRelativo: string;

  @Index()
  @Column({ name: 'chat_codigo' })
  chatCodigo: number;

  @Column({ length: 255 })
  nome: string;

  /** Extensão minúscula sem ponto (`md`, `sql`, `log`, `jpg`). */
  @Column({ length: 16, default: '' })
  extensao: string;

  @Index()
  @Column({ length: 30, default: 'outro' })
  categoria: CategoriaWalleArquivo;

  @Column({ length: 15, default: 'indeterminado' })
  origem: OrigemWalleArquivo;

  /** Título extraído (1º `# H1` do markdown, 1º comentário do SQL) ou o nome do arquivo. */
  @Column({ length: 300, default: '' })
  titulo: string;

  /** Primeiro parágrafo útil do documento — alimenta o card de resultado. */
  @Column({ type: 'text', default: '' })
  resumo: string;

  /** Texto integral extraído (vazio para binário/imagem). LONGTEXT no MariaDB. */
  @Column({ type: 'text', default: '' })
  conteudo: string;

  /** Assuntos detectados, separados por espaço — índice de busca, molde do
   * `dicionario_documentos.palavrasChave` (LIKE, sem depender de full-text por dialeto). */
  @Column({ type: 'text', default: '' })
  assuntos: string;

  @Column({ name: 'tamanho_bytes', default: 0 })
  tamanhoBytes: number;

  @Column({ name: 'modificado_em', type: 'datetime', nullable: true })
  modificadoEm: Date | null;

  @Column({ name: 'hash_conteudo', length: 64, default: '' })
  hashConteudo: string;

  /** O arquivo sumiu da fonte numa sincronização — preserva o histórico sem inventar
   * presença: a busca ignora, a tela pode listar como "removido da fonte". */
  @Column({ default: false })
  removido: boolean;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;
}
