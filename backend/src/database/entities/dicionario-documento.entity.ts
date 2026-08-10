import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TipoDicionarioDocumento = 'modulo' | 'adicional';

/** Um documento técnico curado da base de conhecimento do SIGER® (repositório
 * Documentacao-Fonte-P: 21 módulos + 66 adicionais). Ingerido a partir do markdown por
 * `scripts/ingerir-dicionario-siger.ts` (Node/TypeScript — nenhum Python envolvido).
 * `secoes` guarda o conteúdo quebrado por seção (JSON), `palavrasChave` o índice de termos
 * para busca, e os campos escalares alimentam os filtros da tela "Dicionário Inteligente".
 * Fonte é sempre citável: `caminhoOrigem` + `urlOrigem` apontam para o .md original. */
@Entity({ name: 'dicionario_documentos' })
export class DicionarioDocumento {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 160 })
  slug: string;

  @Index()
  @Column({ length: 20 })
  tipo: TipoDicionarioDocumento;

  @Index()
  @Column({ length: 20 })
  sigla: string;

  @Column({ length: 255 })
  titulo: string;

  @Column({ type: 'text', default: '' })
  resumo: string;

  /** Conteúdo markdown completo do documento (fonte da verdade renderizável na tela).
   *
   * ⚠️ No MariaDB esta coluna é **LONGTEXT** — ver a migration
   * `DicionarioConteudoLongtext1784900000000`. O `type: 'text'` daqui é o que o driver
   * SQLite (dev/teste) entende; ele não conhece `longtext` e falharia no boot. Como
   * `synchronize` é FALSE no MariaDB, o tipo alargado pela migration não é revertido.
   *
   * Antes de 2026-08-10 o comentário aqui dizia que os ~58 KB do maior documento cabiam nos
   * 64 KB do `TEXT` "com folga". Não cabiam com folga nenhuma: era **88% do teto**, e o
   * mesmo limite tinha acabado de derrubar a transcrição em produção no mesmo dia.
   *
   * As seções são dado DERIVADO (reparseadas de `conteudo` sob demanda em
   * `DicionarioService.obter`), então não há coluna para elas — evita duplicar o conteúdo. */
  @Column({ type: 'text' })
  conteudo: string;

  // Índice de termos para busca (programas, copybooks, menus, palavras-chave), separado por
  // espaço/vírgula — casado com LIKE, sem depender de full-text por dialeto.
  @Column({ type: 'text', default: '' })
  palavrasChave: string;

  @Column({ name: 'caminho_origem', length: 500 })
  caminhoOrigem: string;

  @Column({ name: 'url_origem', length: 500, default: '' })
  urlOrigem: string;

  @Column({ name: 'hash_conteudo', length: 64 })
  hashConteudo: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;
}
