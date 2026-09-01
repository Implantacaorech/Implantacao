import { Test, TestingModule } from '@nestjs/testing';
import { BuscaService } from './busca.service';
import { QuadrosRepository } from './repositories/quadros.repository';
import { ListasRepository } from './repositories/listas.repository';
import { CartoesRepository } from './repositories/cartoes.repository';
import { QuadrosService } from './quadros.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const USER = {
  sub: 7,
  login: 'ever',
  nome: 'Everton',
  perfil: 'Consultor',
  perfis: ['Consultor'],
  codigoSicla: '',
} as AuthUser;

const QUADROS = [
  { id: 1, codigoClienteSicla: '10482', nomeCliente: 'Vale Verde' },
  { id: 2, codigoClienteSicla: '20913', nomeCliente: 'Serra Azul' },
];
const LISTAS = [
  { id: 10, quadroId: 1, titulo: 'A fazer', visivelCliente: true },
  { id: 11, quadroId: 1, titulo: 'Bastidor Rech', visivelCliente: false },
  { id: 20, quadroId: 2, titulo: 'A fazer', visivelCliente: true },
];
const cartao = (over: Record<string, unknown>) => ({
  id: 1,
  listaId: 10,
  quadroId: 1,
  titulo: '',
  descricao: '',
  etiquetas: '',
  visivelCliente: false,
  concluidoEm: null,
  ...over,
});
const CARTOES = [
  cartao({ id: 100, titulo: 'Conferir cadastro de NCM', visivelCliente: true }),
  cartao({ id: 101, titulo: 'Cobrar a RNS de conversão', listaId: 11 }),
  cartao({
    id: 102,
    titulo: 'Bastidor: risco fiscal',
    descricao: 'conversão travada',
  }),
  cartao({
    id: 200,
    quadroId: 2,
    listaId: 20,
    titulo: 'Mapear conversão de produtos',
    visivelCliente: true,
  }),
];

describe('BuscaService', () => {
  let service: BuscaService;
  const quadros = { listar: jest.fn(), responsaveis: jest.fn() };
  const listas = { dosQuadros: jest.fn() };
  const cartoes = { dosQuadros: jest.fn() };
  const quadrosSvc = { contexto: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    quadros.listar.mockResolvedValue(QUADROS);
    quadros.responsaveis.mockResolvedValue([
      { quadroId: 1, usuarioId: 7 },
      { quadroId: 2, usuarioId: 9 },
    ]);
    listas.dosQuadros.mockResolvedValue(LISTAS);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuscaService,
        { provide: QuadrosRepository, useValue: quadros },
        { provide: ListasRepository, useValue: listas },
        { provide: CartoesRepository, useValue: cartoes },
        { provide: QuadrosService, useValue: quadrosSvc },
      ],
    }).compile();
    service = module.get(BuscaService);
  });

  function comoInterno() {
    quadrosSvc.contexto.mockResolvedValue({
      interno: true,
      codigosCliente: [],
      responsavel: false,
      podeAlterar: true,
    });
    cartoes.dosQuadros.mockResolvedValue(CARTOES);
  }

  function comoCliente() {
    quadrosSvc.contexto.mockResolvedValue({
      interno: false,
      codigosCliente: ['10482'],
      responsavel: false,
      podeAlterar: true,
    });
    // O repository já recorta em compartilhados quando o chamador pede — é o contrato.
    cartoes.dosQuadros.mockImplementation((ids: number[], so: boolean) =>
      Promise.resolve(
        CARTOES.filter(
          (c) => ids.includes(c.quadroId) && (!so || c.visivelCliente),
        ),
      ),
    );
  }

  it('não consulta nada com termo curto demais', async () => {
    comoInterno();
    const r = await service.buscar(USER, 'a');
    expect(r.total).toBe(0);
    expect(quadros.listar).not.toHaveBeenCalled();
  });

  it('acha em todos os quadros que o interno alcança', async () => {
    comoInterno();
    const r = await service.buscar(USER, 'conversão');
    expect(r.total).toBe(3);
    expect(r.quadros).toBe(2);
  });

  it('ignora acento e caixa — "conversao" acha "conversão"', async () => {
    comoInterno();
    const r = await service.buscar(USER, 'CONVERSAO');
    expect(r.total).toBe(3);
  });

  it('casa também na descrição', async () => {
    comoInterno();
    const r = await service.buscar(USER, 'travada');
    expect(r.achados.map((a) => a.cartaoId)).toEqual([102]);
  });

  it('casa pelo nome da etiqueta', async () => {
    comoInterno();
    cartoes.dosQuadros.mockResolvedValue([
      cartao({ id: 300, titulo: 'Sem palavra alguma', etiquetas: 'fisc' }),
    ]);
    const r = await service.buscar(USER, 'fiscal');
    expect(r.achados.map((a) => a.cartaoId)).toEqual([300]);
  });

  it('marca como "consulta" o achado que está em quadro de outro consultor', async () => {
    comoInterno();
    const r = await service.buscar(USER, 'conversão');
    const meu = r.achados.find((a) => a.codigoClienteSicla === '10482');
    const outro = r.achados.find((a) => a.codigoClienteSicla === '20913');
    expect(meu?.soConsulta).toBe(false);
    expect(outro?.soConsulta).toBe(true);
  });

  it('filtra por consultor — o mesmo filtro da aba "Demais consultores"', async () => {
    comoInterno();
    const r = await service.buscar(USER, 'conversão', 9);
    expect(r.quadros).toBe(1);
    expect(r.achados.every((a) => a.codigoClienteSicla === '20913')).toBe(true);
  });

  // --- o que não pode vazar ---

  it('o CLIENTE não acha cartão interno', async () => {
    comoCliente();
    const r = await service.buscar(USER, 'conversão');
    expect(r.achados.map((a) => a.cartaoId)).toEqual([]);
  });

  it('o CLIENTE não acha cartão de outro cliente', async () => {
    comoCliente();
    const r = await service.buscar(USER, 'ncm');
    expect(r.achados.every((a) => a.codigoClienteSicla === '10482')).toBe(true);
    expect(r.achados.map((a) => a.cartaoId)).toEqual([100]);
  });

  it('cartão compartilhado numa coluna INTERNA continua fora da busca do cliente', async () => {
    quadrosSvc.contexto.mockResolvedValue({
      interno: false,
      codigosCliente: ['10482'],
      responsavel: false,
      podeAlterar: true,
    });
    cartoes.dosQuadros.mockResolvedValue([
      cartao({
        id: 400,
        listaId: 11,
        titulo: 'conversão secreta',
        visivelCliente: true,
      }),
    ]);
    const r = await service.buscar(USER, 'conversão');
    expect(r.achados).toEqual([]);
  });
});
