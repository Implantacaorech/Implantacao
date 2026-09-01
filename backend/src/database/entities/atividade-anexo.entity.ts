import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** `arquivo` e `imagem` moram em disco (só o caminho vem para cá); `link` guarda só a URL e
 * não baixa nada. */
export type TipoAnexo = 'arquivo' | 'imagem' | 'link';

/** Anexo de um cartão. Segue a convenção de `documentos`: o binário vai para o disco, nunca
 * para o banco, com o teto de `LIMITE_UPLOAD_DOC`.
 *
 * O download passa OBRIGATORIAMENTE pelo backend (`/atividades/cartoes/:id/anexos/:anexoId`),
 * que reconfere a permissão do cartão — servir a pasta estaticamente daria a quem tem o
 * caminho um atalho por fora do recorte do cliente. */
@Entity({ name: 'atividade_anexos' })
export class AtividadeAnexo {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'cartao_id' })
  cartaoId: number;

  @Column({ type: 'varchar', length: 20, default: 'arquivo' })
  tipo: TipoAnexo;

  @Column({ length: 260 })
  nome: string;

  /** Nome do arquivo dentro da pasta de anexos. Vazio quando `tipo = 'link'`. */
  @Column({ length: 300, default: '' })
  arquivo: string;

  /** URL do anexo `link`. Vazio nos demais tipos. */
  @Column({ type: 'text', default: '' })
  url: string;

  @Column({ length: 120, default: '' })
  mime: string;

  @Column({ type: 'int', default: 0 })
  tamanho: number;

  @Column({ name: 'enviado_por', length: 160, default: '' })
  enviadoPor: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
