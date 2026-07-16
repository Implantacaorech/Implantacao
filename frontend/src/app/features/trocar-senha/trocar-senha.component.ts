import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-trocar-senha',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './trocar-senha.component.html',
  styleUrl: './trocar-senha.component.css',
})
export class TrocarSenhaComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly sucesso = signal(false);

  readonly form = this.fb.nonNullable.group({
    senhaAtual: ['', Validators.required],
    senhaNova: ['', [Validators.required, Validators.minLength(8)]],
    confirmarSenhaNova: ['', Validators.required],
  });

  async salvar(): Promise<void> {
    if (this.form.invalid || this.salvando()) return;
    const { senhaAtual, senhaNova, confirmarSenhaNova } = this.form.getRawValue();
    if (senhaNova !== confirmarSenhaNova) {
      this.erro.set('A confirmação não bate com a senha nova.');
      return;
    }
    this.salvando.set(true);
    this.erro.set(null);
    this.sucesso.set(false);
    try {
      await this.auth.trocarSenha(senhaAtual, senhaNova);
      this.sucesso.set(true);
      this.form.reset();
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível trocar a senha.',
      );
    } finally {
      this.salvando.set(false);
    }
  }
}
