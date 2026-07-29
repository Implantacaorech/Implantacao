import { FuncoesSiclaService } from './funcoes-sicla.service';
import {
  GRUPO_SEM_MODULO,
  siglaDoToken,
  SQL_LISTA_FUNCOES_PADRAO,
} from './funcoes-sicla.constants';

/** Taxonomia das funções do SICLA. Foco na REGRA de agrupamento por STRMENUS — é o que
 * define a matriz inteira. */
describe('siglaDoToken', () => {
  it('tira o código do menu e devolve a sigla do módulo', () => {
    expect(siglaDoToken('CTB94A')).toBe('CTB');
    expect(siglaDoToken('FTR34')).toBe('FTR');
    expect(siglaDoToken('GER94A')).toBe('GER');
  });

  it('normaliza o ponto final — GER. e GER são o MESMO módulo', () => {
    expect(siglaDoToken('GER.')).toBe('GER');
    expect(siglaDoToken('FAT.')).toBe('FAT');
    expect(siglaDoToken('GTI.')).toBe('GTI');
    expect(siglaDoToken('GER.')).toBe(siglaDoToken('GER94A'));
  });

  it('devolve vazio para token sem letra (vira "Classificar")', () => {
    expect(siglaDoToken('.')).toBe('');
    expect(siglaDoToken('94A')).toBe('');
    expect(siglaDoToken('1.5')).toBe('');
    expect(siglaDoToken('')).toBe('');
    expect(siglaDoToken('   ')).toBe('');
  });

  it('é indiferente a caixa e a espaço em volta', () => {
    expect(siglaDoToken(' csa14 ')).toBe('CSA');
  });
});

describe('FuncoesSiclaService', () => {
  const LINHA_EXEMPLO = {
    CODIGO: 3004,
    DESCRICAO: 'Executar programa de ajuste específico',
    STRMENUS: 'CTB94A;GPA94A;FAT94A;FIN94A;EST94A;GIN94A;PDV94A;GER.;GCO94A',
  };

  function montar(linhas: Record<string, unknown>[], ok = true) {
    const executarSql = jest.fn().mockResolvedValue({
      ok,
      mensagem: ok ? 'ok' : 'ORA-12541',
      colunas: [],
      linhas,
    });
    const porSlug = jest.fn().mockResolvedValue(null);
    const service = new FuncoesSiclaService(
      { executarSql } as never,
      { porSlug } as never,
    );
    return { service, executarSql, porSlug };
  }

  it('usa o SQL padrão, sem bind', async () => {
    const { service, executarSql } = montar([]);
    await service.taxonomia();
    expect(executarSql).toHaveBeenCalledWith(
      SQL_LISTA_FUNCOES_PADRAO,
      {},
      undefined,
      5000,
    );
  });

  it('o exemplo do usuário cai nos 9 módulos do STRMENUS', async () => {
    const { service } = montar([LINHA_EXEMPLO]);
    const tax = await service.taxonomia();
    expect(tax.map((m) => m.sigla)).toEqual(
      // alfabética; GER. virou GER
      ['CTB', 'EST', 'FAT', 'FIN', 'GCO', 'GER', 'GIN', 'GPA', 'PDV'],
    );
    for (const m of tax) {
      expect(m.funcoes).toHaveLength(1);
      expect(m.funcoes[0].descricao).toBe(
        'Executar programa de ajuste específico',
      );
      expect(m.funcoes[0].chave).toBe(`${m.sigla}|3004`);
    }
  });

  it('guarda o caminho do menu que colocou a função no grupo', async () => {
    const { service } = montar([LINHA_EXEMPLO]);
    const tax = await service.taxonomia();
    expect(tax.find((m) => m.sigla === 'CTB')!.funcoes[0].menus).toBe('CTB94A');
    expect(tax.find((m) => m.sigla === 'GER')!.funcoes[0].menus).toBe('GER.');
  });

  it('não duplica a função quando a mesma sigla aparece em dois menus', async () => {
    const { service } = montar([
      { CODIGO: 10, DESCRICAO: 'X', STRMENUS: 'CTB94A;CTB95B;FAT10' },
    ]);
    const tax = await service.taxonomia();
    const ctb = tax.find((m) => m.sigla === 'CTB')!;
    expect(ctb.funcoes).toHaveLength(1);
    expect(ctb.funcoes[0].menus).toBe('CTB94A, CTB95B'); // acumula os caminhos
  });

  it('sem STRMENUS vai para "Classificar"', async () => {
    const { service } = montar([
      { CODIGO: 1, DESCRICAO: 'Sem menu', STRMENUS: null },
      { CODIGO: 2, DESCRICAO: 'Vazio', STRMENUS: '   ' },
    ]);
    const tax = await service.taxonomia();
    expect(tax).toHaveLength(1);
    expect(tax[0].sigla).toBe(GRUPO_SEM_MODULO);
    expect(tax[0].funcoes.map((f) => f.codigo)).toEqual(['1', '2']);
  });

  it('STRMENUS só com lixo (".") também vai para "Classificar"', async () => {
    const { service } = montar([
      { CODIGO: 7, DESCRICAO: 'Rech DF-e', STRMENUS: '.' },
    ]);
    const tax = await service.taxonomia();
    expect(tax[0].sigla).toBe(GRUPO_SEM_MODULO);
    expect(tax[0].funcoes[0].chave).toBe(`${GRUPO_SEM_MODULO}|7`);
  });

  it('"Classificar" fica sempre por último, depois dos módulos', async () => {
    const { service } = montar([
      { CODIGO: 1, DESCRICAO: 'Sem', STRMENUS: '' },
      { CODIGO: 2, DESCRICAO: 'Com', STRMENUS: 'ZZZ10' },
      { CODIGO: 3, DESCRICAO: 'Com', STRMENUS: 'AAA10' },
    ]);
    const tax = await service.taxonomia();
    expect(tax.map((m) => m.sigla)).toEqual(['AAA', 'ZZZ', GRUPO_SEM_MODULO]);
  });

  it('cacheia: a segunda chamada não vai ao banco; limparCache força releitura', async () => {
    const { service, executarSql } = montar([LINHA_EXEMPLO]);
    await service.taxonomia();
    await service.taxonomia();
    expect(executarSql).toHaveBeenCalledTimes(1);
    service.limparCache();
    await service.taxonomia();
    expect(executarSql).toHaveBeenCalledTimes(2);
  });

  it('falha de consulta estoura e NÃO vira cache', async () => {
    const { service, executarSql } = montar([], false);
    await expect(service.taxonomia()).rejects.toThrow('ORA-12541');
    await expect(service.taxonomia()).rejects.toThrow('ORA-12541');
    expect(executarSql).toHaveBeenCalledTimes(2); // tentou de novo
  });
});
