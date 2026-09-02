import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PresencaService } from '../../core/services/presenca.service';
import { PanoramaPresenca, UsuarioOnline } from '../../core/models/presenca.model';

/** De quanto em quanto tempo a TELA se atualiza. Mais curto que a batida do navegador
 * (45s) de propósito: quem acompanha quer ver o movimento, não um retrato parado. */
const ATUALIZA_MS = 15_000;

/** Sistema → Usuários → Online: quem está no Painel agora e em que tela.
 *
 * Só Administrador (a rota tem `perfilGuard('ADM')` e o backend revalida com `@Roles`). */
@Component({
  selector: 'app-online',
  standalone: true,
  templateUrl: './online.component.html',
  styleUrl: './online.component.css',
})
export class OnlineComponent implements OnDestroy {
  private readonly api = inject(PresencaService);
  private readonly router = inject(Router);

  readonly carregando = signal(true);
  readonly erro = signal('');
  readonly panorama = signal<PanoramaPresenca | null>(null);
  readonly expandido = signal<number | null>(null);

  private temporizador: ReturnType<typeof setInterval> | null = null;

  constructor() {
    void this.carregar();
    this.temporizador = setInterval(() => void this.carregar(true), ATUALIZA_MS);
  }

  ngOnDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  readonly usuarios = computed<UsuarioOnline[]>(() => this.panorama()?.usuarios ?? []);
  readonly ativos = computed(() => this.usuarios().filter((u) => !u.ocioso).length);
  readonly ociosos = computed(() => this.usuarios().filter((u) => u.ocioso).length);

  /** `silencioso` evita piscar "Carregando…" a cada 15 segundos. */
  async carregar(silencioso = false): Promise<void> {
    if (!silencioso) this.carregando.set(true);
    try {
      this.panorama.set(await this.api.panorama());
      this.erro.set('');
    } catch {
      this.erro.set('Não foi possível carregar quem está online.');
    } finally {
      this.carregando.set(false);
    }
  }

  alternar(usuarioId: number): void {
    this.expandido.set(this.expandido() === usuarioId ? null : usuarioId);
  }

  voltar(): void {
    void this.router.navigate(['/usuarios']);
  }

  /** "agora", "há 40s", "há 3 min" — tempo curto é o que interessa numa tela ao vivo. */
  desde(segundos: number): string {
    if (segundos < 10) return 'agora';
    if (segundos < 60) return `há ${segundos}s`;
    const min = Math.floor(segundos / 60);
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    return `há ${h}h${String(min % 60).padStart(2, '0')}`;
  }

  /** Só o nome do navegador — o user-agent inteiro não cabe e não diz mais nada útil. */
  navegador(ua: string): string {
    if (/Edg\//.test(ua)) return 'Edge';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Safari\//.test(ua)) return 'Safari';
    return ua ? 'Outro' : '—';
  }
}
