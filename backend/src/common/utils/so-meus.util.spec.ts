import { soMeus } from './so-meus.util';
import { Projeto } from '../../database/entities/projeto.entity';
import type { AuthUser } from '../decorators/current-user.decorator';

function projeto(over: Partial<Projeto> = {}): Projeto {
  return { id: 1, cliente: 'X', gci: '', consultor: '', ...over } as Projeto;
}

function usuario(over: Partial<AuthUser> = {}): AuthUser {
  return {
    sub: 1,
    login: 'x',
    nome: 'Ana',
    perfil: 'Consultor',
    perfis: ['Consultor'],
    codigoSicla: '',
    ...over,
  };
}

describe('soMeus', () => {
  const todos = [
    projeto({ id: 1, gci: 'Beto' }),
    projeto({ id: 2, consultor: 'Ana' }),
    projeto({ id: 3, consultor: 'Carlos, Ana' }),
    projeto({ id: 4, gci: 'Ana, Beto' }),
    projeto({ id: 5, gci: 'Outro', consultor: 'Outro' }),
  ];

  it('ADM/Coordenador/Administrativo veem tudo', () => {
    const r = soMeus(todos, usuario({ perfil: 'ADM', perfis: ['ADM'] }));
    expect(r).toHaveLength(5);
  });

  it('considera TODOS os papéis, não só o principal', () => {
    // Perfil principal "Consultor", mas a pessoa também é Coordenadora → vê tudo.
    const r = soMeus(
      todos,
      usuario({ perfil: 'Consultor', perfis: ['Consultor', 'Coordenador'] }),
    );
    expect(r).toHaveLength(5);
  });

  it('sem papel de gestão, enxerga onde é GCI OU consultor (inclusive em lista)', () => {
    const r = soMeus(todos, usuario({ nome: 'Ana' }));
    expect(r.map((p) => p.id)).toEqual([2, 3, 4]);
  });

  it('não confunde nome que é prefixo de outro', () => {
    const r = soMeus([projeto({ id: 9, consultor: 'Ana Paula' })], usuario());
    expect(r).toHaveLength(0);
  });

  it('token antigo sem `perfis` cai no `perfil` principal', () => {
    const r = soMeus(todos, {
      sub: 1,
      login: 'x',
      nome: 'Ana',
      perfil: 'Coordenador',
      codigoSicla: '',
    } as AuthUser);
    expect(r).toHaveLength(5);
  });
});
