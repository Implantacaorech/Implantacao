import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BiAbasPrincipaisComponent } from '../bi-implantacao/bi-abas-principais.component';

/** Cabeçalho da aba **BI Implantação**: título, abas de 1º nível e as subabas desta área —
 * a "Previsão de Início Oficial" (que roda pelo motor de Consultas BD) e as três páginas de
 * Indicadores portadas do `BI_Interno.pbix`. */
@Component({
  selector: 'app-bi-indicadores-abas',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, BiAbasPrincipaisComponent],
  template: `
    <h1 class="pagina-titulo">
      <svg class="svgi svgi-xl ic-brand" aria-hidden="true"><use href="#ic-dashboard"/></svg>
      BI
    </h1>

    <app-bi-abas-principais />

    <nav class="bi-abas">
      <a routerLink="/bi/implantacao" routerLinkActive="on"
         [routerLinkActiveOptions]="{ exact: true }">Previsão de Início Oficial</a>
      <a routerLink="/bi/implantacao/contratacao" routerLinkActive="on">Indicadores de Contratação</a>
      <a routerLink="/bi/implantacao/conclusao" routerLinkActive="on">Indicadores de Conclusão</a>
      <a routerLink="/bi/implantacao/utilizacao" routerLinkActive="on">% de Utilização das Horas</a>
      <a routerLink="/bi/implantacao/alocacao-calendario" routerLinkActive="on">Alocação de Agendas — Calendário</a>
      <a routerLink="/bi/implantacao/alocacao-horas" routerLinkActive="on">Alocação de Agendas — Horas Aplicadas</a>
      <a routerLink="/bi/implantacao/movimentos" routerLinkActive="on">Movimentos de trabalho efetivo</a>
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
export class BiIndicadoresAbasComponent {}
