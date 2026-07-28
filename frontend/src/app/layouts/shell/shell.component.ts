import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

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

  readonly vePainelGestao = computed(() => {
    const p = this.auth.usuario()?.perfil;
    return p === 'ADM' || p === 'Coordenador' || p === 'Administrativo' || p === 'GCI';
  });

  readonly veSistema = computed(() => this.auth.usuario()?.perfil === 'ADM');

  /** O Comercial só usa a tela de consulta/cadastro do cliente — o menu fica enxuto,
   * sem carteira, gestão nem sistema. */
  readonly soComercial = computed(() => this.auth.usuario()?.perfil === 'Comercial');

  /** Quem pode cadastrar novo cliente (passo 1): ADM, Comercial e Coordenador. Só eles
   * enxergam o link "Novo Cliente" (os demais seriam desviados pela rota). */
  readonly podeNovoCliente = computed(() => {
    const p = this.auth.usuario()?.perfil;
    return p === 'ADM' || p === 'Comercial' || p === 'Coordenador';
  });

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
