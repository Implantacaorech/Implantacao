import { Injectable } from '@nestjs/common';
import { DadosService } from '../dados/dados.service';
import { hojeIso } from '../cronograma/datas.util';
import { textoAparado } from '../common/utils/texto.util';
import {
  ContagemIndicador,
  LinhaIndicador,
  SerieMensal,
  TotaisIndicadores,
} from './bi-indicadores.constants';

export interface QueryIndicadores {
  /** Competência inicial/final (AAAA-MM) sobre a data de CONTRATAÇÃO. */
  compIni?: string;
  compFim?: string;
  posicao?: string[];
  tipoImplantacao?: string[];
  area?: string[];
  tipoSuporte?: string[];
  responsavel?: string[];
  grupo?: string[];
}

export interface FiltrosIndicadores {
  posicoes: string[];
  tiposImplantacao: string[];
  areas: string[];
  tiposSuporte: string[];
  responsaveis: string[];
  grupos: string[];
}

export interface ResultadoIndicadores {
  competencias: { inicio: string; fim: string };
  linhas: LinhaIndicador[];
  totais: TotaisIndicadores;
  /** Série por competência de CONTRATAÇÃO (Indicadores de Contratação). */
  porMesContratacao: SerieMensal[];
  /** Série por competência de ENCERRAMENTO (Indicadores de Conclusão). */
  porMesConclusao: SerieMensal[];
  porPosicao: ContagemIndicador[];
  porTipo: ContagemIndicador[];
  porResponsavel: ContagemIndicador[];
  filtros: FiltrosIndicadores;
  selecionados: FiltrosIndicadores;
  erro: string | null;
}

/** Quantos meses o filtro cobre por padrão. */
const MESES_PADRAO = 24;

/** Indicadores de Implantação (aba **BI Implantação**) — Contratação, Conclusão e
 * % de Utilização das Horas. As três páginas do `BI_Interno.pbix` compartilham a view
 * `POWERBI_IMP_RNIMPLANTACAO_2`, então um endpoint só as serve; cada tela recorta o que
 * precisa do mesmo payload. */
@Injectable()
export class BiIndicadoresService {
  constructor(private readonly dados: DadosService) {}

  private numero(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private texto(v: unknown): string {
    return textoAparado(v);
  }

  private arredondar(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /** `DD/MM/YYYY` → `AAAA-MM-DD`. Devolve '' se não casar o formato — a view é consistente
   * (0 fora do padrão em 2.889 linhas), mas um dado sujo não pode derrubar a tela. */
  private dataIso(v: unknown): string {
    const s = this.texto(v);
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
  }

  /** `AAAA/MM` → `AAAA-MM`. */
  private competencia(v: unknown): string {
    const s = this.texto(v);
    return /^\d{4}\/\d{2}$/.test(s) ? s.replace('/', '-') : '';
  }

  private ehCompetencia(v: string | undefined): boolean {
    return /^\d{4}-\d{2}$/.test((v ?? '').trim());
  }

  private somaMeses(comp: string, n: number): string {
    const [ano, mes] = comp.split('-').map(Number);
    const t = ano * 12 + (mes - 1) + n;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
  }

  /** Janela padrão: últimos 24 meses de contratação. */
  periodo(query: QueryIndicadores): { inicio: string; fim: string } {
    const fim = this.ehCompetencia(query.compFim)
      ? (query.compFim as string).trim()
      : hojeIso().slice(0, 7);
    const inicio = this.ehCompetencia(query.compIni)
      ? (query.compIni as string).trim()
      : this.somaMeses(fim, -MESES_PADRAO);
    return inicio <= fim ? { inicio, fim } : { inicio: fim, fim: inicio };
  }

  /** Meses cheios entre duas datas ISO (aproximação por dia do mês, como o BI faz). */
  private mesesEntre(iniIso: string, fimIso: string): number | null {
    if (!iniIso || !fimIso) return null;
    const [ai, mi, di] = iniIso.split('-').map(Number);
    const [af, mf, df] = fimIso.split('-').map(Number);
    const meses = (af - ai) * 12 + (mf - mi) + (df - di) / 30;
    return Math.round(meses * 100) / 100;
  }

  private normalizar(bruta: Record<string, unknown>): LinhaIndicador {
    const l: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bruta)) l[(k || '').toUpperCase()] = v;

    const hora = (min: unknown) => this.arredondar(this.numero(min) / 60);
    const contratadas = hora(l.MIN_CONTRATADOS);
    const realizadas = hora(l.MIN_REALIZADOS);
    const dataContratacao = this.dataIso(l.DT_CONTRATACAO);
    const dataEncerramento = this.dataIso(l.DT_ENCERRAMENTO);
    const posicao = this.texto(l.POSICAO);

    return {
      codigo: this.numero(l.CODIGO),
      descricao: this.texto(l.DESCRICAO),
      cliente:
        l.CLIENTE === null || l.CLIENTE === undefined
          ? null
          : this.numero(l.CLIENTE),
      fantasia: this.texto(l.FANTASIA),
      responsavel: this.texto(l.RESPONSAVELDES),
      representante: this.texto(l.REPRESENDES),
      dataContratacao,
      dataEncerramento,
      dataCriacao: this.dataIso(l.DT_CRIACAO),
      dataPrevisaoUso: this.texto(l.DT_PREVISAO_USO).slice(0, 10),
      dataTransicao: this.texto(l.DT_TRANSICAO).slice(0, 10),
      competenciaContratacao: this.competencia(l.COMP_CONTRATACAO),
      competenciaEncerramento: this.competencia(l.COMP_ENCERRAMENTO),
      horasContratadas: contratadas,
      horasRealizadas: realizadas,
      horasSaldo: hora(l.MIN_SALDO),
      // Normais + adicionais — a mesma soma que o outro BI faz nas horas do resumo.
      horasCobradas: this.arredondar(
        (this.numero(l.MIN_COBRADOS) + this.numero(l.MIN_COBRADOS_AD)) / 60,
      ),
      horasBonificadas: this.arredondar(
        (this.numero(l.MIN_BONIFICADOS) + this.numero(l.MIN_BONIFICADOS_AD)) /
          60,
      ),
      percentualUtilizacao:
        contratadas > 0
          ? this.arredondar((realizadas / contratadas) * 100)
          : null,
      posicao,
      tipoImplantacao: this.texto(l.TIPO_IMPLANTACAO),
      area: this.texto(l.AREA),
      tipoSuporte: this.texto(l.TIPO_SUPORTE),
      statusImp: this.numero(l.STATUSIMP),
      grupoEconomico: this.texto(l.GRUPO_ECONOMICO),
      leadTimeMeses: this.mesesEntre(dataContratacao, dataEncerramento),
      // "Concluída" pela POSIÇÃO, não pela data: há encerramento preenchido em RNS que ainda
      // não concluíram (data prevista de encerramento).
      concluida: posicao.startsWith('6-'),
    };
  }

  private distintosDe<T>(linhas: T[], campo: (l: T) => string): string[] {
    const s = new Set<string>();
    for (const l of linhas) {
      const v = campo(l);
      if (v) s.add(v);
    }
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  private passa(selecionados: string[] | undefined, valor: string): boolean {
    const sel = (selecionados ?? []).filter(Boolean);
    return sel.length === 0 || sel.includes(valor);
  }

  private emCascata<T>(
    todas: T[],
    preds: { dimensao: string; ok: (l: T) => boolean }[],
    ignorada: string,
  ): T[] {
    return todas.filter((l) =>
      preds.every((p) => p.dimensao === ignorada || p.ok(l)),
    );
  }

  /** Série por competência. `chave` diz qual competência usar (contratação ou encerramento);
   * linhas sem essa competência ficam de fora — senão o gráfico ganharia uma barra fantasma. */
  private serie(
    linhas: LinhaIndicador[],
    chave: (l: LinhaIndicador) => string,
  ): SerieMensal[] {
    const mapa = new Map<string, LinhaIndicador[]>();
    for (const l of linhas) {
      const k = chave(l);
      if (!k) continue;
      const lista = mapa.get(k) ?? [];
      lista.push(l);
      mapa.set(k, lista);
    }
    return [...mapa.entries()]
      .map(([competencia, ls]) => {
        const contratadas = this.arredondar(
          ls.reduce((a, l) => a + l.horasContratadas, 0),
        );
        const realizadas = this.arredondar(
          ls.reduce((a, l) => a + l.horasRealizadas, 0),
        );
        return {
          competencia,
          projetos: ls.length,
          clientes: new Set(ls.map((l) => l.cliente).filter((c) => c !== null))
            .size,
          horasContratadas: contratadas,
          horasRealizadas: realizadas,
          horasCobradas: this.arredondar(
            ls.reduce((a, l) => a + l.horasCobradas, 0),
          ),
          horasBonificadas: this.arredondar(
            ls.reduce((a, l) => a + l.horasBonificadas, 0),
          ),
          percentualUtilizacao:
            contratadas > 0
              ? this.arredondar((realizadas / contratadas) * 100)
              : null,
        };
      })
      .sort((a, b) => a.competencia.localeCompare(b.competencia));
  }

  private contarPor(
    linhas: LinhaIndicador[],
    chave: (l: LinhaIndicador) => string,
  ): ContagemIndicador[] {
    const mapa = new Map<string, LinhaIndicador[]>();
    for (const l of linhas) {
      const k = chave(l) || '(sem informação)';
      const lista = mapa.get(k) ?? [];
      lista.push(l);
      mapa.set(k, lista);
    }
    return [...mapa.entries()]
      .map(([chave, ls]) => ({
        chave,
        quantidade: ls.length,
        horasContratadas: this.arredondar(
          ls.reduce((a, l) => a + l.horasContratadas, 0),
        ),
        horasRealizadas: this.arredondar(
          ls.reduce((a, l) => a + l.horasRealizadas, 0),
        ),
      }))
      .sort(
        (a, b) => b.quantidade - a.quantidade || a.chave.localeCompare(b.chave),
      );
  }

  private totalizar(linhas: LinhaIndicador[]): TotaisIndicadores {
    const contratadas = this.arredondar(
      linhas.reduce((a, l) => a + l.horasContratadas, 0),
    );
    const realizadas = this.arredondar(
      linhas.reduce((a, l) => a + l.horasRealizadas, 0),
    );
    const comLead = linhas.filter((l) => l.leadTimeMeses !== null);
    return {
      projetos: linhas.length,
      clientes: new Set(linhas.map((l) => l.cliente).filter((c) => c !== null))
        .size,
      horasContratadas: contratadas,
      horasRealizadas: realizadas,
      horasSaldo: this.arredondar(linhas.reduce((a, l) => a + l.horasSaldo, 0)),
      horasCobradas: this.arredondar(
        linhas.reduce((a, l) => a + l.horasCobradas, 0),
      ),
      horasBonificadas: this.arredondar(
        linhas.reduce((a, l) => a + l.horasBonificadas, 0),
      ),
      percentualUtilizacao:
        contratadas > 0
          ? this.arredondar((realizadas / contratadas) * 100)
          : null,
      concluidos: linhas.filter((l) => l.concluida).length,
      leadTimeMedio:
        comLead.length > 0
          ? this.arredondar(
              comLead.reduce((a, l) => a + (l.leadTimeMeses ?? 0), 0) /
                comLead.length,
            )
          : null,
    };
  }

  private vazio(
    competencias: { inicio: string; fim: string },
    erro: string | null,
  ): ResultadoIndicadores {
    const semFiltros: FiltrosIndicadores = {
      posicoes: [],
      tiposImplantacao: [],
      areas: [],
      tiposSuporte: [],
      responsaveis: [],
      grupos: [],
    };
    return {
      competencias,
      linhas: [],
      totais: this.totalizar([]),
      porMesContratacao: [],
      porMesConclusao: [],
      porPosicao: [],
      porTipo: [],
      porResponsavel: [],
      filtros: semFiltros,
      selecionados: semFiltros,
      erro,
    };
  }

  async indicadores(query: QueryIndicadores): Promise<ResultadoIndicadores> {
    const competencias = this.periodo(query);
    // Sem checagem prévia de conexão: `consultar` já devolve {ok:false} com a
    // mensagem que diz onde configurar — uma fonte só para o mesmo aviso.

    // Competência vai como AAAA-MM: a conversão para o AAAA/MM que a view guarda é do
    // catálogo (parâmetro do tipo `competencia`), não mais deste módulo.
    const r = await this.dados.consultar('sicla.bi.indicadores', {
      comp_ini: competencias.inicio,
      comp_fim: competencias.fim,
    });
    if (!r.ok) return this.vazio(competencias, r.mensagem);

    const todas = r.linhas.map((l) => this.normalizar(l));

    const preds = [
      {
        dimensao: 'posicao',
        ok: (l: LinhaIndicador) => this.passa(query.posicao, l.posicao),
      },
      {
        dimensao: 'tipoImplantacao',
        ok: (l: LinhaIndicador) =>
          this.passa(query.tipoImplantacao, l.tipoImplantacao),
      },
      {
        dimensao: 'area',
        ok: (l: LinhaIndicador) => this.passa(query.area, l.area),
      },
      {
        dimensao: 'tipoSuporte',
        ok: (l: LinhaIndicador) => this.passa(query.tipoSuporte, l.tipoSuporte),
      },
      {
        dimensao: 'responsavel',
        ok: (l: LinhaIndicador) => this.passa(query.responsavel, l.responsavel),
      },
      {
        dimensao: 'grupo',
        ok: (l: LinhaIndicador) => this.passa(query.grupo, l.grupoEconomico),
      },
    ];
    const paraDim = (d: string) => this.emCascata(todas, preds, d);

    const filtros: FiltrosIndicadores = {
      posicoes: this.distintosDe(paraDim('posicao'), (l) => l.posicao),
      tiposImplantacao: this.distintosDe(
        paraDim('tipoImplantacao'),
        (l) => l.tipoImplantacao,
      ),
      areas: this.distintosDe(paraDim('area'), (l) => l.area),
      tiposSuporte: this.distintosDe(
        paraDim('tipoSuporte'),
        (l) => l.tipoSuporte,
      ),
      responsaveis: this.distintosDe(
        paraDim('responsavel'),
        (l) => l.responsavel,
      ),
      grupos: this.distintosDe(paraDim('grupo'), (l) => l.grupoEconomico),
    };

    const linhas = todas.filter((l) => preds.every((p) => p.ok(l)));

    return {
      competencias,
      linhas,
      totais: this.totalizar(linhas),
      porMesContratacao: this.serie(linhas, (l) => l.competenciaContratacao),
      // Conclusão olha só quem realmente concluiu, pela POSIÇÃO.
      porMesConclusao: this.serie(
        linhas.filter((l) => l.concluida),
        (l) => l.competenciaEncerramento,
      ),
      porPosicao: this.contarPor(linhas, (l) => l.posicao),
      porTipo: this.contarPor(linhas, (l) => l.tipoImplantacao),
      porResponsavel: this.contarPor(linhas, (l) => l.responsavel),
      filtros,
      selecionados: {
        posicoes: (query.posicao ?? []).filter(Boolean),
        tiposImplantacao: (query.tipoImplantacao ?? []).filter(Boolean),
        areas: (query.area ?? []).filter(Boolean),
        tiposSuporte: (query.tipoSuporte ?? []).filter(Boolean),
        responsaveis: (query.responsavel ?? []).filter(Boolean),
        grupos: (query.grupo ?? []).filter(Boolean),
      },
      erro: null,
    };
  }
}
