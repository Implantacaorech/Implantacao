import { Component, signal } from '@angular/core';
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

  /** Visibilidade do painel "Preencher protocolo". */
  readonly mostrarPreencher = signal(false);
}
