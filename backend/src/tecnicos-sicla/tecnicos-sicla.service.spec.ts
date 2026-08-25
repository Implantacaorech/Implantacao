import * as bcrypt from 'bcrypt';
import { TecnicosSiclaService } from './tecnicos-sicla.service';
import { SENHA_PADRAO_TECNICO } from './tecnicos-sicla.constants';
import type { Usuario } from '../database/entities/usuario.entity';

const LINHA = {
  CODIGO: 42,
  NOME: 'Fulano de Tal',
  MODULOCAPACITADO: 'FAT, EST',
  EMAIL: 'fulano@rech.com.br',
  SETORDES: 'Implantação',
};

/** Usuários vindos de SICLA.LISTA_TECNICOS. Foco na REGRA: o de/para das colunas, o login
 * ser o e-mail, a senha padrão só valer para quem é NOVO e a atualização não mexer no que
 * é do Painel (perfil, papéis, situação, senha). */
describe('TecnicosSiclaService', () => {
  function montar(
    over: {
      linhas?: Record<string, unknown>[];
      okConsulta?: boolean;
      existentes?: Partial<Usuario>[];
    } = {},
  ) {
    const consultar = jest.fn().mockResolvedValue({
      ok: over.okConsulta ?? true,
      mensagem: over.okConsulta === false ? 'ORA-00942' : 'ok',
      colunas: [],
      linhas: over.linhas ?? [LINHA],
    });
    const banco = (over.existentes ?? []) as Usuario[];
    const repo = {
      find: jest.fn().mockImplementation(() => Promise.resolve([...banco])),
      create: jest.fn().mockImplementation((d: Partial<Usuario>) => ({ ...d })),
      save: jest.fn().mockImplementation((u: Usuario) => Promise.resolve(u)),
    };
    const service = new TecnicosSiclaService(
      repo as never,
      {
        consultar,
      } as never,
    );
    return { service, consultar, repo };
  }

  it('pede a consulta pelo NOME, sem parâmetro (o filtro é em memória)', async () => {
    const { service, consultar } = montar();
    await service.listar();
    expect(consultar).toHaveBeenCalledWith('sicla.tecnicos.listar');
  });

  // "SQL padrão vs editado" saiu daqui: escolher o texto vigente é do catálogo, coberto em
  // dados.service.spec.ts. Este módulo não conhece mais SQL nem teto de linhas.

  it('mapeia as colunas do de/para (código, nome, módulos, e-mail, setor)', async () => {
    const { service } = montar();
    const r = await service.listar();
    expect(r.tecnicos[0]).toMatchObject({
      codigo: '42',
      nome: 'Fulano de Tal',
      modulosCapacitados: 'FAT, EST',
      email: 'fulano@rech.com.br',
      setorAtuacao: 'Implantação',
      jaCadastrado: false,
    });
  });

  it('filtra em memória por nome, código, e-mail, setor ou módulo', async () => {
    const { service, consultar } = montar({
      linhas: [LINHA, { ...LINHA, CODIGO: 43, NOME: 'Beltrano' }],
    });
    const r = await service.listar('beltr');
    expect(r.tecnicos.map((t) => t.nome)).toEqual(['Beltrano']);
    // o filtro NÃO vira parâmetro da consulta
    expect(consultar).toHaveBeenCalledWith('sicla.tecnicos.listar');
  });

  it('somenteNovos devolve só quem ainda não tem cadastro no Painel', async () => {
    const { service } = montar({
      linhas: [LINHA, { ...LINHA, CODIGO: 99, EMAIL: 'novo@rech.com.br' }],
      existentes: [{ id: 1, codigoSicla: '42', email: 'x@x', login: 'x@x' }],
    });
    const todos = await service.listar();
    expect(todos.tecnicos).toHaveLength(2);

    const novos = await service.listar('', true);
    expect(novos.tecnicos.map((t) => t.codigo)).toEqual(['99']);
  });

  it('somenteNovos combina com o termo de busca', async () => {
    const { service } = montar({
      linhas: [
        { ...LINHA, CODIGO: 1, NOME: 'Ana Nova', EMAIL: 'ana@rech.com.br' },
        { ...LINHA, CODIGO: 2, NOME: 'Ana Velha', EMAIL: 'velha@rech.com.br' },
        { ...LINHA, CODIGO: 3, NOME: 'Beto Novo', EMAIL: 'beto@rech.com.br' },
      ],
      existentes: [{ id: 1, codigoSicla: '2', email: 'v@v', login: 'v@v' }],
    });
    const r = await service.listar('ana', true);
    expect(r.tecnicos.map((t) => t.nome)).toEqual(['Ana Nova']);
  });

  it('marca jaCadastrado por código SICLA ou por e-mail', async () => {
    const { service } = montar({
      linhas: [LINHA, { ...LINHA, CODIGO: 99, EMAIL: 'outro@rech.com.br' }],
      existentes: [{ id: 1, codigoSicla: '42', email: 'x@x', login: 'x@x' }],
    });
    const r = await service.listar();
    expect(r.tecnicos.map((t) => t.jaCadastrado)).toEqual([true, false]);
  });

  it('cria o técnico novo com login = e-mail e a senha padrão', async () => {
    const { service, repo } = montar();
    const r = await service.importar();
    expect(r).toMatchObject({ ok: true, criados: 1, atualizados: 0 });
    const criado = repo.create.mock.calls[0][0] as Usuario;
    expect(criado).toMatchObject({
      login: 'fulano@rech.com.br', // login É o e-mail
      email: 'fulano@rech.com.br',
      nome: 'Fulano de Tal',
      codigoSicla: '42',
      modulosCapacitados: 'FAT, EST',
      setorAtuacao: 'Implantação',
      perfil: 'Consultor',
      ativo: true,
    });
    // senha padrão gravada como hash, nunca em claro
    expect(criado.senhaHash).not.toBe(SENHA_PADRAO_TECNICO);
    await expect(
      bcrypt.compare(SENHA_PADRAO_TECNICO, criado.senhaHash),
    ).resolves.toBe(true);
  });

  it('atualiza quem já existe sem tocar em perfil, papéis, situação ou senha', async () => {
    const existente = {
      id: 7,
      login: 'antigo@rech.com.br',
      nome: 'Nome Velho',
      email: 'fulano@rech.com.br',
      senhaHash: 'hash-antigo',
      perfil: 'ADM',
      perfis: 'ADM, GCI',
      codigoSicla: '',
      modulosCapacitados: '',
      setorAtuacao: '',
      ativo: false,
    } as unknown as Usuario;
    const { service, repo } = montar({ existentes: [existente] });
    const r = await service.importar();
    expect(r).toMatchObject({ criados: 0, atualizados: 1 });
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save.mock.calls[0][0]).toMatchObject({
      id: 7,
      nome: 'Fulano de Tal',
      login: 'fulano@rech.com.br',
      codigoSicla: '42',
      modulosCapacitados: 'FAT, EST',
      setorAtuacao: 'Implantação',
      // o que é do Painel fica como estava
      perfil: 'ADM',
      perfis: 'ADM, GCI',
      senhaHash: 'hash-antigo',
      ativo: false,
    });
  });

  it('importa só os códigos selecionados', async () => {
    const { service, repo } = montar({
      linhas: [LINHA, { ...LINHA, CODIGO: 43, EMAIL: 'beltrano@rech.com.br' }],
    });
    const r = await service.importar(['43']);
    expect(r.criados).toBe(1);
    expect((repo.create.mock.calls[0][0] as Usuario).email).toBe(
      'beltrano@rech.com.br',
    );
  });

  it('ignora técnico sem e-mail (o login do Painel é o e-mail)', async () => {
    const { service, repo } = montar({ linhas: [{ ...LINHA, EMAIL: null }] });
    const r = await service.importar();
    expect(r).toMatchObject({ ok: true, criados: 0, atualizados: 0 });
    expect(r.ignorados).toEqual([
      {
        codigo: '42',
        nome: 'Fulano de Tal',
        motivo: 'sem e-mail no SICLA (o login do Painel é o e-mail)',
      },
    ]);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('não duplica quando o mesmo e-mail aparece em dois códigos do SICLA', async () => {
    const { service } = montar({
      linhas: [LINHA, { ...LINHA, CODIGO: 43 }],
    });
    const r = await service.importar();
    expect(r).toMatchObject({ criados: 1, atualizados: 1 });
  });

  it('uma linha que falha ao gravar não derruba as demais', async () => {
    const { service, repo } = montar({
      linhas: [LINHA, { ...LINHA, CODIGO: 43, EMAIL: 'ok@rech.com.br' }],
    });
    repo.save.mockRejectedValueOnce(new Error('ER_DUP_ENTRY'));
    const r = await service.importar();
    expect(r).toMatchObject({ ok: true, criados: 1 });
    expect(r.ignorados).toEqual([
      {
        codigo: '42',
        nome: 'Fulano de Tal',
        motivo: 'falha ao gravar (login/e-mail já em uso por outro usuário?)',
      },
    ]);
  });

  it('propaga a falha da consulta sem gravar nada', async () => {
    const { service, repo } = montar({ okConsulta: false });
    const r = await service.importar();
    expect(r.ok).toBe(false);
    expect(r.mensagem).toContain('ORA-00942');
    expect(repo.save).not.toHaveBeenCalled();
  });
});
