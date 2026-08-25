import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiDadosComponent } from './api-dados.component';
import { ApiDadosService } from '../../core/services/api-dados.service';
import { InstanciaService } from '../../core/services/instancia.service';
import {
  CatalogoDados,
  ClienteApi,
  ConsultaPublicadaResumo,
  EstadoConexao,
} from '../../core/models/api-dados.model';

const CATALOGO: CatalogoDados = {
  versao: 'v1',
  total: 2,
  consultas: [
    {
      nome: 'sicla.rns.listar',
      titulo: 'RNS — assuntos',
      descricao: 'itens de pedido',
      conexao: 'sicla',
      parametros: [
        { nome: 'data_ini', tipo: 'data', obrigatorio: true, descricao: 'início' },
      ],
      limiteLinhas: 5000,
      cacheSegundos: 60,
      desde: 'v1',
    },
    {
      nome: 'portal.visitas.listar',
      titulo: 'Visitas do Portal',
      descricao: 'protocolo e aprovação',
      conexao: 'portal_rech',
      parametros: [],
      limiteLinhas: 20000,
      cacheSegundos: 300,
      desde: 'v1',
    },
  ],
};

const CONEXOES: EstadoConexao[] = [
  {
    chave: 'sicla',
    rotulo: 'SICLA (Oracle)',
    dialeto: 'oracle',
    origem: 'CRM interno',
    configurada: true,
  },
  {
    chave: 'portal_rech',
    rotulo: 'Portal Rech (MySQL)',
    dialeto: 'mysql',
    origem: 'portalrech.com.br',
    configurada: false,
  },
];

const CLIENTE: ClienteApi = {
  id: 7,
  nome: 'Power BI',
  prefixo: 'ab12cd34ef56',
  consultas: ['sicla.rns.listar'],
  ativo: true,
  observacao: 'Diretoria',
  criadoEm: '2026-08-25T12:00:00.000Z',
  ultimoUsoEm: null,
};

const DE_TELA: ConsultaPublicadaResumo = {
  slug: 'minha_consulta',
  nome: 'Minha consulta',
  conexao: 'sicla',
  sql: 'SELECT 1 FROM DUAL',
  nomeApi: 'sicla.minha.consulta',
  publicada: true,
  parametros: [],
  colunas: ['UM'],
  limiteLinhas: 500,
  cacheSegundos: 60,
};

function servicoPadrao(over: Partial<ApiDadosService> = {}): Partial<ApiDadosService> {
  return {
    catalogo: () => Promise.resolve(CATALOGO),
    conexoes: () => Promise.resolve(CONEXOES),
    clientes: () => Promise.resolve([CLIENTE]),
    consultasDisponiveis: () =>
      Promise.resolve(['portal.visitas.listar', 'sicla.rns.listar']),
    metricas: () => Promise.resolve([]),
    listarConsultas: () => Promise.resolve([DE_TELA]),
    ...over,
  };
}

describe('ApiDadosComponent', () => {
  function montar(service: Partial<ApiDadosService>) {
    TestBed.configureTestingModule({
      imports: [ApiDadosComponent],
      providers: [provideRouter([]), { provide: ApiDadosService, useValue: service }],
    });
    return TestBed.createComponent(ApiDadosComponent);
  }

  async function pronto(service = servicoPadrao()) {
    const fixture = montar(service);
    fixture.detectChanges();
    // Aguarda `carregar()` explicitamente: a carga é em DOIS estágios (núcleo, depois
    // clientes de máquina) e `whenStable()` devolve no meio do caminho — o teste mediria um
    // estado transitório. Chamar de novo é idempotente (só refaz as buscas).
    await fixture.componentInstance.carregar();
    fixture.detectChanges();
    return fixture;
  }

  it('carrega catálogo, conexões, clientes e escopos', async () => {
    const comp = (await pronto()).componentInstance;
    expect(comp.catalogo()?.total).toBe(2);
    expect(comp.conexoes()).toHaveLength(2);
    expect(comp.clientes()[0].nome).toBe('Power BI');
    expect(comp.consultasDisponiveis()).toContain('sicla.rns.listar');
  });

  it('agrupa o catálogo por conexão, com o rótulo legível', async () => {
    const comp = (await pronto()).componentInstance;
    const grupos = comp.porConexao();
    expect(grupos.map((g) => g.chave)).toEqual(['sicla', 'portal_rech']);
    expect(comp.rotuloConexao('sicla')).toBe('SICLA (Oracle)');
  });

  it('a tela nunca mostra SQL — nem do catálogo, nem das consultas de tela', async () => {
    // A palavra "SELECT" aparece na instrução ("cole o SELECT"); o que não pode aparecer é
    // uma CONSULTA — daí exigir o par SELECT … FROM, que é o que revelaria o schema.
    const fixture = await pronto();
    const html: string = fixture.nativeElement.textContent;
    expect(html).not.toMatch(/\bSELECT\b[\s\S]*\bFROM\b/i);
  });

  it('lista as consultas criadas pela tela, com a situação de publicação', async () => {
    const comp = (await pronto()).componentInstance;
    expect(comp.consultasDeTela()).toHaveLength(1);
    expect(comp.consultasDeTela()[0].publicada).toBe(true);
  });

  it('não cria token sem consulta marcada', async () => {
    const criarCliente = vi.fn();
    const fixture = await pronto(servicoPadrao({ criarCliente }));
    const comp = fixture.componentInstance;
    comp.form.controls.nome.setValue('Novo');
    await comp.criar();
    expect(criarCliente).not.toHaveBeenCalled();
    expect(comp.erro()).toContain('consulta');
  });

  it('criar mostra a chave UMA vez e limpa o formulário', async () => {
    const criarCliente = vi
      .fn()
      .mockResolvedValue({ ...CLIENTE, nome: 'Novo', chave: 'rd_abc_def' });
    const fixture = await pronto(servicoPadrao({ criarCliente }));
    const comp = fixture.componentInstance;

    comp.form.controls.nome.setValue('Novo');
    comp.alternarConsulta('sicla.rns.listar', true);
    await comp.criar();

    expect(criarCliente).toHaveBeenCalledWith({
      nome: 'Novo',
      consultas: ['sicla.rns.listar'],
      observacao: '',
    });
    expect(comp.chaveNova()).toEqual({ nome: 'Novo', chave: 'rd_abc_def' });
    expect(comp.form.controls.nome.value).toBe('');

    // Fechar o aviso é definitivo — não há como reexibir a chave.
    comp.fecharChave();
    expect(comp.chaveNova()).toBeNull();
  });

  it('alternarConsulta marca e desmarca sem duplicar', async () => {
    const comp = (await pronto()).componentInstance;
    comp.alternarConsulta('sicla.rns.listar', true);
    comp.alternarConsulta('sicla.rns.listar', true);
    expect(comp.form.controls.consultas.value).toEqual(['sicla.rns.listar']);
    expect(comp.consultaMarcada('sicla.rns.listar')).toBe(true);

    comp.alternarConsulta('sicla.rns.listar', false);
    expect(comp.form.controls.consultas.value).toEqual([]);
  });

  it('alternarGrupo marca todas as consultas daquela conexão de uma vez', async () => {
    // Atalho de usabilidade: liberar um bloco inteiro sem obrigar um clique por consulta.
    const comp = (await pronto()).componentInstance;
    expect(comp.grupoInteiroMarcado('sicla')).toBe(false);

    comp.alternarGrupo('sicla', true);
    expect(comp.form.controls.consultas.value).toEqual(['sicla.rns.listar']);
    expect(comp.grupoInteiroMarcado('sicla')).toBe(true);
    // Não contamina a outra conexão.
    expect(comp.grupoInteiroMarcado('portal_rech')).toBe(false);

    comp.alternarGrupo('sicla', false);
    expect(comp.form.controls.consultas.value).toEqual([]);
  });

  it('revogar pede confirmação e recarrega a lista', async () => {
    const definirAtivo = vi.fn().mockResolvedValue({ ...CLIENTE, ativo: false });
    const fixture = await pronto(servicoPadrao({ definirAtivo }));
    const comp = fixture.componentInstance;

    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await comp.definirAtivo(CLIENTE, false);
    expect(definirAtivo).not.toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await comp.definirAtivo(CLIENTE, false);
    expect(definirAtivo).toHaveBeenCalledWith(7, false);
    expect(comp.aviso()).toContain('revogado');
  });

  it('rotacionar exibe a chave nova', async () => {
    const rotacionar = vi.fn().mockResolvedValue({ ...CLIENTE, chave: 'rd_novo_segredo' });
    const fixture = await pronto(servicoPadrao({ rotacionar }));
    const comp = fixture.componentInstance;

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await comp.rotacionar(CLIENTE);
    expect(comp.chaveNova()?.chave).toBe('rd_novo_segredo');
  });

  it('avisa quando o NÚCLEO (catálogo/conexões) falha', async () => {
    const fixture = await pronto(
      servicoPadrao({ catalogo: () => Promise.reject(new Error('falhou')) }),
    );
    expect(fixture.componentInstance.erro()).toContain('API de Dados');
    expect(fixture.componentInstance.carregando()).toBe(false);
  });

  it('sem a tabela api_clientes, a tela ainda mostra catálogo e conexões', async () => {
    // É o estado de produção ANTES de a migration `ApiClientes` rodar. A tela não pode ir
    // junto: é justamente por ela que o Administrador vê o catálogo e diagnostica.
    const fixture = await pronto(
      servicoPadrao({
        clientes: () => Promise.reject(new Error("Table 'api_clientes' doesn't exist")),
      }),
    );
    const comp = fixture.componentInstance;
    expect(comp.erro()).toBeNull();
    expect(comp.avisoClientes()).toContain('migration');
    expect(comp.catalogo()?.total).toBe(2);
    expect(comp.conexoes()).toHaveLength(2);
  });
});


/** No **Portal API** esta tela vira a tela inteira do produto: é ali que a credencial de
 * banco é cadastrada. O que os testes travam é o que não pode escapar dela — a senha. */
describe('ApiDadosComponent — conexões no Portal API', () => {
  const CONFIG = {
    chave: 'sicla' as const,
    rotulo: 'SICLA (Oracle)',
    dialeto: 'oracle',
    origem: 'CRM interno',
    configurada: true,
    campos: { host: 'srv', porta: '1521', usuario: 'painel_ro', ativo: true },
    temSenha: true,
  };

  function montarPortalApi(over: Partial<ApiDadosService> = {}) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ApiDadosComponent],
      providers: [
        provideRouter([]),
        {
          provide: ApiDadosService,
          useValue: {
            ...servicoPadrao(),
            configuracoesConexao: () => Promise.resolve([CONFIG]),
            salvarConexao: vi.fn().mockResolvedValue(CONFIG),
            testarConexao: vi
              .fn()
              .mockResolvedValue({ ok: true, mensagem: 'Conexão respondeu em 12 ms.', ms: 12 }),
            ...over,
          },
        },
        {
          provide: InstanciaService,
          useValue: {
            garantirCarregado: vi.fn(),
            atual: signal({
              perfil: 'portal-api',
              nome: 'Portal API',
              descricao: '',
              rotaInicial: '/config/api-dados',
            }),
            portalApi: signal(true),
          },
        },
      ],
    });
    return TestBed.createComponent(ApiDadosComponent);
  }

  async function pronto(over: Partial<ApiDadosService> = {}) {
    const fixture = montarPortalApi(over);
    fixture.detectChanges();
    await fixture.componentInstance.carregar();
    fixture.detectChanges();
    return fixture;
  }

  it('carrega a configuração editável das conexões', async () => {
    const comp = (await pronto()).componentInstance;
    expect(comp.portalApi()).toBe(true);
    expect(comp.configuracoes()).toHaveLength(1);
  });

  it('o campo de senha abre VAZIO, mesmo havendo senha gravada', async () => {
    // A senha nunca vem do servidor; preencher o campo com qualquer coisa daria a impressão
    // de que ela está ali.
    const comp = (await pronto()).componentInstance;
    comp.abrirConexao(CONFIG);
    expect(comp.valorDe('senha')).toBe('');
    expect(comp.valorDe('usuario')).toBe('painel_ro');
  });

  it('senha em branco NÃO vai no corpo — gravar sem digitá-la mantém a atual', async () => {
    const salvarConexao = vi.fn().mockResolvedValue(CONFIG);
    const comp = (await pronto({ salvarConexao })).componentInstance;
    comp.abrirConexao(CONFIG);
    comp.definirCampo('host', 'outro-servidor');
    await comp.salvarConexao(CONFIG);

    const [chave, corpo] = salvarConexao.mock.calls[0] as [string, Record<string, unknown>];
    expect(chave).toBe('sicla');
    expect(corpo['host']).toBe('outro-servidor');
    expect(corpo).not.toHaveProperty('senha');
  });

  it('senha digitada vai no corpo', async () => {
    const salvarConexao = vi.fn().mockResolvedValue(CONFIG);
    const comp = (await pronto({ salvarConexao })).componentInstance;
    comp.abrirConexao(CONFIG);
    comp.definirCampo('senha', 'nova-senha');
    await comp.salvarConexao(CONFIG);
    expect(salvarConexao.mock.calls[0][1]['senha']).toBe('nova-senha');
  });

  it('testar mostra o resultado ao lado daquela conexão', async () => {
    const comp = (await pronto()).componentInstance;
    await comp.testarConexao(CONFIG);
    expect(comp.testeDe('sicla')?.ok).toBe(true);
    expect(comp.testeDe('portal_rech')).toBeNull();
  });
});
