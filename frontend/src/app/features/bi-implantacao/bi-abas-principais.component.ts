import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PermissoesService } from '../../core/services/permissoes.service';

/** Navegação de 1º nível da área **BI**: cada aba é um BI diferente, e cada BI traz as
 * próprias subabas (as consultas salvas, no caso do BI Implantação; as 4 páginas portadas do
 * Power BI, no caso do Implantação Clientes SIGER).
 *
 * Cada aba só aparece se o usuário tiver o menu correspondente liberado — a entrada no menu
 * lateral é uma só ("BI"), mas o RBAC continua distinguindo os dois BIs. */
@Component({
  selector: 'app-bi-abas-principais',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="bi-abas-top">
      @if (podeDashboards()) {
        <a routerLink="/bi/implantacao" routerLinkActive="on">BI Implantação</a>
      }
      @if (podeClientesSiger()) {
        <a routerLink="/bi/clientes-siger" routerLinkActive="on">Implantação Clientes SIGER</a>
      }
    </nav>
  `,
  styles: [
    `
      .bi-abas-top {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        margin-bottom: 10px;
        border-bottom: 2px solid var(--line);
      }
      .bi-abas-top a {
        padding: 9px 18px;
        font-size: 0.88rem;
        font-weight: 700;
        color: var(--muted);
        text-decoration: none;
        border-radius: 8px 8px 0 0;
        border: 1px solid transparent;
        border-bottom: none;
        margin-bottom: -2px;
      }
      .bi-abas-top a:hover {
        color: var(--brand);
      }
      .bi-abas-top a.on {
        color: var(--brand);
        background: var(--surface, #fff);
        border-color: var(--line);
        border-bottom: 2px solid var(--surface, #fff);
      }
    `,
  ],
})
export class BiAbasPrincipaisComponent {
  private readonly perm = inject(PermissoesService);
  readonly podeDashboards = computed(() => this.perm.podeVer('dashboards'));
  readonly podeClientesSiger = computed(() => this.perm.podeVer('bi_implantacao'));
}
