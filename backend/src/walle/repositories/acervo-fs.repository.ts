import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { AppConfig } from '../../config/configuration';

/** Um arquivo visto na fonte (share), ainda sem conteúdo — só o necessário para o controle
 * incremental decidir se precisa ler/reindexar. */
export interface ArquivoFonte {
  /** Relativo à raiz do acervo, sempre com `/` (chave estável entre Windows e testes). */
  caminhoRelativo: string;
  chatCodigo: number;
  nome: string;
  /** Minúscula, sem ponto. */
  extensao: string;
  tamanhoBytes: number;
  modificadoEm: Date;
}

/** Acesso ao acervo documental dos chats do Wall-e (`R:\GRM\CHAT_WALLE\` por padrão).
 *
 * ⚠️ REGRA INEGOCIÁVEL: a fonte é oficial e SOMENTE LEITURA. Este repository usa
 * exclusivamente APIs de leitura (`readdir`/`stat`/`readFile`) — nenhum método de escrita
 * existe aqui, e nenhum outro ponto do Painel toca essa pasta. Todo derivado (índice, hash,
 * texto extraído) vive no banco do Painel.
 *
 * Tolerante a falha, no molde do `saude/repositories/operacao-arquivos.repository.ts`:
 * share fora do ar ou arquivo travado ⇒ lista vazia/`null`, nunca exceção — quem decide o
 * que isso significa é o Service. */
@Injectable()
export class AcervoFsRepository {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  raiz(): string {
    return this.config.get('walleAcervoDir', { infer: true });
  }

  disponivel(): boolean {
    try {
      return existsSync(this.raiz());
    } catch {
      return false;
    }
  }

  /** Varre a fonte: uma subpasta NUMÉRICA por chat, arquivos em qualquer profundidade
   * (subpastas não numéricas dentro do chat são percorridas; ocultas são ignoradas). */
  listar(): ArquivoFonte[] {
    const achados: ArquivoFonte[] = [];
    let chats: string[];
    try {
      chats = readdirSync(this.raiz(), { withFileTypes: true })
        .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
        .map((e) => e.name);
    } catch {
      return achados;
    }
    for (const chat of chats) {
      this.coletar(join(this.raiz(), chat), chat, Number(chat), achados);
    }
    return achados;
  }

  private coletar(
    dir: string,
    relativo: string,
    chatCodigo: number,
    saida: ArquivoFonte[],
  ): void {
    let entradas;
    try {
      entradas = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // pasta sumiu/travou no meio da varredura — segue com o que deu
    }
    for (const e of entradas) {
      if (e.name.startsWith('.')) continue;
      const caminho = join(dir, e.name);
      const rel = `${relativo}/${e.name}`;
      if (e.isDirectory()) {
        this.coletar(caminho, rel, chatCodigo, saida);
        continue;
      }
      if (!e.isFile()) continue;
      try {
        const st = statSync(caminho);
        const ponto = e.name.lastIndexOf('.');
        saida.push({
          caminhoRelativo: rel,
          chatCodigo,
          nome: e.name,
          extensao: ponto > 0 ? e.name.slice(ponto + 1).toLowerCase() : '',
          tamanhoBytes: st.size,
          modificadoEm: st.mtime,
        });
      } catch {
        // stat falhou (arquivo em uso/removido durante a varredura) — pula sem derrubar
      }
    }
  }

  /** Lê o conteúdo bruto de um arquivo do acervo. `null` se não deu (fonte fora, caminho
   * inválido ou tentativa de sair da raiz — proteção contra path traversal). */
  ler(caminhoRelativo: string): Buffer | null {
    if (caminhoRelativo.includes('..')) return null;
    try {
      return readFileSync(join(this.raiz(), caminhoRelativo));
    } catch {
      return null;
    }
  }
}
