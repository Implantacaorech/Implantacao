import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { CadastroService } from '../../core/services/cadastro.service';

type Etapa = 'dados' | 'codigo';

@Component({
  selector: 'app-cadastro',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './cadastro.component.html',
  styleUrl: './cadastro.component.css',
})
export class CadastroComponent {
  private readonly fb = inject(FormBuilder);
  private readonly cadastro = inject(CadastroService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly etapa = signal<Etapa>('dados');
  readonly enviando = signal(false);
  readonly reenviando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  readonly formDados = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    senha: ['', [Validators.required, Validators.minLength(6)]],
    codigoSicla: ['', Validators.required],
  });

  readonly formCodigo = this.fb.nonNullable.group({
    codigo: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  async enviarDados(): Promise<void> {
    if (this.formDados.invalid || this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    try {
      await this.cadastro.iniciar(this.formDados.getRawValue());
      this.etapa.set('codigo');
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível iniciar o cadastro.'));
    } finally {
      this.enviando.set(false);
    }
  }

  async confirmarCodigo(): Promise<void> {
    if (this.formCodigo.invalid || this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    try {
      const sessao = await this.cadastro.confirmar({
        email: this.formDados.getRawValue().email,
        codigo: this.formCodigo.getRawValue().codigo,
      });
      this.auth.entrarComSessao(sessao);
      await this.router.navigateByUrl('/home');
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Código inválido ou expirado.'));
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
      await this.cadastro.reenviar({ email: this.formDados.getRawValue().email });
      this.aviso.set('Um novo código foi enviado para o seu e-mail.');
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível reenviar o código.'));
    } finally {
      this.reenviando.set(false);
    }
  }

  voltarParaDados(): void {
    this.etapa.set('dados');
    this.erro.set(null);
    this.aviso.set(null);
  }

  private mensagemErro(e: unknown, padrao: string): string {
    return e instanceof HttpErrorResponse && typeof e.error?.message === 'string' ? e.error.message : padrao;
  }
}
