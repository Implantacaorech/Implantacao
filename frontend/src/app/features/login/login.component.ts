import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    login: ['', Validators.required],
    senha: ['', Validators.required],
  });

  async enviar(): Promise<void> {
    if (this.form.invalid || this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    try {
      const { login, senha } = this.form.getRawValue();
      await this.auth.login(login, senha);
      await this.router.navigateByUrl('/home');
    } catch (e) {
      const msg =
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível entrar. Verifique login e senha.';
      this.erro.set(msg);
    } finally {
      this.enviando.set(false);
    }
  }
}
