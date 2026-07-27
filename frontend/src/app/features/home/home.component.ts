import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PainelService } from '../../core/services/painel.service';
import { AuthService } from '../../core/services/auth.service';
import { ItemPendenciaHome, PainelHome } from '../../core/models/painel.model';

/** A próxima ação da Home leva ao FLUXO do projeto — desde 2026-07-24 o fluxo vive num
 * lugar só (a tela de Passos, que é a própria página do projeto). Antes cada tipo de ação
 * apontava para uma tela solta (definir-gci, agendar, consultores); essas telas foram
 * desativadas, e o passo certo já fica em evidência ao abrir o projeto. */
function rotaAcao(item: ItemPendenciaHome): (string | number)[] {
  return ['/projetos', item.id];
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly service = inject(PainelService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly dados = signal<PainelHome | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly veSistema = computed(() => this.auth.usuario()?.perfil === 'ADM');

  constructor() {
    // O Comercial não tem visão geral: a única tela dele é a consulta/cadastro do cliente.
    // Se cair aqui (deep link ou redirect de guard), segue direto para ela.
    if (this.auth.usuario()?.perfil === 'Comercial') {
      void this.router.navigateByUrl('/clientes/novo');
      return;
    }
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.dados.set(await this.service.home());
    } catch {
      this.erro.set('Não foi possível carregar o painel.');
    } finally {
      this.carregando.set(false);
    }
  }

  rotaAcao(item: ItemPendenciaHome): (string | number)[] {
    return rotaAcao(item);
  }
}
