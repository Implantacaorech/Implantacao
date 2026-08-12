import {
  MenusSigerService,
  ehListaDePrograma,
  extrairCaminho,
} from './menus-siger.service';

const DOC_GIN = `# GIN - GIN Industrial

## 5. Mapa de menus

| Caminho | Opcao | Programa | Funcao implantavel |
| --- | --- | --- | --- |
| \`2.1-M\` | Manutencao consolidada de OP | \`GIN201\` | Consultar/manter OPs. |
| \`2.1-P\` | Importacao de pedidos FAT | \`GIN201\` | Gerar/importar OP a partir de pedidos do Faturamento. |
| \`2.2-P\` | Programacao de OP | \`GIN202\` | Programar OP por data e centro. |

## 6. Outra seção
Texto qualquer.
`;

const DOC_SEM_TABELA = `# CNV - Conversoes

## 1. Papel operacional
Rotina utilitária sem mapa de menus em tabela.
`;

function svc(docs: any[]) {
  const repo = { find: jest.fn().mockResolvedValue(docs) } as any;
  return new MenusSigerService(repo);
}

/** Os 87 documentos do Dicionário usam **81 formatos de cabeçalho** diferentes (medido na
 * base de produção em 2026-08-12). O parser reconhecia UM — e o resultado era um catálogo com
 * 275 dos 416 menus sem nome, ou seja, impossíveis de casar contra uma transcrição, já que o
 * consultor fala o nome da tela e não o código dela. Cada caso abaixo saiu de um documento
 * real. */
describe('MenusSigerService — os formatos reais do Dicionário', () => {
  const doc = (conteudo: string) =>
    svc([{ sigla: 'XXX', tipo: 'modulo', titulo: 'XXX', conteudo }]);

  it.each([
    [
      'Rotina',
      '| Caminho | Rotina | Programa | Uso |',
      'Contratos de Financiamento',
    ],
    [
      'Area',
      '| Caminho | Area | Programa/rotina | Papel tecnico |',
      'Cadastros de teste',
    ],
    ['Menu', '| Caminho | Menu | Uso |', 'Cadastros gerais do modulo'],
    [
      'O que faz',
      '| Caminho | O que faz | Programa |',
      'Abre manutencao consolidada',
    ],
  ])('acha o nome do menu na coluna "%s"', async (_col, cabecalho, nome) => {
    const s = doc(
      `${cabecalho}\n| --- | --- | --- | --- |\n| \`2.1\` | ${nome} | \`XXX201\` | x |`,
    );
    const menus = (await s.taxonomia())[0].menus;
    expect(menus).toHaveLength(1);
    expect(menus[0].codigo).toBe('2.1');
    expect(menus[0].opcao).toBe(nome);
  });

  /** Sem coluna de nome, o nome está DENTRO do caminho — e era jogado fora com ele. */
  it('extrai o nome embutido no próprio caminho quando não há coluna para ele', async () => {
    const s = doc(
      '| Caminho | Opcoes/hotkeys relevantes |\n| --- | --- |\n' +
        '| `1.7 Parametros dos Servicos` | `P` parametros. |',
    );
    const menus = (await s.taxonomia())[0].menus;
    expect(menus[0].codigo).toBe('1.7');
    expect(menus[0].opcao).toBe('Parametros dos Servicos');
  });

  /** Coluna própria vence o embutido. */
  it('prefere a coluna de nome ao nome embutido no caminho', async () => {
    const s = doc(
      '| Caminho | Opcao |\n| --- | --- |\n| `1.7 Parametros` | Nome oficial da tela |',
    );
    expect((await s.taxonomia())[0].menus[0].opcao).toBe(
      'Nome oficial da tela',
    );
  });

  /** Algumas tabelas põem o PROGRAMA na coluna que em outras é o nome. "AUE102, SRIEMF"
   * nunca casaria com fala de reunião e só ocuparia espaço na lista entregue à IA. */
  it('recusa "nome" que na verdade é lista de programa', async () => {
    const s = doc(
      '| Caminho | Opcao | Uso |\n| --- | --- | --- |\n| `1.2` | AUE102, SRIEMF | x |',
    );
    expect((await s.taxonomia())[0].menus[0].opcao).toBe('');
  });

  describe('extrairCaminho', () => {
    it.each([
      ['`2.3-N`', '2.3-N', ''],
      ['`1.1`', '1.1', ''],
      ['`FAT 1.2`', '1.2', ''], // prefixo do módulo não é nome
      ['`1.7 Parametros dos Servicos`', '1.7', 'Parametros dos Servicos'],
      ['`FIN 2.2` / `AUE 3.2`', '2.2', ''], // vários caminhos: nenhum vira nome
      ['`1.2-M/I/A`', '1.2-M/I/A', ''],
    ])('%s -> código %s, nome "%s"', (celula, codigo, nome) => {
      const r = extrairCaminho(celula);
      expect(r).not.toBeNull();
      expect(r!.codigo).toBe(codigo);
      expect(r!.nome).toBe(nome);
    });

    it('caminho textual sem código não vira menu', () => {
      expect(
        extrairCaminho('WMS > Cadastros/Configuracoes > Tipos de tarefa'),
      ).toBeNull();
      expect(
        extrairCaminho('Modulo > 1-Cadastros > 4-Tabelas por Empresa'),
      ).toBeNull();
    });
  });

  describe('ehListaDePrograma', () => {
    it.each(['AUE102, SRIEMF', 'SRHCMP', 'COM301/SRIEOC', 'GIN201'])(
      '"%s" é programa, não nome',
      (t) => expect(ehListaDePrograma(t)).toBe(true),
    );
    it.each([
      'Cancelamento de OP',
      'Programacao da fabrica',
      'Venda varejo/consumidor',
    ])('"%s" é nome de verdade', (t) =>
      expect(ehListaDePrograma(t)).toBe(false),
    );
  });
});

describe('MenusSigerService (parser de menus do SIGER)', () => {
  it('extrai código de acesso, opção, programa e função da tabela Caminho', async () => {
    const s = svc([
      {
        sigla: 'GIN',
        tipo: 'modulo',
        titulo: 'GIN - GIN Industrial',
        conteudo: DOC_GIN,
      },
    ]);
    const tax = await s.taxonomia();
    expect(tax).toHaveLength(1);
    const gin = tax[0];
    expect(gin.menus).toHaveLength(3);
    const p = gin.menus.find((m) => m.codigo === '2.1-P');
    expect(p).toBeDefined();
    expect(p!.opcao).toBe('Importacao de pedidos FAT');
    expect(p!.programa).toBe('GIN201');
    expect(p!.funcao).toContain('Faturamento');
  });

  it('não inventa menus quando o doc não tem tabela Caminho', async () => {
    const s = svc([
      {
        sigla: 'CNV',
        tipo: 'adicional',
        titulo: 'CNV',
        conteudo: DOC_SEM_TABELA,
      },
    ]);
    const tax = await s.taxonomia();
    expect(tax[0].menus).toEqual([]);
  });

  it('ignora docs sem sigla e usa cache (só lê o repo uma vez)', async () => {
    const repo = {
      find: jest
        .fn()
        .mockResolvedValue([
          { sigla: '', tipo: 'adicional', titulo: '', conteudo: '' },
        ]),
    } as any;
    const s = new MenusSigerService(repo);
    await s.taxonomia();
    await s.taxonomia();
    expect(repo.find).toHaveBeenCalledTimes(1);
    expect(await s.taxonomia()).toHaveLength(0);
  });
});
