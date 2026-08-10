import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventoRepository } from '../database/repositories/evento.repository';
import { ProjetoRepository } from '../database/repositories/projeto.repository';
import { ChecklistItensService } from './checklist-itens.service';
import { CronogramaItensService } from './cronograma-itens.service';
import { ModificacoesService } from './modificacoes.service';
import { PlanoCronogramaService } from './plano-cronograma.service';

/** Estas regras existiam no controller e não tinham teste — eram alcançáveis só por HTTP.
 * Ao descerem para o service (Guia Mestre §Responsabilidades), passam a ser verificáveis
 * diretamente: 404 de projeto inexistente, registro na timeline e releitura do estado. */
describe('PlanoCronogramaService', () => {
  let service: PlanoCronogramaService;
  const projetos = { porId: jest.fn() };
  const eventos = { registrar: jest.fn() };
  const cronogramaItens = {
    doProjeto: jest.fn(),
    salvar: jest.fn(),
    gerarPlanoAutomatico: jest.fn(),
  };
  const checklistItens = {
    doProjeto: jest.fn(),
    salvar: jest.fn(),
    gerarRoteiroDoCatalogo: jest.fn(),
  };
  const modificacoes = { doProjeto: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    projetos.porId.mockResolvedValue({ id: 1, consultor: 'Ana' });
    cronogramaItens.doProjeto.mockResolvedValue([]);
    checklistItens.doProjeto.mockResolvedValue([]);
    modificacoes.doProjeto.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanoCronogramaService,
        { provide: ProjetoRepository, useValue: projetos },
        { provide: EventoRepository, useValue: eventos },
        { provide: CronogramaItensService, useValue: cronogramaItens },
        { provide: ChecklistItensService, useValue: checklistItens },
        { provide: ModificacoesService, useValue: modificacoes },
      ],
    }).compile();
    service = module.get(PlanoCronogramaService);
  });

  describe('projeto inexistente', () => {
    it('todas as operações recusam com 404 antes de tocar em qualquer dado', async () => {
      projetos.porId.mockResolvedValue(null);
      const operacoes = [
        () => service.obterCronograma(9),
        () => service.salvarCronograma(9, [], 'Ana'),
        () => service.seedCronograma(9, 'Ana'),
        () => service.obterChecklist(9),
        () => service.salvarChecklist(9, [], 'Ana'),
        () => service.seedChecklist(9, 'Ana'),
      ];
      for (const operacao of operacoes) {
        await expect(operacao()).rejects.toBeInstanceOf(NotFoundException);
      }
      expect(cronogramaItens.salvar).not.toHaveBeenCalled();
      expect(checklistItens.salvar).not.toHaveBeenCalled();
      expect(eventos.registrar).not.toHaveBeenCalled();
    });
  });

  describe('cronograma', () => {
    it('obter devolve linhas + histórico filtrado pela entidade "cronograma"', async () => {
      cronogramaItens.doProjeto.mockResolvedValue([{ id: 7 }]);
      modificacoes.doProjeto.mockResolvedValue([{ id: 3 }]);
      const saida = await service.obterCronograma(1);
      expect(modificacoes.doProjeto).toHaveBeenCalledWith(1, 'cronograma');
      expect(saida).toEqual({ itens: [{ id: 7 }], historico: [{ id: 3 }] });
    });

    it('salvar registra a nota na timeline com a contagem de alterações', async () => {
      cronogramaItens.salvar.mockResolvedValue(2);
      const saida = await service.salvarCronograma(1, [], 'Ana');
      expect(eventos.registrar).toHaveBeenCalledWith(
        1,
        'nota',
        'Cronograma editado (2 alteração(ões)).',
        'Ana',
      );
      expect(saida.mudancas).toBe(2);
    });

    it('seed gera o plano a partir do PROJETO e registra o nº de agendas', async () => {
      cronogramaItens.gerarPlanoAutomatico.mockResolvedValue([{}, {}, {}]);
      cronogramaItens.salvar.mockResolvedValue(3);
      await service.seedCronograma(1, 'Ana');
      expect(cronogramaItens.gerarPlanoAutomatico).toHaveBeenCalledWith({
        id: 1,
        consultor: 'Ana',
      });
      expect(eventos.registrar).toHaveBeenCalledWith(
        1,
        'nota',
        'Cronograma carregado do plano automático (3 agendas).',
        'Ana',
      );
    });

    it('devolve o estado RELIDO do banco, não as linhas enviadas', async () => {
      cronogramaItens.salvar.mockResolvedValue(1);
      cronogramaItens.doProjeto.mockResolvedValue([{ id: 99, ordem: 0 }]);
      const saida = await service.salvarCronograma(1, [{ etapa: 'X' }], 'Ana');
      expect(saida.itens).toEqual([{ id: 99, ordem: 0 }]);
    });
  });

  describe('check list', () => {
    it('obter filtra o histórico pela entidade "checklist"', async () => {
      await service.obterChecklist(1);
      expect(modificacoes.doProjeto).toHaveBeenCalledWith(1, 'checklist');
    });

    it('salvar registra a nota na timeline', async () => {
      checklistItens.salvar.mockResolvedValue(4);
      await service.salvarChecklist(1, [], 'Beto');
      expect(eventos.registrar).toHaveBeenCalledWith(
        1,
        'nota',
        'Check-list editado (4 alteração(ões)).',
        'Beto',
      );
    });

    it('seed usa o roteiro do catálogo e registra o nº de itens', async () => {
      checklistItens.gerarRoteiroDoCatalogo.mockResolvedValue([{}, {}]);
      checklistItens.salvar.mockResolvedValue(2);
      await service.seedChecklist(1, 'Beto');
      expect(checklistItens.gerarRoteiroDoCatalogo).toHaveBeenCalledWith({
        id: 1,
        consultor: 'Ana',
      });
      expect(eventos.registrar).toHaveBeenCalledWith(
        1,
        'nota',
        'Check-list carregado do roteiro dos módulos (2 itens).',
        'Beto',
      );
    });
  });
});
