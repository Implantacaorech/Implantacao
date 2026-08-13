import { Test, TestingModule } from '@nestjs/testing';
import { DicionarioIaService } from './dicionario-ia.service';
import { DicionarioService } from './dicionario.service';
import { IaService } from '../ia/ia.service';
import { DicionarioDocumento } from '../database/entities/dicionario-documento.entity';

function doc(over: Partial<DicionarioDocumento> = {}): DicionarioDocumento {
  return {
    id: 1,
    slug: '01-ctb-contabilidade',
    tipo: 'modulo',
    sigla: 'CTB',
    titulo: 'CTB - Contabilidade',
    resumo: 'x',
    conteudo: 'conteudo',
    palavrasChave: 'CTB101',
    caminhoOrigem: 'c:/x.md',
    urlOrigem: 'https://github.com/x/modulos/01-ctb-contabilidade.md',
    hashConteudo: 'a'.repeat(64),
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...over,
  };
}

describe('DicionarioIaService', () => {
  let service: DicionarioIaService;
  const dicionario = { recuperarParaPergunta: jest.fn() };
  const ia = {
    disponivel: jest.fn(),
    completar: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DicionarioIaService,
        { provide: DicionarioService, useValue: dicionario },
        { provide: IaService, useValue: ia },
      ],
    }).compile();
    service = module.get(DicionarioIaService);
  });

  it('sem documentos recuperados: responde honestamente que não há base', async () => {
    dicionario.recuperarParaPergunta.mockResolvedValue([]);
    ia.disponivel.mockReturnValue(true);
    const r = await service.perguntar('pergunta sem match');
    expect(r.temFundamento).toBe(false);
    expect(r.fontes).toEqual([]);
    expect(r.resposta).toContain(
      'Não foram encontradas informações suficientes',
    );
  });

  it('com documentos mas sem IA configurada: devolve as fontes sem sintetizar', async () => {
    dicionario.recuperarParaPergunta.mockResolvedValue([doc()]);
    ia.disponivel.mockReturnValue(false);
    const r = await service.perguntar('como configurar CTB101');
    expect(r.iaDisponivel).toBe(false);
    expect(r.temFundamento).toBe(true);
    expect(r.fontes).toHaveLength(1);
    expect(r.fontes[0].slug).toBe('01-ctb-contabilidade');
    expect(r.resposta).toContain('não está configurada');
  });

  it('com documentos e IA disponível: sintetiza via completar("dicionario") e cita as fontes', async () => {
    dicionario.recuperarParaPergunta.mockResolvedValue([doc()]);
    ia.disponivel.mockReturnValue(true);
    ia.completar.mockResolvedValue('Resposta direta: use o menu 1.6-T [1].');
    const r = await service.perguntar('como configurar CTB101', 'Ana');
    expect(ia.completar).toHaveBeenCalledWith(
      'dicionario',
      expect.objectContaining({ maxTokens: 2000 }),
      // 3º arg: meta de telemetria (A10) — solicitante + contexto.
      expect.objectContaining({ solicitante: 'Ana', contexto: 'dicionário' }),
    );
    expect(r.iaDisponivel).toBe(true);
    expect(r.temFundamento).toBe(true);
    expect(r.resposta).toContain('menu 1.6-T');
    expect(r.fontes[0].slug).toBe('01-ctb-contabilidade');
  });
});
