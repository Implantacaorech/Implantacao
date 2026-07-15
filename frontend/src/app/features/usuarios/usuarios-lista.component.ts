import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Usuario } from '../../core/models/usuario.model';
import { UsuariosService } from '../../core/services/usuarios.service';

@Component({
  selector: 'app-usuarios-lista',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './usuarios-lista.component.html',
  styleUrl: './usuarios-lista.component.css',
})
export class UsuariosListaComponent {
  private readonly service = inject(UsuariosService);

  readonly usuarios = signal<Usuario[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.usuarios.set(await this.service.listar());
    } catch {
      this.erro.set('Não foi possível carregar os usuários.');
    } finally {
      this.carregando.set(false);
    }
  }
}
