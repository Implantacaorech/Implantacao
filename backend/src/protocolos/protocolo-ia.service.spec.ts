import { Test, TestingModule } from '@nestjs/testing';
import { ProtocoloIaService } from './protocolo-ia.service';
import { IaService } from '../ia/ia.service';

const createMock = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: createMock },
  }));
});

describe('ProtocoloIaService', () => {
  let service: ProtocoloIaService;
  const ia = { obterChave: jest.fn(), modelo: 'claude-opus-4-8', disponivel: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProtocoloIaService, { provide: IaService, useValue: ia }],
    }).compile();
    service = module.get(ProtocoloIaService);
  });

  it('lança sem chave configurada', async () => {
    ia.obterChave.mockReturnValue('');
    await expect(service.analisar('transcrição', 'video.mp4')).rejects.toThrow(
      'Chave de IA não configurada',
    );
  });

  it('extrai os campos do JSON devolvido pela IA (chaves snake_case -> entidade camelCase)', async () => {
    ia.obterChave.mockReturnValue('sk-teste');
    createMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
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
        },
      ],
    });

    const { campos, bruto } = await service.analisar('transcrição', 'video.mp4');
    expect(campos.modulo).toBe('Estoque');
    expect(campos.menu).toBe('1.4-I');
    expect(campos.passoAPasso).toBe('1. Abrir o menu');
    expect(campos.assuntosRemovidos).toBe('- conversa paralela');
    expect(bruto).toContain('Cadastro de Produtos');
  });

  it('força módulo para "Módulo a validar" se a IA devolver algo fora da lista', async () => {
    ia.obterChave.mockReturnValue('sk-teste');
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ modulo: 'Não Existe' }) }],
    });
    const { campos } = await service.analisar('transcrição');
    expect(campos.modulo).toBe('Módulo a validar');
  });

  it('preenche menu/título padrão quando a IA devolve vazio', async () => {
    ia.obterChave.mockReturnValue('sk-teste');
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ menu: '', titulo: '' }) }],
    });
    const { campos } = await service.analisar('transcrição', 'aula1.mp4');
    expect(campos.menu).toBe('Menu não identificado - revisar manualmente');
    expect(campos.titulo).toBe('Protocolo de treinamento — aula1.mp4');
  });

  it('lança quando a IA não devolve um JSON válido', async () => {
    ia.obterChave.mockReturnValue('sk-teste');
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'isso não é json' }],
    });
    await expect(service.analisar('transcrição')).rejects.toThrow(
      'A IA não devolveu o JSON esperado.',
    );
  });

  it('extrai o JSON mesmo com texto extra antes/depois (fallback por regex)', async () => {
    ia.obterChave.mockReturnValue('sk-teste');
    createMock.mockResolvedValue({
      content: [
        { type: 'text', text: 'Aqui está: ' + JSON.stringify({ titulo: 'X' }) + ' obrigado.' },
      ],
    });
    const { campos } = await service.analisar('transcrição');
    expect(campos.titulo).toBe('X');
  });
});
