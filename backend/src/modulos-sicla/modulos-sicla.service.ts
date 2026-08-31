import { Injectable } from '@nestjs/common';
import { DadosService } from '../dados/dados.service';
import { ModuloSicla } from './modulos-sicla.constants';

export interface ResultadoBuscaModulo {
  ok: boolean;
  mensagem: string;
  modulos: ModuloSicla[];
}

/** Busca de módulos/adicionais no SICLA para o passo 1.
 *
 * Pede a consulta `sicla.modulos.buscar` à API de Dados (ADR-0003) — não conhece SQL,
 * conexão nem teto de linhas. O que resta aqui é a REGRA: validar o termo e resolver o
 * código efetivo (adicional quando há, senão módulo). */
@Injectable()
export class ModulosSiclaService {
  constructor(private readonly dados: DadosService) {}

  async buscar(termoBruto: string): Promise<ResultadoBuscaModulo> {
    const termo = (termoBruto ?? '').trim();
    if (termo.length < 1) {
      return {
        ok: false,
        mensagem: 'Digite ao menos 1 caractere para buscar.',
        modulos: [],
      };
    }
    // Termo CRU: o curinga `%` do LIKE é aplicado pelo catálogo (parâmetro `texto_busca`).
    const r = await this.dados.consultar('sicla.modulos.buscar', { termo });
    if (!r.ok) {
      return { ok: false, mensagem: r.mensagem, modulos: [] };
    }
    return {
      ok: true,
      mensagem: r.mensagem,
      modulos: r.linhas.map((row) => this.mapear(row)),
    };
  }

  /** Converte com segurança um valor de coluna (string/número/data) em texto. */
  private texto(v: unknown): string {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return '';
  }

  /** Aplica a regra do usuário: código efetivo = adicional (se houver) ou módulo. Monta um
   * rótulo legível com módulo + adicional. */
  private mapear(row: Record<string, unknown>): ModuloSicla {
    const pega = (...chaves: string[]): string => {
      for (const k of chaves) {
        const t = this.texto(
          row[k] ?? row[k.toUpperCase()] ?? row[k.toLowerCase()],
        );
        if (t !== '') return t;
      }
      return '';
    };
    const codModulo = pega(
      'CODMODULO',
      'CODMOD',
      'CODIGOMODULO',
      'CODIGO_MODULO',
    );
    const descModulo = pega(
      'MODULO',
      'DESCMODULO',
      'DESCRICAOMODULO',
      'DESCRICAO_MODULO',
      'DESCMOD',
    );
    const codAdicional = pega(
      'CODADICIONAL',
      'CODADIC',
      'CODIGOADICIONAL',
      'CODIGO_ADICIONAL',
    );
    const descAdicional = pega(
      'ADICIONAL',
      'DESCADICIONAL',
      'DESCRICAOADICIONAL',
      'DESCRICAO_ADICIONAL',
      'DESCADIC',
    );

    // Regra do usuário: tem adicional -> vale o código do adicional; senão, o do módulo.
    const codigo = codAdicional || codModulo;
    const descricao = descAdicional
      ? `${descModulo || codModulo} · ${descAdicional}`
      : descModulo || codModulo;

    return {
      codModulo,
      descModulo,
      codAdicional,
      descAdicional,
      codigo,
      descricao,
      bruto: row,
    };
  }
}
