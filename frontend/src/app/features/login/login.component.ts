import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { soComercial } from '../../core/constants/perfis';
import { CHAVE_LOGIN_LEMBRADO } from '../../core/constants/sessao';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['../acesso/acesso.css', './login.component.css'],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);

  /** E-mail guardado pelo "Lembrar-me" da última vez — repreenche o campo e deixa a caixa
   * marcada, para quem entra sempre da mesma máquina não redigitar. */
  private readonly lembrado = localStorage.getItem(CHAVE_LOGIN_LEMBRADO) ?? '';

  readonly form = this.fb.nonNullable.group({
    login: [this.lembrado],
    senha: ['', Validators.required],
    lembrar: [this.lembrado !== ''],
  });

  async enviar(): Promise<void> {
    if (this.form.invalid || this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    try {
      const { login, senha, lembrar } = this.form.getRawValue();
      await this.auth.login(login, senha);
      // Só o e-mail é lembrado, e só depois de o login dar certo — nunca a senha, e nunca um
      // endereço que sequer existe.
      if (lembrar) localStorage.setItem(CHAVE_LOGIN_LEMBRADO, login);
      else localStorage.removeItem(CHAVE_LOGIN_LEMBRADO);
      // Quem é SÓ Comercial usa apenas a tela de consulta/cadastro do cliente — cai direto
      // nela. Os demais (inclusive quem acumula Comercial + outro papel) vão pra visão geral.
      const destino = soComercial(this.auth.usuario()) ? '/clientes/novo' : '/home';
      await this.router.navigateByUrl(destino);
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
