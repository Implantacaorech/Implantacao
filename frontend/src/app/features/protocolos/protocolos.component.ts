import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProtocoloService } from '../../core/services/protocolo.service';
import { PROTO_MODULOS, PROTO_STATUS, Protocolo } from '../../core/models/protocolo.model';

@Component({
  selector: 'app-protocolos',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './protocolos.component.html',
  styleUrl: './protocolos.component.css',
})
export class ProtocolosComponent {
  private readonly service = inject(ProtocoloService);

  readonly modulos = PROTO_MODULOS;
  readonly statusOpcoes = PROTO_STATUS;

  readonly carregando = signal(true);
  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly itens = signal<Protocolo[]>([]);
  readonly roboOk = signal(true);
  readonly pasta = signal('');

  fModulo = '';
  fMenu = '';
  fStatus = '';
  fOrigem = '';
  fQ = '';

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.listar({
        modulo: this.fModulo,
        menu: this.fMenu,
        status: this.fStatus,
        origem: this.fOrigem,
        q: this.fQ,
      });
      this.itens.set(r.itens);
      this.roboOk.set(r.roboOk);
      this.pasta.set(r.pasta);
    } catch {
      this.erro.set('Não foi possível carregar os protocolos.');
    } finally {
      this.carregando.set(false);
    }
  }

  async enviarArquivo(input: HTMLInputElement): Promise<void> {
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    this.enviando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const r = await this.service.enviar(arquivo);
      this.aviso.set(r.aviso);
      input.value = '';
      await this.carregar();
    } catch {
      this.erro.set('Não foi possível enviar o arquivo.');
    } finally {
      this.enviando.set(false);
    }
  }

  formatarData(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
}
