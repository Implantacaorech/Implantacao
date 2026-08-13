import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter, map, startWith } from 'rxjs';
import { BarraGravacaoComponent } from '../../features/protocolos/barra-gravacao.component';
import { AuthService } from '../../core/services/auth.service';
import { PermissoesService } from '../../core/services/permissoes.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, BarraGravacaoComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  private readonly perm = inject(PermissoesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    // Carrega o mapa de permissões do usuário logado (menu só existe autenticado).
    void this.perm.garantirCarregado();
  }

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

  /** Visibilidade dos itens de menu — vinda do painel de Permissões (backend), por menu.
   * A Visão Geral (home) não é um menu controlado; segue a regra antiga (todos menos o
   * Comercial). Os demais consultam o nível efetivo do usuário. */
  readonly podeVisaoGeral = computed(() => this.perm.podeVer('visao_geral'));
  readonly podeNovoCliente = computed(() => this.perm.podeVer('novo_cliente'));
  readonly podeCarteira = computed(() => this.perm.podeVer('carteira'));
  readonly podeProtocolos = computed(() => this.perm.podeVer('protocolos'));
  readonly podeMatriz = computed(() => this.perm.podeVer('matriz'));
  readonly podeMatrizDetalhada = computed(() => this.perm.podeVer('matriz_detalhada'));
  readonly podeMatrizFuncoes = computed(() => this.perm.podeVer('matriz_funcoes'));
  readonly podeDicionario = computed(() => this.perm.podeVer('dicionario'));
  readonly podeCoordenacao = computed(() => this.perm.podeVer('coordenacao'));
  readonly podeCentroOp = computed(() =>
    this.perm.podeVer('centro_operacional'),
  );
  readonly podeAtividade = computed(() => this.perm.podeVer('atividade'));
  readonly podeDashboards = computed(() => this.perm.podeVer('dashboards'));
  readonly podeClientesSiger = computed(() => this.perm.podeVer('bi_implantacao'));
  /** A área BI é UMA entrada no menu; basta poder ver um dos dois BIs. */
  readonly podeBi = computed(() => this.podeDashboards() || this.podeClientesSiger());
  readonly podePermissoes = computed(() => this.perm.podeVer('permissoes'));
  readonly veSistema = computed(() => this.perm.podeVer('usuarios'));
  readonly podeProntidao = computed(() => this.perm.podeVer('prontidao'));
  /** Mostra o cabeçalho do grupo Gestão se houver ao menos um item visível nele. */
  readonly temGestao = computed(
    () =>
      this.podeCoordenacao() ||
      this.podeCentroOp() ||
      this.podeAtividade() ||
      this.podeBi() ||
      this.podePermissoes(),
  );

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
