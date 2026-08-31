import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RecheduService } from '../../core/services/rechedu.service';

/** Tela Execução → RechEdu. Moldura do portal de educação da Rech (www.rechedu.com.br)
 * dentro do Painel — irmã da tela Protocolo (Portal Rech): o site permite ser emoldurado
 * (sem X-Frame-Options/CSP `frame-ancestors`, verificado em 2026-08-14), então a página
 * abre embutida num iframe; o botão "Abrir em nova guia" atende quem precisa da janela
 * cheia. No 1º uso a tela SOLICITA a credencial do consultor e guarda no backend (por
 * usuário, senha nunca volta) — mesma mecânica da credencial do Portal Rech. O login no
 * SITE continua sendo digitado no iframe: ele é cross-origin, o Painel não preenche
 * formulário de terceiro. */
@Component({
  selector: 'app-rechedu',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './rechedu.component.html',
  styleUrl: './rechedu.component.css',
})
export class RecheduComponent implements OnInit {
  private readonly rechedu = inject(RecheduService);

  /** Endereço público do RechEdu — usado no botão de nova guia. O `src` do iframe repete o
   * literal como atributo estático: binding de resource URL exigiria passar pelo
   * DomSanitizer sem necessidade. */
  readonly urlRechEdu = 'https://www.rechedu.com.br';

  /** Credencial salva do usuário (status vindo do backend). */
  readonly temCredencial = signal(false);
  readonly credLogin = signal('');

  /** Captura de credencial (aberta sozinha no 1º uso; depois, pelo "trocar"). */
  readonly pedindoCredencial = signal(false);
  readonly formLogin = signal('');
  readonly formSenha = signal('');
  readonly salvandoCred = signal(false);
  readonly erroCred = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const st = await this.rechedu.credencial();
      this.temCredencial.set(st.tem);
      this.credLogin.set(st.login);
      // 1º uso: solicita o login antes de tudo — igual ao Portal Rech na tela Protocolo.
      if (!st.tem) this.pedindoCredencial.set(true);
    } catch {
      // Backend indisponível não derruba a tela: o iframe continua útil; a captura pode
      // ser aberta depois pelo botão "Salvar credencial".
    }
  }

  trocarCredencial(): void {
    this.formLogin.set(this.credLogin());
    this.formSenha.set('');
    this.erroCred.set('');
    this.pedindoCredencial.set(true);
  }

  async salvarCredencial(): Promise<void> {
    const login = this.formLogin().trim();
    if (!login) {
      this.erroCred.set('Informe o login com que você acessa o RechEdu.');
      return;
    }
    // No 1º cadastro a senha é obrigatória (sem ela `tem` continuaria falso); na edição,
    // em branco mantém a atual — regra do backend.
    if (!this.temCredencial() && !this.formSenha().trim()) {
      this.erroCred.set('Informe também a senha — obrigatória no primeiro cadastro.');
      return;
    }
    this.salvandoCred.set(true);
    this.erroCred.set('');
    try {
      const st = await this.rechedu.salvarCredencial(login, this.formSenha());
      this.temCredencial.set(st.tem);
      this.credLogin.set(st.login);
      this.formSenha.set('');
      this.pedindoCredencial.set(false);
    } catch {
      this.erroCred.set('Não foi possível salvar a credencial — tente de novo.');
    } finally {
      this.salvandoCred.set(false);
    }
  }

  async removerCredencial(): Promise<void> {
    if (!confirm('Remover a sua credencial salva do RechEdu?')) return;
    try {
      await this.rechedu.removerCredencial();
      this.temCredencial.set(false);
      this.credLogin.set('');
    } catch {
      // Falha silenciosa não ajuda: reaproveita a faixa de erro da captura.
      this.erroCred.set('Não foi possível remover a credencial — tente de novo.');
      this.pedindoCredencial.set(true);
    }
  }
}
