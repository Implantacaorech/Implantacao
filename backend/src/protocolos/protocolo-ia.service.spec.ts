import { Test, TestingModule } from '@nestjs/testing';
import { ProtocoloIaService } from './protocolo-ia.service';
import { IaService } from '../ia/ia.service';

describe('ProtocoloIaService', () => {
  let service: ProtocoloIaService;
  const ia = { completar: jest.fn(), disponivel: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProtocoloIaService, { provide: IaService, useValue: ia }],
    }).compile();
    service = module.get(ProtocoloIaService);
  });

  it('disponivel consulta a finalidade "protocolos"', () => {
    ia.disponivel.mockReturnValue(true);
    expect(service.disponivel()).toBe(true);
    expect(ia.disponivel).toHaveBeenCalledWith('protocolos');
  });

  it('propaga o erro quando a IA da finalidade não está configurada', async () => {
    ia.completar.mockRejectedValue(
      new Error(
        'IA não configurada para a finalidade "protocolos" (Config → IA).',
      ),
    );
    await expect(service.analisar('transcrição', 'video.mp4')).rejects.toThrow(
      'IA não configurada',
    );
  });

  it('chama completar na finalidade "protocolos" e extrai os campos do JSON', async () => {
    ia.completar.mockResolvedValue(
      JSON.stringify({
        titulo: 'Cadastro de Produtos',
        modulo: 'Estoque',
        menu: '1.4-I',
        assunto: 'Como cadastrar um produto',
        resumo: 'Resumo',
        objetivo: 'Objetivo',
        quando_utilizar: 'Quando',
        pre_requisitos: '- nenhum',
        passo_a_passo: '1. Abrir o menu',
        configuracoes: '',
        dependencias: '',
        regras_negocio: '',
        pontos_atencao: '',
        exemplos: '',
        assuntos_removidos: '- conversa paralela',
        pendencias: '',
      }),
    );

    const { campos, bruto } = await service.analisar(
      'transcrição',
      'video.mp4',
    );
    expect(ia.completar).toHaveBeenCalledWith(
      'protocolos',
      expect.objectContaining({ maxTokens: 8000 }),
    );
    expect(campos.modulo).toBe('Estoque');
    expect(campos.menu).toBe('1.4-I');
    expect(campos.passoAPasso).toBe('1. Abrir o menu');
    expect(campos.assuntosRemovidos).toBe('- conversa paralela');
    expect(bruto).toContain('Cadastro de Produtos');
  });

  it('força módulo para "Módulo a validar" se a IA devolver algo fora da lista', async () => {
    ia.completar.mockResolvedValue(JSON.stringify({ modulo: 'Não Existe' }));
    const { campos } = await service.analisar('transcrição');
    expect(campos.modulo).toBe('Módulo a validar');
  });

  it('preenche menu/título padrão quando a IA devolve vazio', async () => {
    ia.completar.mockResolvedValue(JSON.stringify({ menu: '', titulo: '' }));
    const { campos } = await service.analisar('transcrição', 'aula1.mp4');
    expect(campos.menu).toBe('Menu não identificado - revisar manualmente');
    expect(campos.titulo).toBe('Protocolo de treinamento — aula1.mp4');
  });

  it('lança quando a IA não devolve um JSON válido', async () => {
    ia.completar.mockResolvedValue('isso não é json');
    await expect(service.analisar('transcrição')).rejects.toThrow(
      'A IA não devolveu o JSON esperado.',
    );
  });

  it('extrai o JSON mesmo com texto extra antes/depois (fallback por regex)', async () => {
    ia.completar.mockResolvedValue(
      'Aqui está: ' + JSON.stringify({ titulo: 'X' }) + ' obrigado.',
    );
    const { campos } = await service.analisar('transcrição');
    expect(campos.titulo).toBe('X');
  });
});
