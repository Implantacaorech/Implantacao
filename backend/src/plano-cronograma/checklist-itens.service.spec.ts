import { Test, TestingModule } from '@nestjs/testing';
import { ChecklistItensService } from './checklist-itens.service';
import { ChecklistItensRepository } from './repositories/checklist-itens.repository';
import { ModificacoesService } from './modificacoes.service';
import { ChecklistModeloService } from '../catalogos/checklist-modelo.service';
import { Projeto } from '../database/entities/projeto.entity';

describe('ChecklistItensService', () => {
  let service: ChecklistItensService;
  // Dublê do REPOSITORY — ver a nota equivalente em cronograma-itens.service.spec.ts.
  const repo = { doProjeto: jest.fn(), substituir: jest.fn() };
  const modificacoes = { registrar: jest.fn() };
  const checklistModelo = { listarPorModulos: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChecklistItensService,
        { provide: ChecklistItensRepository, useValue: repo },
        { provide: ModificacoesService, useValue: modificacoes },
        { provide: ChecklistModeloService, useValue: checklistModelo },
      ],
    }).compile();
    service = module.get(ChecklistItensService);
  });

  describe('salvar', () => {
    it('substitui todas as linhas e registra o histórico', async () => {
      repo.doProjeto.mockResolvedValue([
        {
          modulo: 'FAT',
          item: 'x',
          responsavel: '',
          status: 'Pendente',
          obs: '',
        },
      ]);
      const mudancas = await service.salvar(
        1,
        [
          {
            modulo: 'FAT',
            item: 'x',
            responsavel: '',
            status: 'Concluído',
            obs: '',
          },
        ],
        'Ana',
      );
      expect(mudancas).toBe(1);
      expect(modificacoes.registrar).toHaveBeenCalledWith(
        1,
        'checklist',
        'linha 1 · status',
        'status',
        'Pendente',
        'Concluído',
        'Ana',
      );
      expect(repo.substituir).toHaveBeenCalledWith(1, [
        expect.objectContaining({
          projetoId: 1,
          ordem: 0,
          modulo: 'FAT',
          status: 'Concluído',
        }),
      ]);
    });
  });

  describe('gerarRoteiroDoCatalogo', () => {
    function projeto(over: Partial<Projeto> = {}): Projeto {
      return { id: 1, modulos: 'FAT', consultor: 'Beto', ...over } as Projeto;
    }

    it('usa o catálogo ChecklistModelo (não relê o YAML) e monta item + ação', async () => {
      checklistModelo.listarPorModulos.mockResolvedValue([
        {
          modulo: 'FAT',
          adicional: '',
          item: 'Emitir nota',
          acao: 'conferir tributação',
          menu: '2.1.A',
        },
      ]);
      const linhas = await service.gerarRoteiroDoCatalogo(projeto());
      expect(checklistModelo.listarPorModulos).toHaveBeenCalledWith(['FAT']);
      expect(linhas).toEqual([
        {
          modulo: 'FAT',
          item: 'Emitir nota — conferir tributação',
          responsavel: 'Beto',
          status: 'Pendente',
          obs: '2.1.A',
        },
      ]);
    });

    it('prefere "adicional" sobre "modulo" quando ambos vêm preenchidos', async () => {
      checklistModelo.listarPorModulos.mockResolvedValue([
        { modulo: 'FAT', adicional: 'FAT-NFCe', item: 'x', acao: '', menu: '' },
      ]);
      const linhas = await service.gerarRoteiroDoCatalogo(projeto());
      expect(linhas[0].modulo).toBe('FAT-NFCe');
    });

    it('sem ação, o item fica só com o texto original (sem travessão solto)', async () => {
      checklistModelo.listarPorModulos.mockResolvedValue([
        {
          modulo: 'FAT',
          adicional: '',
          item: 'Emitir nota',
          acao: '',
          menu: '',
        },
      ]);
      const linhas = await service.gerarRoteiroDoCatalogo(projeto());
      expect(linhas[0].item).toBe('Emitir nota');
    });
  });
});
