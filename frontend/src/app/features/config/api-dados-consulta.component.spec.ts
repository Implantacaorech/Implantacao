import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ApiDadosConsultaComponent } from './api-dados-consulta.component';
import { ApiDadosService } from '../../core/services/api-dados.service';
import {
  AnaliseConsulta,
  ConsultaPublicadaResumo,
} from '../../core/models/api-dados.model';

const SALVA: ConsultaPublicadaResumo = {
  slug: 'rns_por_cliente',
  nome: 'RNS por cliente',
  conexao: 'sicla',
  sql: 'SELECT A FROM T WHERE C = :cliente',
  nomeApi: 'sicla.rns.por-cliente',
  publicada: true,
  parametros: [
    { nome: 'cliente', tipo: 'inteiro', obrigatorio: true, descricao: 'código' },
  ],
  colunas: ['A'],
  limiteLinhas: 500,
  cacheSegundos: 60,
};

const ANALISE: AnaliseConsulta = {
  ok: true,
  mensagem: '2 coluna(s) em 30 ms.',
  binds: ['cliente', 'data_ini'],
  colunas: ['A', 'B'],
  amostra: { A: 1, B: 2 },
  ms: 30,
};

function servicoPadrao(
  over: Partial<ApiDadosService> = {},
): Partial<ApiDadosService> {
  return {
    obterConsulta: () => Promise.resolve(SALVA),
    analisarConsulta: () => Promise.resolve(ANALISE),
    salvarConsulta: () => Promise.resolve('rns_por_cliente'),
    excluirConsulta: () => Promise.resolve(),
    ...over,
  };
}

/** A tela que dá autonomia para publicar uma consulta sem release. O que os testes protegem
 * é o que essa autonomia poderia custar: o contrato tem de sair do BANCO (Testar), não da
 * digitação, e o erro de publicação tem de chegar inteiro ao operador. */
describe('ApiDadosConsultaComponent', () => {
  function montar(service: Partial<ApiDadosService>, slug: string | null) {
    TestBed.configureTestingModule({
      imports: [ApiDadosConsultaComponent],
      providers: [
        provideRouter([]),
        { provide: ApiDadosService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => slug } } },
        },
      ],
    });
    return TestBed.createComponent(ApiDadosConsultaComponent);
  }

  async function pronto(service = servicoPadrao(), slug: string | null = null) {
    const fixture = montar(service, slug);
    fixture.detectChanges();
    if (slug) await fixture.componentInstance.carregar(slug);
    fixture.detectChanges();
    return fixture;
  }

  it('sem slug abre um formulário vazio, sem chamar o backend', async () => {
    const obterConsulta = vi.fn();
    const comp = (await pronto(servicoPadrao({ obterConsulta }))).componentInstance;
    expect(obterConsulta).not.toHaveBeenCalled();
    expect(comp.slugEditando()).toBe('');
    expect(comp.form.controls.publicada.value).toBe(false);
  });

  it('com slug carrega a consulta salva, inclusive os parâmetros já declarados', async () => {
    const comp = (await pronto(servicoPadrao(), 'rns_por_cliente')).componentInstance;
    expect(comp.form.controls.nomeApi.value).toBe('sicla.rns.por-cliente');
    expect(comp.parametros().map((p) => p.nome)).toEqual(['cliente']);
    expect(comp.colunas()).toEqual(['A']);
  });

  it('Testar traz binds e colunas do BANCO — ninguém digita a lista de campos', async () => {
    const comp = (await pronto()).componentInstance;
    comp.form.controls.sql.setValue('SELECT A, B FROM T WHERE X = :cliente');
    await comp.testar();
    expect(comp.parametros().map((p) => p.nome)).toEqual(['cliente', 'data_ini']);
    expect(comp.colunas()).toEqual(['A', 'B']);
  });

  it('Testar preserva o tipo já escolhido e descarta o bind que sumiu do SQL', async () => {
    // Reconciliação: quem edita o SELECT não pode perder as escolhas que já fez, nem ficar
    // com um parâmetro órfão — que faria a publicação ser recusada por "sobrando".
    const analisarConsulta = vi
      .fn()
      .mockResolvedValue({ ...ANALISE, binds: ['cliente'] });
    const comp = (await pronto(servicoPadrao({ analisarConsulta }), 'rns_por_cliente'))
      .componentInstance;

    comp.definirTipo('cliente', 'texto');
    await comp.testar();

    expect(comp.parametros()).toEqual([
      { nome: 'cliente', tipo: 'texto', obrigatorio: true, descricao: 'código' },
    ]);
  });

  it('Testar que falha mostra a mensagem do banco e não sobrescreve as colunas', async () => {
    const analisarConsulta = vi.fn().mockResolvedValue({
      ...ANALISE,
      ok: false,
      mensagem: 'ORA-00942: tabela ou view inexistente',
      colunas: [],
    });
    const comp = (await pronto(servicoPadrao({ analisarConsulta }), 'rns_por_cliente'))
      .componentInstance;
    await comp.testar();
    expect(comp.erro()).toContain('ORA-00942');
    expect(comp.colunas()).toEqual(['A']);
  });

  it('não salva sem SELECT — e nem chama o backend', async () => {
    const salvarConsulta = vi.fn();
    const comp = (await pronto(servicoPadrao({ salvarConsulta }))).componentInstance;
    comp.form.patchValue({ slug: 'x', nome: 'X', sql: '' });
    await comp.salvar();
    expect(salvarConsulta).not.toHaveBeenCalled();
    expect(comp.erro()).toContain('SELECT');
  });

  it('salvar envia o contrato montado pelo Testar', async () => {
    const salvarConsulta = vi.fn().mockResolvedValue('minha');
    const comp = (await pronto(servicoPadrao({ salvarConsulta }))).componentInstance;
    comp.form.patchValue({
      slug: 'minha',
      nome: 'Minha',
      conexao: 'sicla',
      sql: 'SELECT 1 FROM DUAL',
      nomeApi: 'sicla.minha.consulta',
      limiteLinhas: 500,
      cacheSegundos: 0,
      publicada: true,
    });
    await comp.salvar();

    expect(salvarConsulta).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'minha',
        nomeApi: 'sicla.minha.consulta',
        publicada: true,
        parametros: [],
        colunas: [],
      }),
    );
    expect(comp.aviso()).toContain('publicada');
    expect(comp.slugEditando()).toBe('minha');
  });

  it('a recusa de publicação chega INTEIRA — todos os problemas de uma vez', async () => {
    // O backend devolve a lista; mostrar um por vez obrigaria o operador a salvar, corrigir
    // e salvar de novo até acabar.
    const salvarConsulta = vi.fn().mockRejectedValue({
      error: {
        message: [
          'Informe o teto de linhas — publicar sem teto não é permitido.',
          'O SQL usa :cliente — declare o tipo de cada um.',
        ],
      },
    });
    const comp = (await pronto(servicoPadrao({ salvarConsulta }))).componentInstance;
    comp.form.patchValue({ slug: 'x', nome: 'X', sql: 'SELECT 1 FROM DUAL' });
    await comp.salvar();

    expect(comp.erros()).toHaveLength(2);
    expect(comp.erros()[1]).toContain(':cliente');
    expect(comp.erro()).toBeNull();
  });

  // Este é o formato que o backend REALMENTE devolve: o HttpExceptionFilter troca a
  // `message` pela frase genérica quando ela é um array e move os itens para `details`. O
  // teste acima (que mocka `message` como array) passava sem provar nada do caso real — e
  // por isso a tela ficou mostrando só "Os dados informados são inválidos", sem dizer qual
  // campo estava errado (achado em 2026-09-01, publicando a consulta de contatos).
  it('a lista vem em `details`, como o filtro de exceção a envia', async () => {
    const salvarConsulta = vi.fn().mockRejectedValue({
      error: {
        message: 'Os dados informados são inválidos',
        details: [
          'nomeApi must be a string',
          'limiteLinhas must not be less than 0',
        ],
      },
    });
    const comp = (await pronto(servicoPadrao({ salvarConsulta }))).componentInstance;
    comp.form.patchValue({ slug: 'x', nome: 'X', sql: 'SELECT 1 FROM DUAL' });
    await comp.salvar();

    expect(comp.erros()).toHaveLength(2);
    expect(comp.erros()[0]).toContain('nomeApi');
    // A frase genérica não pode ocupar o lugar do detalhe: ela não diz nada a quem preenche.
    expect(comp.erro()).toBeNull();
  });

  it('erro sem lista mostra a mensagem do backend', async () => {
    const salvarConsulta = vi.fn().mockRejectedValue({
      error: { message: 'Conexão com o SICLA não configurada.' },
    });
    const comp = (await pronto(servicoPadrao({ salvarConsulta }))).componentInstance;
    comp.form.patchValue({ slug: 'x', nome: 'X', sql: 'SELECT 1 FROM DUAL' });
    await comp.salvar();

    expect(comp.erro()).toContain('SICLA');
    expect(comp.erros()).toHaveLength(0);
  });

  it('apagar pede confirmação', async () => {
    const excluirConsulta = vi.fn().mockResolvedValue(undefined);
    const comp = (await pronto(servicoPadrao({ excluirConsulta }), 'rns_por_cliente'))
      .componentInstance;

    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await comp.excluir();
    expect(excluirConsulta).not.toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await comp.excluir();
    expect(excluirConsulta).toHaveBeenCalledWith('rns_por_cliente');
  });
});
