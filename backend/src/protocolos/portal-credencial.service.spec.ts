import { PortalCredencialService } from './portal-credencial.service';

describe('PortalCredencialService', () => {
  const svc = new PortalCredencialService();
  // userId alto e único para não colidir com outros testes que escrevam no mesmo arquivo.
  const uid = 987654;

  afterEach(() => svc.remover(uid));

  it('começa sem credencial', () => {
    expect(svc.tem(uid)).toBe(false);
    expect(svc.obter(uid)).toBeNull();
    expect(svc.loginDe(uid)).toBe('');
  });

  it('salva e lê login+senha; só o login é exposto', () => {
    svc.salvar(uid, 'consultor.rech', 'segredo123');
    expect(svc.tem(uid)).toBe(true);
    expect(svc.loginDe(uid)).toBe('consultor.rech');
    expect(svc.obter(uid)).toEqual({
      login: 'consultor.rech',
      senha: 'segredo123',
    });
  });

  it('senha em branco na edição mantém a senha atual', () => {
    svc.salvar(uid, 'consultor.rech', 'segredo123');
    svc.salvar(uid, 'consultor.novo', '');
    expect(svc.obter(uid)).toEqual({
      login: 'consultor.novo',
      senha: 'segredo123',
    });
  });

  it('remover apaga a credencial', () => {
    svc.salvar(uid, 'x', 'y');
    svc.remover(uid);
    expect(svc.tem(uid)).toBe(false);
  });
});
