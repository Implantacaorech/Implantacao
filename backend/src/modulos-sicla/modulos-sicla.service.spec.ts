import { ModulosSiclaService } from './modulos-sicla.service';
import { SQL_BUSCA_MODULO_PADRAO } from './modulos-sicla.constants';

/** Busca de módulos/adicionais no SICLA. Foco na REGRA: validação do termo, uso do SQL
 * (default vs editado) e, sobretudo, o CÓDIGO EFETIVO (adicional quando há, senão módulo). */
describe('ModulosSiclaService', () => {
  function montar(over: { executarSql?: jest.Mock; porSlug?: jest.Mock } = {}) {
    const executarSql =
      over.executarSql ??
      jest.fn().mockResolvedValue({
        ok: true,
        mensagem: 'ok',
        colunas: [],
        linhas: [],
      });
    const porSlug = over.porSlug ?? jest.fn().mockResolvedValue(null);
    const service = new ModulosSiclaService(
      { executarSql } as never,
      { porSlug } as never,
    );
    return { service, executarSql, porSlug };
  }

  it('recusa termo vazio sem consultar', async () => {
    const { service, executarSql } = montar();
    const r = await service.buscar('');
    expect(r.ok).toBe(false);
    expect(executarSql).not.toHaveBeenCalled();
  });

  it('usa o SQL padrão e passa o termo com curinga', async () => {
    const { service, executarSql } = montar();
    await service.buscar('fat');
    expect(executarSql).toHaveBeenCalledWith(
      SQL_BUSCA_MODULO_PADRAO,
      { termo: '%fat%' },
      undefined,
      200,
    );
  });

  it('sem adicional: código efetivo é o do módulo', async () => {
    const executarSql = jest.fn().mockResolvedValue({
      ok: true,
      mensagem: '1',
      colunas: [],
      linhas: [
        {
          CODMODULO: 10,
          MODULO: 'Faturamento',
          CODADICIONAL: null,
          ADICIONAL: null,
        },
      ],
    });
    const { service } = montar({ executarSql });
    const r = await service.buscar('fat');
    expect(r.modulos[0]).toMatchObject({
      codModulo: '10',
      descModulo: 'Faturamento',
      codAdicional: '',
      codigo: '10',
      descricao: 'Faturamento',
    });
  });

  it('com adicional: código efetivo é o do ADICIONAL e o rótulo junta os dois', async () => {
    const executarSql = jest.fn().mockResolvedValue({
      ok: true,
      mensagem: '1',
      colunas: [],
      linhas: [
        {
          CODMODULO: 10,
          MODULO: 'Faturamento',
          CODADICIONAL: 105,
          ADICIONAL: 'NF-e',
        },
      ],
    });
    const { service } = montar({ executarSql });
    const r = await service.buscar('fat');
    expect(r.modulos[0]).toMatchObject({
      codModulo: '10',
      codAdicional: '105',
      codigo: '105', // adicional manda
      descricao: 'Faturamento · NF-e',
    });
  });

  it('propaga a falha da consulta sem estourar', async () => {
    const executarSql = jest.fn().mockResolvedValue({
      ok: false,
      mensagem: 'ORA-00942',
      colunas: [],
      linhas: [],
    });
    const { service } = montar({ executarSql });
    const r = await service.buscar('fat');
    expect(r.ok).toBe(false);
    expect(r.modulos).toEqual([]);
  });
});
