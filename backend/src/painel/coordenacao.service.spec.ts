import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CoordenacaoService } from './coordenacao.service';
import { MetricasService } from '../metricas/metricas.service';
import { Projeto } from '../database/entities/projeto.entity';
import { Documento } from '../database/entities/documento.entity';
import type { AuthUser } from '../common/decorators/current-user.decorator';

function projeto(over: Partial<Projeto> = {}): Projeto {
  return {
    id: 1,
    cliente: 'X',
    cnpj: '',
    numeroProjeto: '',
    numeroProposta: '',
    ramo: '',
    responsavel: '',
    consultor: '',
    gci: '',
    etapa: 'Projeto',
    situacao: 'Em andamento',
    dataInicio: '',
    dataLevantamento: '',
    dataUsoOficial: '',
    dataEncerramento: '',
    horasCobradas: '',
    horasBonificadas: '',
    modulos: '',
    contatoNome: '',
    contatoEmail: '',
    contatoTel: '',
    contatos: '',
    observacoes: '',
    criadoEm: new Date(),
    atualizadoEm: new Date(),
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

describe('CoordenacaoService', () => {
  let service: CoordenacaoService;
  const projetos = { find: jest.fn() };
  const documentos = { find: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    documentos.find.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoordenacaoService,
        MetricasService,
        { provide: getRepositoryToken(Projeto), useValue: projetos },
        { provide: getRepositoryToken(Documento), useValue: documentos },
      ],
    }).compile();
    service = module.get(CoordenacaoService);
  });

  it('filtra por visibilidade (GCI só vê os projetos onde é o GCI) antes de agregar', async () => {
    projetos.find.mockResolvedValue([
      projeto({ id: 1, gci: 'Beto' }),
      projeto({ id: 2, gci: 'Outro' }),
    ]);

    const r = await service.painel(usuario({ nome: 'Beto', perfil: 'GCI' }));

    expect(r.m.total).toBe(1);
  });

  it('devolve etapas/situações e a agregação de métricas + alertas', async () => {
    projetos.find.mockResolvedValue([projeto({ id: 1, situacao: 'Em risco' })]);

    const r = await service.painel(usuario());

    expect(r.etapas).toContain('Encerramento');
    expect(r.situacoes).toContain('Em risco');
    expect(r.m.nRisco).toBe(1);
    expect(r.alertas.some((a) => a.tipo === 'risco')).toBe(true);
  });
});
