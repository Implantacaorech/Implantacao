import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProtocoloService } from '../../core/services/protocolo.service';
import {
  PROTO_MODULOS,
  PROTO_STATUS,
  Protocolo,
  ROTULO_ORIGEM,
  VideoOrigem,
} from '../../core/models/protocolo.model';
import { deCamposDe, filtrosSalvos } from '../../core/utils/filtros-salvos';

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
  readonly podeExcluir = signal(false);
  readonly excluindo = signal<number | null>(null);

  fModulo = '';
  fMenu = '';
  fStatus = '';
  fOrigem = '';
  fCliente = '';
  fQ = '';

  /** Filtros salvos por usuário logado. São propriedades comuns (o `[(ngModel)]` escreve
   * direto), então a gravação é explícita — feita no `carregar()`, que é exatamente o momento
   * em que o filtro passa a valer no servidor. */
  private readonly salvos = filtrosSalvos(
    'protocolos',
    deCamposDe(this, 'fModulo', 'fMenu', 'fStatus', 'fOrigem', 'fCliente', 'fQ'),
    { aoRestaurar: () => void this.carregar() },
  );

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.salvos.salvar();
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.listar({
        modulo: this.fModulo,
        menu: this.fMenu,
        status: this.fStatus,
        origem: this.fOrigem,
        cliente: this.fCliente,
        q: this.fQ,
      });
      this.itens.set(r.itens);
      this.roboOk.set(r.roboOk);
      this.pasta.set(r.pasta);
      this.podeExcluir.set(r.podeExcluir);
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

  async excluir(p: Protocolo): Promise<void> {
    if (
      !confirm(
        `Excluir definitivamente "${p.titulo || p.videoNome}"? O registro e o arquivo de vídeo/áudio original serão apagados — não é possível desfazer.`,
      )
    ) {
      return;
    }
    this.excluindo.set(p.id);
    this.erro.set(null);
    try {
      await this.service.excluir(p.id);
      await this.carregar();
    } catch {
      this.erro.set('Não foi possível excluir o protocolo.');
    } finally {
      this.excluindo.set(null);
    }
  }

  rotuloOrigem(origem: VideoOrigem): string {
    return ROTULO_ORIGEM[origem] ?? origem;
  }

  formatarData(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
}
