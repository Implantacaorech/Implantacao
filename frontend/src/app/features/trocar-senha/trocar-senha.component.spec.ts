import { TestBed } from '@angular/core/testing';
import { TrocarSenhaComponent } from './trocar-senha.component';
import { AuthService } from '../../core/services/auth.service';

describe('TrocarSenhaComponent', () => {
  function montar(auth: Partial<AuthService>) {
    TestBed.configureTestingModule({
      imports: [TrocarSenhaComponent],
      providers: [{ provide: AuthService, useValue: auth }],
    });
    return TestBed.createComponent(TrocarSenhaComponent);
  }

  function preencher(fixture: ReturnType<typeof montar>, valores: Record<string, string>) {
    fixture.componentInstance.form.patchValue(valores);
  }

  it('chama o service com a senha atual e a nova quando tudo confere', async () => {
    const trocarSenha = vi.fn().mockResolvedValue(undefined);
    const fixture = montar({ trocarSenha });
    fixture.detectChanges();
    preencher(fixture, {
      senhaAtual: 'antiga123',
      senhaNova: 'nova12345',
      confirmarSenhaNova: 'nova12345',
    });
    await fixture.componentInstance.salvar();
    expect(trocarSenha).toHaveBeenCalledWith('antiga123', 'nova12345');
    expect(fixture.componentInstance.sucesso()).toBe(true);
  });

  it('não chama o service quando a confirmação não bate', async () => {
    const trocarSenha = vi.fn();
    const fixture = montar({ trocarSenha });
    fixture.detectChanges();
    preencher(fixture, {
      senhaAtual: 'antiga123',
      senhaNova: 'nova12345',
      confirmarSenhaNova: 'outra-coisa',
    });
    await fixture.componentInstance.salvar();
    expect(trocarSenha).not.toHaveBeenCalled();
    expect(fixture.componentInstance.erro()).toContain('não bate');
  });

  it('não chama o service quando o formulário é inválido (senha nova curta)', async () => {
    const trocarSenha = vi.fn();
    const fixture = montar({ trocarSenha });
    fixture.detectChanges();
    preencher(fixture, { senhaAtual: 'antiga123', senhaNova: '123', confirmarSenhaNova: '123' });
    await fixture.componentInstance.salvar();
    expect(trocarSenha).not.toHaveBeenCalled();
  });

  it('mostra a mensagem de erro padrão quando o backend falha', async () => {
    const trocarSenha = vi.fn().mockRejectedValue(new Error('falhou'));
    const fixture = montar({ trocarSenha });
    fixture.detectChanges();
    preencher(fixture, {
      senhaAtual: 'errada',
      senhaNova: 'nova12345',
      confirmarSenhaNova: 'nova12345',
    });
    await fixture.componentInstance.salvar();
    expect(fixture.componentInstance.erro()).toBe('Não foi possível trocar a senha.');
  });
});
