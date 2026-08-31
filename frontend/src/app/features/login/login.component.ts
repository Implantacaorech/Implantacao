import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { InstanciaService } from '../../core/services/instancia.service';
import { soComercial } from '../../core/constants/perfis';
import { CHAVE_LOGIN_LEMBRADO } from '../../core/constants/sessao';
import {
  limparMarcaDeRecarga,
  recarregarSeBuildTrocou,
} from '../../core/utils/build-desatualizado';

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
  private readonly instancia = inject(InstanciaService);

  /** O que aparece sob o logo no cartão de acesso. A tela de login já pertence a uma das
   * duas instâncias, e quem entra precisa saber em qual está antes de digitar a senha —
   * são portais diferentes, com finalidades diferentes. */
  readonly subtitulo = computed(() =>
    this.instancia.portalApi() ? 'Portal API' : 'Implantação SIGER®',
  );

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
    const { login, senha, lembrar } = this.form.getRawValue();

    // ETAPA 1 — credencial. Só o que acontece AQUI pode virar "verifique login e senha".
    try {
      await this.auth.login(login, senha);
    } catch (e) {
      const msg =
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível entrar. Verifique login e senha.';
      this.erro.set(msg);
      this.enviando.set(false);
      return;
    }

    // Só o e-mail é lembrado, e só depois de o login dar certo — nunca a senha, e nunca um
    // endereço que sequer existe.
    if (lembrar) localStorage.setItem(CHAVE_LOGIN_LEMBRADO, login);
    else localStorage.removeItem(CHAVE_LOGIN_LEMBRADO);

    // ETAPA 2 — entrar no Painel. A sessão JÁ está salva; o que falhar daqui em diante não
    // tem nada a ver com a senha e não pode ser relatado como se tivesse (foi exatamente o
    // que mascarou o incidente de 2026-08-03: token emitido, chunk velho 404, e a tela
    // dizendo "verifique login e senha").
    try {
      // Quem é SÓ Comercial usa apenas a tela de consulta/cadastro do cliente — cai direto
      // nela. Os demais (inclusive quem acumula Comercial + outro papel) vão pra visão geral.
      const destino = soComercial(this.auth.usuario()) ? '/clientes/novo' : '/home';
      await this.router.navigateByUrl(destino);
      limparMarcaDeRecarga();
    } catch (e) {
      // Build trocou debaixo desta aba: recarrega e a pessoa já volta logada (a sessão está
      // no localStorage). Não mostra erro — a página está saindo.
      if (recarregarSeBuildTrocou(e)) return;
      this.erro.set(
        'Sua senha foi aceita, mas o Painel não abriu. Recarregue a página (Ctrl+F5) e tente de novo.',
      );
    } finally {
      this.enviando.set(false);
    }
  }
}
