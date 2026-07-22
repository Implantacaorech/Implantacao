import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../database/entities/usuario.entity';
import { Perfil } from '../common/constants/perfis';
import { normalizarPapeis, papeisDoUsuario } from './papeis.util';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Usuario) private readonly repo: Repository<Usuario>,
  ) {}

  async porLogin(login: string): Promise<Usuario | null> {
    return this.repo.findOne({ where: { login: login.trim(), ativo: true } });
  }

  /** Todos os usuários (ativos e inativos), ordenados por nome — tela de Usuários (ADM). */
  async listar(): Promise<Usuario[]> {
    return this.repo.find({ order: { nome: 'ASC' } });
  }

  async buscarPorId(id: number): Promise<Usuario> {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Usuário não encontrado.');
    return u;
  }

  /** Existe um usuário (ativo ou não) com esse login OU esse e-mail? Espelha
   * webapp/db.py:existe_usuario — usado no auto-cadastro para rejeitar duplicidade antes
   * de gerar o código de verificação. `ignorarId` exclui o próprio registro (edição). */
  async existeUsuario(
    login: string,
    email: string,
    ignorarId?: number,
  ): Promise<boolean> {
    const l = (login || '').trim().toLowerCase();
    const e = (email || '').trim().toLowerCase();
    if (!l && !e) return false;
    // Parênteses explícitos são obrigatórios aqui: `.where()`/`.andWhere()` do TypeORM NÃO
    // envolve strings cruas em parênteses automaticamente — sem eles, o `AND` (precedência
    // maior que `OR` em SQL) se aplicaria só ao segundo termo do OR, e um login batendo
    // sozinho já daria match mesmo com o próprio id excluído (achado escrevendo o teste
    // e2e de edição: um usuário editando o próprio registro sempre "colidia consigo
    // mesmo").
    const qb = this.repo
      .createQueryBuilder('u')
      .where('(LOWER(u.login) = :l OR LOWER(u.email) = :e)', { l, e });
    if (ignorarId) qb.andWhere('u.id != :id', { id: ignorarId });
    return (await qb.getCount()) > 0;
  }

  /** E-mail de um usuário ATIVO pelo nome (prefere o campo `email`, cai no `login`) —
   * exact match, case-insensitive. Espelha webapp/db.py:email_do_usuario, usado pela
   * Designação para resolver o destinatário da notificação a partir de `Projeto.gci`/
   * `Designacao.consultor` (strings de nome, não ids). */
  async emailDoUsuario(nome: string): Promise<string | null> {
    if (!nome) return null;
    const u = await this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.nome) = :nome', { nome: nome.trim().toLowerCase() })
      .andWhere('u.ativo = :ativo', { ativo: true })
      .getOne();
    if (!u) return null;
    return u.email || u.login || null;
  }

  /** Usuários ativos que TÊM o papel — não só quem o tem como principal.
   *
   * Desde que os papéis passaram a ser múltiplos, filtrar por `perfil` deixaria de fora
   * justamente quem acumula cargo (o GCI que também é Levantador, por exemplo). O filtro
   * é feito em memória porque a lista de usuários do Painel é pequena e cabe inteira. */
  async porPerfil(perfil: Perfil): Promise<Usuario[]> {
    const ativos = await this.repo.find({ where: { ativo: true } });
    return ativos.filter((u) => papeisDoUsuario(u).includes(perfil));
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
    perfis?: Perfil[];
    codigoSicla?: string;
  }): Promise<Usuario> {
    const login = (dados.login || '').trim() || dados.email.trim(); // login em branco usa o e-mail
    if (await this.existeUsuario(login, dados.email)) {
      throw new ConflictException(
        'Já existe um usuário com este login ou e-mail.',
      );
    }
    const senhaHash = await bcrypt.hash(dados.senha, SALT_ROUNDS);
    const usuario = this.repo.create({
      login,
      nome: dados.nome,
      email: dados.email,
      senhaHash,
      perfil: dados.perfil,
      perfis: normalizarPapeis(dados.perfis ?? [dados.perfil]).join(', '),
      codigoSicla: dados.codigoSicla ?? '',
      ativo: true,
    });
    return this.repo.save(usuario);
  }

  /** Atualiza um usuário existente. `senha` só é alterada se enviada (não-vazia) — mesmo
   * contrato de webapp/app.py:usuarios (edição via formulário, senha em branco = mantém a
   * atual). */
  async atualizar(
    id: number,
    dados: {
      login?: string;
      nome?: string;
      email?: string;
      senha?: string;
      perfil?: Perfil;
      perfis?: Perfil[];
      codigoSicla?: string;
      ativo?: boolean;
    },
  ): Promise<Usuario> {
    const usuario = await this.buscarPorId(id);
    const loginNovo =
      dados.login !== undefined
        ? dados.login.trim() || (dados.email ?? usuario.email).trim()
        : usuario.login;
    const emailNovo = dados.email !== undefined ? dados.email : usuario.email;
    if (await this.existeUsuario(loginNovo, emailNovo, id)) {
      throw new ConflictException(
        'Já existe um usuário com este login ou e-mail.',
      );
    }
    usuario.login = loginNovo;
    if (dados.nome !== undefined) usuario.nome = dados.nome;
    usuario.email = emailNovo;
    if (dados.perfil !== undefined) usuario.perfil = dados.perfil;
    if (dados.perfis !== undefined) {
      usuario.perfis = normalizarPapeis(dados.perfis).join(', ');
    }
    if (dados.codigoSicla !== undefined)
      usuario.codigoSicla = dados.codigoSicla;
    if (dados.ativo !== undefined) usuario.ativo = dados.ativo;
    if (dados.senha)
      usuario.senhaHash = await bcrypt.hash(dados.senha, SALT_ROUNDS);
    return this.repo.save(usuario);
  }

  async validarSenha(usuario: Usuario, senha: string): Promise<boolean> {
    return bcrypt.compare(senha, usuario.senhaHash);
  }

  /** Autoatendimento (`POST /auth/trocar-senha`) — diferente de `atualizar()` (ADM edita
   * qualquer usuário sem confirmar a senha atual), aqui é o próprio usuário logado trocando
   * a sua, por isso exige a senha atual. Cobre também o caso da migração de dados: senha
   * temporária aleatória (ver migrar-legado.ts) → o usuário troca por uma de sua escolha. */
  async trocarSenha(
    id: number,
    senhaAtual: string,
    senhaNova: string,
  ): Promise<void> {
    const usuario = await this.buscarPorId(id);
    if (!(await this.validarSenha(usuario, senhaAtual))) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }
    usuario.senhaHash = await bcrypt.hash(senhaNova, SALT_ROUNDS);
    await this.repo.save(usuario);
  }
}
