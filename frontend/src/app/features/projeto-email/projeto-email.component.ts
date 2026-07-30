import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProjetoEmailService } from '../../core/services/projeto-email.service';
import { AuthService } from '../../core/services/auth.service';
import { temPapel } from '../../core/constants/perfis';
import { TelaEmailProjeto } from '../../core/models/projeto-email.model';

@Component({
  selector: 'app-projeto-email',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './projeto-email.component.html',
  styleUrl: './projeto-email.component.css',
})
export class ProjetoEmailComponent {
  private readonly service = inject(ProjetoEmailService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));
  readonly ehAdm = computed(() => temPapel(this.auth.usuario(), 'ADM'));

  readonly carregando = signal(true);
  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly dados = signal<TelaEmailProjeto | null>(null);

  destino = '';
  assunto = '';
  corpo = '';
  modeloEscolhido = '';

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.tela(this.projetoId);
      this.dados.set(r);
      this.destino = r.destinoPadrao;
    } catch {
      this.erro.set('Não foi possível carregar os dados do projeto.');
    } finally {
      this.carregando.set(false);
    }
  }

  objectKeys(o: Record<string, unknown>): string[] {
    return Object.keys(o);
  }

  aplicarModelo(): void {
    const tpl = this.dados()?.tpls[this.modeloEscolhido];
    if (!tpl) return;
    this.assunto = tpl.assunto;
    this.corpo = tpl.corpo;
  }

  async enviar(): Promise<void> {
    this.enviando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.enviar(this.projetoId, this.destino, this.assunto, this.corpo);
      if (r.enviado) {
        await this.router.navigate(['/projetos', this.projetoId]);
      } else {
        this.erro.set(r.erro || 'Não foi possível enviar o e-mail.');
      }
    } catch {
      this.erro.set('Não foi possível enviar o e-mail.');
    } finally {
      this.enviando.set(false);
    }
  }
}
