import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LegadoService } from '../../core/services/legado.service';
import { LegadoClienteEstadoService } from '../../core/services/legado-cliente-estado.service';
import { CAMPOS_CLIENTE } from '../../core/models/legado.model';

@Component({
  selector: 'app-legado-cliente',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './cliente.component.html',
  styleUrl: './cliente.component.css',
})
export class ClienteComponent {
  private readonly service = inject(LegadoService);
  private readonly clienteEstado = inject(LegadoClienteEstadoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly campos = CAMPOS_CLIENTE;
  readonly atual = this.clienteEstado.atual;
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);

  valores: Record<string, string> = {};

  async salvar(): Promise<void> {
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.definirCliente(this.valores);
      this.clienteEstado.definir(r.arquivo, r.nome);
      const next = this.route.snapshot.queryParamMap.get('next');
      await this.router.navigateByUrl(next || '/home');
    } catch {
      this.erro.set('Não foi possível salvar os dados do cliente.');
    } finally {
      this.salvando.set(false);
    }
  }
}
