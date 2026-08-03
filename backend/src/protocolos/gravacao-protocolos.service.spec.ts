import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Projeto } from '../database/entities/projeto.entity';
import { Protocolo } from '../database/entities/protocolo.entity';
import { ClientesSiclaService } from '../clientes-sicla/clientes-sicla.service';
import { TranscricaoService } from '../transcricao/transcricao.service';
import {
  GravacaoProtocolosService,
  PASTA_GRAVACOES,
} from './gravacao-protocolos.service';
import { ProcessamentoProtocolosService } from './processamento-protocolos.service';
import { ProtocolosService } from './protocolos.service';

describe('GravacaoProtocolosService', () => {
  let service: GravacaoProtocolosService;
  let raiz: string;

  const protocolos = {
    criarGravacao: jest.fn(),
    buscar: jest.fn(),
    excluir: jest.fn(),
    atualizar: jest.fn(),
    atualizarStatus: jest.fn(),
    salvarHistorico: jest.fn(),
    hash: jest.fn(() => 'hash-do-wav'),
  };
  const processamento = {
    pastaRaiz: jest.fn(() => raiz),
    processarAsync: jest.fn(),
    apagarArquivo: jest.fn(),
  };
  const transcricao = {
    vivoIniciar: jest.fn(),
    vivoTrecho: jest.fn(),
    vivoEstado: jest.fn(),
    vivoFinalizar: jest.fn(),
    vivoCancelar: jest.fn(),
  };
  const projetos = { find: jest.fn(), findOne: jest.fn() };
  const clientesSicla = { buscar: jest.fn() };

  beforeAll(() => {
    raiz = mkdtempSync(join(tmpdir(), 'gravacao-raiz-'));
  });

  afterAll(() => {
    rmSync(raiz, { recursive: true, force: true });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GravacaoProtocolosService,
        { provide: ProtocolosService, useValue: protocolos },
        { provide: ProcessamentoProtocolosService, useValue: processamento },
        { provide: TranscricaoService, useValue: transcricao },
        { provide: ClientesSiclaService, useValue: clientesSicla },
        { provide: getRepositoryToken(Projeto), useValue: projetos },
      ],
    }).compile();
    service = module.get(GravacaoProtocolosService);
  });

  const ana = {
    sub: 1,
    login: 'ana',
    nome: 'Ana',
    perfil: 'Consultor',
    perfis: ['Consultor'],
    codigoSicla: '',
  } as AuthUser;

  function protocolo(over: Partial<Protocolo> = {}): Protocolo {
    return {
      id: 7,
      responsavel: 'Ana',
      cliente: 'Metalúrgica Alfa',
      titulo: 'Reunião Metalúrgica Alfa',
      status: 'Gravando',
      videoOrigem: 'gravacao',
      videoCaminho: '',
      ...over,
    } as Protocolo;
  }

  describe('iniciar', () => {
    it('copia o nome do cliente do projeto e abre a sessão no docservice', async () => {
      projetos.findOne.mockResolvedValue({
        id: 3,
        cliente: 'Metalúrgica Alfa',
      });
      protocolos.criarGravacao.mockResolvedValue(protocolo({ id: 7 }));

      const r = await service.iniciar(ana, {
        projetoId: 3,
        fonte: 'reuniao',
      });

      expect(r).toEqual({
        id: 7,
        cliente: 'Metalúrgica Alfa',
        titulo: expect.stringContaining('Metalúrgica Alfa') as string,
      });
      expect(protocolos.criarGravacao).toHaveBeenCalledWith(
        expect.objectContaining({
          cliente: 'Metalúrgica Alfa',
          projetoId: 3,
          responsavel: 'Ana',
          fonte: 'áudio da reunião remota (Teams/tela)',
        }),
      );
      // O vocabulário sobe junto: é ele que corrige nome próprio no transcritor, e o
      // cliente entra nele sem o usuário precisar digitar.
      expect(transcricao.vivoIniciar).toHaveBeenCalledWith(
        7,
        expect.stringContaining('Metalúrgica Alfa') as string,
      );
    });

    it('aceita gravação sem cliente (conteúdo genérico)', async () => {
      protocolos.criarGravacao.mockResolvedValue(protocolo({ cliente: '' }));

      await service.iniciar(ana, { fonte: 'microfone' });

      expect(projetos.findOne).not.toHaveBeenCalled();
      expect(protocolos.criarGravacao).toHaveBeenCalledWith(
        expect.objectContaining({
          cliente: '',
          projetoId: null,
          clienteCodigo: '',
        }),
      );
    });

    it('guarda o cliente escolhido na busca do SICLA, sem projeto no painel', async () => {
      protocolos.criarGravacao.mockResolvedValue(protocolo());
      projetos.find.mockResolvedValue([{ id: 5, cnpj: '11.111.111/0001-11' }]);

      await service.iniciar(ana, {
        clienteCodigo: '4821',
        cliente: 'MK QUIMICA DO BRASIL LTDA',
        cnpj: '22.222.222/0001-22',
        fonte: 'microfone',
      });

      // Reunião pode acontecer antes de a implantação existir: sem projeto que case pelo
      // CNPJ, a gravação fica só com o cliente do SICLA — e isso é válido.
      expect(protocolos.criarGravacao).toHaveBeenCalledWith(
        expect.objectContaining({
          cliente: 'MK QUIMICA DO BRASIL LTDA',
          clienteCodigo: '4821',
          projetoId: null,
        }),
      );
    });

    it('amarra o projeto existente quando o CNPJ do SICLA bate com a carteira', async () => {
      protocolos.criarGravacao.mockResolvedValue(protocolo());
      projetos.find.mockResolvedValue([
        { id: 5, cnpj: '11.111.111/0001-11' },
        { id: 9, cnpj: '22222222000122' },
      ]);

      await service.iniciar(ana, {
        clienteCodigo: '4821',
        cliente: 'MK QUIMICA DO BRASIL LTDA',
        cnpj: '22.222.222/0001-22',
        fonte: 'microfone',
      });

      // Compara só os dígitos: o SICLA devolve com máscara e a ficha nem sempre.
      expect(protocolos.criarGravacao).toHaveBeenCalledWith(
        expect.objectContaining({ projetoId: 9 }),
      );
    });

    it('busca de cliente é a MESMA do passo 1 (delegada ao SICLA)', async () => {
      clientesSicla.buscar.mockResolvedValue({
        ok: true,
        mensagem: '',
        clientes: [],
      });

      await service.buscarClientes('mk qui');

      expect(clientesSicla.buscar).toHaveBeenCalledWith('mk qui');
    });

    it('desfaz o registro quando o serviço de transcrição não sobe', async () => {
      protocolos.criarGravacao.mockResolvedValue(protocolo({ id: 9 }));
      transcricao.vivoIniciar.mockRejectedValue(new Error('docservice fora'));

      await expect(
        service.iniciar(ana, { fonte: 'microfone' }),
      ).rejects.toThrow('docservice fora');
      // Sem isso ficaria um protocolo eternamente "Gravando", que nunca receberia áudio.
      expect(protocolos.excluir).toHaveBeenCalledWith(9);
    });
  });

  describe('trecho', () => {
    it('recusa áudio de uma gravação já encerrada', async () => {
      protocolos.buscar.mockResolvedValue(protocolo({ status: 'Em revisão' }));

      await expect(
        service.trecho(7, 0, Buffer.from('wav'), ana),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(transcricao.vivoTrecho).not.toHaveBeenCalled();
    });

    it('recusa gravação inexistente', async () => {
      protocolos.buscar.mockResolvedValue(null);

      await expect(
        service.trecho(7, 0, Buffer.from('wav'), ana),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('finalizar', () => {
    beforeEach(() => {
      protocolos.buscar.mockResolvedValue(protocolo());
    });

    it('salva o áudio na pasta de gravações e manda analisar a transcrição ao vivo', async () => {
      transcricao.vivoFinalizar.mockResolvedValue({
        texto: '[0:00] Bom dia, vamos ao faturamento.',
        duracaoSeg: 1800,
        caminhoAudio: '',
        trechos: 4,
        pendentes: 0,
        erro: null,
      });

      const r = await service.finalizar(7, ana);

      const destino = (
        transcricao.vivoFinalizar.mock.calls[0] as [number, string]
      )[1];
      expect(destino.startsWith(join(raiz, PASTA_GRAVACOES))).toBe(true);
      expect(destino.endsWith('.wav')).toBe(true);
      expect(existsSync(join(raiz, PASTA_GRAVACOES))).toBe(true);
      expect(protocolos.atualizar).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          transcricao: '[0:00] Bom dia, vamos ao faturamento.',
          duracaoSeg: 1800,
          videoHash: 'hash-do-wav',
        }),
      );
      expect(protocolos.atualizarStatus).toHaveBeenCalledWith(
        7,
        'Pendente',
        undefined,
        'Ana',
      );
      // O pipeline dos vídeos aproveita a transcrição existente e vai direto para a IA.
      expect(processamento.processarAsync).toHaveBeenCalledWith(7, 'Ana');
      expect(r.duracaoSeg).toBe(1800);
    });

    it('zera a transcrição quando o pedido é retranscrever o áudio inteiro', async () => {
      transcricao.vivoFinalizar.mockResolvedValue({
        texto: '[0:00] alguma coisa',
        duracaoSeg: 60,
        caminhoAudio: '',
        trechos: 1,
        pendentes: 0,
        erro: null,
      });

      await service.finalizar(7, ana, { retranscrever: true });

      expect(protocolos.atualizar).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ transcricao: '' }),
      );
    });

    it('cai na transcrição completa quando o ao vivo não produziu texto', async () => {
      transcricao.vivoFinalizar.mockResolvedValue({
        texto: '   ',
        duracaoSeg: 120,
        caminhoAudio: '',
        trechos: 3,
        pendentes: 3,
        erro: 'O transcritor encerrou antes da hora.',
      });

      const r = await service.finalizar(7, ana);

      expect(protocolos.atualizar).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ transcricao: '' }),
      );
      expect(processamento.processarAsync).toHaveBeenCalledWith(7, 'Ana');
      expect(r.aviso).toContain('transcrito');
    });
  });

  it('cancelar mata a sessão e apaga o registro', async () => {
    protocolos.buscar.mockResolvedValue(protocolo());
    protocolos.excluir.mockResolvedValue(
      protocolo({ videoCaminho: join(raiz, PASTA_GRAVACOES, 'x.wav') }),
    );

    await service.cancelar(7, ana);

    expect(transcricao.vivoCancelar).toHaveBeenCalledWith(7);
    expect(protocolos.excluir).toHaveBeenCalledWith(7);
    expect(processamento.apagarArquivo).toHaveBeenCalled();
  });
});
