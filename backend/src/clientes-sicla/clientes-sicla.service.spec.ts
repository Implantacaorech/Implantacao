import { ClientesSiclaService } from './clientes-sicla.service';

/** O serviço do passo 1: consulta ao SICLA e cadastro da ficha. Testado com dublês — o foco
 * é a REGRA (validação do termo, mapeamento das colunas, anti-duplicação e conclusão do
 * passo 1), não a conexão Oracle real. */
describe('ClientesSiclaService', () => {
  function montar(
    over: {
      consultar?: jest.Mock;
      projetoFindOne?: jest.Mock;
      projetoSave?: jest.Mock;
      concluir?: jest.Mock;
    } = {},
  ) {
    const consultar =
      over.consultar ??
      jest.fn().mockResolvedValue({
        ok: true,
        mensagem: 'ok',
        colunas: [],
        linhas: [],
      });
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
    const dados = { consultar };
    const passos = { concluir };

    const service = new ClientesSiclaService(
      projetos as never,
      dados as never,
      passos as never,
    );
    return {
      service,
      consultar,
      projetoFindOne,
      projetoSave,
      concluir,
    };
  }

  it('recusa termo curto sem consultar o SICLA', async () => {
    const { service, consultar } = montar();
    const r = await service.buscar('a');
    expect(r.ok).toBe(false);
    expect(consultar).not.toHaveBeenCalled();
  });

  it('pede a consulta pelo NOME, com o termo CRU (o curinga é do catálogo)', async () => {
    const { service, consultar } = montar();
    await service.buscar('  acme  ');
    expect(consultar).toHaveBeenCalledWith('sicla.clientes.buscar', {
      termo: 'acme',
    });
  });

  // "SQL padrão vs SQL editado pelo Administrador" saiu daqui: a escolha do texto vigente
  // é do catálogo, e está coberta em dados.service.spec.ts ("usa o SQL salvo em Consultas
  // BD, não o embutido no código"). Este módulo não conhece mais SQL.

  it('mapeia colunas do SICLA para a ficha, aceitando variações de nome', async () => {
    const consultar = jest.fn().mockResolvedValue({
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
    const { service } = montar({ consultar });
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
    const consultar = jest.fn().mockResolvedValue({
      ok: false,
      mensagem: 'ORA-00942',
      colunas: [],
      linhas: [],
    });
    const { service } = montar({ consultar });
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
      {
        cliente: 'ACME',
        cnpj: '00.000/0001-00',
        tipoDemanda: 'Levantamento',
      },
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
      { cliente: 'Nova Indústria', cnpj: '', tipoDemanda: 'Demonstração' },
      { nome: 'Vendedor', perfil: 'Comercial' },
    );
    expect(r.duplicado).toBe(false);
    expect(r.projetoId).toBe(7);
    expect(projetoSave).toHaveBeenCalled();
    // O tipo de demanda escolhido no passo 1 vai para a ficha.
    expect(projetoSave.mock.calls[0][0]).toMatchObject({
      tipoDemanda: 'Demonstração',
    });
    expect(concluir).toHaveBeenCalledWith(
      7,
      1,
      expect.objectContaining({ nome: 'Vendedor', perfil: 'Comercial' }),
      expect.objectContaining({ observacao: expect.any(String) }),
    );
  });

  it('grava os módulos marcados: códigos efetivos em `modulos` e detalhe em JSON', async () => {
    const { service, projetoSave } = montar();
    await service.cadastrar(
      {
        cliente: 'Nova Indústria',
        tipoDemanda: 'Levantamento',
        modulosSelecionados: [
          { codigo: '105', descricao: 'Faturamento · NF-e', obs: 'com nota' },
          { codigo: '20', descricao: 'Estoque', obs: '' },
        ],
      },
      { nome: 'Vendedor', perfil: 'Comercial' },
    );
    const salvo = projetoSave.mock.calls[0][0] as {
      modulos: string;
      modulosDetalhe: string;
    };
    expect(salvo.modulos).toBe('105, 20');
    expect(JSON.parse(salvo.modulosDetalhe)).toEqual([
      { codigo: '105', descricao: 'Faturamento · NF-e', obs: 'com nota' },
      { codigo: '20', descricao: 'Estoque', obs: '' },
    ]);
  });

  it('grava as conversões estimadas (nome + horas + observação) em JSON, ignorando as sem nome', async () => {
    const { service, projetoSave } = montar();
    await service.cadastrar(
      {
        cliente: 'Nova Indústria',
        tipoDemanda: 'Levantamento',
        conversoesSelecionadas: [
          {
            nome: 'Importação Cad. produtos',
            horas: '8',
            obs: 'sem preço de custo',
          },
          { nome: 'Conversão sob medida', horas: '' },
          { nome: '', horas: '5' },
        ],
      },
      { nome: 'Vendedor', perfil: 'Comercial' },
    );
    const salvo = projetoSave.mock.calls[0][0] as { conversoes: string };
    expect(JSON.parse(salvo.conversoes)).toEqual([
      {
        nome: 'Importação Cad. produtos',
        horas: '8',
        obs: 'sem preço de custo',
      },
      { nome: 'Conversão sob medida', horas: '', obs: '' },
    ]);
  });
});
