import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AtividadeCronograma,
  CRONO_STATUS_AGENDA,
  StatusAgenda,
} from '../database/entities/atividade-cronograma.entity';
import { SlotCronograma } from '../database/entities/slot-cronograma.entity';
import {
  CronogramaConfig,
  ModoDisponibilidade,
} from '../database/entities/cronograma-config.entity';
import { CronogramaPeriodoBloqueado } from '../database/entities/cronograma-periodo-bloqueado.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { ChecklistModeloService } from '../catalogos/checklist-modelo.service';

export interface VisitaAgrupada {
  modulo: string;
  seq: number;
  atividades: AtividadeCronograma[];
}

export interface HorariosPorTurno {
  manha: { inicio: string; fim: string };
  tarde: { inicio: string; fim: string };
}

export interface CronogramaConfigDto {
  modoDisponibilidade: ModoDisponibilidade;
  dataInicio: string;
  diasTurnosExcluidos: string;
  analistaPadrao: string;
}

// Horário padrão por turno (HH:MM) quando o slot ainda não tem horário definido.
const TURNO_PADRAO: Record<'manha' | 'tarde', [string, string]> = {
  manha: ['08:00', '12:00'],
  tarde: ['13:00', '17:00'],
};

function seqInt(v: string | number | undefined): number | null {
  const n = parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/** Grupo de dia da semana (0=segunda..4=sexta) + turno excluído da distribuição automática. */
export interface DiaTurnoExcluido {
  diaSemana: number;
  turno: 'manha' | 'tarde';
}

export function parseDiasExcluidos(s: string): DiaTurnoExcluido[] {
  const out: DiaTurnoExcluido[] = [];
  for (const tok of (s || '').split(',')) {
    const t = tok.trim();
    if (!t || !t.includes('-')) continue;
    const [wdStr, turno] = t.split('-', 2);
    const wd = parseInt(wdStr, 10);
    if (
      Number.isFinite(wd) &&
      wd >= 0 &&
      wd <= 4 &&
      (turno === 'manha' || turno === 'tarde')
    ) {
      out.push({ diaSemana: wd, turno });
    }
  }
  return out;
}

export function serializarDiasExcluidos(lista: DiaTurnoExcluido[]): string {
  return lista.map((d) => `${d.diaSemana}-${d.turno}`).join(',');
}

/** Agendador de Visitas: atividades, visitas, alocação manual, horários, configuração da
 * distribuição, períodos sem agenda e status/postergação. Espelha webapp/routes_agenda.py +
 * as funções cronograma_* de webapp/db.py (exceto a distribuição automática — ver
 * distribuicao.service.ts). */
@Injectable()
export class CronogramaService {
  constructor(
    @InjectRepository(AtividadeCronograma)
    private readonly atividades: Repository<AtividadeCronograma>,
    @InjectRepository(SlotCronograma)
    private readonly slots: Repository<SlotCronograma>,
    @InjectRepository(CronogramaConfig)
    private readonly configs: Repository<CronogramaConfig>,
    @InjectRepository(CronogramaPeriodoBloqueado)
    private readonly periodos: Repository<CronogramaPeriodoBloqueado>,
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    private readonly checklist: ChecklistModeloService,
  ) {}

  /** Garante que as atividades do projeto já foram semeadas a partir do Check List dos
   * módulos contratados — chamado antes de qualquer leitura da agenda (mesmo padrão de
   * webapp/routes_agenda.py:projeto_agenda, que semeia a cada acesso à tela). */
  async garantirSeed(projetoId: number): Promise<void> {
    const projeto = await this.projetos.findOne({ where: { id: projetoId } });
    if (!projeto) return;
    await this.atividadesSeed(projetoId, projeto.modulos || '');
  }

  // --- Atividades / Visitas -------------------------------------------------------------

  /** Semeia (1ª vez) as atividades a partir do Check List dos módulos contratados, agrupadas
   * por módulo+seq (Visita). Idempotente. Devolve o total de atividades do projeto. */
  async atividadesSeed(projetoId: number, modulosStr: string): Promise<number> {
    const ja = await this.atividades.count({ where: { projetoId } });
    if (ja > 0) return ja;

    const siglas = (modulosStr || '')
      .split(/[,;\n]+/)
      .map((m) => m.trim().toUpperCase())
      .filter(Boolean);
    if (siglas.length === 0) return 0;

    const linhas = await this.checklist.listarPorModulos(siglas);
    const contador = new Map<string, number>();
    const novas: AtividadeCronograma[] = [];
    for (const r of linhas) {
      const seq = seqInt(r.seq);
      if (!seq || seq <= 0) continue;
      const menu = (r.menu || '').trim();
      const item = (r.item || '').trim();
      const desc =
        menu || item
          ? `${menu} - ${item}`.replace(/^[\s-]+|[\s-]+$/g, '')
          : (r.acao || '').trim();
      const chave = `${r.modulo}|${seq}`;
      const ordem = (contador.get(chave) ?? 0) + 1;
      contador.set(chave, ordem);
      novas.push(
        this.atividades.create({
          projetoId,
          modulo: r.modulo,
          seq,
          ordem,
          descricao: desc,
          tipo: (r.tipo || '').trim(),
          status: 'Solicitada',
        }),
      );
    }
    if (novas.length > 0) await this.atividades.save(novas);
    return novas.length;
  }

  async listarAtividades(projetoId: number): Promise<AtividadeCronograma[]> {
    return this.atividades.find({
      where: { projetoId },
      order: { modulo: 'ASC', seq: 'ASC', ordem: 'ASC', id: 'ASC' },
    });
  }

  async visitas(projetoId: number): Promise<VisitaAgrupada[]> {
    const ats = await this.listarAtividades(projetoId);
    const grupos = new Map<string, VisitaAgrupada>();
    for (const a of ats) {
      const chave = `${a.modulo}|${a.seq}`;
      let g = grupos.get(chave);
      if (!g) {
        g = { modulo: a.modulo, seq: a.seq, atividades: [] };
        grupos.set(chave, g);
      }
      g.atividades.push(a);
    }
    return [...grupos.values()].sort(
      (a, b) => a.modulo.localeCompare(b.modulo) || a.seq - b.seq,
    );
  }

  // --- Alocação --------------------------------------------------------------------------

  /** Cada campo undefined = não mexe; para data/turno, "" desaloca. `auto`: undefined = não
   * mexe; true/false marca se a alocação atual veio da distribuição automática. */
  async alocar(
    atividadeId: number,
    projetoId: number | undefined,
    campos: {
      data?: string;
      turno?: string;
      tecnico?: string;
      status?: string;
      auto?: boolean;
    },
  ): Promise<AtividadeCronograma | null> {
    const a = await this.atividades.findOne({ where: { id: atividadeId } });
    if (!a || (projetoId !== undefined && a.projetoId !== projetoId))
      return null;

    if (campos.data !== undefined) a.data = campos.data.trim();
    if (campos.turno !== undefined) a.turno = campos.turno.trim();
    if (
      (campos.data !== undefined || campos.turno !== undefined) &&
      campos.status === undefined
    ) {
      if (['', 'Solicitada', 'Agendada'].includes(a.status || '')) {
        a.status = a.data && a.turno ? 'Agendada' : 'Solicitada';
      }
    }
    if (campos.tecnico !== undefined) a.tecnico = campos.tecnico.trim();
    if (campos.status !== undefined)
      a.status = (campos.status.trim() || 'Solicitada') as StatusAgenda;
    if (campos.auto !== undefined) a.autoAgendado = campos.auto;

    return this.atividades.save(a);
  }

  async alocarVisita(
    projetoId: number,
    modulo: string,
    seq: number,
    dataDestino: string,
    turnoDestino: string,
    consultorDoModulo: string,
  ): Promise<number> {
    const ats = await this.atividades.find({
      where: { projetoId, modulo, seq },
    });
    const desalocar = !dataDestino && !turnoDestino;
    let n = 0;
    for (const a of ats) {
      if (!['', 'Solicitada', 'Agendada'].includes(a.status || '')) continue; // histórico não se move em bloco
      if (desalocar) {
        await this.alocar(a.id, projetoId, {
          data: '',
          turno: '',
          auto: false,
        });
      } else {
        const t = (a.tecnico || '').trim() || consultorDoModulo || '';
        await this.alocar(a.id, projetoId, {
          data: dataDestino,
          turno: turnoDestino,
          ...(t ? { tecnico: t } : {}),
          auto: false,
        });
      }
      n++;
    }
    return n;
  }

  // --- Horários ----------------------------------------------------------------------------

  async horarios(projetoId: number): Promise<HorariosPorTurno> {
    const rows = await this.slots.find({ where: { projetoId, data: '' } });
    const porTurno = new Map(rows.map((r) => [r.turno, r]));
    const de = (t: 'manha' | 'tarde') => {
      const r = porTurno.get(t);
      const [di, df] = TURNO_PADRAO[t];
      return { inicio: r?.horaInicio || di, fim: r?.horaFim || df };
    };
    return { manha: de('manha'), tarde: de('tarde') };
  }

  async horarioSalvar(
    projetoId: number,
    turno: string,
    horaInicio: string,
    horaFim: string,
  ): Promise<{ turno: string; horaInicio: string; horaFim: string } | null> {
    if (turno !== 'manha' && turno !== 'tarde') return null;
    let r = await this.slots.findOne({ where: { projetoId, data: '', turno } });
    if (!r) r = this.slots.create({ projetoId, data: '', turno });
    r.horaInicio = (horaInicio || '').trim();
    r.horaFim = (horaFim || '').trim();
    await this.slots.save(r);
    return { turno, horaInicio: r.horaInicio, horaFim: r.horaFim };
  }

  // --- Configuração da distribuição --------------------------------------------------------

  async config(projetoId: number): Promise<CronogramaConfigDto> {
    const c = await this.configs.findOne({ where: { projetoId } });
    const modo = c?.modoDisponibilidade;
    return {
      modoDisponibilidade:
        modo === 'conjunta' || modo === 'individual' ? modo : 'conjunta',
      dataInicio: c?.dataInicio || '',
      diasTurnosExcluidos: c?.diasTurnosExcluidos || '',
      analistaPadrao: c?.analistaPadrao || '',
    };
  }

  async configSalvar(
    projetoId: number,
    campos: {
      modo?: string;
      dataInicio?: string;
      diasTurnosExcluidos?: string;
      analistaPadrao?: string;
    },
  ): Promise<CronogramaConfigDto> {
    let c = await this.configs.findOne({ where: { projetoId } });
    if (!c) c = this.configs.create({ projetoId });
    const modo = (campos.modo || '').trim();
    if (modo === 'conjunta' || modo === 'individual')
      c.modoDisponibilidade = modo;
    if (campos.dataInicio !== undefined)
      c.dataInicio = campos.dataInicio.trim();
    if (campos.diasTurnosExcluidos !== undefined)
      c.diasTurnosExcluidos = campos.diasTurnosExcluidos.trim();
    if (campos.analistaPadrao !== undefined)
      c.analistaPadrao = campos.analistaPadrao.trim();
    await this.configs.save(c);
    return this.config(projetoId);
  }

  // --- Períodos sem agenda -------------------------------------------------------------------

  async periodosBloqueados(
    projetoId: number,
  ): Promise<CronogramaPeriodoBloqueado[]> {
    return this.periodos.find({
      where: { projetoId },
      order: { dataIni: 'ASC' },
    });
  }

  static tecnicosDoPeriodo(p: CronogramaPeriodoBloqueado): string[] {
    return (p.tecnicos || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async periodoBloqueadoCriar(
    projetoId: number,
    dataIniBruta: string,
    dataFimBruta: string,
    motivo = '',
    tecnicos: string[] = [],
  ): Promise<CronogramaPeriodoBloqueado | null> {
    const dataIni = (dataIniBruta || '').trim();
    const dataFim = (dataFimBruta || '').trim();
    if (!dataIni || !dataFim || dataFim < dataIni) return null;
    const tecs = [
      ...new Set(tecnicos.map((t) => (t || '').trim()).filter(Boolean)),
    ]
      .sort()
      .join(',');
    const p = this.periodos.create({
      projetoId,
      dataIni,
      dataFim,
      motivo: (motivo || '').trim(),
      tecnicos: tecs,
    });
    return this.periodos.save(p);
  }

  async periodoBloqueadoExcluir(
    periodoId: number,
    projetoId: number,
  ): Promise<boolean> {
    const p = await this.periodos.findOne({ where: { id: periodoId } });
    if (!p || p.projetoId !== projetoId) return false;
    await this.periodos.remove(p);
    return true;
  }

  // --- Status / postergação -------------------------------------------------------------------

  async status(
    atividadeId: number,
    projetoId: number,
    novoStatus: string,
  ): Promise<AtividadeCronograma | null> {
    const s = (novoStatus || '').trim();
    if (!CRONO_STATUS_AGENDA.includes(s as StatusAgenda)) return null;
    const a = await this.atividades.findOne({ where: { id: atividadeId } });
    if (!a || a.projetoId !== projetoId) return null;
    a.status = s as StatusAgenda;
    return this.atividades.save(a);
  }

  async postergar(
    atividadeId: number,
    projetoId: number,
    novaDataBruta: string,
    novoTurnoBruto: string,
  ): Promise<{
    original: AtividadeCronograma;
    novo: AtividadeCronograma;
  } | null> {
    const novaData = (novaDataBruta || '').trim();
    const novoTurno = (novoTurnoBruto || '').trim();
    if (!novaData || (novoTurno !== 'manha' && novoTurno !== 'tarde'))
      return null;
    const a = await this.atividades.findOne({ where: { id: atividadeId } });
    if (!a || a.projetoId !== projetoId || !(a.data && a.turno)) return null;

    a.status = 'Postergada';
    a.novaData = novaData;
    a.novoTurno = novoTurno;
    const original = await this.atividades.save(a);

    const clone = this.atividades.create({
      projetoId: a.projetoId,
      modulo: a.modulo,
      seq: a.seq,
      ordem: a.ordem,
      descricao: a.descricao,
      tipo: a.tipo,
      tecnico: a.tecnico,
      data: novaData,
      turno: novoTurno,
      status: 'Agendada',
      isCopia: true,
      origemId: a.id,
    });
    const novo = await this.atividades.save(clone);
    return { original, novo };
  }

  async postergarLote(
    projetoId: number,
    alvo: { atividadeId?: number; data?: string; turno?: string },
    novaData: string,
    novoTurno: string,
  ): Promise<number> {
    let ids: number[] = [];
    if (alvo.atividadeId) {
      ids = [alvo.atividadeId];
    } else if (alvo.data && alvo.turno) {
      const ats = await this.atividades.find({
        where: { projetoId, data: alvo.data, turno: alvo.turno },
      });
      ids = ats.filter((a) => a.status !== 'Postergada').map((a) => a.id);
    }
    let n = 0;
    for (const id of ids) {
      const r = await this.postergar(id, projetoId, novaData, novoTurno);
      if (r) n++;
    }
    return n;
  }

  async postergarVisita(
    projetoId: number,
    modulo: string,
    seq: number,
    novaData: string,
    novoTurno: string,
  ): Promise<number> {
    if (
      !modulo ||
      !seq ||
      !novaData ||
      (novoTurno !== 'manha' && novoTurno !== 'tarde')
    )
      return 0;
    const ats = await this.atividades.find({
      where: { projetoId, modulo, seq },
    });
    const alvos = ats.filter(
      (a) =>
        a.data &&
        a.turno &&
        !['Postergada', 'Cancelada'].includes(a.status || ''),
    );
    let n = 0;
    for (const a of alvos) {
      const r = await this.postergar(a.id, projetoId, novaData, novoTurno);
      if (r) n++;
    }
    return n;
  }

  async atividadeExcluir(
    atividadeId: number,
    projetoId: number,
  ): Promise<{ ok: boolean; mensagem: string }> {
    const a = await this.atividades.findOne({ where: { id: atividadeId } });
    if (!a || a.projetoId !== projetoId)
      return { ok: false, mensagem: 'Atividade não encontrada.' };
    if (a.status !== 'Postergada') {
      return {
        ok: false,
        mensagem: 'Só é possível excluir uma visita/assunto já Postergada.',
      };
    }
    await this.atividades.remove(a);
    return { ok: true, mensagem: 'Excluído.' };
  }

  // --- Regras compartilhadas com a distribuição automática ---------------------------------

  static jaOcorreu(ats: AtividadeCronograma[]): boolean {
    return ats.some((a) =>
      ['Realizada', 'Não Realizada'].includes(a.status || ''),
    );
  }

  /** Motivo (string) que impede alocar neste dia/turno, ou null se liberado. A checagem de
   * disponibilidade externa (SICLA) ainda não foi convertida — pendência do item 5 da
   * migração (ver docs/migracao/03-documento-conversao.md); por ora só data passada e
   * período sem agenda do projeto são checados aqui. */
  async slotIndisponivel(
    data: string,
    turno: string,
    projetoId?: number,
    tecnico?: string,
  ): Promise<string | null> {
    const d = (data || '').trim();
    if (!d) return null;
    const hoje = new Date().toISOString().slice(0, 10);
    if (d < hoje)
      return 'Não é possível agendar em data passada — escolha hoje ou uma data futura.';
    if (projetoId !== undefined) {
      const p = await this.periodoQueBloqueia(projetoId, d, tecnico);
      if (p) {
        const motivo = p.motivo ? ` — ${p.motivo}` : '';
        const quem = p.tecnicos ? ` (${p.tecnicos})` : '';
        const ini = `${p.dataIni.slice(8, 10)}/${p.dataIni.slice(5, 7)}`;
        const fim = `${p.dataFim.slice(8, 10)}/${p.dataFim.slice(5, 7)}`;
        return `Período sem agenda de ${ini} a ${fim}${quem}${motivo}.`;
      }
    }
    return null;
  }

  async periodoQueBloqueia(
    projetoId: number,
    dataIso: string,
    tecnico?: string,
  ): Promise<CronogramaPeriodoBloqueado | null> {
    const tec = (tecnico || '').trim();
    const lista = await this.periodosBloqueados(projetoId);
    for (const p of lista) {
      if (!(p.dataIni <= dataIso && dataIso <= p.dataFim)) continue;
      const tecs = CronogramaService.tecnicosDoPeriodo(p);
      if (tecs.length === 0 || (tec && tecs.includes(tec))) return p;
    }
    return null;
  }
}
