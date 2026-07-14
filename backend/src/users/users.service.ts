import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../database/entities/usuario.entity';
import { Perfil } from '../common/constants/perfis';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Usuario) private readonly repo: Repository<Usuario>,
  ) {}

  async porLogin(login: string): Promise<Usuario | null> {
    return this.repo.findOne({ where: { login: login.trim(), ativo: true } });
  }

  async contarAtivos(): Promise<number> {
    return this.repo.count({ where: { ativo: true } });
  }

  async criar(dados: {
    login: string;
    nome: string;
    email: string;
    senha: string;
    perfil: Perfil;
    codigoSicla?: string;
  }): Promise<Usuario> {
    const existente = await this.repo.findOne({
      where: { login: dados.login.trim() },
    });
    if (existente)
      throw new ConflictException('Já existe um usuário com este login');
    const senhaHash = await bcrypt.hash(dados.senha, SALT_ROUNDS);
    const usuario = this.repo.create({
      login: dados.login.trim(),
      nome: dados.nome,
      email: dados.email,
      senhaHash,
      perfil: dados.perfil,
      codigoSicla: dados.codigoSicla ?? '',
      ativo: true,
    });
    return this.repo.save(usuario);
  }

  async validarSenha(usuario: Usuario, senha: string): Promise<boolean> {
    return bcrypt.compare(senha, usuario.senhaHash);
  }
}
