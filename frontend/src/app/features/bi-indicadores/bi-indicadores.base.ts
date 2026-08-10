import { computed, inject, signal } from '@angular/core';
import { BiIndicadoresService } from '../../core/services/bi-indicadores.service';
import {
  LinhaIndicadorBi,
  ResultadoIndicadoresBi,
  SerieMensalBi,
} from '../../core/models/bi-indicadores.model';
import { BiIndicadoresStore } from './bi-indicadores.store';
import { mensagemErroBi } from '../bi-implantacao/bi-erro.util';

const NOMES_MES = [
  '', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

/** Base das três telas de Indicadores. Elas consomem o MESMO endpoint e compartilham carga,
 * filtros e formatação — só mudam os painéis que desenham. Herdar evita três cópias da
 * mesma lógica saindo de sincronia. */
export abstract class BiIndicadoresBase {
  protected readonly service = inject(BiIndicadoresService);
  readonly store = inject(BiIndicadoresStore);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<ResultadoIndicadoresBi | null>(null);

  readonly filtros = computed(() => this.resultado()?.filtros ?? null);

  /** Como no outro BI: a busca é local e TODO painel deriva das linhas visíveis. */
  readonly linhas = computed<LinhaIndicadorBi[]>(() => {
    const todas = this.resultado()?.linhas ?? [];
    const q = this.store.busca().trim().toLowerCase();
    if (!q) return todas;
    return todas.filter(
      (l) =>
        l.fantasia.toLowerCase().includes(q) ||
        l.descricao.toLowerCase().includes(q) ||
        l.grupoEconomico.toLowerCase().includes(q) ||
        l.responsavel.toLowerCase().includes(q) ||
        String(l.codigo).includes(q),
    );
  });

  readonly totais = computed(() => {
    const l = this.linhas();
    const s = (f: (x: LinhaIndicadorBi) => number) =>
      Math.round(l.reduce((a, x) => a + f(x), 0) * 100) / 100;
    const contratadas = s((x) => x.horasContratadas);
    const realizadas = s((x) => x.horasRealizadas);
    const comLead = l.filter((x) => x.leadTimeMeses !== null);
    return {
      projetos: l.length,
      clientes: new Set(l.map((x) => x.cliente).filter((c) => c !== null)).size,
      horasContratadas: contratadas,
      horasRealizadas: realizadas,
      horasSaldo: s((x) => x.horasSaldo),
      horasCobradas: s((x) => x.horasCobradas),
      horasBonificadas: s((x) => x.horasBonificadas),
      percentualUtilizacao:
        contratadas > 0 ? Math.round((realizadas / contratadas) * 1000) / 10 : null,
      concluidos: l.filter((x) => x.concluida).length,
      leadTimeMedio:
        comLead.length > 0
          ? Math.round(
              (comLead.reduce((a, x) => a + (x.leadTimeMeses ?? 0), 0) / comLead.length) * 100,
            ) / 100
          : null,
    };
  });

  /** Série mensal recalculada sobre o visível (o backend não conhece a busca local). */
  protected serie(chave: (l: LinhaIndicadorBi) => string, so?: (l: LinhaIndicadorBi) => boolean): SerieMensalBi[] {
    const base = so ? this.linhas().filter(so) : this.linhas();
    const mapa = new Map<string, LinhaIndicadorBi[]>();
    for (const l of base) {
      const k = chave(l);
      if (!k) continue;
      const lista = mapa.get(k) ?? [];
      lista.push(l);
      mapa.set(k, lista);
    }
    const arred = (n: number) => Math.round(n * 100) / 100;
    return [...mapa.entries()]
      .map(([competencia, ls]) => {
        const c = arred(ls.reduce((a, l) => a + l.horasContratadas, 0));
        const r = arred(ls.reduce((a, l) => a + l.horasRealizadas, 0));
        return {
          competencia,
          projetos: ls.length,
          clientes: new Set(ls.map((l) => l.cliente).filter((x) => x !== null)).size,
          horasContratadas: c,
          horasRealizadas: r,
          horasCobradas: arred(ls.reduce((a, l) => a + l.horasCobradas, 0)),
          horasBonificadas: arred(ls.reduce((a, l) => a + l.horasBonificadas, 0)),
          percentualUtilizacao: c > 0 ? Math.round((r / c) * 1000) / 10 : null,
        };
      })
      .sort((a, b) => a.competencia.localeCompare(b.competencia));
  }

  protected contarPor(chave: (l: LinhaIndicadorBi) => string) {
    const mapa = new Map<string, LinhaIndicadorBi[]>();
    for (const l of this.linhas()) {
      const k = chave(l) || '(sem informação)';
      const lista = mapa.get(k) ?? [];
      lista.push(l);
      mapa.set(k, lista);
    }
    return [...mapa.entries()]
      .map(([chave, ls]) => ({
        chave,
        quantidade: ls.length,
        horasContratadas: Math.round(ls.reduce((a, l) => a + l.horasContratadas, 0) * 100) / 100,
        horasRealizadas: Math.round(ls.reduce((a, l) => a + l.horasRealizadas, 0) * 100) / 100,
      }))
      .sort((a, b) => b.quantidade - a.quantidade || a.chave.localeCompare(b.chave));
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.indicadores({
        compIni: this.store.compIni() || undefined,
        compFim: this.store.compFim() || undefined,
        posicao: this.store.posicao(),
        tipoImplantacao: this.store.tipoImplantacao(),
        area: this.store.area(),
        tipoSuporte: this.store.tipoSuporte(),
        responsavel: this.store.responsavel(),
        grupo: this.store.grupo(),
      });
      this.resultado.set(r);
      if (r.erro) this.erro.set(r.erro);
      this.store.compIni.set(r.competencias.inicio);
      this.store.compFim.set(r.competencias.fim);
    } catch (e) {
      this.erro.set(mensagemErroBi(e, 'os Indicadores de Implantação'));
    } finally {
      this.carregando.set(false);
    }
  }

  /** "2026-07" → "jul/26". */
  rotuloMes(competencia: string): string {
    const [ano, mes] = (competencia ?? '').split('-');
    return `${NOMES_MES[Number(mes)] ?? competencia}/${(ano ?? '').slice(2)}`;
  }

  horas(v: number): string {
    return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;
  }

  dataBr(iso: string): string {
    return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
  }

  protected baixarCsv(nome: string, cab: string[], linhas: (string | number | null)[][]): void {
    const escapar = (v: string | number | null): string => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    // `\uFEFF` (BOM) na frente do CSV: é o que faz o Excel abrir o arquivo
    // como UTF-8 em vez de ANSI (sem ele, acento sai trocado na planilha).
    const csv = `\uFEFF${cab.join(';')}\n${linhas.map((l) => l.map(escapar).join(';')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  }
}
