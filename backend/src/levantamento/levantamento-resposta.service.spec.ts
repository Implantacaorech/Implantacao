import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LevantamentoRespostaService } from './levantamento-resposta.service';
import { LevantamentoResposta } from '../database/entities/levantamento-resposta.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { IndiceTopicoService } from '../catalogos/indice-topico.service';

describe('LevantamentoRespostaService', () => {
  let service: LevantamentoRespostaService;
  const repo = {
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((dto) => dto),
    count: jest.fn(),
  };
  const projetos = { findOne: jest.fn() };
  const indice = { modulos: jest.fn(), listar: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LevantamentoRespostaService,
        { provide: getRepositoryToken(LevantamentoResposta), useValue: repo },
        { provide: getRepositoryToken(Projeto), useValue: projetos },
        { provide: IndiceTopicoService, useValue: indice },
      ],
    }).compile();
    service = module.get(LevantamentoRespostaService);
  });

  describe('importarDeParagrafos', () => {
    it('preenche a resposta com o texto depois do tópico, na mesma linha', async () => {
      const linhas = [{ id: 1, topico: 'Razão Social', resposta: '' }];
      repo.find.mockResolvedValue(linhas);
      const n = await service.importarDeParagrafos(1, [
        'Razão Social: Cliente Teste Ltda',
      ]);
      expect(n).toBe(1);
      expect(linhas[0].resposta).toBe('Cliente Teste Ltda');
      expect(repo.save).toHaveBeenCalledWith(linhas);
    });

    it('ignora maiúsculas/minúsculas ao casar o tópico', async () => {
      const linhas = [{ id: 1, topico: 'ramo de atividade', resposta: '' }];
      repo.find.mockResolvedValue(linhas);
      await service.importarDeParagrafos(1, ['RAMO DE ATIVIDADE: Indústria']);
      expect(linhas[0].resposta).toBe('Indústria');
    });

    it('remove separadores (":", "-", "–", "—", "•", "·") entre o tópico e a resposta', async () => {
      const linhas = [{ id: 1, topico: 'Produto', resposta: '' }];
      repo.find.mockResolvedValue(linhas);
      await service.importarDeParagrafos(1, ['Produto  -–—•· ERP Industrial']);
      expect(linhas[0].resposta).toBe('ERP Industrial');
    });

    it('ignora placeholder de modelo em branco ("<...>")', async () => {
      const linhas = [{ id: 1, topico: 'Fornecedor Atual', resposta: '' }];
      repo.find.mockResolvedValue(linhas);
      const n = await service.importarDeParagrafos(1, [
        'Fornecedor Atual: <preencher>',
      ]);
      expect(n).toBe(0);
      expect(linhas[0].resposta).toBe('');
    });

    it('não sobrescreve com string vazia quando nenhum parágrafo menciona o tópico', async () => {
      const linhas = [
        { id: 1, topico: 'Localização', resposta: 'já preenchida antes' },
      ];
      repo.find.mockResolvedValue(linhas);
      const n = await service.importarDeParagrafos(1, [
        'Nada a ver com o tópico',
      ]);
      expect(n).toBe(0);
      expect(linhas[0].resposta).toBe('já preenchida antes');
    });

    it('tópico vazio é ignorado (sem erro)', async () => {
      const linhas = [{ id: 1, topico: '', resposta: '' }];
      repo.find.mockResolvedValue(linhas);
      const n = await service.importarDeParagrafos(1, ['qualquer coisa']);
      expect(n).toBe(0);
    });

    it('não chama save quando nada foi importado', async () => {
      const linhas = [{ id: 1, topico: 'X', resposta: '' }];
      repo.find.mockResolvedValue(linhas);
      await service.importarDeParagrafos(1, ['nada relacionado']);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('usa o primeiro parágrafo que casar, na ordem recebida', async () => {
      const linhas = [{ id: 1, topico: 'Ramo', resposta: '' }];
      repo.find.mockResolvedValue(linhas);
      await service.importarDeParagrafos(1, [
        'linha irrelevante',
        'Ramo: Comércio',
        'Ramo: Serviços',
      ]);
      expect(linhas[0].resposta).toBe('Comércio');
    });
  });
});
