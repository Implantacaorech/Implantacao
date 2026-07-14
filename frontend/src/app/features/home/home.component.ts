import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PainelService } from '../../core/services/painel.service';
import { ItemPendenciaHome, PainelHome } from '../../core/models/painel.model';

/** Resolve a rota da próxima ação a partir do `tipo` (contrato definido no backend —
 * ver docs/migracao/03-documento-conversao.md, HomeService). Ainda não há tela dedicada
 * para todo tipo de ação (Designação/geração de documento) — nesses casos cai na ficha
 * do projeto, que já existe. Atualizar aqui conforme as telas forem sendo construídas. */
function rotaAcao(item: ItemPendenciaHome): (string | number)[] {
  switch (item.tipo) {
    case 'acao:definir_gci':
      return ['/projetos', item.id, 'designacao', 'definir-gci'];
    case 'acao:data_levantamento':
      return ['/projetos', item.id, 'designacao', 'agendar'];
    case 'acao:consultores_designacao':
    case 'acao:consultores':
      return ['/projetos', item.id, 'designacao', 'consultores'];
    default:
      return ['/projetos', item.id];
  }
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly service = inject(PainelService);

  readonly dados = signal<PainelHome | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.dados.set(await this.service.home());
    } catch {
      this.erro.set('Não foi possível carregar o painel.');
    } finally {
      this.carregando.set(false);
    }
  }

  rotaAcao(item: ItemPendenciaHome): (string | number)[] {
    return rotaAcao(item);
  }
}
