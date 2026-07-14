import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CapacidadeService } from './capacidade.service';
import { Usuario } from '../database/entities/usuario.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { AtividadeCronograma } from '../database/entities/atividade-cronograma.entity';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { MatrizService } from '../matriz/matriz.service';

// 2026-08-03 é uma segunda-feira — mesma data de referência usada em
// distribuicao.service.spec.ts, para manter os testes de data consistentes no repo.
const HOJE = new Date('2026-08-03T12:00:00Z');

describe('CapacidadeService', () => {
  let service: CapacidadeService;
  const usuarios = { find: jest.fn() };
  const projetos = { find: jest.fn() };
  const atividades = { find: jest.fn() };
  const disponibilidade = { configurado: jest.fn(), ocupacaoPorSlotCache: jest.fn() };
  const matriz = { listar: jest.fn(), notas: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(HOJE);
    projetos.find.mockResolvedValue([]);
    atividades.find.mockResolvedValue([]);
    disponibilidade.configurado.mockReturnValue(false);
    matriz.listar.mockResolvedValue([]);
    matriz.notas.mockImplementation((t: { notas: string }) => JSON.parse(t.notas || '{}'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CapacidadeService,
        { provide: getRepositoryToken(Usuario), useValue: usuarios },
        { provide: getRepositoryToken(Projeto), useValue: projetos },
        { provide: getRepositoryToken(AtividadeCronograma), useValue: atividades },
        { provide: DisponibilidadeService, useValue: disponibilidade },
        { provide: MatrizService, useValue: matriz },
      ],
    }).compile();
    service = module.get(CapacidadeService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function usuario(over: Partial<Usuario> = {}): Usuario {
    return {
      id: 1,
      login: 'x',
      nome: 'Ana',
      email: '',
      senhaHash: '',
      perfil: 'Consultor',
      codigoSicla: '007',
      ativo: true,
      criadoEm: new Date(),
      ...over,
    } as Usuario;
  }

  it('sem módulos pedidos, sem carga e sem ocupação: score alto e veredito "Pronto"', async () => {
    usuarios.find.mockResolvedValue([usuario()]);

    const r = await service.avaliarEquipe([], 6);

    expect(r.equipe).toHaveLength(1);
    const ana = r.equipe[0];
    expect(ana.livresSemana).toEqual([10, 10, 10, 10, 10, 10]); // TURNOS_SEMANA cheio, nada ocupado
    expect(ana.janela).toBe('2026-08-03'); // primeira semana já serve, a partir de hoje
    expect(ana.veredito).toBe('Pronto');
    expect(ana.score).toBeGreaterThanOrEqual(75); // 0.45*0.5 + 0.35*1.0 + 0.2*1.0 = ~77-78
  });

  it('módulo pedido sem nota na Matriz -> veredito "Sem nota nos módulos"', async () => {
    usuarios.find.mockResolvedValue([usuario()]);
    matriz.listar.mockResolvedValue([{ id: 1, nome: '007', notas: '{}' }]);

    const r = await service.avaliarEquipe(['FAT'], 6);

    expect(r.equipe[0].semNota).toEqual(['FAT']);
    expect(r.equipe[0].veredito).toBe('Sem nota nos módulos');
    expect(r.equipe[0].temMatriz).toBe(true);
  });

  it('módulo pedido com nota alta -> conta na média e no score, veredito "Pronto"', async () => {
    usuarios.find.mockResolvedValue([usuario()]);
    matriz.listar.mockResolvedValue([{ id: 1, nome: '007', notas: JSON.stringify({ FAT: 9 }) }]);

    const r = await service.avaliarEquipe(['fat'], 6); // case-insensitive

    expect(r.equipe[0].notasModulos).toEqual({ FAT: 9 });
    expect(r.equipe[0].media).toBe(9);
    expect(r.equipe[0].veredito).toBe('Pronto');
  });

  it('carga cheia (>= CARGA_CHEIA clientes ativos) rebaixa para "Parcial" mesmo com nota boa', async () => {
    usuarios.find.mockResolvedValue([usuario()]);
    matriz.listar.mockResolvedValue([{ id: 1, nome: '007', notas: JSON.stringify({ FAT: 9 }) }]);
    projetos.find.mockResolvedValue([
      { id: 1, cliente: 'A', consultor: 'Ana', gci: '', etapa: 'Projeto', dataUsoOficial: '' },
      { id: 2, cliente: 'B', consultor: 'Ana', gci: '', etapa: 'Projeto', dataUsoOficial: '' },
      { id: 3, cliente: 'C', consultor: 'Ana', gci: '', etapa: 'Projeto', dataUsoOficial: '' },
    ]);

    const r = await service.avaliarEquipe(['FAT'], 6);

    expect(r.equipe[0].clientes).toBe(3);
    expect(r.equipe[0].veredito).toBe('Parcial'); // média>=6 mas carga >= CARGA_CHEIA(3)
  });

  it('agenda do painel: turnos ocupados reduzem "livresSemana" e podem empurrar a janela', async () => {
    usuarios.find.mockResolvedValue([usuario()]);
    // Ocupa 6 dos 10 turnos da 1ª semana (seg-sex, 2 turnos/dia) -> livres = 4 < LIVRE_MIN(6)
    atividades.find.mockResolvedValue([
      { tecnico: 'Ana', data: '2026-08-03', turno: 'manha', status: 'Agendada' },
      { tecnico: 'Ana', data: '2026-08-03', turno: 'tarde', status: 'Agendada' },
      { tecnico: 'Ana', data: '2026-08-04', turno: 'manha', status: 'Solicitada' },
      { tecnico: 'Ana', data: '2026-08-04', turno: 'tarde', status: 'Solicitada' },
      { tecnico: 'Ana', data: '2026-08-05', turno: 'manha', status: 'Agendada' },
      { tecnico: 'Ana', data: '2026-08-05', turno: 'tarde', status: 'Agendada' },
    ]);

    const r = await service.avaliarEquipe([], 6);

    expect(r.equipe[0].livresSemana[0]).toBe(4);
    expect(r.equipe[0].janela).toBe('2026-08-10'); // pula pra 2ª semana (livre = 10 >= 6)
  });

  it('não consulta a disponibilidade externa quando não está configurada', async () => {
    usuarios.find.mockResolvedValue([usuario()]);
    disponibilidade.configurado.mockReturnValue(false);

    await service.avaliarEquipe([], 6);

    expect(disponibilidade.ocupacaoPorSlotCache).not.toHaveBeenCalled();
  });

  it('mescla ocupação do SICLA com a do painel (fecha o turno pra quem bate a chave)', async () => {
    usuarios.find.mockResolvedValue([usuario({ nome: 'Ana', codigoSicla: '007' })]);
    disponibilidade.configurado.mockReturnValue(true);
    disponibilidade.ocupacaoPorSlotCache.mockResolvedValue({
      '007|2026-08-03|manha': true,
      '007|2026-08-03|tarde': true,
    });

    const r = await service.avaliarEquipe([], 6);

    expect(r.equipe[0].livresSemana[0]).toBe(8); // 10 - 2 turnos ocupados pelo SICLA
  });

  it('falha ao consultar disponibilidade externa não derruba a avaliação (fail-open)', async () => {
    usuarios.find.mockResolvedValue([usuario()]);
    disponibilidade.configurado.mockReturnValue(true);
    disponibilidade.ocupacaoPorSlotCache.mockRejectedValue(new Error('Oracle indisponível'));

    const r = await service.avaliarEquipe([], 6);

    expect(r.equipe[0].livresSemana[0]).toBe(10); // segue como se não houvesse ocupação externa
  });

  it('ordena a equipe por score decrescente', async () => {
    usuarios.find.mockResolvedValue([
      usuario({ id: 1, nome: 'Ana', codigoSicla: '007' }),
      usuario({ id: 2, nome: 'Beto', codigoSicla: '008', perfil: 'GCI' }),
    ]);
    // Beto com 3 clientes ativos (carga cheia) fica com score menor que Ana (sem carga).
    projetos.find.mockResolvedValue([
      { id: 1, cliente: 'A', consultor: '', gci: 'Beto', etapa: 'Projeto', dataUsoOficial: '' },
      { id: 2, cliente: 'B', consultor: '', gci: 'Beto', etapa: 'Projeto', dataUsoOficial: '' },
      { id: 3, cliente: 'C', consultor: '', gci: 'Beto', etapa: 'Projeto', dataUsoOficial: '' },
    ]);

    const r = await service.avaliarEquipe([], 6);

    expect(r.equipe.map((e) => e.nome)).toEqual(['Ana', 'Beto']);
  });
});
