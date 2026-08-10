import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { EsqueciSenhaComponent } from './esqueci-senha.component';
import { RecuperacaoSenhaService } from '../../core/services/recuperacao-senha.service';

describe('EsqueciSenhaComponent', () => {
  function montar(servico: Partial<RecuperacaoSenhaService> = {}) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [EsqueciSenhaComponent],
      providers: [
        provideRouter([]),
        {
          provide: RecuperacaoSenhaService,
          useValue: { solicitar: vi.fn(), redefinir: vi.fn(), ...servico },
        },
      ],
    });
    return TestBed.createComponent(EsqueciSenhaComponent);
  }

  it('começa pedindo o e-mail', () => {
    const fixture = montar();
    fixture.detectChanges();
    expect(fixture.componentInstance.etapa()).toBe('email');
    expect(fixture.nativeElement.textContent).toContain('Enviar código');
  });

  it('avança para a etapa do código após solicitar', async () => {
    const solicitar = vi.fn().mockResolvedValue(undefined);
    const fixture = montar({ solicitar });
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.formEmail.setValue({ email: 'ana@rech.com.br' });
    await comp.pedirCodigo();

    expect(solicitar).toHaveBeenCalledWith('ana@rech.com.br');
    expect(comp.etapa()).toBe('codigo');
  });

  it('não deixa salvar com as duas senhas diferentes', () => {
    const fixture = montar();
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.formRedefinir.setValue({
      codigo: '123456',
      senhaNova: 'senha-nova-1',
      confirmacao: 'senha-outra-1',
    });

    expect(comp.formRedefinir.invalid).toBe(true);
    expect(comp.formRedefinir.errors).toEqual({ diferentes: true });
  });

  it('recusa senha com menos de 8 caracteres (mesmo mínimo do backend)', () => {
    const fixture = montar();
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.formRedefinir.setValue({ codigo: '123456', senhaNova: 'curta', confirmacao: 'curta' });

    expect(comp.formRedefinir.get('senhaNova')?.invalid).toBe(true);
  });

  it('redefinir com sucesso volta para o login', async () => {
    const redefinir = vi.fn().mockResolvedValue(undefined);
    const fixture = montar({ redefinir });
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    comp.formEmail.setValue({ email: 'ana@rech.com.br' });
    comp.etapa.set('codigo');
    comp.formRedefinir.setValue({
      codigo: '123456',
      senhaNova: 'senha-nova-1',
      confirmacao: 'senha-nova-1',
    });
    await comp.redefinir();

    expect(redefinir).toHaveBeenCalledWith('ana@rech.com.br', '123456', 'senha-nova-1');
    expect(navegar).toHaveBeenCalledWith('/login');
  });

  it('código recusado mostra a mensagem e continua na etapa do código', async () => {
    const redefinir = vi.fn().mockRejectedValue(new Error('400'));
    const fixture = montar({ redefinir });
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.formEmail.setValue({ email: 'ana@rech.com.br' });
    comp.etapa.set('codigo');
    comp.formRedefinir.setValue({
      codigo: '000000',
      senhaNova: 'senha-nova-1',
      confirmacao: 'senha-nova-1',
    });
    await comp.redefinir();

    expect(comp.etapa()).toBe('codigo');
    expect(comp.erro()).toContain('Código inválido');
  });

  it('reenviar limpa o código digitado (o anterior deixou de valer)', async () => {
    const solicitar = vi.fn().mockResolvedValue(undefined);
    const fixture = montar({ solicitar });
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.formEmail.setValue({ email: 'ana@rech.com.br' });
    comp.etapa.set('codigo');
    comp.formRedefinir.patchValue({ codigo: '111111' });
    await comp.reenviarCodigo();

    expect(comp.formRedefinir.getRawValue().codigo).toBe('');
    expect(comp.aviso()).toContain('código novo');
  });
});
