import { Test, TestingModule } from '@nestjs/testing';
import { DadosService } from '../dados/dados.service';
import { ContatosSiclaService } from './contatos-sicla.service';
import { AcessoClienteRepository } from './repositories/acesso-cliente.repository';
import { ConexoesService } from '../dados/conexoes/conexoes.service';
import * as bcrypt from 'bcrypt';
import { SENHA_PADRAO_CONTATO } from './contatos-sicla.constants';

/** Acesso de Clientes: contatos do SICLA (`LISTA_CONTATOS`) viram usuários com papel
 * `Cliente`. Quem AUTORIZA é o SICLA (`PORTAL_RECH_CLIENTES = 1`); o Painel só dá a conta. */

/** Linhas como o driver Oracle devolve — colunas em MAIÚSCULAS, conforme confirmado com o
 * usuário em 2026-08-31. Note que não há coluna de CÓDIGO do contato. */
const LINHAS = [
  {
    CLIENTE: 3180,
    NOME: 'Fulano da Silva',
    CARGO: 'Gerente Industrial',
    EMAIL: 'fulano@acme.com.br',
    ATIVODES: 'Ativo',
    STATUSDES: 'Efetivo',
    PORTAL_RECH_CLIENTES_DES: 'Sim',
  },
  {
    CLIENTE: 3180,
    NOME: 'Sicrana Souza',
    CARGO: 'Controladoria',
    EMAIL: 'sicrana@acme.com.br',
    ATIVODES: 'Ativo',
    STATUSDES: 'Efetivo',
    PORTAL_RECH_CLIENTES_DES: 'Sim',
  },
  {
    CLIENTE: 3180,
    NOME: 'Sem Email',
    CARGO: 'Estoque',
    EMAIL: null,
    ATIVODES: 'Ativo',
    STATUSDES: 'Efetivo',
    PORTAL_RECH_CLIENTES_DES: 'Sim',
  },
];

describe('ContatosSiclaService', () => {
  let service: ContatosSiclaService;
  const dados = { consultar: jest.fn() };
  const repo = {
    todos: jest.fn(),
    porEmailOuLogin: jest.fn(),
    salvar: jest.fn((u: unknown) => Promise.resolve(u)),
    criar: jest.fn((u: unknown) => Promise.resolve(u)),
  };

  const semUsuarioExistente = () =>
    repo.porEmailOuLogin.mockResolvedValue(null);
  // Por padrão a instância FALA com o SICLA — é o caso de produção.
  const conexoes = { configurada: jest.fn().mockReturnValue(true) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        ContatosSiclaService,
        { provide: DadosService, useValue: dados },
        { provide: AcessoClienteRepository, useValue: repo },
        { provide: ConexoesService, useValue: conexoes },
      ],
    }).compile();
    service = modulo.get(ContatosSiclaService);
    dados.consultar.mockResolvedValue({
      ok: true,
      mensagem: '3 linha(s).',
      colunas: [],
      linhas: LINHAS,
    });
    repo.todos.mockResolvedValue([]);
    conexoes.configurada.mockReturnValue(true);
    semUsuarioExistente();
  });

  describe('listar', () => {
    it('mapeia as colunas do SICLA para o contrato da tela', async () => {
      const r = await service.listar('3180');
      expect(r.ok).toBe(true);
      expect(r.contatos[0]).toMatchObject({
        nome: 'Fulano da Silva',
        cargo: 'Gerente Industrial',
        email: 'fulano@acme.com.br',
        cliente: '3180',
        ativo: 'Ativo',
        status: 'Efetivo',
        liberacaoPortal: 'Sim',
        jaLiberado: false,
      });
    });

    // O bind reduz o que sai do Oracle; o filtro em memória cobre o SQL editado que o tenha
    // perdido (o texto vigente é o de Consultas BD, e o Administrador pode mexer).
    it('manda o código do cliente como bind numérico', async () => {
      await service.listar('3180');
      expect(dados.consultar).toHaveBeenCalledWith('sicla.contatos.listar', {
        cliente: 3180,
      });
    });

    it('sem cliente informado, pede a lista inteira', async () => {
      await service.listar();
      expect(dados.consultar).toHaveBeenCalledWith('sicla.contatos.listar', {
        cliente: null,
      });
    });

    it('marca quem já tem usuário ATIVO no Painel', async () => {
      repo.todos.mockResolvedValue([
        {
          email: 'fulano@acme.com.br',
          login: 'fulano@acme.com.br',
          ativo: true,
        },
      ]);
      const r = await service.listar('3180');
      expect(
        r.contatos.find((c) => c.email === 'fulano@acme.com.br')?.jaLiberado,
      ).toBe(true);
      expect(
        r.contatos.find((c) => c.email === 'sicrana@acme.com.br')?.jaLiberado,
      ).toBe(false);
    });

    it('distingue quem teve o acesso revogado de quem nunca teve', async () => {
      repo.todos.mockResolvedValue([
        {
          email: 'fulano@acme.com.br',
          login: 'fulano@acme.com.br',
          ativo: false,
        },
      ]);
      const r = await service.listar('3180');
      const f = r.contatos.find((c) => c.email === 'fulano@acme.com.br');
      expect(f?.jaLiberado).toBe(false);
      expect(f?.desativado).toBe(true);
    });

    it('"só não liberados" tira quem já tem acesso', async () => {
      repo.todos.mockResolvedValue([
        {
          email: 'fulano@acme.com.br',
          login: 'fulano@acme.com.br',
          ativo: true,
        },
      ]);
      const r = await service.listar('3180', '', true);
      expect(r.contatos.map((c) => c.email)).not.toContain(
        'fulano@acme.com.br',
      );
    });

    it('SICLA fora do ar devolve a mensagem, não lista vazia silenciosa', async () => {
      dados.consultar.mockResolvedValue({
        ok: false,
        mensagem: 'sem conexão',
        colunas: [],
        linhas: [],
      });
      const r = await service.listar('3180');
      expect(r).toEqual({ ok: false, mensagem: 'sem conexão', contatos: [] });
    });
  });

  describe('liberar', () => {
    it('cria usuário com papel Cliente e o vínculo vindo do SICLA', async () => {
      const r = await service.liberar('3180', ['fulano@acme.com.br']);
      expect(r.liberados).toBe(1);
      const criado = repo.criar.mock.calls[0][0] as Record<string, unknown>;
      expect(criado).toMatchObject({
        login: 'fulano@acme.com.br',
        email: 'fulano@acme.com.br',
        nome: 'Fulano da Silva',
        perfil: 'Cliente',
        perfis: 'Cliente',
        codigoClienteSicla: '3180',
        codigoSicla: '',
        ativo: true,
      });
    });

    // Senha PADRÃO e conhecida (decisão de 2026-09-01, para testes internos). O teste fixa
    // o valor porque quem vai testar precisa saber qual é — e porque trocá-la sem querer
    // deixaria os contatos já liberados sem conseguir entrar.
    it('nasce com a senha padrão de teste', async () => {
      await service.liberar('3180', ['fulano@acme.com.br']);
      const criado = repo.criar.mock.calls[0][0] as { senhaHash: string };
      expect(criado.senhaHash).toBeTruthy();
      expect(await bcrypt.compare(SENHA_PADRAO_CONTATO, criado.senhaHash)).toBe(
        true,
      );
      // O hash é hash: a senha em claro não pode sair no retorno da liberação.
      expect(JSON.stringify(await service.liberar('3180', []))).not.toContain(
        SENHA_PADRAO_CONTATO,
      );
    });

    it('contato sem e-mail não vira acesso — entra em ignorados com o motivo', async () => {
      const r = await service.liberar('3180');
      expect(r.ignorados.some((i) => /sem e-mail/.test(i.motivo))).toBe(true);
      expect(r.liberados).toBe(2); // os dois que têm e-mail
    });

    it('reativa quem teve o acesso revogado, sem trocar a senha', async () => {
      const existente = {
        email: 'fulano@acme.com.br',
        login: 'fulano@acme.com.br',
        perfil: 'Cliente',
        perfis: 'Cliente',
        ativo: false,
        senhaHash: 'hash-antigo',
        nome: 'Fulano da Silva',
        codigoClienteSicla: '3180',
      };
      repo.todos.mockResolvedValue([existente]);
      repo.porEmailOuLogin.mockResolvedValue(existente);
      const r = await service.liberar('3180', ['fulano@acme.com.br']);
      expect(r.reativados).toBe(1);
      expect(existente.ativo).toBe(true);
      expect(existente.senhaHash).toBe('hash-antigo');
    });

    // Um e-mail que já pertence a alguém da casa não pode virar conta de cliente: viraria um
    // usuário interno com papel externo, ou pior, o contrário.
    it('recusa e-mail que já é de usuário INTERNO', async () => {
      const interno = {
        email: 'fulano@acme.com.br',
        login: 'fulano@acme.com.br',
        perfil: 'Consultor',
        perfis: 'Consultor',
        ativo: true,
      };
      repo.todos.mockResolvedValue([interno]);
      repo.porEmailOuLogin.mockResolvedValue(interno);
      const r = await service.liberar('3180', ['fulano@acme.com.br']);
      expect(r.liberados).toBe(0);
      expect(r.ignorados.some((i) => /INTERNO/.test(i.motivo))).toBe(true);
    });
  });

  // Defeito real, relatado pelo usuário em 2026-09-03: no Controle de Atividades, o seletor
  // "DO LADO DO CLIENTE → Incluir contato..." oferecia UMA pessoa só. A causa era este
  // service ser chamado por `listar()`, cuja consulta filtra `PORTAL_RECH_CLIENTES = 1` —
  // AUTORIZAÇÃO para ter conta no Painel. Mas o desenho do módulo diz que um contato pode ser
  // membro de cartão MESMO SEM conta (docs/controle-atividades.md §2.4). São perguntas
  // diferentes, e por isso são duas consultas. O que estes casos travam é a distinção.
  describe('listarDoCliente — a AGENDA, não a autorização', () => {
    it('usa a consulta da agenda, não a de autorização', async () => {
      await service.listarDoCliente('3180');
      expect(dados.consultar).toHaveBeenCalledWith(
        'sicla.contatos.do-cliente',
        {
          cliente: 3180,
        },
      );
      expect(dados.consultar).not.toHaveBeenCalledWith(
        'sicla.contatos.listar',
        expect.anything(),
      );
    });

    it('devolve o contato que NÃO está liberado no Portal — é o ponto', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '2 linha(s).',
        colunas: [],
        linhas: [
          {
            CLIENTE: 3180,
            NOME: 'Ricardo Liberado',
            CARGO: 'TI',
            EMAIL: 'ricardo@acme.com.br',
            ATIVODES: 'Ativo',
            STATUSDES: 'Efetivo',
            PORTAL_RECH_CLIENTES_DES: 'Sim',
          },
          {
            CLIENTE: 3180,
            NOME: 'Marta Sem Portal',
            CARGO: 'Fiscal',
            EMAIL: 'marta@acme.com.br',
            ATIVODES: 'Ativo',
            STATUSDES: 'Efetivo',
            PORTAL_RECH_CLIENTES_DES: 'Não',
          },
        ],
      });
      const r = await service.listarDoCliente('3180');
      expect(r.ok).toBe(true);
      expect(r.contatos.map((c) => c.nome)).toEqual([
        'Ricardo Liberado',
        'Marta Sem Portal',
      ]);
    });

    it('recorta no cliente pedido, mesmo se o SQL editado perder o filtro', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '2 linha(s).',
        colunas: [],
        linhas: [
          { CLIENTE: 3180, NOME: 'Do cliente', EMAIL: 'a@x.com' },
          { CLIENTE: 3729, NOME: 'De OUTRO cliente', EMAIL: 'b@y.com' },
        ],
      });
      const r = await service.listarDoCliente('3180');
      expect(r.contatos.map((c) => c.nome)).toEqual(['Do cliente']);
    });

    it('sem código de cliente não chama o banco — nada de agenda da base inteira', async () => {
      for (const codigo of ['', '  ', 'abc']) {
        const r = await service.listarDoCliente(codigo);
        expect(r.ok).toBe(false);
        expect(r.contatos).toEqual([]);
      }
      expect(dados.consultar).not.toHaveBeenCalled();
    });

    it('falha da API de Dados degrada com a mensagem, sem lançar', async () => {
      dados.consultar.mockResolvedValue({
        ok: false,
        mensagem: 'Conexão "sicla" não configurada.',
        colunas: [],
        linhas: [],
      });
      const r = await service.listarDoCliente('3180');
      expect(r).toEqual({
        ok: false,
        mensagem: 'Conexão "sicla" não configurada.',
        contatos: [],
      });
    });
  });

  describe('situacaoNoSicla — a revalidação do login', () => {
    it('liberado para quem está na lista', async () => {
      await expect(service.situacaoNoSicla('fulano@acme.com.br')).resolves.toBe(
        'liberado',
      );
    });

    it('nao-liberado para quem saiu da lista', async () => {
      await expect(service.situacaoNoSicla('ex@acme.com.br')).resolves.toBe(
        'nao-liberado',
      );
    });

    it('ignora diferença de caixa no e-mail', async () => {
      await expect(service.situacaoNoSicla('FULANO@ACME.COM.BR')).resolves.toBe(
        'liberado',
      );
    });

    // Conexão EXISTE e falhou: é produção com o Oracle fora. Quem chama recusa o login —
    // deixar entrar seria abrir a porta sem conseguir conferir quem está do outro lado.
    it('indisponivel quando a conexão existe mas falha', async () => {
      dados.consultar.mockResolvedValue({
        ok: false,
        mensagem: 'sem conexão',
        colunas: [],
        linhas: [],
      });
      await expect(service.situacaoNoSicla('fulano@acme.com.br')).resolves.toBe(
        'indisponivel',
      );
    });

    // Instância sem SICLA cadastrado é dev/teste, não produção: não há dado de cliente para
    // proteger, e recusar tornaria o acesso impossível de exercitar fora de produção.
    it('sem-integracao quando não há conexão SICLA cadastrada', async () => {
      conexoes.configurada.mockReturnValue(false);
      await expect(service.situacaoNoSicla('fulano@acme.com.br')).resolves.toBe(
        'sem-integracao',
      );
      expect(dados.consultar).not.toHaveBeenCalled();
    });
  });

  describe('revogar', () => {
    it('desativa em vez de apagar — o histórico fica', async () => {
      const u = {
        email: 'fulano@acme.com.br',
        login: 'fulano@acme.com.br',
        perfil: 'Cliente',
        perfis: 'Cliente',
        ativo: true,
      };
      repo.porEmailOuLogin.mockResolvedValue(u);
      const r = await service.revogar(['fulano@acme.com.br']);
      expect(r.revogados).toBe(1);
      expect(u.ativo).toBe(false);
    });

    it('não alcança usuário INTERNO', async () => {
      const interno = {
        email: 'gci@rech.com.br',
        login: 'gci@rech.com.br',
        perfil: 'GCI',
        perfis: 'GCI',
        ativo: true,
      };
      repo.porEmailOuLogin.mockResolvedValue(interno);
      const r = await service.revogar(['gci@rech.com.br']);
      expect(r.revogados).toBe(0);
      expect(interno.ativo).toBe(true);
    });

    it('lista vazia não faz nada', async () => {
      const r = await service.revogar([]);
      expect(r.revogados).toBe(0);
    });
  });
});
