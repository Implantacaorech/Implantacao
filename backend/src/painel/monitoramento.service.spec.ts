import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MonitoramentoService } from './monitoramento.service';
import { MetricasService } from '../metricas/metricas.service';
import { Projeto } from '../database/entities/projeto.entity';
import { Documento } from '../database/entities/documento.entity';
import { CronogramaItem } from '../database/entities/cronograma-item.entity';
import { ChecklistItem } from '../database/entities/checklist-item.entity';
import { Designacao } from '../database/entities/designacao.entity';
import { UsersService } from '../users/users.service';

const HOJE = new Date('2026-08-10T12:00:00');

function projeto(over: Partial<Projeto> = {}): Projeto {
  return {
    id: 1,
    cliente: 'Cliente X',
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
    criadoEm: HOJE,
    atualizadoEm: HOJE,
    ...over,
  } as Projeto;
}

function cronogramaItem(over: Partial<CronogramaItem> = {}): CronogramaItem {
  return {
    id: 1,
    projetoId: 1,
    ordem: 0,
    etapa: 'Treinamento',
    topicos: '',
    horas: '2',
    data: '',
    modalidade: '',
    status: 'Previsto',
    ...over,
  } as CronogramaItem;
}

function checklistItem(over: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: 1,
    projetoId: 1,
    ordem: 0,
    modulo: 'FAT',
    item: 'Item',
    responsavel: '',
    status: 'Pendente',
    obs: '',
    ...over,
  } as ChecklistItem;
}

const SEM_USUARIOS = { adm: [], coordenador: [], gci: [], consultor: [] };

describe('MonitoramentoService', () => {
  let service: MonitoramentoService;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(HOJE);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoramentoService,
        MetricasService,
        { provide: getRepositoryToken(Projeto), useValue: {} },
        { provide: getRepositoryToken(Documento), useValue: {} },
        { provide: getRepositoryToken(CronogramaItem), useValue: {} },
        { provide: getRepositoryToken(ChecklistItem), useValue: {} },
        { provide: getRepositoryToken(Designacao), useValue: {} },
        { provide: UsersService, useValue: {} },
      ],
    }).compile();
    service = module.get(MonitoramentoService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('monta os 8 setores na ordem esperada, com o chart alinhado', () => {
    const r = service.avaliar([], {}, [], [], [], SEM_USUARIOS);
    expect(r.setores.map((s) => s.nome)).toEqual([
      'Comercial',
      'Administrativo',
      'Coordenação',
      'GCI',
      'Consultoria',
      'Implantação',
      'Suporte',
      'Desenvolvimento',
    ]);
    expect(r.chartSetores.labels).toEqual(r.setores.map((s) => s.nome));
    expect(r.chartSetores.pendentes).toEqual(r.setores.map((s) => s.pendentes));
  });

  it('sem nenhum projeto, saúde fica em 100', () => {
    const r = service.avaliar([], {}, [], [], [], SEM_USUARIOS);
    expect(r.saude).toBe(100);
  });

  it('projeto atrasado (go-live vencido) reduz a saúde e aparece no mapa como atrasado', () => {
    const p = projeto({ id: 1, dataUsoOficial: '2026-08-01', etapa: 'Cronograma e Check-list' });
    const r = service.avaliar([p], {}, [], [], [], SEM_USUARIOS);
    expect(r.saude).toBeLessThan(100);
    expect(r.mapa[0].atrasado).toBe(true);
    expect(r.mapa[0].id).toBe(1);
  });

  it('quirk preservada de propósito: no setor Suporte, "andamento" e "pendentes" usam o mesmo valor', () => {
    const p = projeto({ id: 1, etapa: 'Encerramento', situacao: 'Em andamento' });
    const r = service.avaliar([p], {}, [], [], [], SEM_USUARIOS);
    const suporte = r.setores.find((s) => s.nome === 'Suporte')!;
    expect(suporte.andamento).toBe(suporte.pendentes);
    expect(suporte.andamento).toBe(1);
  });

  it('mapa ordena atrasado antes de risco, e risco antes do resto', () => {
    const atrasado = projeto({ id: 1, cliente: 'Atrasado', dataUsoOficial: '2026-08-01' });
    const risco = projeto({ id: 2, cliente: 'Risco', situacao: 'Em risco' });
    const normal = projeto({ id: 3, cliente: 'Normal' });
    const r = service.avaliar([atrasado, risco, normal], {}, [], [], [], SEM_USUARIOS);
    expect(r.mapa.map((x) => x.cliente)).toEqual(['Atrasado', 'Risco', 'Normal']);
  });

  it('entregas: junta data_levantamento/data_uso_oficial + cronograma pendente, ordenadas por data', () => {
    const p = projeto({ id: 1, cliente: 'Cliente Y', dataLevantamento: '2026-09-01', dataUsoOficial: '2026-08-20' });
    const crono = cronogramaItem({ projetoId: 1, data: '15/08/2026', etapa: 'Treinamento FAT', status: 'Previsto' });
    const r = service.avaliar([p], {}, [crono], [], [], SEM_USUARIOS);
    expect(r.entregas.map((e) => e.tipo)).toEqual(['Treinamento FAT', 'Go-live', 'Levantamento']);
  });

  it('carga: soma horas e projetos por GCI/consultor (nomes separados de string bruta)', () => {
    const p1 = projeto({ id: 1, gci: 'Ana', consultor: 'Beto', horasCobradas: '10' });
    const p2 = projeto({ id: 2, gci: 'Ana', consultor: '', horasCobradas: '5' });
    const r = service.avaliar([p1, p2], {}, [], [], [], SEM_USUARIOS);
    const ana = r.carga.find((c) => c.nome === 'Ana')!;
    expect(ana.projetos).toBe(2);
    expect(ana.horas).toBe(15);
  });

  it('carga inclui designações mesmo sem o consultor estar no campo Projeto.consultor', () => {
    const p = projeto({ id: 1, consultor: '' });
    const r = service.avaliar(
      [p],
      {},
      [],
      [],
      [{ id: 1, projetoId: 1, modulo: 'FAT', consultor: 'Delta', ordem: 0, naoDistribuir: false, analista: '' }],
      SEM_USUARIOS,
    );
    expect(r.carga.find((c) => c.nome === 'Delta')?.projetos).toBe(1);
  });

  it('setor Desenvolvimento detecta por palavra-chave no item/obs do checklist', () => {
    const p = projeto({ id: 1 });
    const check = checklistItem({ projetoId: 1, item: 'Integração bancária', status: 'Pendente' });
    const r = service.avaliar([p], {}, [], [check], [], SEM_USUARIOS);
    const dev = r.setores.find((s) => s.nome === 'Desenvolvimento')!;
    expect(dev.pendentes).toBe(1);
  });

  it('projeto Concluído não entra em "ativos" nem no mapa/entregas', () => {
    const p = projeto({ id: 1, situacao: 'Concluído', dataUsoOficial: '2026-01-01' });
    const r = service.avaliar([p], {}, [], [], [], SEM_USUARIOS);
    expect(r.mapa).toEqual([]);
    expect(r.entregas).toEqual([]);
  });
});
