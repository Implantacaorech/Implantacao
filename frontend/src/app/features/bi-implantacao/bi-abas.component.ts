import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BiAbasPrincipaisComponent } from './bi-abas-principais.component';

/** Cabeçalho da área BI: título, abas de 1º nível (os dois BIs) e as SUBABAS do
 * "Implantação Clientes SIGER" — as 4 páginas portadas do `BI_clientes.pbix`. Equivale ao
 * `pageNavigator` que o relatório tinha na lateral de cada página. */
@Component({
  selector: 'app-bi-abas',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, BiAbasPrincipaisComponent],
  template: `
    <h1 class="pagina-titulo">
      <svg class="svgi svgi-xl ic-brand" aria-hidden="true"><use href="#ic-dashboard"/></svg>
      BI
    </h1>

    <app-bi-abas-principais />

    <nav class="bi-abas">
      <a routerLink="/bi/clientes-siger/resumo" routerLinkActive="on">Resumo</a>
      <a routerLink="/bi/clientes-siger/extrato" routerLinkActive="on">Extrato de Protocolo/Horas</a>
      <a routerLink="/bi/clientes-siger/rns" routerLinkActive="on">RNS vinculadas</a>
      <a routerLink="/bi/clientes-siger/agendas" routerLinkActive="on">Agendas</a>
    </nav>
  `,
  styles: [
    `
      .bi-abas {
        display: flex;
        gap: 6px;
        margin-bottom: 12px;
        border-bottom: 1px solid var(--line);
        flex-wrap: wrap;
      }
      .bi-abas a {
        padding: 7px 13px;
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--muted);
        text-decoration: none;
      }
      .bi-abas a.on {
        color: var(--brand);
        border-bottom: 2px solid var(--brand);
      }
      .bi-abas a:hover {
        color: var(--brand);
      }
    `,
  ],
})
export class BiAbasComponent {}
