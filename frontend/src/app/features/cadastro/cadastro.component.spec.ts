import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { CadastroComponent } from './cadastro.component';
import { CadastroService } from '../../core/services/cadastro.service';
import { AuthService } from '../../core/services/auth.service';
import { LoginResponse } from '../../core/models/auth-user.model';

function sessao(): LoginResponse {
  return {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    usuario: { sub: 1, login: 'ana@teste.com', nome: 'Ana', perfil: 'Consultor', codigoSicla: '007' },
  };
}

describe('CadastroComponent', () => {
  function montar(cadastroService: Partial<CadastroService>, authService: Partial<AuthService> = {}) {
    TestBed.configureTestingModule({
      imports: [CadastroComponent],
      providers: [
        provideRouter([]),
        { provide: CadastroService, useValue: cadastroService },
        { provide: AuthService, useValue: { entrarComSessao: vi.fn(), ...authService } },
      ],
    });
    return TestBed.createComponent(CadastroComponent);
  }

  it('começa na etapa "dados"', () => {
    const fixture = montar({});
    fixture.detectChanges();
    expect(fixture.componentInstance.etapa()).toBe('dados');
    expect(fixture.nativeElement.textContent).toContain('Criar conta');
  });

  it('avança para a etapa "código" quando o cadastro é iniciado com sucesso', async () => {
    const iniciar = vi.fn().mockResolvedValue({ email: 'ana@teste.com' });
    const fixture = montar({ iniciar });
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.formDados.setValue({ nome: 'Ana', email: 'ana@teste.com', senha: 'segredo1', codigoSicla: '007' });
    await comp.enviarDados();
    expect(iniciar).toHaveBeenCalledWith({ nome: 'Ana', email: 'ana@teste.com', senha: 'segredo1', codigoSicla: '007' });
    expect(comp.etapa()).toBe('codigo');
  });

  it('mostra erro quando iniciar o cadastro falha', async () => {
    const iniciar = vi.fn().mockRejectedValue(new Error('falhou'));
    const fixture = montar({ iniciar });
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.formDados.setValue({ nome: 'Ana', email: 'ana@teste.com', senha: 'segredo1', codigoSicla: '007' });
    await comp.enviarDados();
    expect(comp.etapa()).toBe('dados');
    expect(comp.erro()).toBe('Não foi possível iniciar o cadastro.');
  });

  it('confirmar código abre sessão e navega para /home', async () => {
    const confirmar = vi.fn().mockResolvedValue(sessao());
    const entrarComSessao = vi.fn();
    const fixture = montar({ confirmar }, { entrarComSessao });
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    comp.formDados.patchValue({ email: 'ana@teste.com' });
    comp.etapa.set('codigo');
    comp.formCodigo.setValue({ codigo: '123456' });
    await comp.confirmarCodigo();
    expect(confirmar).toHaveBeenCalledWith({ email: 'ana@teste.com', codigo: '123456' });
    expect(entrarComSessao).toHaveBeenCalledWith(sessao());
    expect(navigateSpy).toHaveBeenCalledWith('/home');
  });

  it('reenviar código mostra aviso de sucesso', async () => {
    const reenviar = vi.fn().mockResolvedValue({ email: 'ana@teste.com' });
    const fixture = montar({ reenviar });
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.formDados.patchValue({ email: 'ana@teste.com' });
    comp.etapa.set('codigo');
    await comp.reenviarCodigo();
    expect(reenviar).toHaveBeenCalledWith({ email: 'ana@teste.com' });
    expect(comp.aviso()).toContain('novo código');
  });

  it('voltar para dados limpa erro/aviso e retorna à primeira etapa', () => {
    const fixture = montar({});
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.etapa.set('codigo');
    comp.erro.set('algo');
    comp.aviso.set('algo');
    comp.voltarParaDados();
    expect(comp.etapa()).toBe('dados');
    expect(comp.erro()).toBeNull();
    expect(comp.aviso()).toBeNull();
  });
});
