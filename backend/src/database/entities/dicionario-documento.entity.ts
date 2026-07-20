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

  // Conteúdo markdown completo do documento (fonte da verdade renderizável na tela).
  // 'text' (não 'mediumtext'/'longtext') de propósito: portável para o better-sqlite3 dos
  // testes, e o maior documento curado tem ~58KB — dentro do limite de 64KB do TEXT do
  // MariaDB, com folga. As seções são dado DERIVADO (reparseadas de `conteudo` sob demanda
  // em DicionarioService.obter), então não há coluna para elas — evita duplicar o conteúdo.
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
