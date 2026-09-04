import { Test, TestingModule } from '@nestjs/testing';
import { CartoesService } from './cartoes.service';
import { CartoesRepository } from './repositories/cartoes.repository';
import { ListasRepository } from './repositories/listas.repository';
import { QuadrosRepository } from './repositories/quadros.repository';
import { DetalhesCartaoRepository } from './repositories/detalhes-cartao.repository';
import { EventosAtividadeRepository } from './repositories/eventos-atividade.repository';
import { UsersService } from '../users/users.service';
import { QuadrosService } from './quadros.service';
import { NotificacoesAtividadeService } from './notificacoes-atividade.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

/** A FIAÇÃO do recorte de e-mail (regra do usuário, 2026-09-03).
 *
 * `notificacoes-atividade.service.spec.ts` prova que o service RESPEITA o recorte quando ele
 * é informado. Falta provar que quem chama de fato o INFORMA — e é justamente esse argumento
 * que uma refatoração distraída remove sem que nada mais quebre: o cartão continua sendo
 * criado, a tela continua igual, e o e-mail volta a sair para o quadro inteiro em silêncio. */

const CLIENTE = {
  sub: 99,
  login: 'contato@acme.com.br',
  nome: 'Contato ACME',
  perfil: 'Cliente',
  perfis: ['Cliente'],
  codigoSicla: '',
} as AuthUser;

/** Responsáveis pelo quadro: a "implantação inteira" que NÃO pode receber e-mail. */
const RESPONSAVEIS_DO_QUADRO = [10, 11, 12];
/** O consultor que o cliente escolheu no cartão. */
const DESIGNADO = 11;

describe('CartoesService — para quem o e-mail de atividade nova vai', () => {
  let service: CartoesService;

  const avisos = {
    responsaveisDo: jest.fn().mockResolvedValue(RESPONSAVEIS_DO_QUADRO),
    internosDoCartao: jest.fn().mockResolvedValue([]),
    enderecosDoCliente: jest.fn().mockResolvedValue([]),
    avisar: jest.fn().mockResolvedValue(undefined),
    avisarEnderecos: jest.fn().mockResolvedValue(undefined),
  };
  const listas = {
    porId: jest.fn().mockResolvedValue({
      id: 5,
      quadroId: 1,
      titulo: 'A fazer',
      visivelCliente: true,
    }),
  };
  const quadros = {
    porId: jest.fn().mockResolvedValue({
      id: 1,
      codigoClienteSicla: '3180',
      nomeCliente: 'Cliente ACME',
    }),
  };
  const cartoes = {
    daLista: jest.fn().mockResolvedValue([]),
    criar: jest.fn((d: Record<string, unknown>) =>
      Promise.resolve({ id: 50, ...d, etiquetas: '' }),
    ),
  };
  const detalhes = { incluirMembro: jest.fn().mockResolvedValue(undefined) };
  const eventos = { registrar: jest.fn().mockResolvedValue(undefined) };
  const usuarios = {
    buscarPorId: jest.fn((id: number) =>
      Promise.resolve({ id, nome: `Consultor ${id}`, perfil: 'Consultor' }),
    ),
  };
  // Contexto de um usuário-CLIENTE que alcança o quadro: é o caminho da "solicitação".
  const quadrosSvc = {
    contexto: jest.fn().mockResolvedValue({
      interno: false,
      codigosCliente: ['3180'],
      responsavel: false,
      podeAlterar: true,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    avisos.responsaveisDo.mockResolvedValue(RESPONSAVEIS_DO_QUADRO);
    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        CartoesService,
        { provide: CartoesRepository, useValue: cartoes },
        { provide: ListasRepository, useValue: listas },
        { provide: QuadrosRepository, useValue: quadros },
        { provide: DetalhesCartaoRepository, useValue: detalhes },
        { provide: EventosAtividadeRepository, useValue: eventos },
        { provide: QuadrosService, useValue: quadrosSvc },
        { provide: NotificacoesAtividadeService, useValue: avisos },
        { provide: UsersService, useValue: usuarios },
      ],
    }).compile();
    service = modulo.get(CartoesService);
  });

  /** O 8º argumento de `avisar` — a lista que de fato recebe e-mail. */
  const emailPara = (): number[] | undefined =>
    avisos.avisar.mock.calls[0]?.[7];
  /** O 6º parâmetro (índice 5) — quem recebe o aviso na tela. */
  const naTela = (): number[] => avisos.avisar.mock.calls[0]?.[5] ?? [];

  it('com consultor designado, o e-mail vai SÓ para ele', async () => {
    await service.criar(CLIENTE, {
      listaId: 5,
      titulo: 'Preciso de ajuda',
      designadoUsuarioId: DESIGNADO,
    });

    expect(avisos.avisar).toHaveBeenCalledTimes(1);
    expect(emailPara()).toEqual([DESIGNADO]);
    // A prova pelo avesso: nenhum dos outros responsáveis pelo quadro entra no e-mail.
    for (const id of RESPONSAVEIS_DO_QUADRO.filter((x) => x !== DESIGNADO)) {
      expect(emailPara()).not.toContain(id);
    }
  });

  it('mas o aviso na TELA continua indo para quem responde pelo quadro', async () => {
    await service.criar(CLIENTE, {
      listaId: 5,
      titulo: 'Preciso de ajuda',
      designadoUsuarioId: DESIGNADO,
    });
    expect(naTela()).toEqual(expect.arrayContaining(RESPONSAVEIS_DO_QUADRO));
  });

  it('SEM designado, ninguém recebe e-mail — e a solicitação ainda aparece na tela', async () => {
    await service.criar(CLIENTE, { listaId: 5, titulo: 'Sem designar' });

    expect(emailPara()).toEqual([]);
    expect(naTela()).toEqual(expect.arrayContaining(RESPONSAVEIS_DO_QUADRO));
  });

  it('o recorte é SEMPRE informado — nunca `undefined`', async () => {
    // `undefined` faria o service cair no comportamento antigo (e-mail = aviso da tela), que
    // é exatamente o que a regra proíbe. Este caso existe para pegar a remoção do argumento.
    await service.criar(CLIENTE, { listaId: 5, titulo: 'x' });
    expect(emailPara()).toBeDefined();
  });
});
