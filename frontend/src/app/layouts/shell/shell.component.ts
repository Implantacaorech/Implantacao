import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter, map, startWith } from 'rxjs';
import { BarraGravacaoComponent } from '../../features/protocolos/barra-gravacao.component';
import { AvisosAtividadesComponent } from '../../features/controle-atividades/avisos-atividades.component';
import { AuthService } from '../../core/services/auth.service';
import { PermissoesService } from '../../core/services/permissoes.service';
import { InstanciaService } from '../../core/services/instancia.service';
import { temPapel } from '../../core/constants/perfis';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    BarraGravacaoComponent,
    AvisosAtividadesComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  private readonly perm = inject(PermissoesService);
  private readonly instancia = inject(InstanciaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    // Carrega o mapa de permissões do usuário logado (menu só existe autenticado).
    void this.perm.garantirCarregado();
  }

  /** Este front-end está sendo servido pelo **Portal API** (instância interna)?
   *
   * Lá o menu é OUTRO — só conexão de banco, criação de consulta e geração de token, que é
   * tudo o que aquela instância monta. E não é só o menu: a TABELA DE ROTAS daquele portal
   * também é outra (ver `app.routes.ts`), então o que não aparece aqui também não existe lá.
   *
   * O valor já vem resolvido do boot (`main.ts` pergunta antes de a aplicação subir), então
   * não há espera nem estado intermediário. */
  readonly portalApi = computed(() => this.instancia.portalApi());
  readonly nomeInstancia = computed(() => this.instancia.atual().nome);
  readonly rotaInicial = computed(() => this.instancia.atual().rotaInicial);

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
  readonly podeProtocolo = computed(() => this.perm.podeVer('protocolo'));
  readonly podeRechEdu = computed(() => this.perm.podeVer('rechedu'));
  readonly podeAgenda = computed(() => this.perm.podeVer('agenda'));
  readonly podeRns = computed(() => this.perm.podeVer('rns'));
  readonly podeControleAtividades = computed(() =>
    this.perm.podeVer('controle_atividades'),
  );
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

  /** O usuário logado é um CLIENTE da Rech (papel externo), e não gente de casa? Só muda a
   * faixa do cabeçalho: o que ele PODE ver já é decidido pelas permissões (menu) e pelo
   * recorte por cliente (backend). */
  readonly ehCliente = computed(() => temPapel(this.auth.usuario(), 'Cliente'));

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
