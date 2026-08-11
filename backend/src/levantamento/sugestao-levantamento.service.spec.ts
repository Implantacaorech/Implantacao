import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { IaService } from '../ia/ia.service';
import { ProtocolosService } from '../protocolos/protocolos.service';
import { ProjetoRepository } from '../database/repositories/projeto.repository';
import { LevantamentoResposta } from '../database/entities/levantamento-resposta.entity';
import { Protocolo } from '../database/entities/protocolo.entity';
import { LevantamentoRespostaService } from './levantamento-resposta.service';
import { SugestaoLevantamentoService } from './sugestao-levantamento.service';

describe('SugestaoLevantamentoService', () => {
  let service: SugestaoLevantamentoService;

  const respostas = { garantirSeed: jest.fn(), listar: jest.fn() };
  const protocolos = { listarDoProjeto: jest.fn() };
  const projetos = { porId: jest.fn() };
  const ia = { disponivel: jest.fn(), completar: jest.fn() };

  function linha(
    over: Partial<LevantamentoResposta> = {},
  ): LevantamentoResposta {
    return {
      id: 1,
      projetoId: 7,
      moduloSigla: 'FAT',
      modulo: 'Faturamento',
      adicional: '',
      topico: 'Como é feita a emissão de notas hoje?',
      resposta: '',
      naoUtilizado: false,
      versao: 1,
      ...over,
    } as LevantamentoResposta;
  }

  function gravacao(over: Partial<Protocolo> = {}): Protocolo {
    return {
      id: 42,
      titulo: 'Levantamento — Cliente X',
      cliente: 'Cliente X',
      transcricao: '[00:10] P1: hoje a gente emite nota pelo sistema antigo.',
      mapaLocutores: '',
      criadoEm: new Date('2026-08-01T10:00:00'),
      duracaoSeg: 3600,
      status: 'Em revisão',
      ...over,
    } as Protocolo;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    projetos.porId.mockResolvedValue({ id: 7, cliente: 'Cliente X' });
    protocolos.listarDoProjeto.mockResolvedValue([gravacao()]);
    respostas.garantirSeed.mockResolvedValue(undefined);
    respostas.listar.mockResolvedValue([linha()]);
    ia.disponivel.mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SugestaoLevantamentoService,
        { provide: LevantamentoRespostaService, useValue: respostas },
        { provide: ProtocolosService, useValue: protocolos },
        { provide: ProjetoRepository, useValue: projetos },
        { provide: IaService, useValue: ia },
      ],
    }).compile();
    service = module.get(SugestaoLevantamentoService);
  });

  function respondeIa(itens: unknown): void {
    ia.completar.mockResolvedValue(JSON.stringify(itens));
  }

  it('devolve a sugestão casada com a linha, com a marca de tempo da origem', async () => {
    respondeIa([
      {
        n: 1,
        resposta: 'A emissão é feita no sistema antigo.',
        trecho: '[00:10]',
      },
    ]);

    const r = await service.sugerir(7, 42);

    expect(r.sugestoes).toEqual([
      {
        linhaId: 1,
        moduloSigla: 'FAT',
        topico: 'Como é feita a emissão de notas hoje?',
        texto: 'A emissão é feita no sistema antigo.',
        trecho: '[00:10]',
      },
    ]);
    expect(r.analisados).toBe(1);
    expect(r.naoAnalisados).toBe(0);
  });

  /** A razão de existir do recurso é economizar digitação, não decidir pelo consultor. */
  it('NÃO grava nada — só devolve propostas', async () => {
    respondeIa([{ n: 1, resposta: 'texto', trecho: '' }]);
    await service.sugerir(7, 42);
    // O serviço não tem como gravar: nem o repositório de respostas está injetado com
    // método de escrita. A prova é que o único caminho de escrita do módulo
    // (LevantamentoRespostaService.salvarLinha) nem sequer é chamado.
    expect(
      (respostas as unknown as Record<string, unknown>).salvarLinha,
    ).toBeUndefined();
  });

  describe('o que entra no pedido', () => {
    it('pergunta já respondida e "Não será utilizado." ficam de fora', async () => {
      respostas.listar.mockResolvedValue([
        linha({ id: 1, resposta: 'já respondida' }),
        linha({
          id: 2,
          naoUtilizado: true,
          resposta: 'Este campo foi desconsiderado…',
        }),
        linha({ id: 3, topico: 'Pendente de verdade' }),
      ]);
      respondeIa([]);

      const r = await service.sugerir(7, 42);

      expect(r.analisados).toBe(1);
      const enviado = ia.completar.mock.calls[0][1].messages[0]
        .content as string;
      expect(enviado).toContain('Pendente de verdade');
      expect(enviado).not.toContain('já respondida');
    });

    it('sem nenhuma pendência, nem chama a IA', async () => {
      respostas.listar.mockResolvedValue([linha({ resposta: 'respondida' })]);

      const r = await service.sugerir(7, 42);

      expect(r.sugestoes).toEqual([]);
      expect(r.aviso).toContain('Não há pergunta pendente');
      expect(ia.completar).not.toHaveBeenCalled();
    });

    /** Os nomes dos locutores mudam o sentido do texto: "Ivian: ..." em vez de "P1: ..."
     * deixa a IA separar o que o CLIENTE faz hoje do que o consultor propôs. */
    it('a transcrição vai com os nomes dos locutores já aplicados', async () => {
      protocolos.listarDoProjeto.mockResolvedValue([
        gravacao({
          transcricao: '[00:10] P1: emitimos pelo sistema antigo.',
          mapaLocutores: '{"P1":"Ivian"}',
        }),
      ]);
      respondeIa([]);

      await service.sugerir(7, 42);

      const enviado = ia.completar.mock.calls[0][1].messages[0]
        .content as string;
      expect(enviado).toContain('Ivian: emitimos pelo sistema antigo.');
      expect(enviado).not.toContain('P1:');
    });
  });

  describe('o que volta da IA', () => {
    /** Sugestão na pergunta errada é um erro no documento do cliente; sugestão a menos é um
     * aborrecimento. Na dúvida, descarta. */
    it.each([
      ['número fora da faixa', [{ n: 99, resposta: 'x', trecho: '' }]],
      ['número inválido', [{ n: 'dois', resposta: 'x', trecho: '' }]],
      ['resposta vazia', [{ n: 1, resposta: '   ', trecho: '' }]],
      ['item sem nada', [{}]],
    ])('descarta item com %s', async (_caso, itens) => {
      respondeIa(itens);
      const r = await service.sugerir(7, 42);
      expect(r.sugestoes).toEqual([]);
    });

    it('o mesmo tópico repetido só entra uma vez', async () => {
      respondeIa([
        { n: 1, resposta: 'primeira', trecho: '' },
        { n: 1, resposta: 'segunda', trecho: '' },
      ]);
      const r = await service.sugerir(7, 42);
      expect(r.sugestoes).toHaveLength(1);
      expect(r.sugestoes[0].texto).toBe('primeira');
    });

    it('array embrulhado em texto/```json ainda é lido', async () => {
      ia.completar.mockResolvedValue(
        'Claro! Aqui está:\n```json\n[{"n":1,"resposta":"achou","trecho":"[01:00]"}]\n```',
      );
      const r = await service.sugerir(7, 42);
      expect(r.sugestoes[0].texto).toBe('achou');
    });

    it('resposta ilegível vira lista vazia, não exceção', async () => {
      ia.completar.mockResolvedValue('desculpe, não consegui');
      const r = await service.sugerir(7, 42);
      expect(r.sugestoes).toEqual([]);
      expect(r.aviso).toContain('não trouxe conteúdo');
    });
  });

  describe('lotes', () => {
    /** Lista longa degrada a atenção do modelo — ele passa a responder por dedução no fim,
     * que é justamente onde ninguém confere. */
    it('divide as pendências em lotes de 50', async () => {
      respostas.listar.mockResolvedValue(
        Array.from({ length: 120 }, (_, i) =>
          linha({ id: i + 1, topico: `T${i + 1}` }),
        ),
      );
      respondeIa([]);

      const r = await service.sugerir(7, 42);

      expect(ia.completar).toHaveBeenCalledTimes(3);
      expect(r.analisados).toBe(120);
    });

    /** Corte silencioso viraria "a IA não achou nada sobre esses tópicos", que é outra coisa. */
    it('acima do teto de lotes, DECLARA quantas ficaram de fora', async () => {
      respostas.listar.mockResolvedValue(
        Array.from({ length: 400 }, (_, i) =>
          linha({ id: i + 1, topico: `T${i + 1}` }),
        ),
      );
      respondeIa([]);

      const r = await service.sugerir(7, 42);

      expect(r.analisados).toBe(300); // 6 lotes de 50
      expect(r.naoAnalisados).toBe(100);
      expect(r.aviso).toContain('100 pergunta(s) ficaram de fora');
    });
  });

  describe('acesso', () => {
    /** A tela oferece só as gravações deste projeto, mas a rota não pode confiar nisso:
     * informar o id de outro cliente traria a transcrição dele para cá. */
    it('gravação que não é do projeto -> 404, sem chamar a IA', async () => {
      protocolos.listarDoProjeto.mockResolvedValue([gravacao({ id: 42 })]);

      await expect(service.sugerir(7, 999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(ia.completar).not.toHaveBeenCalled();
    });

    it('lista as gravações do projeto casando também pelo nome do cliente', async () => {
      const r = await service.gravacoes(7);

      expect(protocolos.listarDoProjeto).toHaveBeenCalledWith(7, 'Cliente X');
      expect(r).toEqual([
        {
          id: 42,
          titulo: 'Levantamento — Cliente X',
          criadoEm: new Date('2026-08-01T10:00:00'),
          duracaoSeg: 3600,
          status: 'Em revisão',
          caracteres: '[00:10] P1: hoje a gente emite nota pelo sistema antigo.'
            .length,
        },
      ]);
    });
  });
});
