import { PermissoesService, UsuarioPermissao } from './permissoes.service';
import { PermissaoPapel } from '../database/entities/permissao-papel.entity';
import { PermissaoUsuario } from '../database/entities/permissao-usuario.entity';

/** Mocks mínimos dos repositórios: só o que o serviço usa (count/find/create). */
function repoMock(rows: any[]) {
  return {
    count: jest.fn().mockResolvedValue(rows.length),
    find: jest.fn().mockResolvedValue(rows),
    create: jest.fn((x) => x),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  } as any;
}

async function montar(
  papel: Partial<PermissaoPapel>[],
  usuario: Partial<PermissaoUsuario>[] = [],
) {
  const svc = new PermissoesService(repoMock(papel), repoMock(usuario));
  await svc.onModuleInit(); // count>0 pula o seed; recarrega os mapas
  return svc;
}

const u = (
  perfil: UsuarioPermissao['perfil'],
  sub = 1,
  perfis?: UsuarioPermissao['perfis'],
): UsuarioPermissao => ({ sub, perfil, perfis });

describe('PermissoesService.nivelEfetivo', () => {
  it('ADM é sempre alteracao — trava de segurança (nunca se tranca fora)', async () => {
    const svc = await montar([{ papel: 'ADM', menu: 'carteira', nivel: 'nada' }]);
    expect(svc.nivelEfetivo(u('ADM'), 'carteira')).toBe('alteracao');
    expect(svc.nivelEfetivo(u('ADM'), 'qualquer_menu')).toBe('alteracao');
  });

  it('sem regra para o papel/menu = nada', async () => {
    const svc = await montar([{ papel: 'Comercial', menu: 'carteira', nivel: 'consulta' }]);
    expect(svc.nivelEfetivo(u('Comercial'), 'matriz')).toBe('nada');
  });

  it('usa o nível do papel', async () => {
    const svc = await montar([
      { papel: 'Comercial', menu: 'carteira', nivel: 'consulta' },
      { papel: 'GCI', menu: 'carteira', nivel: 'alteracao' },
    ]);
    expect(svc.nivelEfetivo(u('Comercial'), 'carteira')).toBe('consulta');
    expect(svc.nivelEfetivo(u('GCI'), 'carteira')).toBe('alteracao');
  });

  it('acumulando papéis, vale o MAIOR nível', async () => {
    const svc = await montar([
      { papel: 'Comercial', menu: 'carteira', nivel: 'consulta' },
      { papel: 'GCI', menu: 'carteira', nivel: 'alteracao' },
    ]);
    expect(
      svc.nivelEfetivo(u('Comercial', 5, ['Comercial', 'GCI']), 'carteira'),
    ).toBe('alteracao');
  });

  it('exceção do usuário sobrepõe o papel', async () => {
    const svc = await montar(
      [{ papel: 'Consultor', menu: 'matriz', nivel: 'alteracao' }],
      [{ usuarioId: 7, menu: 'matriz', nivel: 'consulta' }],
    );
    expect(svc.nivelEfetivo(u('Consultor', 7), 'matriz')).toBe('consulta');
    // outro usuário do mesmo papel segue no padrão
    expect(svc.nivelEfetivo(u('Consultor', 8), 'matriz')).toBe('alteracao');
  });

  it('podeVer/podeAlterar refletem o nível', async () => {
    const svc = await montar([
      { papel: 'Comercial', menu: 'carteira', nivel: 'consulta' },
    ]);
    expect(svc.podeVer(u('Comercial'), 'carteira')).toBe(true);
    expect(svc.podeAlterar(u('Comercial'), 'carteira')).toBe(false);
    expect(svc.podeVer(u('Comercial'), 'matriz')).toBe(false);
  });
});
