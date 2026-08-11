import { Test, TestingModule } from '@nestjs/testing';
import {
  ProtocoloIaService,
  resgatarCamposDeJsonCortado,
} from './protocolo-ia.service';
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
        menus_abordados: '### 1.4-I — Cadastro de Produtos',
        funcionalidades: '- F8: explorar arquivos',
        passo_a_passo: '1. Abrir o menu',
        processos: '- Cadastro de produto',
        definicoes: '- Matriz de Integração: regras de contrapartida',
        configuracoes: '',
        dependencias: '',
        regras_negocio: '',
        pontos_atencao: '',
        exemplos: '',
        duvidas: '- P: e se não houver matriz?\n  R: partida dobrada simples',
        pendencias_treinamento: '- validar a conta 99',
        proximos_passos: '- nova sessão na próxima semana',
        resumo_tecnico: '- conciliação automática por data e valor',
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
    expect(campos.menusAbordados).toBe('### 1.4-I — Cadastro de Produtos');
    expect(campos.funcionalidades).toBe('- F8: explorar arquivos');
    expect(campos.definicoes).toContain('Matriz de Integração');
    expect(campos.processos).toBe('- Cadastro de produto');
    expect(campos.duvidas).toContain('partida dobrada simples');
    expect(campos.pendenciasTreinamento).toBe('- validar a conta 99');
    expect(campos.proximosPassos).toBe('- nova sessão na próxima semana');
    expect(campos.resumoTecnico).toContain('conciliação automática');
    expect(campos.assuntosRemovidos).toBe('- conversa paralela');
    expect(bruto).toContain('Cadastro de Produtos');
  });

  it('declara a ausência de pendências do treinamento quando a IA devolve vazio', async () => {
    ia.completar.mockResolvedValue(
      JSON.stringify({ pendencias_treinamento: '' }),
    );
    const { campos } = await service.analisar('transcrição');
    expect(campos.pendenciasTreinamento).toBe(
      'Nenhuma pendência identificada.',
    );
  });

  it('o prompt cobre as 10 seções obrigatórias do protocolo de treinamento', async () => {
    ia.completar.mockResolvedValue(JSON.stringify({}));
    await service.analisar('transcrição');
    const system = (ia.completar.mock.calls[0][1] as { system: string }).system;
    for (const chave of [
      'menus_abordados',
      'funcionalidades',
      'definicoes',
      'configuracoes',
      'processos',
      'duvidas',
      'pendencias_treinamento',
      'proximos_passos',
      'resumo_tecnico',
    ]) {
      expect(system).toContain(chave);
    }
    expect(system).toContain('NUNCA invente');
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

  it('analisar não mexe em resumoCompleto (vem da 2ª chamada)', async () => {
    ia.completar.mockResolvedValue(JSON.stringify({ titulo: 'X' }));
    const { campos } = await service.analisar('transcrição');
    expect(campos.resumoCompleto).toBeUndefined();
  });

  describe('resumirCompleto', () => {
    it('devolve o texto do resumo, com as duas seções pedidas no prompt', async () => {
      ia.completar.mockResolvedValue(
        '  Registro de Atividades por Menu do Sistema\nMenu 4 – Caixa:\nAção: lançamento.  ',
      );
      const texto = await service.resumirCompleto('transcrição', 'aula.mp4');
      expect(texto).toBe(
        'Registro de Atividades por Menu do Sistema\nMenu 4 – Caixa:\nAção: lançamento.',
      );
      const [finalidade, opcoes] = ia.completar.mock.calls[0] as [
        string,
        { system: string; maxTokens: number },
      ];
      expect(finalidade).toBe('protocolos');
      expect(opcoes.system).toContain(
        'Registro de Atividades por Menu do Sistema',
      );
      expect(opcoes.system).toContain('Definições de Configuração');
      expect(opcoes.system).toContain('NUNCA invente');
      // Teto de saída de vários modelos configuráveis em Config → IA é 8192.
      expect(opcoes.maxTokens).toBeLessThanOrEqual(8192);
    });

    it('propaga o erro da API (o pipeline decide o que fazer)', async () => {
      ia.completar.mockRejectedValue(new Error('overloaded (529)'));
      await expect(service.resumirCompleto('transcrição')).rejects.toThrow(
        'overloaded',
      );
    });
  });
});

/**
 * JSON cortado não pode custar o registro inteiro.
 *
 * A saída da IA é limitada a 8.000 tokens e o formato pede ~24 seções, uma delas sendo
 * "TODOS os menus citados". Num treinamento longo o modelo chega ao teto no meio de um campo.
 * Até 2026-08-11 isso devolvia `null` e descartava em silêncio tudo que tinha chegado
 * completo — inclusive os menus, que é a queixa que originou esta correção.
 */
describe('resgatarCamposDeJsonCortado', () => {
  it('aproveita os campos fechados de um JSON sem fecha-chaves', () => {
    const cortado =
      '{"titulo": "Treinamento de Faturamento", "modulo": "FAT", ' +
      '"menus_abordados": "### 2.3-N — Emissao de notas", "funcionalidades": "ficou pela met';
    const r = resgatarCamposDeJsonCortado(cortado);
    expect(r.titulo).toBe('Treinamento de Faturamento');
    expect(r.modulo).toBe('FAT');
    expect(r.menus_abordados).toContain('2.3-N');
    // O campo que estava sendo escrito no momento do corte fica de fora, e não pela metade.
    expect(r.funcionalidades).toBeUndefined();
  });

  it('desescapa quebra de linha e aspas como o JSON manda', () => {
    const r = resgatarCamposDeJsonCortado(
      '{"resumo": "linha 1\\nlinha 2 com \\"aspas\\"", "modulo": "EST"',
    );
    expect(r.resumo).toBe('linha 1\nlinha 2 com "aspas"');
    expect(r.modulo).toBe('EST');
  });

  it('tolera quebra de linha DE VERDADE dentro da string — malformação comum de modelo', () => {
    // JSON exige `\n`; o modelo às vezes emite o caractere cru, e o JSON.parse recusa.
    // Perder o campo por isso seria desperdiçar texto perfeitamente aproveitável.
    const r = resgatarCamposDeJsonCortado(
      '{"resumo": "primeira linha\nsegunda linha", "modulo": "FAT"',
    );
    expect(r.resumo).toContain('primeira linha');
    expect(r.resumo).toContain('segunda linha');
    expect(r.modulo).toBe('FAT');
  });

  it('texto sem par algum devolve objeto vazio (e não quebra)', () => {
    expect(resgatarCamposDeJsonCortado('desculpe, não consegui')).toEqual({});
    expect(resgatarCamposDeJsonCortado('')).toEqual({});
  });
});
