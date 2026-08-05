import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HomeService } from './home.service';
import { MetricasService } from '../metricas/metricas.service';
import { Projeto } from '../database/entities/projeto.entity';
import { Documento } from '../database/entities/documento.entity';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const HOJE = new Date('2026-08-10T12:00:00');

function projeto(over: Partial<Projeto> = {}): Projeto {
  return {
    id: 1,
    cliente: 'Cliente X',
    cnpj: 'x',
    numeroProjeto: 'x',
    numeroProposta: '',
    ramo: '',
    responsavel: '',
    consultor: '',
    gci: 'Ana',
    etapa: 'Levantamento',
    situacao: 'Em andamento',
    dataInicio: '',
    dataLevantamento: '2026-08-01',
    dataUsoOficial: '',
    dataEncerramento: '',
    horasCobradas: '1',
    horasBonificadas: '',
    modulos: 'FAT',
    contatoNome: '',
    contatoEmail: '',
    contatoTel: '',
    contatos: '',
    observacoes: '',
    criadoEm: HOJE,
    atualizadoEm: HOJE,
    ...over,
  };
}

function usuario(over: Partial<AuthUser> = {}): AuthUser {
  return {
    sub: 1,
    login: 'x',
    nome: 'Ana',
    perfil: 'ADM',
    codigoSicla: '',
    ...over,
  };
}

describe('HomeService', () => {
  let service: HomeService;
  const projetos = { find: jest.fn() };
  const documentos = { find: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(HOJE);
    documentos.find.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeService,
        MetricasService,
        { provide: getRepositoryToken(Projeto), useValue: projetos },
        { provide: getRepositoryToken(Documento), useValue: documentos },
      ],
    }).compile();
    service = module.get(HomeService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sem projetos ativos: foco nulo e nenhuma pendência', async () => {
    projetos.find.mockResolvedValue([projeto({ situacao: 'Concluído' })]);

    const r = await service.painel(usuario());

    expect(r.foco).toBeNull();
    expect(r.pendencias).toEqual([]);
  });

  it('pendência = documento faltante do gate da próxima etapa', async () => {
    projetos.find.mockResolvedValue([
      projeto({ id: 1, etapa: 'Levantamento' }),
    ]);

    const r = await service.painel(usuario());

    expect(r.pendencias).toHaveLength(1);
    expect(r.pendencias[0]).toMatchObject({ id: 1, tipo: 'levantamento' });
  });

  it('sem pendência de documento/ação, mas com gate ok -> "Avançar para X"', async () => {
    // Levantamento não exige nenhum doc para SI mesma (GATES.Levantamento=[]); a próxima
    // etapa (Designação, passos 8-9) exige "levantamento", que aqui está presente -> sem
    // próxima ação de doc; a ação de entrada da Designação é "gci definido", que o projeto
    // de teste tem -> avancarOk true -> "Avançar para Designação".
    documentos.find.mockResolvedValue([
      {
        id: 1,
        projetoId: 1,
        tipo: 'levantamento',
        arquivo: '',
        caminho: '',
        origem: 'gerado',
        criadoEm: HOJE,
      },
    ]);
    projetos.find.mockResolvedValue([
      projeto({ id: 1, etapa: 'Levantamento' }),
    ]);

    const r = await service.painel(usuario());

    expect(r.pendencias[0]).toMatchObject({
      id: 1,
      tipo: 'avancar',
      acao: 'Avançar para Designação',
    });
  });

  it('ordena pendências por atraso desc, sem atraso por último', async () => {
    projetos.find.mockResolvedValue([
      projeto({ id: 1, etapa: 'Levantamento', dataUsoOficial: '' }), // sem atraso (etapa não expõe dataUsoOficial vencida)
      projeto({
        id: 2,
        etapa: 'Cronograma e Check-list',
        consultor: 'Ana',
        dataUsoOficial: '2026-08-01', // 9 dias de atraso
      }),
    ]);

    const r = await service.painel(usuario());

    expect(r.pendencias.map((p) => p.id)).toEqual([2, 1]);
  });

  it('foco = projeto ativo atualizado mais recentemente', async () => {
    projetos.find.mockResolvedValue([
      projeto({ id: 1, atualizadoEm: new Date('2026-08-01') }),
      projeto({ id: 2, atualizadoEm: new Date('2026-08-09') }),
    ]);

    const r = await service.painel(usuario());

    expect(r.foco?.projeto.id).toBe(2);
  });
});
