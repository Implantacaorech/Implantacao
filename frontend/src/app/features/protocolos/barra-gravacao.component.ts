import { Component, HostListener, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GravacaoEmAndamentoService } from '../../core/audio/gravacao-em-andamento.service';

/** Barra fixa da gravação em andamento — fica no shell, então acompanha o usuário por
 * TODAS as telas do portal.
 *
 * Existe por um motivo de uso real: quem grava a reunião de levantamento passa a reunião
 * inteira preenchendo o formulário, abrindo a ficha do projeto, consultando o cronograma.
 * Sem a barra, pausar ou encerrar exigiria voltar à tela de gravação — e, antes de a
 * gravação virar serviço de aplicação, sair da tela simplesmente matava o áudio. */
@Component({
  selector: 'app-barra-gravacao',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (g.ativa()) {
      <div class="barra-grav" role="status">
        <span class="ponto" aria-hidden="true"></span>
        <span class="tempo">{{ g.formatarDuracao(g.duracaoSeg()) }}</span>

        <div class="medidor" aria-hidden="true">
          <div class="medidor-nivel" [style.width.%]="g.nivel() * 100"></div>
        </div>

        <span class="rotulo">
          @if (g.cliente()) {
            <strong>{{ g.cliente() }}</strong>
          } @else {
            Gravando reunião
          }
          @if (g.pausado()) { <em>· em pausa</em> }
          @if (g.enviando() > 0) { <em>· enviando</em> }
        </span>

        <span class="espaco"></span>

        @if (g.fase() === 'gravando') {
          <button type="button" class="acao" (click)="g.alternarPausa()">
            {{ g.pausado() ? '▶ Retomar' : '⏸ Pausar' }}
          </button>
          <button type="button" class="acao forte" (click)="encerrar()">⏹ Encerrar</button>
          <a class="acao" routerLink="/protocolos/gravar">Abrir</a>
        } @else {
          <span class="rotulo">Encerrando e montando o resumo…</span>
        }
      </div>
    }
  `,
  styles: [
    `
      .barra-grav {
        position: sticky;
        top: 0;
        z-index: 50;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 14px;
        background: #7f1d1d;
        color: #fff;
        font-size: 0.86rem;
      }
      /* Vermelho pulsando: a gravação precisa ser impossível de esquecer ligada — o
         usuário vai passar a reunião inteira em outras telas. */
      .ponto {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #fca5a5;
        animation: bg-pulsa 1.4s ease-in-out infinite;
      }
      @keyframes bg-pulsa {
        50% { opacity: 0.25; }
      }
      .tempo {
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        font-size: 1rem;
      }
      .medidor {
        width: 90px;
        height: 6px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.25);
      }
      .medidor-nivel {
        height: 100%;
        background: #fecaca;
        transition: width 0.12s linear;
      }
      .rotulo em { font-style: normal; opacity: 0.85; }
      .espaco { flex: 1; }
      .acao {
        border: 1px solid rgba(255, 255, 255, 0.55);
        background: transparent;
        color: #fff;
        border-radius: 6px;
        padding: 4px 10px;
        font: inherit;
        cursor: pointer;
        text-decoration: none;
      }
      .acao:hover { background: rgba(255, 255, 255, 0.15); }
      .acao.forte { background: #fff; color: #7f1d1d; font-weight: 600; }
      @media (max-width: 720px) {
        .medidor, .rotulo { display: none; }
      }
    `,
  ],
})
export class BarraGravacaoComponent {
  readonly g = inject(GravacaoEmAndamentoService);
  private readonly router = inject(Router);

  /** Fechar a aba (ou F5) mata a captura: o áudio já enviado fica salvo, mas o restante da
   * reunião se perde. O aviso vive AQUI, e não na tela de gravação, justamente porque o
   * usuário estará em outra tela quase o tempo todo. */
  @HostListener('window:beforeunload', ['$event'])
  avisarSaida(ev: BeforeUnloadEvent): void {
    if (this.g.ativa()) ev.preventDefault();
  }

  async encerrar(): Promise<void> {
    await this.g.encerrar();
    // Leva para a tela da gravação, onde fica o resultado e o link da revisão.
    void this.router.navigate(['/protocolos/gravar']);
  }
}
