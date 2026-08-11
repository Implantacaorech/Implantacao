import {
  MenuCatalogo,
  digitarNumerosFalados,
  expandirCodigo,
  formatarParaPrompt,
  menusMencionados,
} from './menus-mencionados';

/** Recorte do catálogo real (documento do FAT no Dicionário). */
const CATALOGO: MenuCatalogo[] = [
  {
    sigla: 'FAT',
    codigo: '1.1-P',
    opcao: 'Parametros gerais do FAT.',
    programa: 'FAT101',
  },
  {
    sigla: 'FAT',
    codigo: '1.2-M/I/A',
    opcao: 'Empresa do FAT.',
    programa: 'FAT102',
  },
  {
    sigla: 'FAT',
    codigo: '2.3-N/G/K',
    opcao: 'Emissao de notas, NF-e/NFC-e/NFS-e.',
    programa: 'FAT203',
  },
  {
    sigla: 'EST',
    codigo: '4.1-C',
    opcao: 'Consulta de saldo em estoque.',
    programa: 'EST401',
  },
];

describe('menusMencionados — o menu citado na reunião não pode sumir', () => {
  it('acha o código escrito do jeito canônico', () => {
    const r = menusMencionados('Abre o 2.3-N e emite a nota.', CATALOGO);
    expect(r.map((m) => m.codigo)).toEqual(['2.3-N/G/K']);
    expect(r[0].via).toBe('codigo');
  });

  it.each([
    ['espaço no lugar do traço', 'vai no 2.3 N que é onde emite'],
    ['sem separador nenhum', 'entra no 2.3N e confirma'],
    ['ponto no lugar do traço', 'o menu 2.3.N faz isso'],
    ['minúscula', 'abre o 2.3-n primeiro'],
  ])('tolera o que o Whisper escreve: %s', (_caso, texto) => {
    expect(menusMencionados(texto, CATALOGO).map((m) => m.codigo)).toContain(
      '2.3-N/G/K',
    );
  });

  it('acha o código FALADO por extenso — o caso que motivou tudo isto', () => {
    // Ninguém dita "dois traço três traço N": fala "dois ponto três N", e o Whisper escreve
    // exatamente isso. Antes, esse menu simplesmente não aparecia no resumo.
    const r = menusMencionados(
      'Agora a gente vai no dois ponto três N para emitir a nota fiscal.',
      CATALOGO,
    );
    expect(r.map((m) => m.codigo)).toContain('2.3-N/G/K');
  });

  it('código composto vale por qualquer uma das letras', () => {
    // `1.2-M/I/A` é um menu só, acessível por M, I ou A.
    const r = menusMencionados(
      'confere no 1.2-I os dados da empresa',
      CATALOGO,
    );
    expect(r.map((m) => m.codigo)).toEqual(['1.2-M/I/A']);
  });

  it('acha pelo nome do PROGRAMA, inclusive separado', () => {
    const r = menusMencionados('isso é parametrizado no FAT 101', CATALOGO);
    expect(r[0].codigo).toBe('1.1-P');
    expect(r[0].via).toBe('programa');
  });

  it('acha pelo nome da opção quando ele é distintivo', () => {
    const r = menusMencionados(
      'fizemos a consulta de saldo em estoque antes de faturar',
      CATALOGO,
    );
    expect(r[0].codigo).toBe('4.1-C');
    expect(r[0].via).toBe('nome');
  });

  it('não inventa menu a partir de número solto no meio da conversa', () => {
    // "quatro pedidos" e "2 notas" não podem virar menu — seria pior do que não achar nada,
    // porque o revisor passaria a desconfiar da lista inteira.
    const r = menusMencionados(
      'a gente lançou quatro pedidos e depois 2 notas naquele dia',
      CATALOGO,
    );
    expect(r).toEqual([]);
  });

  it('não repete o mesmo menu citado várias vezes', () => {
    const r = menusMencionados(
      'entra no 2.3-N, volta pro 2.3-N e confere no 2.3 N de novo',
      CATALOGO,
    );
    expect(r).toHaveLength(1);
  });

  it('devolve o trecho onde apareceu, para dar como conferir', () => {
    const r = menusMencionados(
      'Depois de conferir o estoque, abrimos o 2.3-N e emitimos a nota do cliente.',
      CATALOGO,
    );
    expect(r[0].trecho).toContain('2.3');
  });

  it('respeita o limite — lista gigante dilui a instrução da IA', () => {
    const texto = CATALOGO.map((m) => m.codigo.split('/')[0]).join(' e ');
    expect(menusMencionados(texto, CATALOGO, 2)).toHaveLength(2);
  });

  it('texto vazio ou catálogo vazio não quebra', () => {
    expect(menusMencionados('', CATALOGO)).toEqual([]);
    expect(menusMencionados('2.3-N', [])).toEqual([]);
  });
});

/**
 * Estes dois casos vieram da validação contra a BASE REAL de produção (2026-08-11), não da
 * imaginação: rodando o catálogo verdadeiro, o resultado saiu com 1.724 entradas (a maioria
 * nome de arquivo COBOL) e com nove linhas quase idênticas para um único código citado.
 */
describe('menusMencionados — lições da base real', () => {
  it('ignora entrada de catálogo que não é código de menu (nome de fonte .CBL)', () => {
    // A mesma tabela "Caminho | Opção | Programa" dos documentos também lista FONTES. Sem
    // filtro, `BDA001.CBL` virava "menu" e casava com qualquer conversa que citasse o arquivo.
    const sujo: MenuCatalogo[] = [
      { sigla: 'BDA', codigo: 'BDA001.CBL', opcao: '', programa: 'BDA001.CBL' },
      { sigla: 'BDA', codigo: '1.1', opcao: 'Seção', programa: '' },
      ...CATALOGO,
    ];
    const r = menusMencionados('rodamos o BDA001.CBL e o 1.1 de manhã', sujo);
    expect(r).toEqual([]);
  });

  it('mesmo código em vários módulos vira UMA entrada, com a ambiguidade declarada', () => {
    // Todo módulo do SIGER tem o seu "Empresa do módulo" em 1.2-M/I/A. Nove linhas quase
    // iguais afogariam o prompt; uma linha que ADMITE a ambiguidade deixa a IA decidir pelo
    // contexto da gravação.
    const multi: MenuCatalogo[] = [
      {
        sigla: 'FAT',
        codigo: '1.2-M/I/A',
        opcao: 'Empresa do FAT.',
        programa: 'FAT102',
      },
      {
        sigla: 'EST',
        codigo: '1.2-M/I/A',
        opcao: 'Empresa do EST.',
        programa: 'EST102',
      },
      {
        sigla: 'FIN',
        codigo: '1.2-M/I/A',
        opcao: 'Empresa do FIN.',
        programa: 'FIN102',
      },
    ];
    const r = menusMencionados('confere no 1.2-M os dados da empresa', multi);

    expect(r).toHaveLength(1);
    expect(r[0].siglas).toEqual(['FAT', 'EST', 'FIN']);
    expect(r[0].programas).toEqual(['FAT102', 'EST102', 'FIN102']);

    const prompt = formatarParaPrompt(r);
    expect(prompt).toContain('FAT/EST/FIN');
    expect(prompt).toContain('existe em vários módulos');
  });

  it('código único NÃO ganha o aviso de ambiguidade', () => {
    const r = menusMencionados('abre o 2.3-N', CATALOGO);
    expect(formatarParaPrompt(r)).not.toContain('vários módulos');
  });
});

describe('digitarNumerosFalados', () => {
  it('converte só quando há separador falado no meio', () => {
    expect(digitarNumerosFalados('um ponto quatro')).toContain('1.4');
    expect(digitarNumerosFalados('dois virgula tres')).toContain('2.3');
  });

  it('NÃO converte número solto', () => {
    // Sem isso, "quatro pedidos" viraria "4 pedidos" e alimentaria falso positivo.
    expect(digitarNumerosFalados('quatro pedidos')).toBe('quatro pedidos');
  });

  it('funciona com acento no texto original', () => {
    expect(digitarNumerosFalados('dois ponto três')).toContain('2.3');
  });
});

describe('expandirCodigo', () => {
  it('quebra o código composto', () => {
    expect(expandirCodigo('1.2-M/I/A')).toEqual(['1.2-M', '1.2-I', '1.2-A']);
  });

  it('mantém o código simples', () => {
    expect(expandirCodigo('1.1-P')).toEqual(['1.1-P']);
  });
});

describe('formatarParaPrompt', () => {
  it('monta uma linha por menu, com módulo e programa', () => {
    const menus = menusMencionados('abre o 2.3-N', CATALOGO);
    expect(formatarParaPrompt(menus)).toBe(
      '- 2.3-N/G/K (FAT, FAT203) — Emissao de notas, NF-e/NFC-e/NFS-e',
    );
  });

  it('sem menu, não gera bloco nenhum', () => {
    expect(formatarParaPrompt([])).toBe('');
  });
});
