import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TokensApiComponent } from './tokens-api.component';
import { ApiDadosService } from '../../core/services/api-dados.service';
import {
  PainelTokens,
  TokenApiDados,
} from '../../core/models/api-dados.model';

const TOKEN: TokenApiDados = {
  id: 3,
  nome: 'Portal API interno',
  url: 'http://interno:5110',
  prefixo: 'ab12cd34ef56',
  consultas: ['sicla.rns.listar'],
  ativo: true,
  observacao: 'rede interna',
  criadoEm: '2026-08-25T12:00:00.000Z',
  ultimoUsoEm: null,
  ultimoErro: null,
};

const PAINEL: PainelTokens = {
  itens: [TOKEN],
  descobertas: ['sicla.bi.extrato-horas'],
  consumoRemotoAtivo: true,
};

function servicoPadrao(
  over: Partial<ApiDadosService> = {},
): Partial<ApiDadosService> {
  return {
    tokens: () => Promise.resolve(PAINEL),
    sondarToken: () =>
      Promise.resolve({
        ok: true,
        mensagem: 'Token válido — autoriza 2 consulta(s).',
        consultas: ['sicla.rns.listar', 'sicla.agenda.listar'],
      }),
    salvarToken: () => Promise.resolve(TOKEN),
    definirTokenAtivo: () => Promise.resolve(TOKEN),
    excluirToken: () => Promise.resolve(),
    ...over,
  };
}

/** A tela do lado CONSUMIDOR. O que os testes protegem é o que a torna usável sem erro
 * silencioso: a lista de consultas vem do Testar (não da digitação), o token gravado nunca
 * volta para o campo, e "o que ainda NÃO tem token" fica visível. */
describe('TokensApiComponent', () => {
  function montar(service: Partial<ApiDadosService>) {
    TestBed.configureTestingModule({
      imports: [TokensApiComponent],
      providers: [provideRouter([]), { provide: ApiDadosService, useValue: service }],
    });
    return TestBed.createComponent(TokensApiComponent);
  }

  async function pronto(service = servicoPadrao()) {
    const fixture = montar(service);
    fixture.detectChanges();
    await fixture.componentInstance.carregar();
    fixture.detectChanges();
    return fixture;
  }

  it('mostra os tokens e o que ainda vai pelo banco local', async () => {
    const comp = (await pronto()).componentInstance;
    expect(comp.painel().itens).toHaveLength(1);
    expect(comp.painel().descobertas).toEqual(['sicla.bi.extrato-horas']);
    expect(comp.painel().consumoRemotoAtivo).toBe(true);
  });

  it('Testar traz as consultas do Portal API — ninguém digita nome de consulta', async () => {
    const comp = (await pronto()).componentInstance;
    comp.form.patchValue({ url: 'http://interno:5110', chave: 'rd_a_b' });
    await comp.testar();
    expect(comp.consultas()).toEqual(['sicla.rns.listar', 'sicla.agenda.listar']);
  });

  it('não salva sem Testar — token sem consultas não consulta nada', async () => {
    const salvarToken = vi.fn();
    const comp = (await pronto(servicoPadrao({ salvarToken }))).componentInstance;
    comp.form.patchValue({
      nome: 'X',
      url: 'http://interno:5110',
      chave: 'rd_a_b',
    });
    await comp.salvar();
    expect(salvarToken).not.toHaveBeenCalled();
    expect(comp.erro()).toContain('Testar');
  });

  it('não salva token novo sem a chave', async () => {
    const salvarToken = vi.fn();
    const comp = (await pronto(servicoPadrao({ salvarToken }))).componentInstance;
    comp.form.patchValue({ nome: 'X', url: 'http://interno:5110', chave: '' });
    await comp.salvar();
    expect(salvarToken).not.toHaveBeenCalled();
    expect(comp.erro()).toContain('token');
  });

  it('salva com as consultas descobertas no Testar', async () => {
    const salvarToken = vi.fn().mockResolvedValue(TOKEN);
    const comp = (await pronto(servicoPadrao({ salvarToken }))).componentInstance;
    comp.form.patchValue({
      nome: 'Novo',
      url: 'http://interno:5110',
      chave: 'rd_a_b',
    });
    await comp.testar();
    await comp.salvar();

    expect(salvarToken).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        nome: 'Novo',
        consultas: ['sicla.rns.listar', 'sicla.agenda.listar'],
      }),
    );
  });

  it('editar não traz o token de volta ao campo', async () => {
    // O segredo nunca sai do servidor; deixar o campo vazio é o que sinaliza "mantém".
    const comp = (await pronto()).componentInstance;
    comp.editar(TOKEN);
    expect(comp.editando()).toBe(3);
    expect(comp.form.controls.chave.value).toBe('');
    expect(comp.consultas()).toEqual(['sicla.rns.listar']);
  });

  it('desligar explica que as consultas voltam ao banco local', async () => {
    const definirTokenAtivo = vi.fn().mockResolvedValue(TOKEN);
    const comp = (await pronto(servicoPadrao({ definirTokenAtivo })))
      .componentInstance;
    await comp.definirAtivo(TOKEN, false);
    expect(definirTokenAtivo).toHaveBeenCalledWith(3, false);
    expect(comp.aviso()).toContain('banco local');
  });

  it('apagar pede confirmação', async () => {
    const excluirToken = vi.fn().mockResolvedValue(undefined);
    const comp = (await pronto(servicoPadrao({ excluirToken }))).componentInstance;

    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await comp.excluir(TOKEN);
    expect(excluirToken).not.toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await comp.excluir(TOKEN);
    expect(excluirToken).toHaveBeenCalledWith(3);
  });

  it('sem a tabela de tokens, a tela avisa em vez de ficar em branco', async () => {
    const fixture = await pronto(
      servicoPadrao({
        tokens: () => Promise.reject(new Error("Table 'api_dados_tokens' doesn't exist")),
      }),
    );
    expect(fixture.componentInstance.erro()).toContain('migration');
    expect(fixture.componentInstance.carregando()).toBe(false);
  });
});
