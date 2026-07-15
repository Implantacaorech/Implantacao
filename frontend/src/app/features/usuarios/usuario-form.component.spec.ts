import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { UsuarioFormComponent } from './usuario-form.component';
import { UsuariosService } from '../../core/services/usuarios.service';
import { Usuario } from '../../core/models/usuario.model';

function usuario(over: Partial<Usuario> = {}): Usuario {
  return {
    id: 9,
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

describe('UsuarioFormComponent', () => {
  function montar(id: string, service: Partial<UsuariosService>) {
    TestBed.configureTestingModule({
      imports: [UsuarioFormComponent],
      providers: [
        provideRouter([]),
        { provide: UsuariosService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id }) } } },
      ],
    });
    return TestBed.createComponent(UsuarioFormComponent);
  }

  it('modo criação: título "Novo usuário" e formulário vazio', () => {
    const fixture = montar('novo', {});
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Novo usuário');
    expect(fixture.componentInstance.usuarioId()).toBeNull();
  });

  it('modo criação: exige senha com pelo menos 6 caracteres antes de salvar', async () => {
    const criar = vi.fn();
    const fixture = montar('novo', { criar });
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.form.patchValue({ email: 'novo@teste.com', codigoSicla: '123', senha: '123' });
    await comp.salvar();
    expect(criar).not.toHaveBeenCalled();
    expect(comp.erro()).toContain('pelo menos 6 caracteres');
  });

  it('modo criação: chama service.criar e navega para o usuário salvo', async () => {
    const criado = usuario({ id: 42 });
    const criar = vi.fn().mockResolvedValue(criado);
    const fixture = montar('novo', { criar });
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    comp.form.patchValue({ email: 'novo@teste.com', codigoSicla: '123', senha: 'segredo' });
    await comp.salvar();
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ email: 'novo@teste.com', senha: 'segredo' }));
    expect(navigateSpy).toHaveBeenCalledWith(['/usuarios', 42]);
  });

  it('modo edição: carrega o usuário e mantém a senha em branco', async () => {
    const buscar = vi.fn().mockResolvedValue(usuario({ id: 9, nome: 'Ana Existente' }));
    const fixture = montar('9', { buscar });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    expect(buscar).toHaveBeenCalledWith(9);
    expect(comp.form.getRawValue().nome).toBe('Ana Existente');
    expect(comp.form.getRawValue().senha).toBe('');
  });

  it('modo edição: senha em branco não bloqueia o salvar e não é enviada', async () => {
    const buscar = vi.fn().mockResolvedValue(usuario({ id: 9 }));
    const atualizar = vi.fn().mockResolvedValue(usuario({ id: 9 }));
    const fixture = montar('9', { buscar, atualizar });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await comp.salvar();
    expect(atualizar).toHaveBeenCalledWith(9, expect.not.objectContaining({ senha: expect.anything() }));
  });

  it('mostra mensagem de erro quando o salvamento falha', async () => {
    const criar = vi.fn().mockRejectedValue(new Error('falhou'));
    const fixture = montar('novo', { criar });
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.form.patchValue({ email: 'novo@teste.com', codigoSicla: '123', senha: 'segredo' });
    await comp.salvar();
    expect(comp.erro()).toBe('Não foi possível salvar o usuário.');
  });
});
