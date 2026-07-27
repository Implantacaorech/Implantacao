import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ConsultaClienteComponent } from './consulta-cliente.component';
import { AuthService } from '../../core/services/auth.service';
import {
  ClienteSicla,
  ClientesSiclaService,
} from '../../core/services/clientes-sicla.service';
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

describe('ConsultaClienteComponent', () => {
  function montar(service: Partial<ClientesSiclaService>) {
    TestBed.configureTestingModule({
      imports: [ConsultaClienteComponent],
      providers: [
        provideRouter([]),
        { provide: ClientesSiclaService, useValue: service },
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
});
