import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import {
  CronogramaService,
  VisitaAgrupada,
  parseDiasExcluidos,
} from './cronograma.service';
import { DesignacoesService } from './designacoes.service';
import {
  addDays,
  addMonthsClamped,
  diaUtil,
  hojeIso,
  parseIso,
  toIso,
  weekdaySegunda0,
} from './datas.util';

export interface ResultadoDistribuicao {
  ok: boolean;
  erro?: string;
  n?: number;
  semSlot?: string[];
  estourouGolive?: string[];
  aviso?: string;
}

/** Módulos usados no cronograma sem técnico definido (ou com nome fora da lista de técnicos
 * atribuíveis) — trava a distribuição automática. Módulos "Não distribuir" nunca entram
 * aqui. Espelha webapp/routes_agenda.py:_modulos_sem_tecnico_valido. */
function modulosSemTecnicoValido(
  modulosUsados: Set<string>,
  tech: Map<string, string>,
  ndMod: Map<string, boolean>,
  tecnicosValidos: string[],
): string[] {
  const modulos = [...modulosUsados].filter((m) => m && !ndMod.get(m)).sort();
  return modulos.filter(
    (m) => !tecnicosValidos.includes((tech.get(m) || '').trim()),
  );
}

/** Distribuição automática de agendas conforme datas livres — o coração do Agendador de
 * Visitas. Espelha webapp/routes_agenda.py:_distribuir_automatico linha a linha.
 *
 * PENDÊNCIA (item 5 da migração): a checagem de disponibilidade externa (SICLA/Oracle) ainda
 * não foi convertida — por ora a distribuição só considera compromissos já registrados NESTE
 * cronograma, períodos sem agenda do projeto e dias/turnos excluídos. Ver
 * docs/migracao/03-documento-conversao.md. */
@Injectable()
export class DistribuicaoService {
  constructor(
    private readonly cronograma: CronogramaService,
    private readonly designacoes: DesignacoesService,
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
  ) {}

  async distribuirAutomatico(
    projetoId: number,
    opcoes: { modulo?: string; incluirAlocadas?: boolean } = {},
  ): Promise<ResultadoDistribuicao> {
    const { modulo, incluirAlocadas = false } = opcoes;

    let ats = await this.cronograma.listarAtividades(projetoId);
    const designacoes = await this.designacoes.doProjeto(projetoId);
    const tech = new Map(designacoes.map((d) => [d.modulo, d.consultor]));
    const ordemMod = new Map(designacoes.map((d) => [d.modulo, d.ordem]));
    const ndMod = new Map(designacoes.map((d) => [d.modulo, d.naoDistribuir]));

    const modulosUsados = new Set(ats.map((a) => a.modulo));
    // Únicos, não vazios, cujo módulo não é "não distribuir" — mesmo critério de
    // webapp/routes_agenda.py:_distribuir_automatico para a lista `tecnicos`.
    const tecnicosValidos = [
      ...new Set(
        ats
          .filter((a) => !ndMod.get(a.modulo))
          .map((a) => (tech.get(a.modulo) || '').trim()),
      ),
    ]
      .filter(Boolean)
      .sort();

    let faltantes = modulosSemTecnicoValido(
      modulosUsados,
      tech,
      ndMod,
      tecnicosValidos,
    );
    if (modulo) faltantes = faltantes.filter((m) => m === modulo);
    if (faltantes.length > 0) {
      return {
        ok: false,
        erro:
          `Defina um técnico válido (em 'Técnico por módulo') para: ${faltantes.join(', ')} ` +
          '— a distribuição automática só roda com todos os módulos designados (ou marque ' +
          "'Não distribuir' se o módulo não entra nesta agenda).",
      };
    }

    let visitas = await this.cronograma.visitas(projetoId);
    if (modulo) visitas = visitas.filter((g) => g.modulo === modulo);

    const elegivel = (g: VisitaAgrupada): boolean => {
      if (g.atividades.length === 0 || ndMod.get(g.modulo)) return false;
      for (const a of g.atividades) {
        if (!['', 'Solicitada', 'Agendada'].includes(a.status || ''))
          return false;
        if (a.data && a.turno && !incluirAlocadas) return false;
      }
      return true;
    };

    const alvo = visitas.filter(elegivel);
    if (alvo.length === 0) {
      return {
        ok: true,
        n: 0,
        semSlot: [],
        aviso:
          'Não há visitas pendentes para distribuir (as demais já foram alocadas manualmente, ' +
          "concluídas ou pertencem a módulo marcado 'Não distribuir').",
      };
    }
    alvo.sort(
      (a, b) =>
        (ordemMod.get(a.modulo) || 0) - (ordemMod.get(b.modulo) || 0) ||
        a.modulo.localeCompare(b.modulo) ||
        a.seq - b.seq,
    );

    // Piso do módulo reorganizado: nenhuma visita "de fora" do alvo pode ficar com data
    // anterior à visita que continua fixa — senão a reorganização voltaria a violar a ordem
    // V1 < V2 que motivou o próprio pedido.
    let piso: Date | null = null;
    if (modulo) {
      const alvoChaves = new Set(alvo.map((g) => `${g.modulo}|${g.seq}`));
      const datasFixas = ats
        .filter(
          (a) =>
            a.modulo === modulo &&
            !alvoChaves.has(`${a.modulo}|${a.seq}`) &&
            a.data,
        )
        .map((a) => parseIso(a.data));
      if (datasFixas.length > 0) {
        piso = datasFixas.reduce((max, d) => (d > max ? d : max));
      }
    }

    if (incluirAlocadas) {
      for (const g of alvo) {
        for (const a of g.atividades) {
          if (a.data || a.turno) {
            await this.cronograma.alocar(a.id, projetoId, {
              data: '',
              turno: '',
              auto: true,
            });
          }
        }
      }
      ats = await this.cronograma.listarAtividades(projetoId); // reflete os slots agora livres
    }

    const cfg = await this.cronograma.config(projetoId);
    const hoje = parseIso(hojeIso());
    let inicio = cfg.dataInicio ? parseIso(cfg.dataInicio) : hoje;
    if (inicio < hoje) inicio = hoje; // nunca busca no passado
    if (piso && piso >= inicio) {
      inicio = addDays(piso, 1);
      while (!diaUtil(inicio)) inicio = addDays(inicio, 1);
    }
    const fim = addMonthsClamped(inicio, 18);
    const dias: Date[] = [];
    for (let d = inicio; d <= fim; d = addDays(d, 1)) {
      if (diaUtil(d)) dias.push(d);
    }

    const modo = cfg.modoDisponibilidade;
    const diasExcluidos = parseDiasExcluidos(cfg.diasTurnosExcluidos);
    const excluiSet = new Set(
      diasExcluidos.map((d) => `${d.diaSemana}|${d.turno}`),
    );
    const periodos = await this.cronograma.periodosBloqueados(projetoId);

    const periodoBloqueia = (iso: string, tec: string): boolean => {
      for (const p of periodos) {
        if (!(p.dataIni <= iso && iso <= p.dataFim)) continue;
        const tecs = CronogramaService.tecnicosDoPeriodo(p);
        if (tecs.length === 0 || tecs.includes(tec)) return true;
      }
      return false;
    };

    // PENDÊNCIA item 5: disponibilidade externa (SICLA/Oracle) não é consultada aqui ainda —
    // `modo` (conjunta/individual) só afeta a ocupação já registrada neste cronograma.
    const ocupado = new Map<string, boolean>();
    for (const a of ats) {
      const t = (a.tecnico || '').trim();
      if (t && a.data && a.turno)
        ocupado.set(`${t}|${a.data}|${a.turno}`, true);
    }
    const ocupadoConjunta = (iso: string, turno: string): boolean => {
      if (modo !== 'conjunta') return false;
      return tecnicosValidos.some((tec) =>
        ocupado.get(`${tec}|${iso}|${turno}`),
      );
    };

    let alocadas = 0;
    const semSlot: string[] = [];
    for (const g of alvo) {
      const tec = (tech.get(g.modulo) || '').trim();
      let slot: { iso: string; turno: string } | null = null;
      for (const d of dias) {
        const iso = toIso(d);
        if (periodoBloqueia(iso, tec)) continue;
        for (const turno of ['manha', 'tarde'] as const) {
          if (excluiSet.has(`${weekdaySegunda0(d)}|${turno}`)) continue;
          if (
            ocupado.get(`${tec}|${iso}|${turno}`) ||
            ocupadoConjunta(iso, turno)
          )
            continue;
          slot = { iso, turno };
          break;
        }
        if (slot) break;
      }
      if (!slot) {
        semSlot.push(`${g.modulo} V${g.seq}`);
        continue;
      }
      for (const a of g.atividades) {
        await this.cronograma.alocar(a.id, projetoId, {
          data: slot.iso,
          turno: slot.turno,
          ...(a.tecnico || tec ? { tecnico: a.tecnico || tec } : {}),
          auto: true,
        });
      }
      ocupado.set(`${tec}|${slot.iso}|${slot.turno}`, true);
      alocadas++;
    }

    let aviso = `${alocadas} visita(s) distribuída(s) automaticamente.`;
    if (semSlot.length > 0) {
      aviso += ` Sem turno livre (dentro de ~18 meses) para: ${semSlot.join(', ')}.`;
    }

    // A última visita de cada técnico nunca pode cair no Go-live previsto ou depois.
    const estourouGolive: string[] = [];
    const projeto = await this.projetos.findOne({ where: { id: projetoId } });
    const goliveRaw = (projeto?.dataUsoOficial || '').trim();
    if (goliveRaw) {
      const golive = parseIso(goliveRaw);
      const atsFinal = await this.cronograma.listarAtividades(projetoId);
      for (const tec of tecnicosValidos) {
        const datasTec = atsFinal
          .filter((a) => (a.tecnico || '').trim() === tec && a.data)
          .map((a) => parseIso(a.data));
        if (datasTec.length > 0) {
          const max = datasTec.reduce((m, d) => (d > m ? d : m));
          if (max >= golive) estourouGolive.push(tec);
        }
      }
      if (estourouGolive.length > 0) {
        aviso +=
          ` Atenção: ${estourouGolive.join(', ')} não tem agendas disponíveis dentro do ` +
          'período necessário — a última visita ficaria em ' +
          `${goliveRaw.slice(8, 10)}/${goliveRaw.slice(5, 7)}/${goliveRaw.slice(0, 4)} (Go-live previsto) ou depois.`;
      }
    }

    return { ok: true, n: alocadas, semSlot, estourouGolive, aviso };
  }

  async redistribuir(projetoId: number): Promise<ResultadoDistribuicao> {
    const ats = await this.cronograma.listarAtividades(projetoId);
    for (const a of ats) {
      if (
        a.autoAgendado &&
        ['', 'Solicitada', 'Agendada'].includes(a.status || '')
      ) {
        await this.cronograma.alocar(a.id, projetoId, {
          data: '',
          turno: '',
          auto: false,
        });
      }
    }
    return this.distribuirAutomatico(projetoId);
  }

  async desfazerTudo(
    projetoId: number,
  ): Promise<{ ok: boolean; erro?: string; n?: number; aviso?: string }> {
    const ats = await this.cronograma.listarAtividades(projetoId);
    if (CronogramaService.jaOcorreu(ats)) {
      return {
        ok: false,
        erro:
          'Há visita(s) já Realizada(s)/Não Realizada(s) neste cronograma — não é possível ' +
          'desfazer as agendas.',
      };
    }
    let n = 0;
    for (const a of ats) {
      if (
        ['', 'Solicitada', 'Agendada'].includes(a.status || '') &&
        (a.data || a.turno)
      ) {
        await this.cronograma.alocar(a.id, projetoId, {
          data: '',
          turno: '',
          auto: false,
        });
        n++;
      }
    }
    return {
      ok: true,
      n,
      aviso:
        n > 0
          ? `${n} assunto(s) voltaram à lista de pendentes.`
          : 'Não havia agenda alocada para desfazer.',
    };
  }

  async reorganizarModulo(
    projetoId: number,
    modulo: string,
  ): Promise<ResultadoDistribuicao> {
    const m = (modulo || '').trim().toUpperCase();
    if (!m) return { ok: false, erro: 'módulo ausente' };
    return this.distribuirAutomatico(projetoId, {
      modulo: m,
      incluirAlocadas: true,
    });
  }

  async prontidao(
    projetoId: number,
  ): Promise<{ faltantes: string[]; jaOcorreu: boolean }> {
    const ats = await this.cronograma.listarAtividades(projetoId);
    const designacoes = await this.designacoes.doProjeto(projetoId);
    const tech = new Map(designacoes.map((d) => [d.modulo, d.consultor]));
    const ndMod = new Map(designacoes.map((d) => [d.modulo, d.naoDistribuir]));
    const modulosUsados = new Set(ats.map((a) => a.modulo));
    const tecnicosValidos = [
      ...new Set(
        ats
          .filter((a) => !ndMod.get(a.modulo))
          .map((a) => (tech.get(a.modulo) || '').trim()),
      ),
    ]
      .filter(Boolean)
      .sort();
    return {
      faltantes: modulosSemTecnicoValido(
        modulosUsados,
        tech,
        ndMod,
        tecnicosValidos,
      ),
      jaOcorreu: CronogramaService.jaOcorreu(ats),
    };
  }
}
