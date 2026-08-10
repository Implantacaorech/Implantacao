import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { RecuperacaoSenhaService } from '../../core/services/recuperacao-senha.service';

type Etapa = 'email' | 'codigo';

/** As duas senhas têm de bater — validador de grupo, porque a comparação é entre campos. */
function senhasIguais(grupo: AbstractControl): ValidationErrors | null {
  const senha = grupo.get('senhaNova')?.value;
  const confirmacao = grupo.get('confirmacao')?.value;
  return !confirmacao || senha === confirmacao ? null : { diferentes: true };
}

/** "Esqueci minha senha" — duas etapas no mesmo cartão: pedir o código por e-mail e, com
 * ele, gravar a senha nova. Não abre sessão: ao final devolve o usuário ao login. */
@Component({
  selector: 'app-esqueci-senha',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './esqueci-senha.component.html',
  styleUrls: ['../acesso/acesso.css', './esqueci-senha.component.css'],
})
export class EsqueciSenhaComponent {
  private readonly fb = inject(FormBuilder);
  private readonly recuperacao = inject(RecuperacaoSenhaService);
  private readonly router = inject(Router);

  readonly etapa = signal<Etapa>('email');
  readonly enviando = signal(false);
  readonly reenviando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  readonly formEmail = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly formRedefinir = this.fb.nonNullable.group(
    {
      codigo: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      // Mesmo mínimo que o backend exige em RedefinirSenhaDto.
      senhaNova: ['', [Validators.required, Validators.minLength(8)]],
      confirmacao: ['', Validators.required],
    },
    { validators: senhasIguais },
  );

  async pedirCodigo(): Promise<void> {
    if (this.formEmail.invalid || this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    try {
      await this.recuperacao.solicitar(this.formEmail.getRawValue().email);
      this.etapa.set('codigo');
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível enviar o código.'));
    } finally {
      this.enviando.set(false);
    }
  }

  async reenviarCodigo(): Promise<void> {
    if (this.reenviando()) return;
    this.reenviando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      await this.recuperacao.solicitar(this.formEmail.getRawValue().email);
      // Pedir de novo invalida o código anterior (ver RecuperacaoSenhaService no backend) —
      // avisar evita que a pessoa insista com o código do primeiro e-mail.
      this.aviso.set('Enviamos um código novo. Use o último e-mail recebido.');
      this.formRedefinir.patchValue({ codigo: '' });
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível reenviar o código.'));
    } finally {
      this.reenviando.set(false);
    }
  }

  async redefinir(): Promise<void> {
    if (this.formRedefinir.invalid || this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const { codigo, senhaNova } = this.formRedefinir.getRawValue();
      await this.recuperacao.redefinir(
        this.formEmail.getRawValue().email,
        codigo,
        senhaNova,
      );
      await this.router.navigateByUrl('/login');
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Código inválido ou expirado.'));
    } finally {
      this.enviando.set(false);
    }
  }

  private mensagemErro(e: unknown, padrao: string): string {
    return e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
      ? e.error.message
      : padrao;
  }
}
