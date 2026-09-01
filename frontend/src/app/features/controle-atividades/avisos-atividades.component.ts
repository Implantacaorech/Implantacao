import {
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ControleAtividadesService } from '../../core/services/controle-atividades.service';
import { PermissoesService } from '../../core/services/permissoes.service';
import { AvisoAtividade } from '../../core/models/controle-atividades.model';

/** Intervalo de consulta. Um minuto é o compromisso entre "chegou na hora" e não bater no
 * backend à toa — o aviso é persistente, então nada se perde entre uma consulta e outra. */
const INTERVALO_MS = 60_000;

/** Pop-up de avisos do Controle de Atividades, no canto inferior direito (decisão do
 * usuário, 2026-09-01).
 *
 * **Fica aberto até a pessoa fechar** — não some sozinho. É por isso que o aviso é uma linha
 * no banco (`atividade_notificacoes`) e não um evento em memória: fechar precisa valer entre
 * sessões, máquinas e reinícios do Painel, e um aviso que somesse ao recarregar a página
 * seria pior que nenhum.
 *
 * Clicar abre o cartão. Mora no shell, então acompanha o consultor por todas as telas. */
@Component({
  selector: 'app-avisos-atividades',
  standalone: true,
  templateUrl: './avisos-atividades.component.html',
  styleUrl: './avisos-atividades.component.css',
})
export class AvisosAtividadesComponent implements OnDestroy {
  private readonly api = inject(ControleAtividadesService);
  private readonly perm = inject(PermissoesService);
  private readonly router = inject(Router);

  readonly avisos = signal<AvisoAtividade[]>([]);
  /** Mostra no máximo 3 de uma vez — uma pilha maior cobriria a tela em vez de avisar. */
  readonly visiveis = computed(() => this.avisos().slice(0, 3));
  readonly restantes = computed(() => Math.max(0, this.avisos().length - 3));

  private temporizador: ReturnType<typeof setInterval> | null = null;

  constructor() {
    void this.iniciar();
  }

  ngOnDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  private async iniciar(): Promise<void> {
    await this.perm.garantirCarregado();
    // Sem acesso ao menu, não há o que avisar — e a chamada voltaria 403 a cada minuto.
    if (!this.perm.podeVer('controle_atividades')) return;
    await this.consultar();
    this.temporizador = setInterval(() => void this.consultar(), INTERVALO_MS);
  }

  private async consultar(): Promise<void> {
    try {
      this.avisos.set(await this.api.avisos());
    } catch {
      // Falha de rede não pode encher o console nem quebrar a tela por baixo: o aviso é
      // acessório, e a próxima consulta tenta de novo.
    }
  }

  async fechar(id: number): Promise<void> {
    this.avisos.update((lista) => lista.filter((a) => a.id !== id));
    try {
      await this.api.fecharAvisos([id]);
    } catch {
      // Se não conseguiu marcar como lido, o aviso volta na próxima consulta — que é o
      // comportamento certo: some da tela agora, mas não se perde.
    }
  }

  async fecharTodos(): Promise<void> {
    this.avisos.set([]);
    try {
      await this.api.fecharAvisos();
    } catch {
      // idem
    }
  }

  async abrir(aviso: AvisoAtividade): Promise<void> {
    await this.fechar(aviso.id);
    void this.router.navigate(['/atividades', aviso.codigoClienteSicla]);
  }
}
