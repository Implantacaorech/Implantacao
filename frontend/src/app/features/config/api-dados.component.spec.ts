import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiDadosComponent } from './api-dados.component';
import { ApiDadosService } from '../../core/services/api-dados.service';
import {
  CatalogoDados,
  ClienteApi,
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
      escopo: 'sicla:leitura',
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
      escopo: 'portal_rech:leitura',
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
  escopos: ['sicla:leitura'],
  ativo: true,
  observacao: 'Diretoria',
  criadoEm: '2026-08-25T12:00:00.000Z',
  ultimoUsoEm: null,
};

function servicoPadrao(over: Partial<ApiDadosService> = {}): Partial<ApiDadosService> {
  return {
    catalogo: () => Promise.resolve(CATALOGO),
    conexoes: () => Promise.resolve(CONEXOES),
    clientes: () => Promise.resolve([CLIENTE]),
    escopos: () => Promise.resolve(['portal_rech:leitura', 'sicla:leitura']),
    metricas: () => Promise.resolve([]),
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
    expect(comp.escopos()).toContain('sicla:leitura');
  });

  it('agrupa o catálogo por conexão, com o rótulo legível', async () => {
    const comp = (await pronto()).componentInstance;
    const grupos = comp.porConexao();
    expect(grupos.map((g) => g.chave)).toEqual(['sicla', 'portal_rech']);
    expect(comp.rotuloConexao('sicla')).toBe('SICLA (Oracle)');
  });

  it('a tela nunca mostra SQL — o catálogo publicado não o traz', async () => {
    const fixture = await pronto();
    const html: string = fixture.nativeElement.textContent;
    expect(html).not.toContain('SELECT');
  });

  it('não cria cliente sem escopo marcado', async () => {
    const criarCliente = vi.fn();
    const fixture = await pronto(servicoPadrao({ criarCliente }));
    const comp = fixture.componentInstance;
    comp.form.controls.nome.setValue('Novo');
    await comp.criar();
    expect(criarCliente).not.toHaveBeenCalled();
    expect(comp.erro()).toContain('escopo');
  });

  it('criar mostra a chave UMA vez e limpa o formulário', async () => {
    const criarCliente = vi
      .fn()
      .mockResolvedValue({ ...CLIENTE, nome: 'Novo', chave: 'rd_abc_def' });
    const fixture = await pronto(servicoPadrao({ criarCliente }));
    const comp = fixture.componentInstance;

    comp.form.controls.nome.setValue('Novo');
    comp.alternarEscopo('sicla:leitura', true);
    await comp.criar();

    expect(criarCliente).toHaveBeenCalledWith({
      nome: 'Novo',
      escopos: ['sicla:leitura'],
      observacao: '',
    });
    expect(comp.chaveNova()).toEqual({ nome: 'Novo', chave: 'rd_abc_def' });
    expect(comp.form.controls.nome.value).toBe('');

    // Fechar o aviso é definitivo — não há como reexibir a chave.
    comp.fecharChave();
    expect(comp.chaveNova()).toBeNull();
  });

  it('alternarEscopo marca e desmarca sem duplicar', async () => {
    const comp = (await pronto()).componentInstance;
    comp.alternarEscopo('sicla:leitura', true);
    comp.alternarEscopo('sicla:leitura', true);
    expect(comp.form.controls.escopos.value).toEqual(['sicla:leitura']);
    expect(comp.escopoMarcado('sicla:leitura')).toBe(true);

    comp.alternarEscopo('sicla:leitura', false);
    expect(comp.form.controls.escopos.value).toEqual([]);
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
