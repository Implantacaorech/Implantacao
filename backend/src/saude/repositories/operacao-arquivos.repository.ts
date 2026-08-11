import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { AppConfig } from '../../config/configuration';

/** Um zip de dump encontrado na pasta de operação. */
export interface ArquivoBackup {
  nome: string;
  bytes: number;
  modificadoEm: Date;
}

/** Uma linha do log do Guardião (`dd/MM/yyyy HH:mm:ss - mensagem`). */
export interface ReinicioGuardiao {
  quando: Date;
  mensagem: string;
}

const PREFIXO_ZIP = 'painel_novo_mariadb_';
const LOG_BACKUP = 'backup_novo_mariadb.log';
const LOG_GUARDIAO = 'guardiao_novo.log';

/** Acesso aos artefatos que a operação deixa em disco: os zips do dump e os logs do backup
 * e do Guardião. É a camada Repository do módulo — o Service não conhece caminho de arquivo
 * nem formato de linha de log (Guia Mestre §Responsabilidades).
 *
 * Tudo aqui é **tolerante a falha**: pasta inexistente, arquivo travado por outro processo
 * ou linha ilegível devolvem vazio, nunca exceção. Uma tela de saúde que quebra porque não
 * conseguiu ler um log é pior do que não ter tela nenhuma — ela some justamente quando algo
 * está errado na máquina. */
@Injectable()
export class OperacaoArquivosRepository {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  pasta(): string {
    return this.config.get('backupDir', { infer: true });
  }

  /** O zip de dump mais recente, ou null se não houver nenhum (ou a pasta não existir). */
  ultimoBackup(): ArquivoBackup | null {
    let nomes: string[];
    try {
      nomes = readdirSync(this.pasta());
    } catch {
      return null; // pasta ausente: quem interpreta é o Service
    }
    let recente: ArquivoBackup | null = null;
    for (const nome of nomes) {
      if (!(nome.startsWith(PREFIXO_ZIP) && nome.endsWith('.zip'))) continue;
      try {
        const st = statSync(join(this.pasta(), nome));
        if (!recente || st.mtimeMs > recente.modificadoEm.getTime()) {
          recente = {
            nome,
            bytes: st.size,
            modificadoEm: new Date(st.mtimeMs),
          };
        }
      } catch {
        continue; // arquivo sumiu entre o readdir e o stat
      }
    }
    return recente;
  }

  /** Linhas de ERRO do log do backup a partir de `desde`. O script grava
   * `yyyy-MM-dd HH:mm:ss ERRO -> motivo`. */
  errosDeBackup(desde: Date): string[] {
    const achados: string[] = [];
    for (const linha of this.linhas(LOG_BACKUP)) {
      if (!linha.includes('ERRO')) continue;
      const quando = this.dataIso(linha);
      if (quando && quando >= desde) achados.push(linha.trim());
    }
    return achados;
  }

  /** Reinícios registrados pelo Guardião a partir de `desde`. */
  reiniciosDoGuardiao(desde: Date): ReinicioGuardiao[] {
    const achados: ReinicioGuardiao[] = [];
    for (const linha of this.linhas(LOG_GUARDIAO)) {
      const quando = this.dataBr(linha);
      if (!quando || quando < desde) continue;
      const traco = linha.indexOf(' - ');
      achados.push({
        quando,
        mensagem: traco >= 0 ? linha.slice(traco + 3).trim() : linha.trim(),
      });
    }
    return achados;
  }

  /** Lê um log da pasta de operação e devolve as linhas legíveis.
   *
   * ⚠️ O `backup_novo_mariadb.log` tem **encoding misturado** — parte dele foi gravada em
   * UTF-16 por uma versão antiga do script, e é justamente onde estão as linhas de ERRO dos
   * 4 dias de falha de 2026-07-30 a 02/08 (foi por isso que passaram despercebidas: quem
   * abria o arquivo via caracteres chineses). Aqui cada linha é decodificada por conta
   * própria e o que não fizer sentido é descartado, em vez de contaminar a leitura inteira.
   * O script já foi corrigido para gravar UTF-8 sem BOM daqui para frente. */
  private linhas(arquivo: string): string[] {
    let bruto: Buffer;
    try {
      bruto = readFileSync(join(this.pasta(), arquivo));
    } catch {
      return [];
    }
    return this.decodificar(bruto)
      .split(/\r?\n/)
      .map((l) => this.semBom(l).trim())
      .filter((l) => l.length > 0 && !this.ilegivel(l));
  }

  /** Tira o BOM (U+FEFF) do comeco da linha. Feito por codigo, e nao com o caractere
   * literal num regex: um BOM solto no fonte e invisivel no editor, e o lint o recusa
   * com razao. Ele aparece porque o `Out-File -Encoding utf8` da PowerShell 5.1 carimba
   * um a cada append. */
  private semBom(linha: string): string {
    return linha.charCodeAt(0) === 0xfeff ? linha.slice(1) : linha;
  }

  /** UTF-16LE se houver BOM ou uma densidade alta de bytes nulos (todo caractere ASCII em
   * UTF-16 vem seguido de `00`); UTF-8 no resto dos casos. */
  private decodificar(bruto: Buffer): string {
    const temBomUtf16 =
      bruto.length >= 2 && bruto[0] === 0xff && bruto[1] === 0xfe;
    const amostra = bruto.subarray(0, 4096);
    const nulos = amostra.filter((b) => b === 0).length;
    if (temBomUtf16 || (amostra.length > 0 && nulos / amostra.length > 0.25)) {
      return bruto.toString('utf16le');
    }
    return bruto.toString('utf8');
  }

  /** Texto que sobrou de uma decodificação errada (o caso do log misturado): quase nenhum
   * caractere latino. Descartar é melhor do que exibir lixo numa tela de diagnóstico. */
  private ilegivel(linha: string): boolean {
    const latinos = (linha.match(/[\x20-\x7EÀ-ÿ]/g) ?? []).length;
    return latinos / linha.length < 0.6;
  }

  /** `yyyy-MM-dd HH:mm:ss` no começo da linha (log do backup, escrito pelo PowerShell). */
  private dataIso(linha: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(linha);
    return m ? this.montar(m, { ano: 1, mes: 2, dia: 3 }) : null;
  }

  /** `dd/MM/yyyy HH:mm:ss` no começo da linha (log do Guardião: é o `Now` do VBScript, que
   * sai no formato do Windows em pt-BR). */
  private dataBr(linha: string): Date | null {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})[ ,]+(\d{2}):(\d{2}):(\d{2})/.exec(
      linha,
    );
    return m ? this.montar(m, { ano: 3, mes: 2, dia: 1 }) : null;
  }

  private montar(
    m: RegExpExecArray,
    pos: { ano: number; mes: number; dia: number },
  ): Date | null {
    const d = new Date(
      Number(m[pos.ano]),
      Number(m[pos.mes]) - 1,
      Number(m[pos.dia]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6]),
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }
}
