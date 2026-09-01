import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Perfil } from '../../common/constants/perfis';

@Entity({ name: 'usuarios' })
export class Usuario {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 120 })
  login: string;

  @Column({ length: 120, default: '' })
  nome: string;

  @Column({ length: 160, default: '' })
  email: string;

  // bcrypt — troca o hash werkzeug (scrypt/pbkdf2) do Flask; usuários existentes precisam
  // de reset de senha na virada (ver docs/migracao/03-documento-conversao.md).
  @Column({ name: 'senha_hash', type: 'text', default: '' })
  senhaHash: string;

  // type: 'varchar' explícito — com `import type` (exigido por isolatedModules), o
  // design:type refletido por decorator metadata vira "Object" em vez de String, e o
  // TypeORM não consegue inferir o tipo de coluna sozinho.
  /** Papel PRINCIPAL — mantido porque dados e telas antigas dependem dele, e porque é o
   * que aparece quando se quer um rótulo só. Quem manda nas permissões é `perfis`. */
  @Column({ type: 'varchar', length: 20, default: 'Consultor' })
  perfil: Perfil;

  /** TODOS os papéis do usuário, separados por vírgula. A mesma pessoa costuma acumular
   * cargos (GCI e Levantador, por exemplo), então permissão se pergunta por PAPEL, não
   * por um perfil único. Vazio = usa só o `perfil`, para os cadastros antigos. */
  @Column({ type: 'text', default: '' })
  perfis: string;

  // código do técnico no SICLA — elo com o Agendador de Visitas
  @Column({ name: 'codigo_sicla', length: 40, default: '' })
  codigoSicla: string;

  /** Código do CLIENTE no SICLA (`SICLA.LISTA_CLIENTES.CODIGO`) — o recorte de dados do
   * usuário com papel `Cliente`, que só enxerga o BI dele (docs/acesso-cliente-bi.md).
   *
   * Não confundir com `codigoSicla`, logo acima: aquele é o código do TÉCNICO, e diz quem a
   * pessoa é na agenda interna; este diz de QUEM são os dados que ela pode ver. Vazio em
   * todo usuário interno; obrigatório no `Cliente` — um papel `Cliente` sem este código não
   * tem escopo, e a regra é negar, nunca mostrar tudo.
   *
   * Texto, e não inteiro, pelo mesmo motivo de `codigoSicla`: é código de sistema externo,
   * e comparar como texto evita depender do formato do SICLA. Guardado como lista separada
   * por vírgula para o dia em que um cliente tiver mais de uma empresa — hoje o cadastro
   * grava um só (ver `escopo-cliente.service.ts`, que já lê uma lista). */
  @Column({ name: 'codigo_cliente_sicla', length: 200, default: '' })
  codigoClienteSicla: string;

  /** Módulos em que o técnico é capacitado, como vêm de `SICLA.LISTA_TECNICOS.MODULOCAPACITADO`
   * (texto livre do SICLA, geralmente uma lista separada por vírgula). Alimentado pela
   * importação de técnicos — ver `tecnicos-sicla/`. */
  @Column({ name: 'modulos_capacitados', type: 'text', default: '' })
  modulosCapacitados: string;

  /** Setor de atuação — `SICLA.LISTA_TECNICOS.SETORDES`. */
  @Column({ name: 'setor_atuacao', length: 120, default: '' })
  setorAtuacao: string;

  @Column({ default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
