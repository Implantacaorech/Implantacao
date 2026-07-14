import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type VideoOrigem = 'sharepoint' | 'upload';

export type StatusProtocolo =
  | 'Pendente'
  | 'Transcrevendo'
  | 'Analisando'
  | 'Em revisão'
  | 'Aprovado'
  | 'Reprovado / Ajustar'
  | 'Erro';

/** Registro de protocolo gerado a partir de um vídeo de treinamento (transcrito
 * localmente via faster-whisper no docservice e analisado pela IA), com revisão humana
 * antes da aprovação. Não vinculado a Projeto/Cliente — base de conhecimento própria,
 * independente do fluxo de implantação. Espelha webapp/db.py:Protocolo. */
@Entity({ name: 'protocolos' })
export class Protocolo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255, default: '' })
  titulo: string;

  @Column({ length: 60, default: 'Módulo a validar' })
  modulo: string;

  @Column({ length: 120, default: 'Menu não identificado - revisar manualmente' })
  menu: string;

  @Column({ length: 255, default: '' })
  assunto: string;

  @Column({ type: 'text', default: '' })
  resumo: string;

  @Column({ type: 'text', default: '' })
  objetivo: string;

  @Column({ name: 'quando_utilizar', type: 'text', default: '' })
  quandoUtilizar: string;

  @Column({ name: 'pre_requisitos', type: 'text', default: '' })
  preRequisitos: string;

  @Column({ name: 'passo_a_passo', type: 'text', default: '' })
  passoAPasso: string;

  @Column({ type: 'text', default: '' })
  configuracoes: string;

  @Column({ type: 'text', default: '' })
  dependencias: string;

  @Column({ name: 'regras_negocio', type: 'text', default: '' })
  regrasNegocio: string;

  @Column({ name: 'pontos_atencao', type: 'text', default: '' })
  pontosAtencao: string;

  @Column({ type: 'text', default: '' })
  exemplos: string;

  // Auditoria do que a IA descartou como irrelevante (small talk, ruído...).
  @Column({ name: 'assuntos_removidos', type: 'text', default: '' })
  assuntosRemovidos: string;

  // Pontos que precisam de revisão humana (menu/módulo ambíguo, trecho inaudível...).
  @Column({ type: 'text', default: '' })
  pendencias: string;

  @Column({ name: 'video_nome', length: 255, default: '' })
  videoNome: string;

  @Column({ name: 'video_caminho', type: 'text', default: '' })
  videoCaminho: string;

  // type: 'varchar' explícito — ver comentário equivalente em projeto.entity.ts.
  @Column({ name: 'video_origem', type: 'varchar', length: 20, default: 'sharepoint' })
  videoOrigem: VideoOrigem;

  // Hash rápido (nome + tamanho + 1º MB) para dedup — o mesmo vídeo não é registrado 2x.
  @Index()
  @Column({ name: 'video_hash', length: 40, default: '' })
  videoHash: string;

  @Column({ name: 'duracao_seg', default: 0 })
  duracaoSeg: number;

  // Transcrição original com timestamps por bloco ([MM:SS] fala...).
  @Column({ type: 'text', default: '' })
  transcricao: string;

  // Resposta bruta da IA (auditoria).
  @Column({ name: 'texto_ia', type: 'text', default: '' })
  textoIa: string;

  @Column({ type: 'varchar', length: 30, default: 'Pendente' })
  status: StatusProtocolo;

  @Column({ name: 'log_erro', type: 'text', default: '' })
  logErro: string;

  // Linhas "dd/mm/aaaa HH:MM | autor | ação", uma por evento — auditoria simples.
  @Column({ type: 'text', default: '' })
  historico: string;

  @Column({ length: 120, default: '' })
  responsavel: string;

  @Column({ length: 120, default: '' })
  aprovador: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  // Sem `type` explícito de propósito — 'timestamp' não existe no driver better-sqlite3
  // e 'datetime' não existe no driver Postgres; deixar o TypeORM inferir do tipo da
  // propriedade escolhe o tipo nativo certo por driver automaticamente. Precisa ser
  // exatamente `Date` (não `Date | null`): um tipo união faz o design:type refletido
  // virar "Object" em vez de "Date" — mesma causa-raiz do item "`import type` quebra a
  // inferência de coluna" em docs/migracao/03-documento-conversao.md §6. `nullable: true`
  // já permite gravar/ler null mesmo com a propriedade tipada como `Date`.
  @Column({ name: 'processado_em', nullable: true })
  processadoEm: Date;

  @Column({ name: 'aprovado_em', nullable: true })
  aprovadoEm: Date;
}
