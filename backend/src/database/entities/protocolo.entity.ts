import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type VideoOrigem = 'sharepoint' | 'upload' | 'gravacao';

export type StatusProtocolo =
  | 'Gravando'
  | 'Pendente'
  | 'Transcrevendo'
  | 'Analisando'
  | 'Em revisão'
  | 'Aprovado'
  | 'Reprovado / Ajustar'
  | 'Erro';

/** Registro de protocolo gerado a partir de um vídeo/áudio de treinamento ou de uma
 * REUNIÃO GRAVADA ao vivo (transcrito localmente via faster-whisper no docservice e
 * analisado pela IA), com revisão humana antes da aprovação. Espelha webapp/db.py:Protocolo.
 *
 * O vínculo com Projeto/Cliente é OPCIONAL (`projetoId`/`cliente`): a base de conhecimento
 * continua existindo por si só (treinamentos genéricos do SIGER não são de cliente nenhum),
 * mas uma gravação de reunião normalmente é "de um cliente" e precisa ser achada por ele. */
@Entity({ name: 'protocolos' })
export class Protocolo {
  @PrimaryGeneratedColumn()
  id: number;

  /** Projeto (cliente) a que a gravação/protocolo pertence — nulo quando é conteúdo
   * genérico, sem dono. É só um ponteiro: não há FK/relação declarada, para que excluir
   * um projeto nunca apague conhecimento já registrado. */
  @Index()
  @Column({ name: 'projeto_id', type: 'int', nullable: true })
  projetoId: number | null;

  /** Nome do cliente no momento do registro — desnormalizado de propósito: é o que a
   * lista filtra/exibe, e continua legível mesmo se o projeto for excluído depois. */
  @Column({ length: 200, default: '' })
  cliente: string;

  /** Código do cliente no SICLA — a gravação escolhe o cliente pela MESMA busca do passo 1
   * (SICLA), que nem sempre tem projeto no painel: uma reunião pode acontecer antes de a
   * ficha existir. É este código, e não o `projetoId`, que identifica o cliente de verdade. */
  @Column({ name: 'cliente_codigo', length: 20, default: '' })
  clienteCodigo: string;

  /** Termos que o transcritor deve ESPERAR ouvir nesta gravação (nomes dos participantes,
   * cliente, jargão do SIGER). Vai como `hotwords` para o Whisper nos dois passes — o ao
   * vivo e a retranscrição do arquivo. É o que corrige nome próprio: sem contexto, o modelo
   * escolhe a sequência de sons mais provável do português geral ("IVEA" no lugar de
   * "IVIAN"). Guardado no registro porque a retranscrição acontece DEPOIS, e precisa dos
   * mesmos termos. */
  @Column({ type: 'text', default: '' })
  vocabulario: string;

  /** Quantas vozes separar na transcrição (0 = não separar). INFORMADO por quem grava, e
   * não descoberto: testado em 2026-07-31, o agrupamento automático inventou de 7 a 10
   * vozes onde havia 2 — microfone de sala não dá contraste para adivinhar sozinho. */
  @Column({ default: 0 })
  participantes: number;

  /** Nomes dos locutores, JSON `{"P1":"Ivian"}`. A transcrição guarda o RÓTULO; o nome
   * vive aqui, então renomear é reversível e não reescreve o texto — ver locutores.ts. */
  @Column({ name: 'mapa_locutores', type: 'text', default: '' })
  mapaLocutores: string;

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

  // Resumo COMPLETO da transcrição, em texto corrido/estruturado (registro de atividades
  // por menu do sistema + definições de configuração). É o que a tela de revisão mostra no
  // lugar da leitura da transcrição bruta. Gerado por uma chamada de IA PRÓPRIA — ver
  // ProtocoloIaService.resumirCompleto.
  @Column({ name: 'resumo_completo', type: 'text', default: '' })
  resumoCompleto: string;

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

  // 'sharepoint' (robô da pasta) · 'upload' (arquivo enviado na tela) · 'gravacao'
  // (reunião gravada e transcrita ao vivo pelo próprio painel).
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
