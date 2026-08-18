import { WalleOracleService } from './walle-oracle.service';

/** Fonte B (Oracle/SICLA) do módulo Wall-e — o que se cobra: enriquecimento é OPCIONAL e
 * nunca lança (SICLA fora ⇒ `disponivel: false` com motivo), só enriquece chat que existe
 * no acervo (não inventa chat sem arquivo) e respeita SQL editado no Consultas BD. */
describe('WalleOracleService', () => {
  function montar(opts: {
    executar?: { ok: boolean; mensagem: string; linhas: Array<Record<string, unknown>> };
    sqlEditado?: string | null;
    chatsLocais?: number[];
  }) {
    const salvos: Array<Record<string, unknown>> = [];
    const disponibilidade = {
      executarSql: jest.fn(async () =>
        opts.executar ?? { ok: true, mensagem: '', colunas: [], linhas: [] },
      ),
    };
    const consultas = {
      porSlug: jest.fn(async () =>
        opts.sqlEditado === undefined || opts.sqlEditado === null
          ? null
          : { sql: opts.sqlEditado },
      ),
      salvar: jest.fn(),
    };
    const chats = {
      porCodigo: jest.fn(async (codigo: number) =>
        (opts.chatsLocais ?? []).includes(codigo)
          ? { id: codigo, codigo, descricao: '', tecnico: '', sistema: '' }
          : null,
      ),
      salvar: jest.fn(async (c: Record<string, unknown>) => {
        salvos.push(c);
        return c;
      }),
    };
    const servico = new WalleOracleService(
      disponibilidade as never,
      consultas as never,
      chats as never,
    );
    return { servico, disponibilidade, consultas, chats, salvos };
  }

  it('SICLA fora do ar: devolve disponivel=false com o motivo, sem lançar', async () => {
    const { servico } = montar({
      executar: { ok: false, mensagem: 'DPY-3015: senha com verificador antigo', linhas: [] },
    });
    const r = await servico.enriquecer();
    expect(r.disponivel).toBe(false);
    expect(r.mensagem).toContain('DPY-3015');
    expect(r.enriquecidos).toBe(0);
  });

  it('enriquece SÓ os chats que existem no acervo local — não inventa chat sem arquivo', async () => {
    const { servico, salvos } = montar({
      executar: {
        ok: true,
        mensagem: '',
        linhas: [
          { CODIGO: 42, DESCRICAO: 'Investigação WhatsApp', TECNICO: 'Gustavo', SISTEMA: 'SICLA' },
          { CODIGO: 999, DESCRICAO: 'Chat sem pasta no acervo', TECNICO: '', SISTEMA: '' },
        ],
      },
      chatsLocais: [42],
    });
    const r = await servico.enriquecer();
    expect(r.disponivel).toBe(true);
    expect(r.chatsOracle).toBe(2);
    expect(r.enriquecidos).toBe(1);
    expect(salvos).toHaveLength(1);
    expect(salvos[0]).toMatchObject({
      codigo: 42,
      descricao: 'Investigação WhatsApp',
      origemMetadados: 'oracle',
    });
  });

  it('usa o SQL editado no Consultas BD quando existir (editável sem deploy)', async () => {
    const { servico, disponibilidade } = montar({
      sqlEditado: 'SELECT CODIGO, DESCRICAO, TECNICO, SISTEMA FROM SICLA.LISTA_CHAT_WALLE',
      executar: { ok: true, mensagem: '', linhas: [] },
    });
    await servico.enriquecer();
    expect(disponibilidade.executarSql).toHaveBeenCalledWith(
      expect.stringContaining('LISTA_CHAT_WALLE'),
      {},
      undefined,
      5000,
    );
  });
});
