import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { ConsultaBdService } from '../disponibilidade/consulta-bd.service';
import {
  ModuloSicla,
  NOME_BUSCA_MODULO,
  SLUG_BUSCA_MODULO,
  SQL_BUSCA_MODULO_PADRAO,
} from './modulos-sicla.constants';

export interface ResultadoBuscaModulo {
  ok: boolean;
  mensagem: string;
  modulos: ModuloSicla[];
}

/** Busca de módulos/adicionais no SICLA para o passo 1. Reusa o motor Oracle da
 * Disponibilidade (`executarSql`); o SQL é editável (consulta nomeada) com default embutido. */
@Injectable()
export class ModulosSiclaService implements OnModuleInit {
  private readonly logger = new Logger('ModulosSiclaService');

  constructor(
    private readonly disponibilidade: DisponibilidadeService,
    private readonly consultas: ConsultaBdService,
  ) {}

  /** Semeia o SQL (idempotente) para o Administrador editar na tela de Consultas BD. */
  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const existe = await this.consultas.porSlug(SLUG_BUSCA_MODULO);
      if (!existe) {
        await this.consultas.salvar(SLUG_BUSCA_MODULO, {
          nome: NOME_BUSCA_MODULO,
          sql: SQL_BUSCA_MODULO_PADRAO,
          ordem: 98,
          mostrarGrafico: false,
        });
      }
    } catch (e) {
      this.logger.error(
        'Falha ao semear a consulta de busca de módulo no SICLA',
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  private async sqlBusca(): Promise<string> {
    const c = await this.consultas.porSlug(SLUG_BUSCA_MODULO);
    const sql = (c?.sql ?? '').trim();
    return sql || SQL_BUSCA_MODULO_PADRAO;
  }

  async buscar(termoBruto: string): Promise<ResultadoBuscaModulo> {
    const termo = (termoBruto ?? '').trim();
    if (termo.length < 1) {
      return {
        ok: false,
        mensagem: 'Digite ao menos 1 caractere para buscar.',
        modulos: [],
      };
    }
    const sql = await this.sqlBusca();
    const r = await this.disponibilidade.executarSql(
      sql,
      { termo: `%${termo}%` },
      undefined,
      200,
    );
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
