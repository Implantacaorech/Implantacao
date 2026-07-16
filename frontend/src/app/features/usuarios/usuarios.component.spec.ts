import { TestBed } from '@angular/core/testing';
import { UsuariosComponent } from './usuarios.component';
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

describe('UsuariosComponent', () => {
  function montar(service: Partial<UsuariosService>) {
    TestBed.configureTestingModule({
      imports: [UsuariosComponent],
      providers: [{ provide: UsuariosService, useValue: service }],
    });
    return TestBed.createComponent(UsuariosComponent);
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

  it('lista os usuários vindos da API', async () => {
    const fixture = montar({ listar: () => Promise.resolve([usuario({ nome: 'Ana' }), usuario({ id: 2, nome: 'Beto' })]) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Ana');
    expect(texto).toContain('Beto');
  });

  it('mostra a mensagem de lista vazia quando não há usuários', async () => {
    const fixture = montar({ listar: () => Promise.resolve([]) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhum usuário ainda');
  });

  it('modo criação: exige senha com pelo menos 6 caracteres antes de salvar', async () => {
    const criar = vi.fn();
    const fixture = montar({ listar: () => Promise.resolve([]), criar });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.form.patchValue({ email: 'novo@teste.com', codigoSicla: '123', senha: '123' });
    await comp.salvar();
    expect(criar).not.toHaveBeenCalled();
    expect(comp.erro()).toContain('pelo menos 6 caracteres');
  });

  it('modo criação: chama service.criar e recarrega a lista', async () => {
    const criar = vi.fn().mockResolvedValue(usuario({ id: 42 }));
    const listar = vi.fn().mockResolvedValue([]);
    const fixture = montar({ listar, criar });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.form.patchValue({ email: 'novo@teste.com', codigoSicla: '123', senha: 'segredo' });
    await comp.salvar();
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ email: 'novo@teste.com', senha: 'segredo' }));
    expect(listar).toHaveBeenCalledTimes(2);
  });

  it('editar pré-preenche o formulário e zera a senha', async () => {
    const fixture = montar({ listar: () => Promise.resolve([usuario({ nome: 'Ana Existente' })]) });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.editar(usuario({ nome: 'Ana Existente' }));
    expect(comp.form.getRawValue().nome).toBe('Ana Existente');
    expect(comp.form.getRawValue().senha).toBe('');
    expect(comp.usuarioId()).toBe(1);
  });

  it('após editar, senha em branco não bloqueia o salvar e não é enviada', async () => {
    const atualizar = vi.fn().mockResolvedValue(usuario());
    const fixture = montar({ listar: () => Promise.resolve([usuario()]), atualizar });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.editar(usuario());
    await comp.salvar();
    expect(atualizar).toHaveBeenCalledWith(1, expect.not.objectContaining({ senha: expect.anything() }));
  });

  it('mostra mensagem de erro quando o salvamento falha', async () => {
    const criar = vi.fn().mockRejectedValue(new Error('falhou'));
    const fixture = montar({ listar: () => Promise.resolve([]), criar });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.form.patchValue({ email: 'novo@teste.com', codigoSicla: '123', senha: 'segredo' });
    await comp.salvar();
    expect(comp.erro()).toBe('Não foi possível salvar o usuário.');
  });
});
