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

  /** Espelha webapp/db.py:usuarios_por_perfil — usuários ativos de um perfil. */
  async porPerfil(perfil: Perfil): Promise<Usuario[]> {
    return this.repo.find({ where: { perfil, ativo: true } });
  }

  /** `{nomeLower: codigoSicla}` dos usuários ativos (restringe a `nomes` se informado) — o
   * elo entre um técnico/consultor deste sistema e a agenda de disponibilidade externa
   * (SICLA/Oracle). Espelha webapp/db.py:codigos_sicla_por_nome. */
  async codigosSiclaPorNome(nomes?: string[]): Promise<Record<string, string>> {
    const alvo = new Set(
      (nomes ?? []).map((n) => (n || '').trim().toLowerCase()).filter(Boolean),
    );
    const usuarios = await this.repo.find({ where: { ativo: true } });
    const out: Record<string, string> = {};
    for (const u of usuarios) {
      const nl = (u.nome || '').trim().toLowerCase();
      if (nl && (alvo.size === 0 || alvo.has(nl))) {
        out[nl] = (u.codigoSicla || '').trim();
      }
    }
    return out;
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
