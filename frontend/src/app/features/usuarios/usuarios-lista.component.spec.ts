import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UsuariosListaComponent } from './usuarios-lista.component';
import { UsuariosService } from '../../core/services/usuarios.service';
import { Usuario } from '../../core/models/usuario.model';

function usuario(over: Partial<Usuario> = {}): Usuario {
  return {
    id: 1,
    login: 'ana',
    nome: 'Ana',
    email: 'ana@teste.com',
    perfil: 'Consultor',
    codigoSicla: '007',
    ativo: true,
    criadoEm: new Date().toISOString(),
    ...over,
  };
}

describe('UsuariosListaComponent', () => {
  function montar(service: Partial<UsuariosService>) {
    TestBed.configureTestingModule({
      imports: [UsuariosListaComponent],
      providers: [provideRouter([]), { provide: UsuariosService, useValue: service }],
    });
    return TestBed.createComponent(UsuariosListaComponent);
  }

  it('mostra "Carregando…" enquanto a chamada está pendente', () => {
    const fixture = montar({ listar: () => new Promise(() => {}) });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Carregando');
  });

  it('mostra mensagem de erro quando a chamada falha', async () => {
    const fixture = montar({ listar: () => Promise.reject(new Error('falhou')) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar os usuários.');
  });

  it('lista os usuários vindos da API, sem expor senha', async () => {
    const fixture = montar({ listar: () => Promise.resolve([usuario({ nome: 'Ana' }), usuario({ id: 2, nome: 'Beto' })]) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Ana');
    expect(texto).toContain('Beto');
  });

  it('mostra "Nenhum usuário cadastrado." quando a lista vem vazia', async () => {
    const fixture = montar({ listar: () => Promise.resolve([]) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhum usuário cadastrado.');
  });
});
