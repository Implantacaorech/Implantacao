import { ModulosSiclaService } from './modulos-sicla.service';

/** Busca de módulos/adicionais no SICLA. Foco na REGRA que sobrou no módulo depois da API
 * de Dados: validação do termo e, sobretudo, o CÓDIGO EFETIVO (adicional quando há, senão
 * módulo). SQL, conexão e teto de linhas são do catálogo — testados lá. */
describe('ModulosSiclaService', () => {
  function montar(over: { consultar?: jest.Mock } = {}) {
    const consultar =
      over.consultar ??
      jest.fn().mockResolvedValue({
        ok: true,
        mensagem: 'ok',
        colunas: [],
        linhas: [],
      });
    const service = new ModulosSiclaService({ consultar } as never);
    return { service, consultar };
  }

  it('recusa termo vazio sem consultar', async () => {
    const { service, consultar } = montar();
    const r = await service.buscar('');
    expect(r.ok).toBe(false);
    expect(consultar).not.toHaveBeenCalled();
  });

  it('pede a consulta pelo NOME, com o termo CRU (o curinga é do catálogo)', async () => {
    const { service, consultar } = montar();
    await service.buscar('  fat  ');
    expect(consultar).toHaveBeenCalledWith('sicla.modulos.buscar', {
      termo: 'fat',
    });
  });

  it('sem adicional: código efetivo é o do módulo', async () => {
    const consultar = jest.fn().mockResolvedValue({
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
    const { service } = montar({ consultar });
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
    const consultar = jest.fn().mockResolvedValue({
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
    const { service } = montar({ consultar });
    const r = await service.buscar('fat');
    expect(r.modulos[0]).toMatchObject({
      codModulo: '10',
      codAdicional: '105',
      codigo: '105', // adicional manda
      descricao: 'Faturamento · NF-e',
    });
  });

  it('propaga a falha da consulta sem estourar', async () => {
    const consultar = jest.fn().mockResolvedValue({
      ok: false,
      mensagem: 'ORA-00942',
      colunas: [],
      linhas: [],
    });
    const { service } = montar({ consultar });
    const r = await service.buscar('fat');
    expect(r.ok).toBe(false);
    expect(r.modulos).toEqual([]);
  });
});
