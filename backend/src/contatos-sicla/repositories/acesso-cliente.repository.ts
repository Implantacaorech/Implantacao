import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../../database/entities/usuario.entity';

/** Persistência do ACESSO de cliente sobre `usuarios` — só acesso a dado, sem regra de
 * negócio (Guia Mestre §Responsabilidades → Repository, ADR-0002).
 *
 * Fica dentro do módulo, e não em `database/repositories/`, porque o recorte é do módulo:
 * são as quatro operações que "liberar/revogar contato" precisa, não um CRUD de usuário.
 * Quem administra usuário de verdade continua sendo `UsersService`. */
@Injectable()
export class AcessoClienteRepository {
  constructor(
    @InjectRepository(Usuario)
    private readonly repo: Repository<Usuario>,
  ) {}

  /** Todos os usuários — o cadastro do Painel cabe em memória, e um SELECT só resolve o
   * "já liberado" de uma lista inteira de contatos. */
  async todos(): Promise<Usuario[]> {
    return this.repo.find();
  }

  /** Usuário por e-mail OU login (o login de um contato É o e-mail dele). */
  async porEmailOuLogin(email: string): Promise<Usuario | null> {
    const e = (email || '').trim().toLowerCase();
    if (!e) return null;
    return this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :e OR LOWER(u.login) = :e', { e })
      .getOne();
  }

  async salvar(usuario: Usuario): Promise<Usuario> {
    return this.repo.save(usuario);
  }

  async criar(dados: Partial<Usuario>): Promise<Usuario> {
    return this.repo.save(this.repo.create(dados));
  }
}
