import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Preferência de tela do usuário logado — hoje, a seleção de filtros de cada tela.
 *
 * É de PROPÓSITO um par chave→JSON e não uma coluna por filtro: cada tela tem um conjunto
 * diferente de filtros e eles mudam junto com a tela. Guardar no banco (e não no
 * localStorage) porque o pedido é "salvar por usuário logado" — a seleção precisa seguir a
 * pessoa, não o navegador da máquina onde ela sentou.
 *
 * O formato do `valor` é responsabilidade da tela; o backend só o transporta. Por isso a
 * leitura no cliente é tolerante: filtro que não existe mais é ignorado (ver
 * `frontend/src/app/core/utils/filtros-salvos.ts`). */
@Entity({ name: 'preferencias_usuario' })
@Index('IDX_preferencias_usuario_usuario_chave', ['usuarioId', 'chave'], {
  unique: true,
})
export class PreferenciaUsuario {
  @PrimaryGeneratedColumn()
  id: number;

  /** → `usuarios.id`. Referência LÓGICA, sem FK — convenção do schema inteiro (ver
   * `vault/05 - Banco de Dados`): integridade referencial é da aplicação. */
  @Column({ name: 'usuario_id' })
  usuarioId: number;

  /** Identifica a tela/bloco de filtros (ex.: `capacidade`, `bi-clientes-siger`). */
  @Column({ length: 60 })
  chave: string;

  /** Estado dos filtros serializado em JSON. */
  @Column({ type: 'text' })
  valor: string;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;
}
