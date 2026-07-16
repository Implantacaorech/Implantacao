import { Injectable, signal } from '@angular/core';

const CHAVE = 'legado_cliente';

interface ClienteEstado {
  arquivo: string;
  nome: string;
}

// Equivalente ao session["cliente_yaml"]/session["cliente_nome"] do Flask — como o backend
// novo é stateless (JWT), o "cliente atual" do assistente legado vive no sessionStorage do
// navegador (mesmo escopo de vida: dura a aba, some ao fechar).
@Injectable({ providedIn: 'root' })
export class LegadoClienteEstadoService {
  readonly atual = signal<ClienteEstado | null>(this.ler());

  private ler(): ClienteEstado | null {
    try {
      const bruto = sessionStorage.getItem(CHAVE);
      return bruto ? (JSON.parse(bruto) as ClienteEstado) : null;
    } catch {
      return null;
    }
  }

  definir(arquivo: string, nome: string): void {
    const estado: ClienteEstado = { arquivo, nome };
    sessionStorage.setItem(CHAVE, JSON.stringify(estado));
    this.atual.set(estado);
  }
}
