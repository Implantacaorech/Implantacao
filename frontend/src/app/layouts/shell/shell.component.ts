import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { Perfil } from '../../core/models/auth-user.model';
import {
  MENU_DICIONARIO,
  MENU_GESTAO,
  MENU_MATRIZ,
  MENU_NOVO_CLIENTE,
  MENU_PROTOCOLOS,
  MENU_SISTEMA,
} from '../../core/constants/perfis';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly busca = signal('');
  readonly sideAberta = signal(false);

  // Espelha `{{ self.titulo() }}` do base.html — cada rota folha declara `data: { titulo }`
  // (ver app.routes.ts); sem isso, cai no nome do sistema.
  readonly tituloPagina = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => {
        let r = this.route.snapshot;
        while (r.firstChild) r = r.firstChild;
        return (r.data['titulo'] as string) ?? 'Painel de Implantação';
      }),
      startWith('Painel de Implantação'),
    ),
    { initialValue: 'Painel de Implantação' },
  );

  /** Liberação por item de menu (definição do usuário em 2026-07-28). Carteira, Matriz e
   * Dashboards são de TODOS os perfis, então aparecem sempre (menu só existe autenticado). */
  private tem(perfis: Perfil[]): boolean {
    const p = this.auth.usuario()?.perfil;
    return !!p && perfis.includes(p);
  }

  readonly soComercial = computed(
    () => this.auth.usuario()?.perfil === 'Comercial',
  );
  readonly podeNovoCliente = computed(() => this.tem(MENU_NOVO_CLIENTE));
  readonly podeProtocolos = computed(() => this.tem(MENU_PROTOCOLOS));
  readonly podeMatriz = computed(() => this.tem(MENU_MATRIZ));
  readonly podeDicionario = computed(() => this.tem(MENU_DICIONARIO));
  /** Coordenação, Centro Operacional e Atividade. */
  readonly podeGestao = computed(() => this.tem(MENU_GESTAO));
  readonly veSistema = computed(() => this.tem(MENU_SISTEMA));

  readonly iniciais = computed(() => (this.auth.usuario()?.nome ?? 'P').slice(0, 2).toUpperCase());

  async buscar(): Promise<void> {
    const q = this.busca().trim();
    await this.router.navigate(['/projetos'], q ? { queryParams: { q } } : {});
  }

  toggleSide(forcar?: boolean): void {
    this.sideAberta.set(forcar ?? !this.sideAberta());
  }

  sair(): void {
    void this.auth.logout();
  }
}
