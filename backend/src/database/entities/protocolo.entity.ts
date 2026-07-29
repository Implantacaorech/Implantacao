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

  @Column({
    length: 120,
    default: 'Menu não identificado - revisar manualmente',
  })
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

  // Seção 2 do prompt: TODOS os menus citados, cada um com objetivo e atividades feitas
  // (a coluna `menu` acima continua sendo só o menu principal — é ela que filtra a lista).
  @Column({ name: 'menus_abordados', type: 'text', default: '' })
  menusAbordados: string;

  // Seção 3: funcionalidades demonstradas (nome, finalidade, como foi usada, observações).
  @Column({ type: 'text', default: '' })
  funcionalidades: string;

  @Column({ name: 'passo_a_passo', type: 'text', default: '' })
  passoAPasso: string;

  // Seção 6: processos executados (cadastro, faturamento, estoque, integração...).
  @Column({ type: 'text', default: '' })
  processos: string;

  // Seção 4: conceitos/termos explicados pelo consultor (glossário do treinamento).
  @Column({ type: 'text', default: '' })
  definicoes: string;

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

  // Seção 7: perguntas do participante e as respostas dadas no treinamento.
  @Column({ type: 'text', default: '' })
  duvidas: string;

  // Seção 8: o que ficou pendente COM O CLIENTE (ajustes, cadastros, testes, retornos) —
  // não confundir com `pendencias`, que é a lista de dúvidas da própria IA p/ o revisor.
  @Column({ name: 'pendencias_treinamento', type: 'text', default: '' })
  pendenciasTreinamento: string;

  // Seção 9: ações futuras acordadas durante o treinamento.
  @Column({ name: 'proximos_passos', type: 'text', default: '' })
  proximosPassos: string;

  // Seção 10: resumo final em tópicos, só os pontos mais importantes.
  @Column({ name: 'resumo_tecnico', type: 'text', default: '' })
  resumoTecnico: string;

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
  @Column({
    name: 'video_origem',
    type: 'varchar',
    length: 20,
    default: 'sharepoint',
  })
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
