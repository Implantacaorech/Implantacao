import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { PreencherProtocoloComponent } from './preencher-protocolo.component';

/** Tela Execução → Protocolo. Moldura do Portal Rech dentro do Painel: o site permite ser
 * emoldurado (sem X-Frame-Options/CSP `frame-ancestors`, verificado em 2026-08-13), então
 * a página de login abre embutida num iframe; o botão "Abrir em nova guia" atende quem
 * precisa da janela cheia. O botão "Preencher protocolo" abre um painel que monta o rascunho
 * do Registro de Atendimento em Visita a partir de uma transcrição/gravação (Caminho A). */
@Component({
  selector: 'app-protocolo',
  standalone: true,
  imports: [PreencherProtocoloComponent],
  templateUrl: './protocolo.component.html',
  styleUrl: './protocolo.component.css',
})
export class ProtocoloComponent {
  /** Endereço público do Portal Rech — usado no botão de nova guia. O `src` do iframe
   * repete o literal como atributo estático: binding de resource URL exigiria passar pelo
   * DomSanitizer sem necessidade. */
  readonly urlPortal = 'https://portalrech.com.br/login';

  /** Lista de visitas do Portal — para onde a moldura vai após criar um rascunho, para o
   * novo registro pendente aparecer. */
  private readonly urlPortalLista = 'https://portalrech.com.br/protocolo/lista';

  /** Referência ao iframe do Portal, para recarregá-lo após criar a visita. */
  private readonly portalFrame =
    viewChild<ElementRef<HTMLIFrameElement>>('portalFrame');

  /** Visibilidade do painel "Preencher protocolo". */
  readonly mostrarPreencher = signal(false);

  /** Chamado quando o painel cria a visita (rascunho pendente): fecha o painel e atualiza a
   * página do Portal para o novo registro aparecer. Definir `src` direto no elemento nativo
   * não passa pelo sanitizer do Angular (não é binding), então não precisa do DomSanitizer. */
  onProtocoloCriado(): void {
    this.mostrarPreencher.set(false);
    const frame = this.portalFrame()?.nativeElement;
    if (frame) frame.src = this.urlPortalLista;
  }
}
