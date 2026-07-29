import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  LevantamentoRespostaService,
  TEXTO_NAO_UTILIZADO,
} from './levantamento-resposta.service';
import { LevantamentoResposta } from '../database/entities/levantamento-resposta.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { IndiceTopicoService } from '../catalogos/indice-topico.service';

/** Linha como ela sai do banco — com os campos de concorrência que a edição a várias mãos usa. */
function linha(over: Partial<LevantamentoResposta> = {}): LevantamentoResposta {
  return {
    id: 1,
    projetoId: 7,
    ordem: 0,
    moduloSigla: 'FAT',
    modulo: 'Faturamento',
    adicional: '',
    topico: 'Tópico',
    resposta: '',
    naoUtilizado: false,
    versao: 0,
    atualizadoPor: '',
    atualizadoEm: null as unknown as Date,
    ...over,
  };
}

describe('LevantamentoRespostaService', () => {
  let service: LevantamentoRespostaService;
  const repo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((e: unknown) => e),
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

  describe('salvarLinha — autosave campo a campo (edição a várias mãos)', () => {
    it('grava a resposta, incrementa a versão e registra o autor', async () => {
      const alvo = linha({ versao: 3, topico: 'Razão Social' });
      repo.findOne.mockResolvedValue(alvo);
      repo.find.mockResolvedValue([alvo]);

      const salva = await service.salvarLinha(
        7,
        1,
        { resposta: '  Cliente Teste  ', versao: 3 },
        'Ana',
      );

      expect(salva.resposta).toBe('Cliente Teste');
      expect(salva.versao).toBe(4);
      expect(salva.atualizadoPor).toBe('Ana');
      expect(salva.atualizadoEm).toBeInstanceOf(Date);
    });

    it('recusa (409) quando a versão em tela ficou para trás — não sobrescreve o colega', async () => {
      const alvo = linha({
        versao: 5,
        resposta: 'texto do colega',
        atualizadoPor: 'Bruno',
      });
      repo.findOne.mockResolvedValue(alvo);

      await expect(
        service.salvarLinha(7, 1, { resposta: 'meu texto', versao: 2 }, 'Ana'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(alvo.resposta).toBe('texto do colega');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('sem versão no payload, grava sem conferir (importação/uso administrativo)', async () => {
      const alvo = linha({ versao: 9 });
      repo.findOne.mockResolvedValue(alvo);
      repo.find.mockResolvedValue([alvo]);
      const salva = await service.salvarLinha(7, 1, { resposta: 'x' }, 'Ana');
      expect(salva.versao).toBe(10);
    });

    it('"Não será utilizado." grava a frase padrão e ignora o texto que a tela mandar', async () => {
      const alvo = linha({ versao: 0 });
      repo.findOne.mockResolvedValue(alvo);
      repo.find.mockResolvedValue([alvo]);

      const salva = await service.salvarLinha(
        7,
        1,
        { naoUtilizado: true, resposta: 'tentativa de burlar', versao: 0 },
        'Ana',
      );

      expect(salva.naoUtilizado).toBe(true);
      expect(salva.resposta).toBe(TEXTO_NAO_UTILIZADO);
    });

    it('desmarcar a flag libera o campo com o texto enviado', async () => {
      const alvo = linha({
        versao: 1,
        naoUtilizado: true,
        resposta: TEXTO_NAO_UTILIZADO,
      });
      repo.findOne.mockResolvedValue(alvo);
      repo.find.mockResolvedValue([alvo]);

      const salva = await service.salvarLinha(
        7,
        1,
        { naoUtilizado: false, resposta: '', versao: 1 },
        'Ana',
      );

      expect(salva.naoUtilizado).toBe(false);
      expect(salva.resposta).toBe('');
    });

    it('linha de outro projeto não é encontrada', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.salvarLinha(7, 999, { resposta: 'x' }, 'Ana'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('salvar (lote)', () => {
    it('não apaga o que não veio no payload — o colega pode ter respondido em outra máquina', async () => {
      const minha = linha({ id: 1, resposta: 'antiga' });
      const doColega = linha({ id: 2, resposta: 'resposta do colega' });
      repo.find.mockResolvedValue([minha, doColega]);

      const n = await service.salvar(7, { '1': 'nova' }, 'Ana');

      expect(minha.resposta).toBe('nova');
      expect(doColega.resposta).toBe('resposta do colega');
      expect(n).toBe(2);
      expect(repo.save).toHaveBeenCalledWith([minha]);
    });

    it('não mexe em pergunta marcada como "Não será utilizado."', async () => {
      const descartada = linha({
        id: 1,
        naoUtilizado: true,
        resposta: TEXTO_NAO_UTILIZADO,
      });
      repo.find.mockResolvedValue([descartada]);

      await service.salvar(7, { '1': 'texto qualquer' }, 'Ana');

      expect(descartada.resposta).toBe(TEXTO_NAO_UTILIZADO);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('marca autoria e versão só no que realmente mudou', async () => {
      const igual = linha({ id: 1, resposta: 'mesma coisa', versao: 4 });
      repo.find.mockResolvedValue([igual]);

      await service.salvar(7, { '1': 'mesma coisa' }, 'Ana');

      expect(igual.versao).toBe(4);
      expect(igual.atualizadoPor).toBe('');
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('importarDeParagrafos', () => {
    it('não sobrescreve pergunta marcada como "Não será utilizado."', async () => {
      const linhas = [
        linha({
          id: 1,
          topico: 'Razão Social',
          naoUtilizado: true,
          resposta: TEXTO_NAO_UTILIZADO,
        }),
      ];
      repo.find.mockResolvedValue(linhas);
      const n = await service.importarDeParagrafos(1, [
        'Razão Social: Cliente Teste Ltda',
      ]);
      expect(n).toBe(0);
      expect(linhas[0].resposta).toBe(TEXTO_NAO_UTILIZADO);
    });

    it('preenche a resposta com o texto depois do tópico, na mesma linha', async () => {
      const linhas = [
        { id: 1, topico: 'Razão Social', resposta: '', versao: 0 },
      ];
      repo.find.mockResolvedValue(linhas);
      const n = await service.importarDeParagrafos(1, [
        'Razão Social: Cliente Teste Ltda',
      ]);
      expect(n).toBe(1);
      expect(linhas[0].resposta).toBe('Cliente Teste Ltda');
      expect(repo.save).toHaveBeenCalledWith(linhas);
    });

    it('ignora maiúsculas/minúsculas ao casar o tópico', async () => {
      const linhas = [
        { id: 1, topico: 'ramo de atividade', resposta: '', versao: 0 },
      ];
      repo.find.mockResolvedValue(linhas);
      await service.importarDeParagrafos(1, ['RAMO DE ATIVIDADE: Indústria']);
      expect(linhas[0].resposta).toBe('Indústria');
    });

    it('remove separadores (":", "-", "–", "—", "•", "·") entre o tópico e a resposta', async () => {
      const linhas = [{ id: 1, topico: 'Produto', resposta: '', versao: 0 }];
      repo.find.mockResolvedValue(linhas);
      await service.importarDeParagrafos(1, ['Produto  -–—•· ERP Industrial']);
      expect(linhas[0].resposta).toBe('ERP Industrial');
    });

    it('ignora placeholder de modelo em branco ("<...>")', async () => {
      const linhas = [
        { id: 1, topico: 'Fornecedor Atual', resposta: '', versao: 0 },
      ];
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
      const linhas = [{ id: 1, topico: '', resposta: '', versao: 0 }];
      repo.find.mockResolvedValue(linhas);
      const n = await service.importarDeParagrafos(1, ['qualquer coisa']);
      expect(n).toBe(0);
    });

    it('não chama save quando nada foi importado', async () => {
      const linhas = [{ id: 1, topico: 'X', resposta: '', versao: 0 }];
      repo.find.mockResolvedValue(linhas);
      await service.importarDeParagrafos(1, ['nada relacionado']);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('usa o primeiro parágrafo que casar, na ordem recebida', async () => {
      const linhas = [{ id: 1, topico: 'Ramo', resposta: '', versao: 0 }];
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
