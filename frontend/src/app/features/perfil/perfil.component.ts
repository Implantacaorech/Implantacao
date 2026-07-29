import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { temPapel } from '../../core/constants/perfis';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css',
})
export class PerfilComponent {
  private readonly auth = inject(AuthService);

  readonly usuario = this.auth.usuario;
  readonly ehAdm = computed(() => temPapel(this.usuario(), 'ADM'));

  sair(): void {
    void this.auth.logout();
  }
}
