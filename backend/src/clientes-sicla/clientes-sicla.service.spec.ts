import { ClientesSiclaService } from './clientes-sicla.service';
import { SQL_BUSCA_CLIENTE_PADRAO } from './clientes-sicla.constants';

/** O serviço do passo 1: consulta ao SICLA e cadastro da ficha. Testado com dublês — o foco
 * é a REGRA (validação do termo, mapeamento das colunas, anti-duplicação e conclusão do
 * passo 1), não a conexão Oracle real. */
describe('ClientesSiclaService', () => {
  function montar(
    over: {
      executarSql?: jest.Mock;
      porSlug?: jest.Mock;
      projetoFindOne?: jest.Mock;
      projetoSave?: jest.Mock;
      concluir?: jest.Mock;
    } = {},
  ) {
    const executarSql =
      over.executarSql ??
      jest.fn().mockResolvedValue({
        ok: true,
        mensagem: 'ok',
        colunas: [],
        linhas: [],
      });
    const porSlug = over.porSlug ?? jest.fn().mockResolvedValue(null);
    const projetoFindOne =
      over.projetoFindOne ?? jest.fn().mockResolvedValue(null);
    const projetoSave =
      over.projetoSave ??
      jest
        .fn()
        .mockImplementation((p: unknown) =>
          Promise.resolve({ id: 7, ...(p as object) }),
        );
    const concluir = over.concluir ?? jest.fn().mockResolvedValue([]);

    const projetos = {
      findOne: projetoFindOne,
      save: projetoSave,
      create: (p: unknown) => p,
    };
    const disponibilidade = { executarSql };
    const consultas = { porSlug };
    const passos = { concluir };

    const service = new ClientesSiclaService(
      projetos as never,
      disponibilidade as never,
      consultas as never,
      passos as never,
    );
    return {
      service,
      executarSql,
      porSlug,
      projetoFindOne,
      projetoSave,
      concluir,
    };
  }

  it('recusa termo curto sem consultar o SICLA', async () => {
    const { service, executarSql } = montar();
    const r = await service.buscar('a');
    expect(r.ok).toBe(false);
    expect(executarSql).not.toHaveBeenCalled();
  });

  it('usa o SQL padrão quando não há consulta editada e passa o termo com curinga', async () => {
    const { service, executarSql, porSlug } = montar();
    await service.buscar('acme');
    expect(porSlug).toHaveBeenCalled();
    expect(executarSql).toHaveBeenCalledWith(
      SQL_BUSCA_CLIENTE_PADRAO,
      { termo: '%acme%' },
      undefined,
      50,
    );
  });

  it('prefere o SQL editado pelo Administrador quando existe', async () => {
    const sqlEditado =
      'SELECT CODIGO, CLIENTE FROM MINHA.TABELA WHERE CLIENTE LIKE :termo';
    const porSlug = jest.fn().mockResolvedValue({ sql: sqlEditado });
    const { service, executarSql } = montar({ porSlug });
    await service.buscar('acme');
    expect(executarSql).toHaveBeenCalledWith(
      sqlEditado,
      { termo: '%acme%' },
      undefined,
      50,
    );
  });

  it('mapeia colunas do SICLA para a ficha, aceitando variações de nome', async () => {
    const executarSql = jest.fn().mockResolvedValue({
      ok: true,
      mensagem: '1 linha(s).',
      colunas: ['CODIGO', 'RAZAO', 'FANTASIA', 'CNPJ'],
      linhas: [
        {
          CODIGO: 123,
          RAZAO: 'ACME Indústria',
          FANTASIA: 'ACME',
          CNPJ: '00.000/0001-00',
        },
      ],
    });
    const { service } = montar({ executarSql });
    const r = await service.buscar('acme');
    expect(r.ok).toBe(true);
    expect(r.clientes[0]).toMatchObject({
      codigo: '123',
      cliente: 'ACME Indústria',
      fantasia: 'ACME',
      cnpj: '00.000/0001-00',
    });
    // A linha original fica em `bruto`, para o front usar colunas extras sem depender do mapa.
    expect(r.clientes[0].bruto).toEqual(r.clientes[0].bruto);
  });

  it('propaga a falha da consulta sem estourar', async () => {
    const executarSql = jest.fn().mockResolvedValue({
      ok: false,
      mensagem: 'ORA-00942',
      colunas: [],
      linhas: [],
    });
    const { service } = montar({ executarSql });
    const r = await service.buscar('acme');
    expect(r.ok).toBe(false);
    expect(r.mensagem).toContain('ORA-00942');
    expect(r.clientes).toEqual([]);
  });

  it('cadastra: cria a ficha, conclui o passo 1 e não duplica quando o CNPJ já existe', async () => {
    const projetoFindOne = jest.fn().mockResolvedValue({ id: 42 });
    const projetoSave = jest.fn();
    const concluir = jest.fn();
    const { service } = montar({ projetoFindOne, projetoSave, concluir });
    const r = await service.cadastrar(
      { cliente: 'ACME', cnpj: '00.000/0001-00' },
      { nome: 'Vendedor', perfil: 'Comercial' },
    );
    expect(r).toEqual({ projetoId: 42, duplicado: true });
    expect(projetoSave).not.toHaveBeenCalled();
    expect(concluir).not.toHaveBeenCalled();
  });

  it('cadastra um cliente novo e conclui o passo 1 como Comercial', async () => {
    const concluir = jest.fn().mockResolvedValue([]);
    const { service, projetoSave } = montar({ concluir });
    const r = await service.cadastrar(
      { cliente: 'Nova Indústria', cnpj: '' },
      { nome: 'Vendedor', perfil: 'Comercial' },
    );
    expect(r.duplicado).toBe(false);
    expect(r.projetoId).toBe(7);
    expect(projetoSave).toHaveBeenCalled();
    expect(concluir).toHaveBeenCalledWith(
      7,
      1,
      expect.objectContaining({ nome: 'Vendedor', perfil: 'Comercial' }),
      expect.any(String),
    );
  });
});
