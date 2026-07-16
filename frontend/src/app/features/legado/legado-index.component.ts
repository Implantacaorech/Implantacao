import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROLES_LEGADO } from '../../core/models/legado.model';

@Component({
  selector: 'app-legado-index',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './legado-index.component.html',
  styleUrl: './legado-index.component.css',
})
export class LegadoIndexComponent {
  readonly roles = ROLES_LEGADO;
}
