import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

const SEGREDO = 'segredo-de-teste';
const CONFIG: Record<string, string> = {
  jwtSecret: SEGREDO,
  jwtRefreshSecret: SEGREDO,
  jwtExpiresIn: '15m',
  jwtRefreshExpiresIn: '7d',
};

function usuario(over: Partial<Usuario> = {}): Usuario {
  return {
    id: 9,
    login: 'dibah@rech.com.br',
    nome: 'Dibah Luiz Lenhart',
    perfil: 'GCI',
    perfis: 'GCI, Consultor, Levantador',
    codigoSicla: '',
    ativo: true,
    ...over,
  } as Usuario;
}

/** A renovação do token tem de reler o CADASTRO.
 *
 * Diagnóstico de 2026-07-29: papéis e nome eram recopiados do token que chegava, então quem
 * já estava logado nunca recebia um papel novo dado em Gestão → Usuários. O Painel continuava
 * dizendo "Só o responsável (Levantador) pode concluir" para quem JÁ era Levantador no
 * cadastro, e só sair e entrar de novo resolvia. */
describe('AuthService.refresh — papéis vêm do cadastro, não do token antigo', () => {
  let service: AuthService;
  let jwt: JwtService;
  const users = { buscarPorId: jest.fn() };
  const refreshRepo = {
    findOne: jest.fn(),
    save: jest.fn((r: unknown) => Promise.resolve(r)),
    create: jest.fn((r: unknown) => r),
    update: jest.fn(),
  };

  /** Token de refresh VÁLIDO, mas com o conteúdo defasado que a sessão antiga carregava. */
  async function refreshDefasado(): Promise<string> {
    const antigo: AuthUser = {
      sub: 9,
      login: 'dibah@rech.com.br',
      nome: 'Dibah',
      perfil: 'GCI',
      perfis: ['GCI'],
      codigoSicla: '',
    };
    return jwt.signAsync(antigo, { secret: SEGREDO, expiresIn: '7d' });
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    users.buscarPorId.mockResolvedValue(usuario());
    refreshRepo.findOne.mockResolvedValue({
      id: 1,
      usuarioId: 9,
      revogado: false,
      expiraEm: new Date(Date.now() + 86400000),
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        {
          provide: ConfigService,
          useValue: { get: (chave: string) => CONFIG[chave] },
        },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshRepo },
      ],
    }).compile();
    service = module.get(AuthService);
    jwt = module.get(JwtService);
  });

  it('devolve os papéis ATUAIS do cadastro, não os que vieram no token', async () => {
    const { accessToken } = await service.refresh(await refreshDefasado());
    const novo = jwt.verify<AuthUser>(accessToken, { secret: SEGREDO });
    expect(novo.perfis).toEqual(['GCI', 'Consultor', 'Levantador']);
  });

  it('atualiza o nome, que é por onde se confere a designação no projeto', async () => {
    const { accessToken } = await service.refresh(await refreshDefasado());
    const novo = jwt.verify<AuthUser>(accessToken, { secret: SEGREDO });
    expect(novo.nome).toBe('Dibah Luiz Lenhart');
  });

  it('recusa a renovação de quem foi inativado no cadastro', async () => {
    users.buscarPorId.mockResolvedValue(usuario({ ativo: false }));
    await expect(service.refresh(await refreshDefasado())).rejects.toThrow(
      'Usuário inativo ou removido.',
    );
  });

  it('recusa a renovação de quem não existe mais', async () => {
    users.buscarPorId.mockRejectedValue(new Error('não encontrado'));
    await expect(service.refresh(await refreshDefasado())).rejects.toThrow(
      'Usuário inativo ou removido.',
    );
  });
});
