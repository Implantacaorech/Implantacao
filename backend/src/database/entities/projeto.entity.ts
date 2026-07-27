import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Etapa, Situacao } from '../../common/constants/perfis';

@Entity({ name: 'projetos' })
export class Projeto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  cliente: string;

  @Column({ length: 40, default: '' })
  cnpj: string;

  @Column({ name: 'numero_projeto', length: 40, default: '' })
  numeroProjeto: string;

  @Column({ name: 'numero_proposta', length: 40, default: '' })
  numeroProposta: string;

  @Column({ length: 160, default: '' })
  ramo: string;

  @Column({ length: 160, default: '' })
  responsavel: string;

  @Column({ length: 160, default: '' })
  consultor: string;

  @Column({ length: 160, default: '' })
  gci: string;

  // type: 'varchar' explícito — ver comentário equivalente em usuario.entity.ts.
  @Column({ type: 'varchar', length: 40, default: 'Agendamento' })
  etapa: Etapa;

  @Column({ type: 'varchar', length: 40, default: 'Em andamento' })
  situacao: Situacao;

  @Column({ name: 'data_inicio', length: 20, default: '' })
  dataInicio: string;

  @Column({ name: 'data_levantamento', length: 20, default: '' })
  dataLevantamento: string;

  @Column({ name: 'data_uso_oficial', length: 20, default: '' })
  dataUsoOficial: string;

  @Column({ name: 'data_encerramento', length: 20, default: '' })
  dataEncerramento: string;

  @Column({ name: 'horas_cobradas', length: 20, default: '' })
  horasCobradas: string;

  @Column({ name: 'horas_bonificadas', length: 20, default: '' })
  horasBonificadas: string;

  @Column({ type: 'text', default: '' })
  modulos: string;

  /** Detalhe dos módulos contratados marcados na consulta ao SICLA (passo 1): JSON no formato
   * `[{ codigo, descricao, obs }]`. O campo `modulos` acima continua sendo a lista de CÓDIGOS
   * efetivos (do adicional quando há, senão do módulo) que os geradores/cronograma leem; aqui
   * ficam a descrição e a observação de cada item marcado. Nulo quando não houve marcação. */
  @Column({ name: 'modulos_detalhe', type: 'text', nullable: true })
  modulosDetalhe: string | null;

  /** Conversões de dados estimadas no passo 1 (Comercial): JSON `[{ nome, horas }]`. Lista
   * fixa (clientes/fornecedores, produtos, financeiro em aberto, notas emitidas) mais itens
   * livres que o Comercial acrescentar, cada um com a estimativa de horas de conversão. Nulo
   * quando nada foi marcado. */
  @Column({ type: 'text', nullable: true })
  conversoes: string | null;

  @Column({ name: 'contato_nome', length: 160, default: '' })
  contatoNome: string;

  @Column({ name: 'contato_email', length: 160, default: '' })
  contatoEmail: string;

  @Column({ name: 'contato_tel', length: 60, default: '' })
  contatoTel: string;

  /** E-mail do Comercial que abriu o cliente — destinatário do passo 3 (o levantador
   * repassa a ele o que encontrou no levantamento). Preenchido automaticamente com o
   * REMETENTE do e-mail de fechamento; o Administrativo pode corrigir na ficha. */
  @Column({ name: 'comercial_email', length: 160, default: '' })
  comercialEmail: string;

  @Column({ type: 'text', default: '' })
  contatos: string;

  @Column({ type: 'text', default: '' })
  observacoes: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;
}
