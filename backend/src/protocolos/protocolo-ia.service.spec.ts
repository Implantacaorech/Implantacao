import { Test, TestingModule } from '@nestjs/testing';
import {
  dividirTranscricaoEmPartes,
  ProtocoloIaService,
  resgatarCamposDeJsonCortado,
  SISTEMA_MAPA,
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
      // 3º arg: meta de telemetria (A10) — contexto com o nome do vídeo.
      expect.objectContaining({
        contexto: expect.stringContaining('video.mp4'),
      }),
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

  // A15: validação pós-geração contra o catálogo do SIGER.
  describe('validação de menus contra o catálogo (A15)', () => {
    const validos = new Set(['1.4-I', '2.1-P']);

    it('rejeita o menu principal inexistente e sinaliza ao revisor', async () => {
      ia.completar.mockResolvedValue(
        JSON.stringify({
          menu: '3.4-L', // não existe no catálogo
          menus_abordados: '### 9.9-Z — Tela inventada',
          pendencias: '',
        }),
      );
      const { campos } = await service.analisar('t', 'v.mp4', '', validos);
      expect(campos.menu).toBe('Menu não identificado - revisar manualmente');
      expect(campos.pendencias).toContain('3.4-L');
      expect(campos.pendencias).toContain('9.9-Z');
      expect(campos.pendencias).toContain('A15');
    });

    it('mantém o menu válido e não gera nota', async () => {
      ia.completar.mockResolvedValue(
        JSON.stringify({
          menu: '1.4-I',
          menus_abordados: '### 1.4-I — Cadastro\n### 2.1-P — Nota',
          pendencias: '',
        }),
      );
      const { campos } = await service.analisar('t', 'v.mp4', '', validos);
      expect(campos.menu).toBe('1.4-I');
      expect(campos.pendencias).toBe('');
    });

    it('sem catálogo (Set vazio) não valida nada — comportamento de antes', async () => {
      ia.completar.mockResolvedValue(
        JSON.stringify({ menu: '3.4-L', pendencias: '' }),
      );
      const { campos } = await service.analisar('t', 'v.mp4', '', new Set());
      expect(campos.menu).toBe('3.4-L');
      expect(campos.pendencias).toBe('');
    });
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

  /** O começo da resposta diz o que aconteceu de verdade (prosa? recusa? vazio?) — sem ele,
   * diagnosticar exige reproduzir uma chamada de dezenas de minutos (caso de 2026-08-19). */
  it('o erro de JSON traz o começo da resposta para diagnóstico', async () => {
    ia.completar.mockResolvedValue('O treinamento abordou o módulo de caixa…');
    await expect(service.analisar('transcrição')).rejects.toThrow(
      'A resposta começou com: "O treinamento abordou',
    );
    ia.completar.mockResolvedValue('   ');
    await expect(service.analisar('transcrição')).rejects.toThrow(
      'resposta vazia',
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

  /** Caso real de 2026-08-19: um vídeo longo virou prompt de 43.959 tokens, o Ollama truncou
   * o COMEÇO (as instruções) e a resposta veio em prosa. Transcrição acima do limite de
   * leitura única tem de ser condensada em partes antes da análise — e a fase cara (mapa)
   * tem de rodar uma vez só para as duas chamadas do pipeline. */
  describe('condensação de transcrição longa (map-reduce)', () => {
    const linha = '[00:01] Consultor: ' + 'assunto técnico do SIGER '.repeat(4);
    function transcricaoLonga(chars: number): string {
      const linhas: string[] = [];
      while (linhas.length * (linha.length + 1) < chars) linhas.push(linha);
      return linhas.join('\n');
    }
    function chamadasDeMapa(): unknown[][] {
      return ia.completar.mock.calls.filter(
        (c) => (c[1] as { system: string }).system === SISTEMA_MAPA,
      );
    }
    function mockMapaEJson(): void {
      ia.completar.mockImplementation(
        (_f: string, opcoes: { system: string }) =>
          Promise.resolve(
            opcoes.system === SISTEMA_MAPA
              ? 'registro parcial da parte'
              : JSON.stringify({ titulo: 'X' }),
          ),
      );
    }

    it('transcrição curta passa intacta, sem nenhuma chamada de mapa', async () => {
      ia.completar.mockResolvedValue(JSON.stringify({ titulo: 'X' }));
      await service.analisar('transcrição curta', 'v.mp4');
      expect(ia.completar).toHaveBeenCalledTimes(1);
      const user = (
        ia.completar.mock.calls[0][1] as {
          messages: { content: string }[];
        }
      ).messages[0].content;
      expect(user).toContain('TRANSCRIÇÃO (com timestamps):');
    });

    it('transcrição longa é condensada e a análise recebe o consolidado, não a bruta', async () => {
      mockMapaEJson();
      const longa = transcricaoLonga(70_000);
      await service.analisar(longa, 'aula-longa.mp4');

      const mapas = chamadasDeMapa();
      expect(mapas.length).toBeGreaterThanOrEqual(2);
      expect(
        (mapas[0][1] as { messages: { content: string }[] }).messages[0]
          .content,
      ).toContain('Parte 1 de');

      const chamadas = ia.completar.mock.calls;
      const final = chamadas[chamadas.length - 1][1] as {
        system: string;
        messages: { content: string }[];
      };
      expect(final.system).not.toBe(SISTEMA_MAPA);
      const user = final.messages[0].content;
      expect(user).toContain('REGISTRO CONSOLIDADO');
      expect(user).toContain('=== Parte 1 de');
      // O consolidado é ordens de grandeza menor que a transcrição bruta.
      expect(user.length).toBeLessThan(10_000);
    });

    it('o resumo reaproveita a condensação do cache — a fase cara roda uma vez', async () => {
      mockMapaEJson();
      const longa = transcricaoLonga(70_000);
      await service.analisar(longa, 'aula.mp4');
      const mapasAposAnalise = chamadasDeMapa().length;

      await service.resumirCompleto(longa, 'aula.mp4');
      expect(chamadasDeMapa().length).toBe(mapasAposAnalise);
      const chamadas = ia.completar.mock.calls;
      const user = (
        chamadas[chamadas.length - 1][1] as {
          messages: { content: string }[];
        }
      ).messages[0].content;
      expect(user).toContain('REGISTRO CONSOLIDADO');
    });

    it('parte que falha uma vez é tentada de novo antes de desistir', async () => {
      let jaFalhou = false;
      ia.completar.mockImplementation(
        (_f: string, opcoes: { system: string }) => {
          if (opcoes.system === SISTEMA_MAPA && !jaFalhou) {
            jaFalhou = true;
            return Promise.reject(new Error('engasgo passageiro'));
          }
          return Promise.resolve(
            opcoes.system === SISTEMA_MAPA
              ? 'registro parcial'
              : JSON.stringify({ titulo: 'X' }),
          );
        },
      );
      await expect(
        service.analisar(transcricaoLonga(70_000), 'v.mp4'),
      ).resolves.toBeDefined();
    });
  });
});

describe('dividirTranscricaoEmPartes', () => {
  it('texto que cabe no alvo volta inteiro', () => {
    expect(dividirTranscricaoEmPartes('abc', 100)).toEqual(['abc']);
  });

  it('quebra em fim de linha, sem perder conteúdo nem partir uma fala', () => {
    const linhas = Array.from({ length: 10 }, (_, i) => `[00:0${i}] fala ${i}`);
    const partes = dividirTranscricaoEmPartes(linhas.join('\n'), 40);
    expect(partes.length).toBeGreaterThan(1);
    // A reunião das partes é o texto original — nada some, nada duplica.
    expect(partes.join('\n')).toBe(linhas.join('\n'));
    // Cada parte começa numa fala (com timestamp), nunca no meio de uma.
    for (const p of partes) expect(p.startsWith('[')).toBe(true);
  });

  it('linha única maior que o alvo é fatiada no duro (transcrição sem quebras)', () => {
    const partes = dividirTranscricaoEmPartes('x'.repeat(95), 30);
    expect(partes).toEqual(['x'.repeat(30), 'x'.repeat(30), 'x'.repeat(30), 'xxxxx']);
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
