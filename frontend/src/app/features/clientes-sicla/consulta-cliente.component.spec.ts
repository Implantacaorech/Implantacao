import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ConsultaClienteComponent } from './consulta-cliente.component';
import { AuthService } from '../../core/services/auth.service';
import {
  ClienteSicla,
  ClientesSiclaService,
} from '../../core/services/clientes-sicla.service';
import {
  ModuloSicla,
  ModulosSiclaService,
} from '../../core/services/modulos-sicla.service';
import { AuthUser } from '../../core/models/auth-user.model';

function usuario(perfil: AuthUser['perfil'] = 'Comercial'): AuthUser {
  return { sub: 1, login: 'vend', nome: 'Vendedor', perfil, codigoSicla: '' };
}

function cliente(over: Partial<ClienteSicla> = {}): ClienteSicla {
  return {
    codigo: '123',
    cliente: 'ACME Indústria',
    fantasia: 'ACME',
    cnpj: '00.000/0001-00',
    ramo: 'Metalurgia',
    responsavel: 'João',
    contatoNome: 'Maria',
    contatoEmail: 'maria@acme.com',
    contatoTel: '51 3000-0000',
    bruto: {},
    ...over,
  };
}

function moduloSicla(over: Partial<ModuloSicla> = {}): ModuloSicla {
  return {
    codModulo: '10',
    descModulo: 'Faturamento',
    codAdicional: '',
    descAdicional: '',
    codigo: '10',
    descricao: 'Faturamento',
    bruto: {},
    ...over,
  };
}

describe('ConsultaClienteComponent', () => {
  function montar(
    service: Partial<ClientesSiclaService>,
    modulos: Partial<ModulosSiclaService> = {},
  ) {
    TestBed.configureTestingModule({
      imports: [ConsultaClienteComponent],
      providers: [
        provideRouter([]),
        { provide: ClientesSiclaService, useValue: service },
        { provide: ModulosSiclaService, useValue: modulos },
        { provide: AuthService, useValue: { usuario: signal(usuario()) } },
      ],
    });
    return TestBed.createComponent(ConsultaClienteComponent);
  }

  it('não consulta o SICLA com termo muito curto', async () => {
    const buscar = vi.fn();
    const fixture = montar({ buscar });
    const comp = fixture.componentInstance;
    comp.termo.set('a');
    await comp.buscar();
    expect(buscar).not.toHaveBeenCalled();
    expect(comp.msgBusca()).toContain('2 caracteres');
  });

  it('busca e lista os clientes encontrados', async () => {
    const buscar = vi
      .fn()
      .mockResolvedValue({ ok: true, mensagem: '1', clientes: [cliente()] });
    const fixture = montar({ buscar });
    const comp = fixture.componentInstance;
    comp.termo.set('acme');
    await comp.buscar();
    expect(buscar).toHaveBeenCalledWith('acme');
    expect(comp.resultados().length).toBe(1);
  });

  it('selecionar pré-preenche a ficha com os dados do SICLA', () => {
    const fixture = montar({});
    const comp = fixture.componentInstance;
    comp.selecionar(cliente());
    const v = comp.form.getRawValue();
    expect(v.cliente).toBe('ACME Indústria');
    expect(v.cnpj).toBe('00.000/0001-00');
    expect(v.numeroProjeto).toBe('123'); // código do SICLA → nº do projeto
    expect(v.contatoEmail).toBe('maria@acme.com');
  });

  it('cadastrar chama o serviço e mostra a confirmação', async () => {
    const cadastrar = vi
      .fn()
      .mockResolvedValue({ projetoId: 9, duplicado: false });
    const fixture = montar({ cadastrar });
    const comp = fixture.componentInstance;
    comp.selecionar(cliente());
    await comp.salvar();
    expect(cadastrar).toHaveBeenCalled();
    expect(comp.sucesso()?.resultado.projetoId).toBe(9);
    expect(comp.selecionado()).toBeNull();
  });

  it('não cadastra quando falta a razão social (campo obrigatório)', async () => {
    const cadastrar = vi.fn();
    const fixture = montar({ cadastrar });
    const comp = fixture.componentInstance;
    comp.selecionar(cliente({ cliente: '', fantasia: '' }));
    await comp.salvar();
    expect(cadastrar).not.toHaveBeenCalled();
  });

  it('busca módulos e marca/desmarca os contratados', async () => {
    const buscar = vi.fn().mockResolvedValue({
      ok: true,
      mensagem: '2',
      modulos: [
        moduloSicla({ codigo: '10', descricao: 'Faturamento' }),
        moduloSicla({ codModulo: '20', codigo: '205', descricao: 'Estoque · Inventário' }),
      ],
    });
    const fixture = montar({}, { buscar });
    const comp = fixture.componentInstance;
    comp.termoModulo.set('fat');
    await comp.buscarModulos();
    expect(buscar).toHaveBeenCalledWith('fat');
    expect(comp.resultadosModulo().length).toBe(2);

    comp.toggleModulo(comp.resultadosModulo()[0]);
    expect(comp.moduloMarcado('10')).toBe(true);
    comp.toggleModulo(comp.resultadosModulo()[0]);
    expect(comp.moduloMarcado('10')).toBe(false);
  });

  it('envia os módulos marcados (com observação) no cadastro', async () => {
    const cadastrar = vi
      .fn()
      .mockResolvedValue({ projetoId: 9, duplicado: false });
    const fixture = montar({ cadastrar });
    const comp = fixture.componentInstance;
    comp.selecionar(cliente());
    comp.toggleModulo(moduloSicla({ codigo: '205', descricao: 'Estoque · Inventário' }));
    comp.setObs('205', 'confirmar layout');
    await comp.salvar();
    expect(cadastrar).toHaveBeenCalledWith(
      expect.objectContaining({
        modulosSelecionados: [
          { codigo: '205', descricao: 'Estoque · Inventário', obs: 'confirmar layout' },
        ],
      }),
    );
  });

  it('começa com as 4 conversões fixas, nenhuma marcada', () => {
    const fixture = montar({});
    const comp = fixture.componentInstance;
    const nomes = comp.conversoes().map((c) => c.nome);
    expect(nomes).toContain('Importação Cad. clientes e fornecedores');
    expect(nomes).toContain('Importação Notas Fiscais já emitidas');
    expect(comp.conversoes().length).toBe(4);
    expect(comp.conversoes().every((c) => !c.marcado)).toBe(true);
  });

  it('marca conversões, informa horas e adiciona item livre — tudo enviado no cadastro', async () => {
    const cadastrar = vi
      .fn()
      .mockResolvedValue({ projetoId: 9, duplicado: false });
    const fixture = montar({ cadastrar });
    const comp = fixture.componentInstance;
    comp.selecionar(cliente());
    // marca a 2ª fixa (produtos) e informa horas
    comp.toggleConversao(1);
    comp.setHorasConversao(1, '8');
    // adiciona um item livre (entra já marcado)
    comp.novaConversao.set('Conversão de contratos');
    comp.adicionarConversao();
    expect(comp.novaConversao()).toBe('');
    await comp.salvar();
    expect(cadastrar).toHaveBeenCalledWith(
      expect.objectContaining({
        conversoesSelecionadas: [
          { nome: 'Importação Cad. produtos', horas: '8' },
          { nome: 'Conversão de contratos', horas: '' },
        ],
      }),
    );
  });

  it('esvaziar o campo do cliente limpa a lista de resultados', async () => {
    const buscar = vi
      .fn()
      .mockResolvedValue({ ok: true, mensagem: '1', clientes: [cliente()] });
    const fixture = montar({ buscar });
    const comp = fixture.componentInstance;
    comp.termo.set('acme');
    await comp.buscar();
    expect(comp.resultados().length).toBe(1);
    comp.onTermoChange('');
    expect(comp.resultados().length).toBe(0);
    expect(comp.buscou()).toBe(false);
  });

  it('digitar no campo do cliente dispara a busca após o debounce', () => {
    vi.useFakeTimers();
    try {
      const buscar = vi
        .fn()
        .mockResolvedValue({ ok: true, mensagem: '1', clientes: [] });
      const fixture = montar({ buscar });
      const comp = fixture.componentInstance;
      comp.onTermoChange('acme');
      expect(buscar).not.toHaveBeenCalled(); // ainda no debounce
      vi.advanceTimersByTime(400);
      expect(buscar).toHaveBeenCalledWith('acme');
    } finally {
      vi.useRealTimers();
    }
  });

  it('esvaziar o campo do módulo limpa a lista de módulos', async () => {
    const buscar = vi
      .fn()
      .mockResolvedValue({ ok: true, mensagem: '1', modulos: [moduloSicla()] });
    const fixture = montar({}, { buscar });
    const comp = fixture.componentInstance;
    comp.termoModulo.set('fat');
    await comp.buscarModulos();
    expect(comp.resultadosModulo().length).toBe(1);
    comp.onTermoModuloChange('');
    expect(comp.resultadosModulo().length).toBe(0);
  });

  it('avisa quando o cliente já possui cadastro (duplicado), sem tratar como sucesso', async () => {
    const cadastrar = vi
      .fn()
      .mockResolvedValue({ projetoId: 3, duplicado: true });
    const fixture = montar({ cadastrar });
    const comp = fixture.componentInstance;
    comp.selecionar(cliente());
    await comp.salvar();
    expect(comp.sucesso()?.resultado.duplicado).toBe(true);
    expect(comp.sucesso()?.resultado.projetoId).toBe(3);
  });
});
