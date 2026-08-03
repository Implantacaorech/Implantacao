import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { RecuperacaoSenhaService } from './recuperacao-senha.service';
import { RecuperacaoSenha } from '../database/entities/recuperacao-senha.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { UsersService } from '../users/users.service';
import { MailerService } from '../email/mailer.service';

function usuario(over: Partial<Usuario> = {}): Usuario {
  return {
    id: 9,
    login: 'dibah@rech.com.br',
    nome: 'Dibah Luiz Lenhart',
    email: 'dibah@rech.com.br',
    perfil: 'GCI',
    ativo: true,
    ...over,
  } as Usuario;
}

/** Repositório em memória com o mínimo que o serviço usa (`createQueryBuilder` incluso —
 * o serviço busca o pedido por e-mail em LOWER()). */
function repoFake() {
  const linhas: RecuperacaoSenha[] = [];
  return {
    linhas,
    create: jest.fn((r: Partial<RecuperacaoSenha>) => ({ ...r })),
    save: jest.fn((r: RecuperacaoSenha) => {
      if (!linhas.includes(r)) {
        r.criadoEm = r.criadoEm ?? new Date();
        linhas.push(r);
      }
      return Promise.resolve(r);
    }),
    remove: jest.fn((r: RecuperacaoSenha) => {
      const i = linhas.indexOf(r);
      if (i >= 0) linhas.splice(i, 1);
      return Promise.resolve(r);
    }),
    delete: jest.fn(() => Promise.resolve({ affected: 0 })),
    createQueryBuilder: jest.fn(() => {
      let alvo = '';
      const qb = {
        where: (_sql: string, p: { email: string }) => {
          alvo = p.email;
          return qb;
        },
        orderBy: () => qb,
        getOne: () =>
          Promise.resolve(
            linhas.find((l) => l.email.toLowerCase() === alvo) ?? null,
          ),
      };
      return qb;
    }),
  };
}

describe('RecuperacaoSenhaService — "Esqueci minha senha"', () => {
  let service: RecuperacaoSenhaService;
  let pedidos: ReturnType<typeof repoFake>;
  const users = { porEmail: jest.fn(), definirSenha: jest.fn() };
  const mailer = {
    configurado: jest.fn(() => true),
    enviar: jest.fn(() => Promise.resolve({ ok: true, erro: null })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mailer.configurado.mockReturnValue(true);
    pedidos = repoFake();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        RecuperacaoSenhaService,
        { provide: getRepositoryToken(RecuperacaoSenha), useValue: pedidos },
        { provide: UsersService, useValue: users },
        { provide: MailerService, useValue: mailer },
      ],
    }).compile();
    service = mod.get(RecuperacaoSenhaService);
  });

  /** Extrai os 6 dígitos do corpo do e-mail simulado — é assim que o usuário os recebe. */
  function codigoEnviado(): string {
    const corpo = mailer.enviar.mock.calls.at(-1)?.[2] as unknown as string;
    const m = /(\d{6})/.exec(corpo);
    if (!m) throw new Error('Código não encontrado no e-mail simulado.');
    return m[1];
  }

  it('envia o código e guarda apenas o HASH dele', async () => {
    users.porEmail.mockResolvedValue(usuario());
    await service.solicitar('dibah@rech.com.br');

    expect(mailer.enviar).toHaveBeenCalledTimes(1);
    const codigo = codigoEnviado();
    const gravado = pedidos.linhas[0];
    expect(gravado.codigoHash).not.toBe(codigo); // nunca em claro na tabela
    expect(await bcrypt.compare(codigo, gravado.codigoHash)).toBe(true);
  });

  it('e-mail desconhecido não gera pedido nem e-mail — e não estoura', async () => {
    users.porEmail.mockResolvedValue(null);
    await expect(
      service.solicitar('ninguem@teste.com'),
    ).resolves.toBeUndefined();
    expect(mailer.enviar).not.toHaveBeenCalled();
    expect(pedidos.linhas).toHaveLength(0);
  });

  it('não grava pedido quando o Painel está sem e-mail configurado (o código não chegaria)', async () => {
    users.porEmail.mockResolvedValue(usuario());
    mailer.configurado.mockReturnValue(false);
    await service.solicitar('dibah@rech.com.br');
    expect(pedidos.linhas).toHaveLength(0);
  });

  it('código certo grava a senha nova e consome o pedido', async () => {
    users.porEmail.mockResolvedValue(usuario());
    await service.solicitar('dibah@rech.com.br');

    const r = await service.redefinir(
      'dibah@rech.com.br',
      codigoEnviado(),
      'senhaNova123',
    );

    expect(r).toEqual({ ok: true, usuarioId: 9 });
    expect(users.definirSenha).toHaveBeenCalledWith(9, 'senhaNova123');
    expect(pedidos.linhas).toHaveLength(0); // não dá para reusar o mesmo código
  });

  it('código errado não troca a senha e conta a tentativa', async () => {
    users.porEmail.mockResolvedValue(usuario());
    await service.solicitar('dibah@rech.com.br');

    const r = await service.redefinir(
      'dibah@rech.com.br',
      '000000',
      'senhaNova123',
    );

    expect(r.ok).toBe(false);
    expect(users.definirSenha).not.toHaveBeenCalled();
    expect(pedidos.linhas[0].tentativas).toBe(1);
  });

  it('descarta o pedido após 5 tentativas erradas', async () => {
    users.porEmail.mockResolvedValue(usuario());
    await service.solicitar('dibah@rech.com.br');

    for (let i = 0; i < 5; i++) {
      await service.redefinir('dibah@rech.com.br', '000000', 'senhaNova123');
    }
    const r = await service.redefinir(
      'dibah@rech.com.br',
      '000000',
      'senhaNova123',
    );

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toContain('Muitas tentativas');
    expect(pedidos.linhas).toHaveLength(0);
  });

  it('código expirado (mais de 15min) não vale mais', async () => {
    users.porEmail.mockResolvedValue(usuario());
    await service.solicitar('dibah@rech.com.br');
    const codigo = codigoEnviado();
    pedidos.linhas[0].criadoEm = new Date(Date.now() - 16 * 60_000);

    const r = await service.redefinir(
      'dibah@rech.com.br',
      codigo,
      'senhaNova123',
    );

    expect(r.ok).toBe(false);
    expect(users.definirSenha).not.toHaveBeenCalled();
  });

  it('pedir de novo invalida o código anterior', async () => {
    users.porEmail.mockResolvedValue(usuario());
    await service.solicitar('dibah@rech.com.br');
    const primeiro = codigoEnviado();
    pedidos.linhas.length = 0; // o serviço apaga o anterior via delete({usuarioId})
    await service.solicitar('dibah@rech.com.br');

    const r = await service.redefinir(
      'dibah@rech.com.br',
      primeiro,
      'senhaNova123',
    );

    expect(r.ok).toBe(false);
    expect(pedidos.delete).toHaveBeenCalledWith({ usuarioId: 9 });
  });
});
