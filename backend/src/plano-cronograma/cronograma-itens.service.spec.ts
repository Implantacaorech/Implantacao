import { Test, TestingModule } from '@nestjs/testing';
import { CronogramaItensService } from './cronograma-itens.service';
import { CronogramaItensRepository } from './repositories/cronograma-itens.repository';
import { ModificacoesService } from './modificacoes.service';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { Projeto } from '../database/entities/projeto.entity';

describe('CronogramaItensService', () => {
  let service: CronogramaItensService;
  // Dublê do REPOSITORY (não mais do Repository<T> do TypeORM): o service passou a
  // depender da abstração de persistência, então o teste passa a exercitar o contrato do
  // módulo em vez dos verbos do ORM.
  const repo = { doProjeto: jest.fn(), substituir: jest.fn() };
  const modificacoes = { registrar: jest.fn() };
  // Por padrão, SICLA sem ocupação (o plano segue pela cadência fixa).
  const disponibilidade = { consultar: jest.fn().mockResolvedValue([]) };

  beforeEach(async () => {
    jest.clearAllMocks();
    disponibilidade.consultar.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronogramaItensService,
        { provide: CronogramaItensRepository, useValue: repo },
        { provide: ModificacoesService, useValue: modificacoes },
        { provide: DisponibilidadeService, useValue: disponibilidade },
      ],
    }).compile();
    service = module.get(CronogramaItensService);
  });

  describe('salvar', () => {
    it('substitui todas as linhas (apaga e reinsere) e registra o histórico dos diffs', async () => {
      repo.doProjeto.mockResolvedValue([
        {
          etapa: 'A',
          topicos: 't',
          horas: '2',
          data: '',
          modalidade: '',
          status: 'Previsto',
        },
      ]);

      const mudancas = await service.salvar(
        1,
        [
          {
            etapa: 'A',
            topicos: 't',
            horas: '3',
            data: '',
            modalidade: '',
            status: 'Previsto',
          },
        ],
        'Ana',
      );

      expect(mudancas).toBe(1); // só "horas" mudou
      expect(modificacoes.registrar).toHaveBeenCalledWith(
        1,
        'cronograma',
        'linha 1 · horas',
        'horas',
        '2',
        '3',
        'Ana',
      );
      expect(repo.substituir).toHaveBeenCalledWith(1, [
        expect.objectContaining({
          projetoId: 1,
          ordem: 0,
          etapa: 'A',
          horas: '3',
        }),
      ]);
    });

    it('lista vazia manda substituir por nada (quem apaga é o repository)', async () => {
      repo.doProjeto.mockResolvedValue([
        {
          etapa: 'A',
          topicos: '',
          horas: '',
          data: '',
          modalidade: '',
          status: 'Previsto',
        },
      ]);
      await service.salvar(1, [], 'Ana');
      expect(repo.substituir).toHaveBeenCalledWith(1, []);
    });
  });

  describe('gerarPlanoAutomatico', () => {
    function projeto(over: Partial<Projeto> = {}): Projeto {
      return {
        id: 1,
        modulos: '',
        consultor: '',
        horasCobradas: '',
        horasBonificadas: '',
        dataInicio: '2026-08-10', // segunda-feira
        ...over,
      } as Projeto;
    }

    it('sem módulos reconhecidos, usa o bloco genérico "Treinamento das rotinas"', async () => {
      const linhas = await service.gerarPlanoAutomatico(
        projeto({ modulos: 'XPTO_INEXISTENTE' }),
      );
      expect(linhas.some((l) => l.etapa === 'Treinamento das rotinas')).toBe(
        true,
      );
      expect(
        linhas.every(
          (l) => l.status === 'Previsto' && l.modalidade === 'A combinar',
        ),
      ).toBe(true);
    });

    it('sem consultor não consulta o SICLA: 1ª data = data_inicio, seguintes +5 dias úteis', async () => {
      const linhas = await service.gerarPlanoAutomatico(projeto());
      expect(disponibilidade.consultar).not.toHaveBeenCalled();
      expect(linhas[0].data).toBe('10/08/2026');
      expect(linhas[1].data).toBe('17/08/2026'); // +5 dias úteis
    });

    it('com consultor designado, pula o dia ocupado na agenda do SICLA', async () => {
      // 17/08 (a 2ª visita pela cadência) está ocupado -> deve ir para 18/08.
      disponibilidade.consultar.mockResolvedValue([
        { tecnico: 'Ana', data: '2026-08-17', turno: 'manha' },
      ]);
      const linhas = await service.gerarPlanoAutomatico(
        projeto({ consultor: 'Ana' }),
      );
      expect(disponibilidade.consultar).toHaveBeenCalledWith(
        '2026-08-10',
        expect.any(String),
        ['Ana'],
      );
      expect(linhas[0].data).toBe('10/08/2026');
      expect(linhas[1].data).toBe('18/08/2026'); // pulou o 17/08 ocupado
    });

    it('se a consulta ao SICLA falhar, cai na cadência fixa (não quebra a geração)', async () => {
      disponibilidade.consultar.mockRejectedValue(new Error('DPY-3015'));
      const linhas = await service.gerarPlanoAutomatico(
        projeto({ consultor: 'Ana' }),
      );
      expect(linhas[0].data).toBe('10/08/2026');
      expect(linhas[1].data).toBe('17/08/2026');
    });

    it('sem horas informadas, distribui peso*2 por etapa (fallback do _distribuir)', async () => {
      const linhas = await service.gerarPlanoAutomatico(
        projeto({ modulos: 'XPTO_INEXISTENTE' }),
      );
      const abertura = linhas.find(
        (l) => l.etapa === 'Abertura + Parametrização inicial',
      );
      expect(abertura?.horas).toBe('4'); // peso 2.0 * 2
    });

    it('distribui as horas totais proporcionalmente aos pesos quando informadas', async () => {
      const linhas = await service.gerarPlanoAutomatico(
        projeto({ modulos: 'XPTO_INEXISTENTE', horasCobradas: '20' }),
      );
      const total = linhas.reduce((acc, l) => acc + Number(l.horas), 0);
      expect(total).toBe(20); // soma bate com o total informado (método do maior resto)
    });
  });
});
