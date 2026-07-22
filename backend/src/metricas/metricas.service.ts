import { Injectable } from '@nestjs/common';
import { Projeto } from '../database/entities/projeto.entity';
import type { Etapa } from '../common/constants/perfis';
import { ETAPAS, SITUACOES } from '../common/constants/perfis';
import {
  ACAO_ENTRADA,
  CAMPO_LABELS,
  CAMPOS_OBRIGATORIOS,
  DOC_LABELS,
  GATES,
  TipoDocumentoGate,
} from './metricas.constants';

const ALERTA_PARADO_DIAS = 14;
const ALERTA_HYPERCARE_DIAS = 15;
const SLA_CRONOGRAMA_UTEIS = 5;

export interface DocLeve {
  tipo: string;
}

export interface CampoFaltante {
  campo: string;
  label: string;
}

export interface ItemGate {
  tipo: TipoDocumentoGate;
  label: string;
  ok: boolean;
}

export interface GateStatus {
  etapa: Etapa;
  itens: ItemGate[];
  faltam: string[];
  ok: boolean;
}

export interface LinhaAtraso {
  id: number;
  cliente: string;
  etapa: string;
  consultor: string;
  dias: number;
}

export interface LinhaRisco {
  id: number;
  cliente: string;
  etapa: string;
}

export interface LinhaConsultorCarga {
  consultor: string;
  projetos: number;
  horas: number;
}

export interface ResultadoMetricas {
  total: number;
  ativos: number;
  concluidos: number;
  porSituacao: Record<string, number>;
  porEtapa: Record<string, number>;
  atrasados: LinhaAtraso[];
  nAtrasados: number;
  emRisco: LinhaRisco[];
  nRisco: number;
  gatePendente: number;
  noPrazo: number;
  consultores: LinhaConsultorCarga[];
  horasCob: number;
  horasBon: number;
  horasTotal: number;
  ttvMedio: number | null;
}

export interface Alerta {
  nivel: 'alto' | 'medio';
  projetoId: number;
  cliente: string;
  tipo: string;
  msg: string;
}

export interface MetricasUso {
  dias: number;
  projetosNovos: number;
  documentos: number;
  emails: number;
  notas: number;
  transicoes: number;
  totalEventos: number;
}

export interface FaseFunil {
  fase: Etapa;
  n: number;
  idadeMedia: number | null;
}

export interface ItemStepper {
  nome: Etapa;
  estado: 'done' | 'atual' | 'futuro';
}

export interface ProximaAcao {
  tipo: string;
  label: string;
  ok: boolean;
}

export interface Cabecalho {
  stepper: ItemStepper[];
  fase: Etapa;
  etapa: Etapa;
  goLive: string;
  atraso: number | null;
  horasCob: number;
  horasBon: number;
  horasTotal: number;
  docsOk: number;
  docsTotal: number;
  proxima: ProximaAcao | null;
  proxEtapa: Etapa | null;
  avancarOk: boolean;
  gate: GateStatus;
  camposFaltantes: CampoFaltante[];
  bloqueios: string[];
}

export interface EventoLeve {
  id: number;
  projetoId: number;
  tipo: string;
  criadoEm: Date;
}

/** Motor de métricas/alertas/gates que alimenta as telas executivas — SOMENTE LEITURA
 * (relatório/reporting). Espelha as funções puras de webapp/db.py (metricas, alertas,
 * gate_status, campos_faltantes, cabecalho, metricas_uso, funil_macro...). Não inclui a
 * ENFORCEMENT de `pode_avancar` no caminho de escrita do Projeto (`ProjetosService`) —
 * isso segue como pendência registrada em docs/migracao/03-documento-conversao.md, fora
 * do escopo desta fatia (telas executivas), já que mudaria o comportamento do fluxo já
 * publicado nos itens 1-6. */
@Injectable()
export class MetricasService {
  private pdate(s: string | null | undefined): Date | null {
    const v = (s || '').trim();
    if (!v) return null;
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return null;
  }

  private pnum(s: string | null | undefined): number {
    const m = /\d+(?:[.,]\d+)?/.exec(String(s ?? ''));
    return m ? parseFloat(m[0].replace(',', '.')) : 0;
  }

  private diffDias(a: Date, b: Date): number {
    return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
  }

  private hoje(): Date {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private diasUteis(d: Date, n: number): Date {
    const atual = new Date(d);
    let restante = n;
    while (restante > 0) {
      atual.setDate(atual.getDate() + 1);
      const dow = atual.getDay(); // 0=domingo..6=sábado
      if (dow !== 0 && dow !== 6) restante--;
    }
    return atual;
  }

  private formatBr(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  macroIdx(etapa: string): number {
    const i = ETAPAS.indexOf(etapa as Etapa);
    return i >= 0 ? i : 0;
  }

  proximaEtapa(etapa: string): Etapa | null {
    const i = ETAPAS.indexOf(etapa as Etapa);
    return i >= 0 && i + 1 < ETAPAS.length ? ETAPAS[i + 1] : null;
  }

  camposFaltantes(etapa: Etapa, proj: Projeto): CampoFaltante[] {
    const obrig = CAMPOS_OBRIGATORIOS[etapa] ?? [];
    const faltam: CampoFaltante[] = [];
    const p = proj as unknown as Record<string, string>;
    for (const campo of obrig) {
      const v = (p[campo] || '').toString().trim();
      if (!v) faltam.push({ campo, label: CAMPO_LABELS[campo] ?? campo });
    }
    return faltam;
  }

  gateStatus(etapa: Etapa, docs: DocLeve[]): GateStatus {
    const presentes = new Set(
      (docs || []).map((d) => (d.tipo || '').toLowerCase()),
    );
    const itens: ItemGate[] = (GATES[etapa] ?? []).map((t) => ({
      tipo: t,
      label: DOC_LABELS[t] ?? t,
      ok: presentes.has(t),
    }));
    const faltam = itens.filter((i) => !i.ok).map((i) => i.label);
    return { etapa, itens, faltam, ok: faltam.length === 0 };
  }

  gciDefinido(proj: Projeto): boolean {
    return !!(proj.gci || '').trim();
  }

  acaoEntradaOk(etapa: Etapa | null, proj: Projeto): boolean {
    if (!etapa) return true;
    const req = ACAO_ENTRADA[etapa]?.[0];
    if (req === 'gci_e_data_levantamento') {
      return (
        !!(proj.gci || '').trim() && !!(proj.dataLevantamento || '').trim()
      );
    }
    if (req === 'consultores_designacao') return !!(proj.gci || '').trim();
    if (req === 'consultores') return !!(proj.consultor || '').trim();
    return true;
  }

  podeAvancar(
    etapa: Etapa,
    proj: Projeto,
    docs: DocLeve[],
  ): { ok: boolean; bloqueios: string[] } {
    const bloqueios: string[] = [];
    for (const f of this.camposFaltantes(etapa, proj)) {
      bloqueios.push(`Campo obrigatório: ${f.label}`);
    }
    const prox = this.proximaEtapa(etapa);
    if (prox) {
      const g = this.gateStatus(prox, docs);
      for (const it of g.itens) {
        if (!it.ok) bloqueios.push(`Documento pendente: ${it.label}`);
      }
      if (!this.acaoEntradaOk(prox, proj)) {
        const label = ACAO_ENTRADA[prox]?.[1];
        if (label) bloqueios.push(`Ação obrigatória: ${label}`);
      }
    }
    return { ok: bloqueios.length === 0, bloqueios };
  }

  /** Avança `projeto.etapa` (em memória — quem chama persiste e registra os eventos)
   * enquanto o gate da PRÓXIMA etapa (documentos + ação de entrada) já estiver
   * satisfeito. PERMISSIVO de propósito quanto aos campos obrigatórios — eles são
   * cobrados no avanço MANUAL e sinalizados na ficha (`camposFaltantes`/`podeAvancar`);
   * bloqueá-los aqui travaria o fluxo (ex.: Agendamento sem nº do projeto/horas ainda
   * preenchidos). Nunca avança PARA FORA de "Levantamento" — a conclusão do
   * Levantamento é confirmada manualmente pelo GCI (botão Avançar). Espelha
   * webapp/app.py:_auto_avancar. */
  autoAvancar(
    projeto: Projeto,
    docs: DocLeve[],
  ): { etapaAnterior: Etapa; etapaNova: Etapa }[] {
    const transicoes: { etapaAnterior: Etapa; etapaNova: Etapa }[] = [];
    if (projeto.etapa === 'Levantamento') return transicoes;
    let prox = this.proximaEtapa(projeto.etapa);
    while (
      prox &&
      this.gateStatus(prox, docs).ok &&
      this.acaoEntradaOk(prox, projeto)
    ) {
      transicoes.push({ etapaAnterior: projeto.etapa, etapaNova: prox });
      projeto.etapa = prox;
      prox = this.proximaEtapa(projeto.etapa);
    }
    return transicoes;
  }

  /** Agrega a carteira p/ o Painel Coordenação. Espelha webapp/db.py:metricas. */
  metricas(
    projetos: Projeto[],
    docsMap: Record<number, DocLeve[]> = {},
  ): ResultadoMetricas {
    const hoje = this.hoje();
    const porSituacao: Record<string, number> = Object.fromEntries(
      SITUACOES.map((s) => [s, 0]),
    );
    const porEtapa: Record<string, number> = Object.fromEntries(
      ETAPAS.map((e) => [e, 0]),
    );
    const consultores = new Map<string, LinhaConsultorCarga>();
    const atrasados: LinhaAtraso[] = [];
    const emRisco: LinhaRisco[] = [];
    const ttv: number[] = [];
    let gatePendente = 0;
    let concluidos = 0;
    let horasCob = 0;
    let horasBon = 0;

    for (const p of projetos) {
      const sit = p.situacao || '';
      const et = p.etapa || '';
      porSituacao[sit] = (porSituacao[sit] ?? 0) + 1;
      porEtapa[et] = (porEtapa[et] ?? 0) + 1;
      const encerrado = sit === 'Concluído';
      const cob = this.pnum(p.horasCobradas);
      const bon = this.pnum(p.horasBonificadas);
      horasCob += cob;
      horasBon += bon;
      const cons = (p.consultor || '').trim() || '— sem consultor —';

      if (encerrado) {
        concluidos++;
        const di = this.pdate(p.dataInicio);
        const df =
          this.pdate(p.dataUsoOficial) ?? this.pdate(p.dataEncerramento);
        if (di && df && df >= di) ttv.push(this.diffDias(df, di));
        continue;
      }

      const c = consultores.get(cons) ?? {
        consultor: cons,
        projetos: 0,
        horas: 0,
      };
      c.projetos += 1;
      c.horas += cob + bon;
      consultores.set(cons, c);

      const duso = this.pdate(p.dataUsoOficial);
      if (duso && duso < hoje) {
        atrasados.push({
          id: p.id,
          cliente: p.cliente,
          etapa: et,
          consultor: cons,
          dias: this.diffDias(hoje, duso),
        });
      }
      if (sit === 'Em risco') {
        emRisco.push({ id: p.id, cliente: p.cliente, etapa: et });
      }
      if (!this.gateStatus(et, docsMap[p.id] ?? []).ok) gatePendente++;
    }

    const ativos = projetos.length - concluidos;
    atrasados.sort((a, b) => b.dias - a.dias);

    return {
      total: projetos.length,
      ativos,
      concluidos,
      porSituacao,
      porEtapa,
      atrasados,
      nAtrasados: atrasados.length,
      emRisco,
      nRisco: emRisco.length,
      gatePendente,
      noPrazo: ativos - atrasados.length,
      consultores: [...consultores.values()].sort(
        (a, b) => b.projetos - a.projetos,
      ),
      horasCob,
      horasBon,
      horasTotal: horasCob + horasBon,
      ttvMedio:
        ttv.length > 0
          ? Math.round(ttv.reduce((a, b) => a + b, 0) / ttv.length)
          : null,
    };
  }

  /** Alertas proativos (SLA / hypercare / risco) dos projetos ATIVOS. Espelha
   * webapp/db.py:alertas. */
  alertas(
    projetos: Projeto[],
    docsMap: Record<number, DocLeve[]> = {},
  ): Alerta[] {
    const hoje = this.hoje();
    const agora = new Date();
    const out: Alerta[] = [];

    for (const p of projetos) {
      const sit = p.situacao || '';
      const et = p.etapa || '';
      if (sit === 'Concluído') continue;
      const pid = p.id;
      const cli = p.cliente;
      const tipos = new Set(
        (docsMap[pid] ?? []).map((d) => (d.tipo || '').toLowerCase()),
      );
      const duso = this.pdate(p.dataUsoOficial);

      const add = (
        nivel: 'alto' | 'medio',
        tipo: string,
        msg: string,
      ): void => {
        out.push({ nivel, projetoId: pid, cliente: cli, tipo, msg });
      };

      if (duso && duso < hoje) {
        add(
          'alto',
          'atraso',
          `Uso oficial previsto venceu há ${this.diffDias(hoje, duso)} dia(s)`,
        );
      }
      if (sit === 'Em risco') {
        add('alto', 'risco', 'Projeto marcado como Em risco');
      }
      const di = this.pdate(p.dataInicio);
      if (
        di &&
        !tipos.has('cronograma') &&
        hoje > this.diasUteis(di, SLA_CRONOGRAMA_UTEIS)
      ) {
        add(
          'medio',
          'sla',
          `Cronograma pendente além do SLA de ${SLA_CRONOGRAMA_UTEIS} dias úteis (início ${this.formatBr(di)})`,
        );
      }
      if (et === 'Encerramento' && duso) {
        const limite = new Date(duso);
        limite.setDate(limite.getDate() + ALERTA_HYPERCARE_DIAS);
        if (hoje > limite) {
          add(
            'medio',
            'encerramento',
            `Em Encerramento há mais de ${ALERTA_HYPERCARE_DIAS} dias após o go-live — concluir o projeto`,
          );
        }
      }
      if (p.atualizadoEm) {
        const diasParado = this.diffDias(agora, new Date(p.atualizadoEm));
        if (diasParado >= ALERTA_PARADO_DIAS) {
          add('medio', 'parado', `Sem atualização há ${diasParado} dias`);
        }
      }
    }

    out.sort(
      (a, b) => (a.nivel === 'alto' ? 0 : 1) - (b.nivel === 'alto' ? 0 : 1),
    );
    return out;
  }

  /** Contagens de uso no período: projetos criados + eventos por tipo. Espelha
   * webapp/db.py:metricas_uso. */
  metricasUso(
    eventos: EventoLeve[],
    projetos: Projeto[],
    dias = 30,
  ): MetricasUso {
    const corte = new Date();
    corte.setDate(corte.getDate() - dias);
    const rec = eventos.filter((e) => e.criadoEm && e.criadoEm >= corte);
    const por = new Map<string, number>();
    for (const e of rec) por.set(e.tipo, (por.get(e.tipo) ?? 0) + 1);
    const novos = projetos.filter(
      (p) => p.criadoEm && p.criadoEm >= corte,
    ).length;
    return {
      dias,
      projetosNovos: novos,
      documentos: por.get('documento') ?? 0,
      emails: por.get('email') ?? 0,
      notas: por.get('nota') ?? 0,
      transicoes: por.get('etapa') ?? 0,
      totalEventos: rec.length,
    };
  }

  /** Projetos por macro-fase + idade média (dias desde a criação). Espelha
   * webapp/db.py:funil_macro. */
  funilMacro(projetos: Projeto[]): FaseFunil[] {
    const hoje = new Date();
    const porFase = new Map<Etapa, (number | null)[]>();
    for (const f of ETAPAS) porFase.set(f, []);
    for (const p of projetos) {
      const f = ETAPAS[this.macroIdx(p.etapa)];
      const idade = p.criadoEm
        ? this.diffDias(hoje, new Date(p.criadoEm))
        : null;
      porFase.get(f)!.push(idade);
    }
    return ETAPAS.map((f) => {
      const lista = porFase.get(f)!;
      const idades = lista.filter((d): d is number => d !== null);
      return {
        fase: f,
        n: lista.length,
        idadeMedia:
          idades.length > 0
            ? Math.round(idades.reduce((a, b) => a + b, 0) / idades.length)
            : null,
      };
    });
  }

  /** Dados do cabeçalho da ficha (stepper + KPIs + próxima ação + avançar). O que se cobra
   * é o gate da PRÓXIMA etapa = o que falta para avançar. Espelha webapp/db.py:cabecalho. */
  cabecalho(d: Projeto, docs: DocLeve[]): Cabecalho {
    const etapa = d.etapa;
    const cur = this.macroIdx(etapa);
    const stepper: ItemStepper[] = ETAPAS.map((f, i) => ({
      nome: f,
      estado: i < cur ? 'done' : i === cur ? 'atual' : 'futuro',
    }));
    const cob = this.pnum(d.horasCobradas);
    const bon = this.pnum(d.horasBonificadas);
    const duso = this.pdate(d.dataUsoOficial);
    const encerrado = d.situacao === 'Concluído';
    const hoje = this.hoje();
    const atraso =
      duso && !encerrado && duso < hoje ? this.diffDias(hoje, duso) : null;
    const prox = this.proximaEtapa(etapa);
    const gateRef = prox
      ? this.gateStatus(prox, docs)
      : this.gateStatus(etapa, docs);
    const itens = gateRef.itens;
    let proxima: ProximaAcao | null = itens.find((i) => !i.ok) ?? null;
    const acaoOk = this.acaoEntradaOk(prox, d);
    if (!proxima && prox && !acaoOk) {
      const entrada = ACAO_ENTRADA[prox];
      if (entrada) {
        const [chave, label] = entrada;
        if (chave === 'gci_e_data_levantamento') {
          proxima = !this.gciDefinido(d)
            ? {
                tipo: 'acao:definir_gci',
                label: 'Definir GCI Responsável',
                ok: false,
              }
            : {
                tipo: 'acao:data_levantamento',
                label: 'Definir Data do Levantamento',
                ok: false,
              };
        } else {
          proxima = { tipo: `acao:${chave}`, label, ok: false };
        }
      }
    }
    const cf = this.camposFaltantes(etapa, d);
    const { ok: avancarOk, bloqueios } = this.podeAvancar(etapa, d, docs);
    return {
      stepper,
      fase: ETAPAS[cur],
      etapa,
      goLive: d.dataUsoOficial || '',
      atraso,
      horasCob: cob,
      horasBon: bon,
      horasTotal: cob + bon,
      docsOk: itens.filter((i) => i.ok).length,
      docsTotal: itens.length,
      proxima,
      proxEtapa: prox,
      avancarOk,
      gate: gateRef,
      camposFaltantes: cf,
      bloqueios,
    };
  }
}
