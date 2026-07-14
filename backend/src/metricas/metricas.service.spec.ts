import { Test, TestingModule } from '@nestjs/testing';
import { MetricasService } from './metricas.service';
import { Projeto } from '../database/entities/projeto.entity';

// 2026-08-10 é uma segunda-feira.
const HOJE = new Date('2026-08-10T12:00:00');

function projeto(over: Partial<Projeto> = {}): Projeto {
  return {
    id: 1,
    cliente: 'Cliente X',
    cnpj: '00.000.000/0001-00',
    numeroProjeto: 'P1',
    numeroProposta: '',
    ramo: '',
    responsavel: '',
    consultor: '',
    gci: '',
    etapa: 'Agendamento',
    situacao: 'Em andamento',
    dataInicio: '',
    dataLevantamento: '',
    dataUsoOficial: '',
    dataEncerramento: '',
    horasCobradas: '',
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
  } as Projeto;
}

describe('MetricasService', () => {
  let service: MetricasService;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(HOJE);
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricasService],
    }).compile();
    service = module.get(MetricasService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('camposFaltantes / gateStatus / podeAvancar', () => {
    it('acusa os campos obrigatórios vazios da etapa', () => {
      const p = projeto({ etapa: 'Agendamento', cliente: '', cnpj: 'x', horasCobradas: '10' });
      const faltam = service.camposFaltantes('Agendamento', p);
      expect(faltam.map((f) => f.campo)).toEqual(
        expect.arrayContaining(['cliente', 'gci', 'dataLevantamento']),
      );
      expect(faltam.map((f) => f.campo)).not.toContain('cnpj');
    });

    it('gateStatus: documento presente marca ok, ausente marca faltante', () => {
      const g = service.gateStatus('Projeto', [{ tipo: 'levantamento' }]);
      expect(g.ok).toBe(true);
      expect(g.itens).toEqual([{ tipo: 'levantamento', label: 'Mapeamento (Levantamento)', ok: true }]);

      const g2 = service.gateStatus('Encerramento', [{ tipo: 'levantamento' }, { tipo: 'projeto' }]);
      expect(g2.ok).toBe(false);
      expect(g2.faltam).toEqual(['Cronograma', 'Check List']);
    });

    it('podeAvancar bloqueia por campo obrigatório da etapa atual', () => {
      const p = projeto({ etapa: 'Agendamento', cliente: '' });
      const r = service.podeAvancar('Agendamento', p, []);
      expect(r.ok).toBe(false);
      expect(r.bloqueios).toEqual(expect.arrayContaining([expect.stringContaining('Razão Social')]));
    });

    it('podeAvancar bloqueia por documento pendente do gate da PRÓXIMA etapa', () => {
      const p = projeto({
        etapa: 'Levantamento',
        cliente: 'X',
        cnpj: 'x',
        numeroProjeto: 'x',
        horasCobradas: '1',
        gci: 'Ana',
        dataLevantamento: '2026-08-01',
      });
      const r = service.podeAvancar('Levantamento', p, []); // sem doc "levantamento" -> bloqueia entrada em Projeto
      expect(r.ok).toBe(false);
      expect(r.bloqueios).toEqual(
        expect.arrayContaining([expect.stringContaining('Mapeamento (Levantamento)')]),
      );
    });

    it('podeAvancar bloqueia por ação de entrada não cumprida (GCI + data do levantamento)', () => {
      const p = projeto({
        etapa: 'Agendamento',
        cliente: 'X',
        cnpj: 'x',
        numeroProjeto: 'x',
        horasCobradas: '1',
        modulos: 'FAT',
        gci: '',
        dataLevantamento: '',
      });
      const r = service.podeAvancar('Agendamento', p, [{ tipo: 'levantamento' }]);
      expect(r.ok).toBe(false);
      expect(r.bloqueios).toEqual(
        expect.arrayContaining([expect.stringContaining('Definir GCI e Data do Levantamento')]),
      );
    });

    it('podeAvancar libera quando tudo está preenchido/presente', () => {
      const p = projeto({
        etapa: 'Agendamento',
        cliente: 'X',
        cnpj: 'x',
        numeroProjeto: 'x',
        horasCobradas: '1',
        modulos: 'FAT',
        gci: 'Ana',
        dataLevantamento: '2026-08-01',
      });
      const r = service.podeAvancar('Agendamento', p, []); // Levantamento não exige doc nenhum
      expect(r.ok).toBe(true);
      expect(r.bloqueios).toEqual([]);
    });
  });

  describe('metricas', () => {
    it('agrega por situação/etapa, calcula atrasados (ordenados por dias desc) e gate pendente', () => {
      const projetos = [
        projeto({ id: 1, situacao: 'Em andamento', etapa: 'Projeto', dataUsoOficial: '2026-08-01', consultor: 'Ana' }), // 9 dias atrasado
        projeto({ id: 2, situacao: 'Em andamento', etapa: 'Projeto', dataUsoOficial: '2026-08-05', consultor: 'Ana' }), // 5 dias atrasado
        projeto({ id: 3, situacao: 'Em risco', etapa: 'Designação', consultor: 'Beto' }),
        projeto({
          id: 4,
          situacao: 'Concluído',
          etapa: 'Encerramento',
          dataInicio: '2026-01-01',
          dataUsoOficial: '2026-03-01',
        }),
      ];
      const m = service.metricas(projetos, { 1: [], 2: [{ tipo: 'levantamento' }] });

      expect(m.total).toBe(4);
      expect(m.concluidos).toBe(1);
      expect(m.ativos).toBe(3);
      expect(m.atrasados.map((a) => a.id)).toEqual([1, 2]); // 9 dias antes de 5 dias
      expect(m.nRisco).toBe(1);
      expect(m.gatePendente).toBe(2); // etapa "Projeto" exige "levantamento" — nenhum dos 2 tem doc completo do gate (Projeto exige só 'levantamento'; #2 tem)
      expect(m.consultores.find((c) => c.consultor === 'Ana')?.projetos).toBe(2);
      expect(m.ttvMedio).toBe(59); // 2026-01-01 -> 2026-03-01
    });
  });

  describe('alertas', () => {
    it('gera alerta de atraso (go-live vencido) e de risco, ignora projetos concluídos', () => {
      const projetos = [
        projeto({ id: 1, situacao: 'Em andamento', dataUsoOficial: '2026-08-01' }),
        projeto({ id: 2, situacao: 'Em risco' }),
        projeto({ id: 3, situacao: 'Concluído', dataUsoOficial: '2026-01-01' }),
      ];
      const out = service.alertas(projetos, {});
      const tipos = out.map((a) => `${a.projetoId}:${a.tipo}`);
      expect(tipos).toContain('1:atraso');
      expect(tipos).toContain('2:risco');
      expect(out.every((a) => a.projetoId !== 3)).toBe(true);
      expect(out[0].nivel).toBe('alto'); // alto vem antes de médio
    });

    it('gera alerta de SLA de cronograma quando passou o prazo útil sem o documento', () => {
      const p = projeto({ id: 1, dataInicio: '2026-08-01' }); // 7 dias corridos atrás, > 5 dias úteis
      const out = service.alertas([p], {});
      expect(out.some((a) => a.tipo === 'sla')).toBe(true);
    });

    it('não gera alerta de SLA quando o cronograma já existe', () => {
      const p = projeto({ id: 1, dataInicio: '2026-08-01' });
      const out = service.alertas([p], { 1: [{ tipo: 'cronograma' }] });
      expect(out.some((a) => a.tipo === 'sla')).toBe(false);
    });

    it('gera alerta de hypercare (Encerramento há mais de 15 dias do go-live)', () => {
      const p = projeto({ id: 1, etapa: 'Encerramento', dataUsoOficial: '2026-07-01' });
      const out = service.alertas([p], {});
      expect(out.some((a) => a.tipo === 'encerramento')).toBe(true);
    });

    it('gera alerta de "parado" quando não atualiza há >= 14 dias', () => {
      const p = projeto({ id: 1, atualizadoEm: new Date('2026-07-01T12:00:00') });
      const out = service.alertas([p], {});
      expect(out.some((a) => a.tipo === 'parado')).toBe(true);
    });
  });

  describe('metricasUso', () => {
    it('conta eventos recentes por tipo e projetos novos no período', () => {
      const eventos = [
        { id: 1, projetoId: 1, tipo: 'documento', criadoEm: new Date('2026-08-05') },
        { id: 2, projetoId: 1, tipo: 'documento', criadoEm: new Date('2026-08-05') },
        { id: 3, projetoId: 1, tipo: 'email', criadoEm: new Date('2026-08-05') },
        { id: 4, projetoId: 1, tipo: 'nota', criadoEm: new Date('2020-01-01') }, // fora da janela
      ];
      const projetos = [projeto({ id: 1, criadoEm: new Date('2026-08-01') })];
      const uso = service.metricasUso(eventos, projetos, 30);
      expect(uso.documentos).toBe(2);
      expect(uso.emails).toBe(1);
      expect(uso.notas).toBe(0);
      expect(uso.totalEventos).toBe(3);
      expect(uso.projetosNovos).toBe(1);
    });
  });

  describe('funilMacro', () => {
    it('agrupa por macro-fase e calcula idade média em dias', () => {
      const projetos = [
        projeto({ etapa: 'Agendamento', criadoEm: new Date('2026-08-05') }), // 5 dias
        projeto({ etapa: 'Agendamento', criadoEm: new Date('2026-08-08') }), // 2 dias
        projeto({ etapa: 'Projeto', criadoEm: new Date('2026-08-01') }), // 9 dias
      ];
      const funil = service.funilMacro(projetos);
      const agendamento = funil.find((f) => f.fase === 'Agendamento')!;
      expect(agendamento.n).toBe(2);
      expect(agendamento.idadeMedia).toBe(4); // média(5,2) arredondado
      const projetoFase = funil.find((f) => f.fase === 'Projeto')!;
      expect(projetoFase.idadeMedia).toBe(9);
    });
  });

  describe('cabecalho', () => {
    it('próxima ação = documento pendente do gate da próxima etapa', () => {
      const p = projeto({ etapa: 'Levantamento', gci: 'Ana', dataLevantamento: '2026-08-01' });
      const c = service.cabecalho(p, []);
      expect(c.proxima).toEqual({ tipo: 'levantamento', label: 'Mapeamento (Levantamento)', ok: false });
      expect(c.proxEtapa).toBe('Projeto');
    });

    it('próxima ação = "Definir GCI" quando o gate está ok mas falta o GCI', () => {
      const p = projeto({ etapa: 'Agendamento', gci: '', dataLevantamento: '' });
      const c = service.cabecalho(p, [{ tipo: 'levantamento' }]);
      expect(c.proxima).toEqual({ tipo: 'acao:definir_gci', label: 'Definir GCI Responsável', ok: false });
    });

    it('próxima ação = "Definir Data do Levantamento" quando o GCI já foi definido', () => {
      const p = projeto({ etapa: 'Agendamento', gci: 'Ana', dataLevantamento: '' });
      const c = service.cabecalho(p, [{ tipo: 'levantamento' }]);
      expect(c.proxima).toEqual({
        tipo: 'acao:data_levantamento',
        label: 'Definir Data do Levantamento',
        ok: false,
      });
    });

    it('stepper marca fases anteriores como "done" e a atual como "atual"', () => {
      const p = projeto({ etapa: 'Designação' });
      const c = service.cabecalho(p, []);
      expect(c.stepper.find((s) => s.nome === 'Agendamento')?.estado).toBe('done');
      expect(c.stepper.find((s) => s.nome === 'Designação')?.estado).toBe('atual');
      expect(c.stepper.find((s) => s.nome === 'Encerramento')?.estado).toBe('futuro');
    });

    it('calcula atraso em dias quando o go-live já venceu e o projeto não está concluído', () => {
      const p = projeto({ etapa: 'Cronograma e Check-list', dataUsoOficial: '2026-08-01', situacao: 'Em andamento' });
      const c = service.cabecalho(p, []);
      expect(c.atraso).toBe(9);
    });

    it('não calcula atraso para projeto concluído', () => {
      const p = projeto({ dataUsoOficial: '2026-08-01', situacao: 'Concluído' });
      const c = service.cabecalho(p, []);
      expect(c.atraso).toBeNull();
    });
  });
});
