import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Cliente de MÁQUINA da API de Dados — outro sistema da Rech, um agente de IA, uma
 * planilha/BI. Existe porque o consumo da API não é só do Painel (decisão do usuário em
 * 2026-08-25: "preparar para uso geral"), e um JWT de pessoa não serve para integração:
 * expira em 15 min, carrega perfil/menus e some quando a pessoa sai da empresa.
 *
 * A chave é entregue UMA vez, no cadastro, no formato `rd_<prefixo>_<segredo>`:
 * - `prefixo` viaja em claro e é o índice de busca (achar o cliente sem varrer hashes);
 * - `segredo` é guardado só como hash bcrypt — vazamento do banco não devolve a chave.
 *
 * `consultas` é a lista fechada de NOMES de consulta que este cliente pode chamar — a
 * autorização é POR CONSULTA, não por conexão: um token destinado a `sicla.rns.listar` não
 * abre o resto do SICLA. Nome que não exista no catálogo é recusado no cadastro. */
@Entity({ name: 'api_clientes' })
export class ClienteApi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 160, default: '' })
  nome: string;

  @Index({ unique: true })
  @Column({ length: 24, default: '' })
  prefixo: string;

  @Column({ name: 'chave_hash', length: 120, default: '' })
  chaveHash: string;

  /** Nomes de consulta separados por vírgula (ex.: `sicla.rns.listar,sicla.rns.detalhar`).
   * Lista curta e fechada — coluna de texto em vez de tabela filha é proporcional. */
  @Column({ type: 'text' })
  consultas: string;

  @Column({ default: true })
  ativo: boolean;

  @Column({ length: 255, default: '' })
  observacao: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  /** Última vez que a chave autenticou. É o que responde "ainda usam isto?" antes de
   * revogar, e denuncia chave viva esquecida numa integração desligada. */
  @Column({ name: 'ultimo_uso_em', type: 'datetime', nullable: true })
  ultimoUsoEm: Date | null;
}
