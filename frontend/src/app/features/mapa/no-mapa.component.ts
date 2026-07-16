import { Component, input } from '@angular/core';

export interface NoMapa {
  nome: string;
  filhos?: NoMapa[];
}

@Component({
  selector: 'app-no-mapa',
  standalone: true,
  imports: [NoMapaComponent],
  template: `
    @if (no().filhos && no().filhos!.length > 0) {
      <details class="mm-node mm-l{{ nivel() }}" [open]="nivel() < 1">
        <summary>{{ no().nome }}</summary>
        <div class="mm-kids">
          @for (f of no().filhos!; track f.nome) {
            <app-no-mapa [no]="f" [nivel]="nivel() + 1" />
          }
        </div>
      </details>
    } @else {
      <div class="mm-leaf">{{ no().nome }}</div>
    }
  `,
})
export class NoMapaComponent {
  readonly no = input.required<NoMapa>();
  readonly nivel = input(0);
}
