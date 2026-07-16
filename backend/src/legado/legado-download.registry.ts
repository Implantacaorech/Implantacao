import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { basename } from 'path';

interface ArquivoRegistrado {
  caminho: string;
  nome: string;
}

/** Registro em memória (token opaco -> caminho absoluto) para os arquivos gerados pelo
 * assistente legado — evita expor caminho de disco ao cliente (equivalente seguro do
 * `url_for('download', path=...)` do Flask, que passava o caminho absoluto na URL). */
@Injectable()
export class LegadoDownloadRegistry {
  private readonly arquivos = new Map<string, ArquivoRegistrado>();

  registrar(caminho: string, nome?: string): string {
    const token = randomUUID();
    this.arquivos.set(token, { caminho, nome: nome ?? basename(caminho) });
    return token;
  }

  obter(token: string): ArquivoRegistrado | undefined {
    return this.arquivos.get(token);
  }
}
