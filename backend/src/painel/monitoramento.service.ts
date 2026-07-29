import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { Documento } from '../database/entities/documento.entity';
import { CronogramaItem } from '../database/entities/cronograma-item.entity';
import { ChecklistItem } from '../database/entities/checklist-item.entity';
import { Designacao } from '../database/entities/designacao.entity';
import { ETAPAS } from '../common/constants/perfis';
import {
  Alerta,
  MetricasService,
  ResultadoMetricas,
} from '../metricas/metricas.service';
import { UsersService } from '../users/users.service';
import { construirDocsMap } from './docs-map.util';
import {
  estadoSetor,
  EstadoSetor,
  formatarDataHoraBr,
  idadeMedia,
  parseData,
  pessoas,
  pnum,
} from './monitoramento.util';

export interface SetorMonitoramento {
  nome: string;
  estado: EstadoSetor;
  estadoLabel: string;
  andamento: number;
  concluidas: number;
  pendentes: number;
  atrasadas: number;
  aprovacao: number;
  responsaveis: string[];
  tempoMedio: number | null;
  alertas: string[];
}

export interface LinhaCarga {
  nome: string;
  projetos: number;
  horas: number;
  alertas: number;
}

export interface EntregaProxima {
  cliente: string;
  projetoId: number;
  tipo: string;
  data: Date;
  dias: number;
  setor: string;
}

export interface LinhaMapa {
  id: number;
  cliente: string;
  etapa: string;
  situacao: string;
  progresso: number;
  consultor: string;
  alertas: number;
  risco: boolean;
  atrasado: boolean;
}

export interface UsuariosPorPerfilNomes {
  adm: string[];
  coordenador: string[];
  gci: string[];
  consultor: string[];
}

export interface ResultadoMonitoramento {
  m: ResultadoMetricas;
  alertas: Alerta[];
  setores: SetorMonitoramento[];
  saude: number;
  fluxo: { nome: string; n: number; pct: number }[];
  mapa: LinhaMapa[];
  entregas: EntregaProxima[];
  carga: LinhaCarga[];
  atualizadoEm: string;
  chartSetores: {
    labels: string[];
    pendentes: number[];
    atrasadas: number[];
    andamento: number[];
  };
}

const ETAPAS_PRECISA_CONSULTOR = new Set([
  'Designação',
  'Cronograma e Check-list',
  'Encerramento',
]);
const DEV_KW = ['desenv', 'custom', 'integra', 'rns', 'orc', 'cob', 'api'];

/** Centro de Monitoramento Operacional: consolida a carteira em visão executiva —
 * 8 "setores" inferidos (não são uma tabela própria, só contagens/keywords sobre
 * projetos/gates/cronograma/checklist/alertas), score de saúde, carga por colaborador,
 * próximas entregas e mapa de progresso. Espelha
 * webapp/routes_painel.py:_monitoramento_operacional/monitoramento — a função mais
 * complexa do Flask original. O parâmetro `eventos` do original nunca era lido dentro da
 * função (parâmetro morto) — não foi portado.
 *
 * ESCOPO (correção de 2026-07-28): carteira INTEIRA, igual à Coordenação/Atividade — o gate
 * é o menu `centro_operacional` do painel de Permissões. Com o filtro por designação, quem
 * tinha o menu liberado e não é ADM/Coordenador/Administrativo via os 8 setores zerados. */
@Injectable()
export class MonitoramentoService {
  constructor(
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    @InjectRepository(Documento)
    private readonly documentos: Repository<Documento>,
    @InjectRepository(CronogramaItem)
    private readonly cronogramaRepo: Repository<CronogramaItem>,
    @InjectRepository(ChecklistItem)
    private readonly checklistRepo: Repository<ChecklistItem>,
    @InjectRepository(Designacao)
    private readonly designacoesRepo: Repository<Designacao>,
    private readonly metricas: MetricasService,
    private readonly users: UsersService,
  ) {}

  async painel(): Promise<ResultadoMonitoramento> {
    const todos = await this.projetos.find();
    const ids = todos.map((p) => p.id);

    const [
      documentos,
      cronos,
      checks,
      designacoes,
      usuariosAdm,
      usuariosCoord,
      usuariosAdmPerfil,
      usuariosGci,
      usuariosCons,
    ] = await Promise.all([
      ids.length > 0
        ? this.documentos.find({ where: { projetoId: In(ids) } })
        : Promise.resolve([]),
      ids.length > 0
        ? this.cronogramaRepo.find({ where: { projetoId: In(ids) } })
        : Promise.resolve([]),
      ids.length > 0
        ? this.checklistRepo.find({ where: { projetoId: In(ids) } })
        : Promise.resolve([]),
      ids.length > 0
        ? this.designacoesRepo.find({ where: { projetoId: In(ids) } })
        : Promise.resolve([]),
      this.users.porPerfil('Administrativo'),
      this.users.porPerfil('Coordenador'),
      this.users.porPerfil('ADM'),
      this.users.porPerfil('GCI'),
      this.users.porPerfil('Consultor'),
    ]);

    const usuariosPorPerfil: UsuariosPorPerfilNomes = {
      adm: usuariosAdm.map((u) => u.nome),
      coordenador: [...usuariosCoord, ...usuariosAdmPerfil].map((u) => u.nome),
      gci: usuariosGci.map((u) => u.nome),
      consultor: usuariosCons.map((u) => u.nome),
    };

    return this.avaliar(
      todos,
      construirDocsMap(documentos),
      cronos,
      checks,
      designacoes,
      usuariosPorPerfil,
    );
  }

  avaliar(
    projetos: Projeto[],
    docsMap: Record<number, { tipo: string }[]>,
    cronos: CronogramaItem[],
    checks: ChecklistItem[],
    designacoes: Designacao[],
    usuariosPorPerfil: UsuariosPorPerfilNomes,
  ): ResultadoMonitoramento {
    const hoje = new Date();
    const hojeMeia = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate(),
    );
    const ativos = projetos.filter((p) => p.situacao !== 'Concluído');
    const concluidos = projetos.filter((p) => p.situacao === 'Concluído');
    const porId = new Map(projetos.map((p) => [p.id, p]));
    const m = this.metricas.metricas(projetos, docsMap);
    const alertas = this.metricas.alertas(projetos, docsMap);
    const alertasPorPid = new Map<number, Alerta[]>();
    for (const a of alertas) {
      const lista = alertasPorPid.get(a.projetoId) ?? [];
      lista.push(a);
      alertasPorPid.set(a.projetoId, lista);
    }

    const faltasPorPid = new Map<number, string[]>();
    for (const p of ativos) {
      faltasPorPid.set(
        p.id,
        this.metricas.gateStatus(p.etapa, docsMap[p.id] ?? []).faltam,
      );
    }

    const cronoPend = cronos.filter(
      (c) => c.status !== 'Concluído' && c.status !== 'Cancelado',
    );
    const cronoOk = cronos.filter((c) => c.status === 'Concluído');
    const cronoAtrasado = cronoPend.filter((c) => {
      const d = parseData(c.data);
      return d !== null && d < hojeMeia;
    });
    const checkPend = checks.filter(
      (c) => c.status !== 'Concluído' && c.status !== 'N/A',
    );
    const checkOk = checks.filter((c) => c.status === 'Concluído');

    const devChecks = checks.filter((c) => {
      const texto = `${c.item} ${c.obs}`.toLowerCase();
      return DEV_KW.some((k) => texto.includes(k));
    });
    const devPend = devChecks.filter(
      (c) => c.status !== 'Concluído' && c.status !== 'N/A',
    );
    const devIds = new Set(devChecks.map((c) => c.projetoId));
    for (const p of projetos) {
      const texto = `${p.modulos || ''} ${p.observacoes || ''}`.toLowerCase();
      if (DEV_KW.some((k) => texto.includes(k))) devIds.add(p.id);
    }

    const setor = (
      nome: string,
      ids: Iterable<number>,
      andamento: number,
      concluidasSetor: number,
      pendentes: number,
      atrasadas: number,
      aprovacao = 0,
      responsaveis: string[] = [],
      alertasTxt: string[] = [],
    ): SetorMonitoramento => {
      const rel = [...ids]
        .map((i) => porId.get(i))
        .filter((p): p is Projeto => !!p);
      const [estado, label] = estadoSetor(
        andamento,
        pendentes,
        atrasadas,
        aprovacao,
        concluidasSetor,
      );
      return {
        nome,
        estado,
        estadoLabel: label,
        andamento,
        concluidas: concluidasSetor,
        pendentes,
        atrasadas,
        aprovacao,
        responsaveis,
        tempoMedio: idadeMedia(rel),
        alertas: alertasTxt.slice(0, 3),
      };
    };

    const agendamento = ativos.filter((p) => p.etapa === 'Agendamento');
    const comercialPend = agendamento.reduce(
      (acc, p) => acc + this.metricas.camposFaltantes('Agendamento', p).length,
      0,
    );
    const comercialAtraso = agendamento.filter(
      (p) =>
        p.criadoEm &&
        Math.floor(
          (hoje.getTime() - new Date(p.criadoEm).getTime()) / 86_400_000,
        ) >= 2,
    );

    const adminIds = new Set(
      ativos
        .filter(
          (p) => (faltasPorPid.get(p.id)?.length ?? 0) > 0 || !p.responsavel,
        )
        .map((p) => p.id),
    );
    let adminFaltas = 0;
    for (const v of faltasPorPid.values()) adminFaltas += v.length;
    const adminSla = alertas.filter((a) => a.tipo === 'sla');

    const coordPend = ativos.filter(
      (p) => !p.gci || (ETAPAS_PRECISA_CONSULTOR.has(p.etapa) && !p.consultor),
    );
    const coordAprov = ativos.filter((p) => p.situacao === 'Em risco');

    const gciIds = new Set(
      ativos
        .filter(
          (p) =>
            p.gci || p.etapa === 'Levantamento' || p.etapa === 'Designação',
        )
        .map((p) => p.id),
    );
    const gciPend = ativos.filter(
      (p) =>
        p.etapa === 'Levantamento' &&
        (faltasPorPid.get(p.id) ?? []).includes('Mapeamento (Levantamento)'),
    );
    const gciAtraso = ativos.filter((p) => {
      if (p.etapa !== 'Agendamento' && p.etapa !== 'Levantamento') return false;
      const d = parseData(p.dataLevantamento);
      return d !== null && d < hojeMeia;
    });

    const consultoriaIds = new Set(
      ativos
        .filter(
          (p) =>
            p.consultor ||
            p.etapa === 'Cronograma e Check-list' ||
            p.etapa === 'Encerramento',
        )
        .map((p) => p.id),
    );
    for (const c of cronoPend) consultoriaIds.add(c.projetoId);
    for (const c of checkPend) consultoriaIds.add(c.projetoId);
    const implantacaoIds = new Set(
      ativos.filter((p) => p.etapa !== 'Agendamento').map((p) => p.id),
    );
    const suporteIds = new Set(
      projetos
        .filter((p) => p.etapa === 'Encerramento' || p.situacao === 'Concluído')
        .map((p) => p.id),
    );
    const suportePend = ativos.filter((p) => p.etapa === 'Encerramento');
    const suporteAtraso = alertas.filter((a) => a.tipo === 'encerramento');

    const designados = designacoes
      .filter((d) => d.consultor)
      .map((d) => d.consultor);

    const idsAtivos = new Set(ativos.map((p) => p.id));
    const projetosNaoAgendamento = projetos.filter(
      (p) => p.etapa !== 'Agendamento',
    ).length;
    const projetosSemAgendamentoLevantamento = projetos.filter(
      (p) => p.etapa !== 'Agendamento' && p.etapa !== 'Levantamento',
    ).length;

    const setores: SetorMonitoramento[] = [
      setor(
        'Comercial',
        agendamento.map((p) => p.id),
        agendamento.length,
        projetosNaoAgendamento,
        comercialPend,
        comercialAtraso.length,
        0,
        pessoas(agendamento.map((p) => p.responsavel)),
        comercialPend ? ['Fechamentos aguardando dados ou encaminhamento'] : [],
      ),
      setor(
        'Administrativo',
        adminIds,
        adminIds.size,
        Object.keys(docsMap).length,
        adminFaltas,
        adminSla.length,
        0,
        pessoas(
          usuariosPorPerfil.adm,
          ativos.map((p) => p.responsavel),
        ),
        adminSla.map((a) => a.msg),
      ),
      setor(
        'Coordenação',
        ativos.map((p) => p.id),
        ativos.length,
        concluidos.length,
        coordPend.length,
        alertas.filter((a) => a.nivel === 'alto').length,
        coordAprov.length,
        pessoas(usuariosPorPerfil.coordenador),
        alertas.filter((a) => a.nivel === 'alto').map((a) => a.msg),
      ),
      setor(
        'GCI',
        gciIds,
        gciIds.size,
        projetosSemAgendamentoLevantamento,
        gciPend.length,
        gciAtraso.length,
        0,
        pessoas(
          usuariosPorPerfil.gci,
          ativos.map((p) => p.gci),
        ),
        gciAtraso.length || gciPend.length
          ? ['Levantamento vencido ou mapeamento pendente']
          : [],
      ),
      setor(
        'Consultoria',
        consultoriaIds,
        consultoriaIds.size,
        cronoOk.length + checkOk.length,
        cronoPend.length + checkPend.length,
        cronoAtrasado.length,
        0,
        pessoas(
          usuariosPorPerfil.consultor,
          ativos.map((p) => p.consultor),
          designados,
        ),
        cronoPend.length || checkPend.length
          ? ['Cronograma/check-list com linhas pendentes']
          : [],
      ),
      setor(
        'Implantação',
        implantacaoIds,
        implantacaoIds.size,
        concluidos.length,
        m.gatePendente,
        m.nAtrasados,
        m.emRisco.length,
        pessoas(
          ativos.map((p) => p.gci),
          ativos.map((p) => p.consultor),
        ),
        alertas.slice(0, 3).map((a) => a.msg),
      ),
      setor(
        'Suporte',
        suporteIds,
        suportePend.length,
        concluidos.length,
        suportePend.length,
        suporteAtraso.length,
        0,
        pessoas(
          suportePend.map((p) => p.consultor),
          ['Suporte'],
        ),
        suporteAtraso.map((a) => a.msg),
      ),
      setor(
        'Desenvolvimento',
        devIds,
        [...devIds].filter((i) => idsAtivos.has(i)).length,
        devChecks.filter((c) => c.status === 'Concluído').length,
        devPend.length,
        0,
        0,
        pessoas(
          devChecks.map((c) => c.responsavel),
          ['Desenvolvimento'],
        ),
        devPend.length ? ['Itens técnicos/customizações pendentes'] : [],
      ),
    ];

    interface CargaAcc {
      nome: string;
      projetos: Set<number>;
      horas: number;
      atrasos: number;
    }
    const carga = new Map<string, CargaAcc>();
    for (const p of ativos) {
      const horas = pnum(p.horasCobradas) + pnum(p.horasBonificadas);
      for (const nome of pessoas(p.gci, p.consultor)) {
        const c = carga.get(nome) ?? {
          nome,
          projetos: new Set<number>(),
          horas: 0,
          atrasos: 0,
        };
        c.projetos.add(p.id);
        c.horas += horas;
        if ((alertasPorPid.get(p.id) ?? []).length > 0) c.atrasos += 1;
        carga.set(nome, c);
      }
    }
    for (const d of designacoes) {
      if (d.consultor) {
        const c = carga.get(d.consultor) ?? {
          nome: d.consultor,
          projetos: new Set<number>(),
          horas: 0,
          atrasos: 0,
        };
        c.projetos.add(d.projetoId);
        carga.set(d.consultor, c);
      }
    }
    const cargaColab: LinhaCarga[] = [...carga.values()].map((c) => ({
      nome: c.nome,
      projetos: c.projetos.size,
      horas: Math.round(c.horas),
      alertas: c.atrasos,
    }));
    cargaColab.sort((a, b) => {
      if (b.projetos !== a.projetos) return b.projetos - a.projetos;
      if (b.horas !== a.horas) return b.horas - a.horas;
      return a.nome.localeCompare(b.nome);
    });

    const CAMPOS_DATA: {
      campo: 'dataLevantamento' | 'dataUsoOficial';
      label: string;
      setor: string;
    }[] = [
      { campo: 'dataLevantamento', label: 'Levantamento', setor: 'GCI' },
      { campo: 'dataUsoOficial', label: 'Go-live', setor: 'Implantação' },
    ];
    const entregas: EntregaProxima[] = [];
    for (const p of ativos) {
      for (const { campo, label, setor: setorNome } of CAMPOS_DATA) {
        const data = parseData(p[campo]);
        if (data) {
          entregas.push({
            cliente: p.cliente,
            projetoId: p.id,
            tipo: label,
            data,
            dias: Math.floor(
              (data.getTime() - hojeMeia.getTime()) / 86_400_000,
            ),
            setor: setorNome,
          });
        }
      }
    }
    for (const c of cronoPend) {
      const data = parseData(c.data);
      const projeto = porId.get(c.projetoId);
      if (data && projeto) {
        entregas.push({
          cliente: projeto.cliente,
          projetoId: c.projetoId,
          tipo: c.etapa || 'Cronograma',
          data,
          dias: Math.floor((data.getTime() - hojeMeia.getTime()) / 86_400_000),
          setor: 'Consultoria',
        });
      }
    }
    entregas.sort((a, b) => a.data.getTime() - b.data.getTime());

    const totalEtapas = Math.max(1, ETAPAS.length - 1);
    const mapa: LinhaMapa[] = ativos.map((p) => {
      const idx = this.metricas.macroIdx(p.etapa);
      const progresso =
        p.situacao === 'Concluído'
          ? 100
          : Math.round((idx / totalEtapas) * 100);
      const al = alertasPorPid.get(p.id) ?? [];
      return {
        id: p.id,
        cliente: p.cliente,
        etapa: p.etapa,
        situacao: p.situacao,
        progresso,
        consultor: p.consultor || p.gci || '—',
        alertas: al.length,
        risco: p.situacao === 'Em risco',
        atrasado: al.some((a) => a.tipo === 'atraso'),
      };
    });
    mapa.sort((a, b) => {
      const aAtr = a.atrasado ? 0 : 1;
      const bAtr = b.atrasado ? 0 : 1;
      if (aAtr !== bAtr) return aAtr - bAtr;
      const aRisco = a.risco ? 0 : 1;
      const bRisco = b.risco ? 0 : 1;
      if (aRisco !== bRisco) return aRisco - bRisco;
      if (b.alertas !== a.alertas) return b.alertas - a.alertas;
      return (a.cliente || '').localeCompare(b.cliente || '');
    });

    let saude = 100;
    saude -= Math.min(35, m.nAtrasados * 10);
    saude -= Math.min(25, m.nRisco * 8);
    saude -= Math.min(20, m.gatePendente * 3);
    saude -= Math.min(
      20,
      setores.filter((s) => s.estado === 'sobrecarregado').length * 8,
    );
    saude = Math.max(0, saude);

    const fluxo = ETAPAS.map((e) => ({
      nome: e,
      n: m.porEtapa[e] ?? 0,
      pct: Math.round(((m.porEtapa[e] ?? 0) / Math.max(1, m.total)) * 100),
    }));

    return {
      m,
      alertas,
      setores,
      saude,
      fluxo,
      mapa: mapa.slice(0, 14),
      entregas: entregas.slice(0, 10),
      carga: cargaColab.slice(0, 10),
      atualizadoEm: formatarDataHoraBr(new Date()),
      chartSetores: {
        labels: setores.map((s) => s.nome),
        pendentes: setores.map((s) => s.pendentes),
        atrasadas: setores.map((s) => s.atrasadas),
        andamento: setores.map((s) => s.andamento),
      },
    };
  }
}
