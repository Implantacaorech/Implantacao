import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository } from 'typeorm';
import { Usuario } from '../database/entities/usuario.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { AtividadeCronograma } from '../database/entities/atividade-cronograma.entity';
import type { Perfil } from '../common/constants/perfis';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { MatrizService } from '../matriz/matriz.service';
import {
  addDays,
  hojeIso,
  parseIso,
  toIso,
  weekdaySegunda0,
} from '../cronograma/datas.util';

const TURNOS_SEMANA = 10; // 5 dias úteis x 2 turnos — ver webapp/capacidade.py
const LIVRE_MIN = 6; // turnos livres na semana p/ considerá-la "janela de início"
const CARGA_CHEIA = 3; // nº de clientes ativos que zera a parcela de carga do score

export interface ProjetoCapacidade {
  cliente: string;
  golive: string;
}

export interface LinhaCapacidade {
  nome: string;
  perfil: Perfil;
  sicla: string;
  clientes: number;
  projetos: ProjetoCapacidade[];
  liberaEm: string;
  livresSemana: number[];
  janela: string;
  notasModulos: Record<string, number>;
  semNota: string[];
  media: number;
  temMatriz: boolean;
  score: number;
  veredito: string;
}

export interface ResultadoCapacidade {
  equipe: LinhaCapacidade[];
  semanas: string[];
  modulos: string[];
  turnosSemana: number;
}

function tokens(txt: string): string[] {
  return (txt || '')
    .replace(/;/g, ',')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/** Capacidade da equipe: cruza 4 sinais (conhecimento na Matriz, agenda — Painel + SICLA,
 * carga de clientes ativos, próxima liberação/go-live) para responder ao Comercial se dá
 * para receber um cliente novo e quando começar. Espelha webapp/capacidade.py. */
@Injectable()
export class CapacidadeService {
  private readonly logger = new Logger('CapacidadeService');

  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    @InjectRepository(AtividadeCronograma)
    private readonly atividades: Repository<AtividadeCronograma>,
    private readonly disponibilidade: DisponibilidadeService,
    private readonly matriz: MatrizService,
  ) {}

  private semanas(qtd: number): [string, string][] {
    const hoje = parseIso(hojeIso());
    const seg0 = addDays(hoje, -weekdaySegunda0(hoje));
    const out: [string, string][] = [];
    for (let i = 0; i < qtd; i++) {
      const s = addDays(seg0, i * 7);
      const f = addDays(s, 4);
      out.push([toIso(s), toIso(f)]);
    }
    return out;
  }

  async avaliarEquipe(
    modulosBrutos: string[] = [],
    semanasQtd = 6,
  ): Promise<ResultadoCapacidade> {
    const modulos = modulosBrutos
      .map((m) => m.trim().toUpperCase())
      .filter(Boolean);
    const hojeIsoStr = hojeIso();
    const jan = this.semanas(semanasQtd);
    const ini = jan[0][0];
    const fim = jan[jan.length - 1][1];

    const usuarios = await this.usuarios.find({
      where: { perfil: In(['Consultor', 'GCI'] as Perfil[]), ativo: true },
      order: { nome: 'ASC' },
    });
    const projetos = await this.projetos.find({
      where: { etapa: Not('Encerramento') },
    });
    const atividades = await this.atividades.find({
      where: {
        data: Between(ini, fim),
        status: In(['Solicitada', 'Agendada']),
      },
    });

    const codigos = usuarios
      .map((u) => u.codigoSicla || u.nome || '')
      .filter(Boolean);
    let ocupSicla: Record<string, boolean> = {};
    if (this.disponibilidade.configurado() && codigos.length > 0) {
      try {
        ocupSicla = await this.disponibilidade.ocupacaoPorSlotCache(
          ini,
          fim,
          codigos,
        );
      } catch (e) {
        this.logger.error(
          'Falha ao consultar disponibilidade externa na Capacidade da equipe',
          e instanceof Error ? e.stack : String(e),
        );
      }
    }

    const matrizPorNome = new Map<
      string,
      Awaited<ReturnType<typeof this.matriz.listar>>[number]
    >();
    for (const t of await this.matriz.listar()) {
      const nl = (t.nome || '').trim().toLowerCase();
      if (nl) matrizPorNome.set(nl, t);
    }

    const equipe: LinhaCapacidade[] = usuarios.map((u) => {
      const chaves = new Set([...tokens(u.codigoSicla), ...tokens(u.nome)]);

      // 3. carga: projetos ativos em que aparece como consultor ou GCI
      const meus = projetos.filter((p) => {
        const donos = new Set([...tokens(p.consultor), ...tokens(p.gci)]);
        return [...chaves].some((c) => donos.has(c));
      });

      // 4. próxima liberação (go-live futuro mais próximo)
      const golives = meus
        .map((p) => p.dataUsoOficial || '')
        .filter((g) => g && g >= hojeIsoStr)
        .sort();
      const liberaEm = golives[0] ?? '';

      // 2. agenda: turnos ocupados por semana (painel + SICLA)
      const ocupDatas = new Set<string>();
      for (const a of atividades) {
        if (chaves.has((a.tecnico || '').trim().toLowerCase())) {
          ocupDatas.add(`${a.data}|${a.turno}`);
        }
      }
      for (const [chave, valor] of Object.entries(ocupSicla)) {
        if (!valor) continue;
        const [tec, data, turno] = chave.split('|');
        if (chaves.has(tec)) ocupDatas.add(`${data}|${turno}`);
      }
      const livresSemana: number[] = [];
      let janela = '';
      for (const [seg, sex] of jan) {
        let oc = 0;
        for (const chave of ocupDatas) {
          const data = chave.split('|')[0];
          if (data >= seg && data <= sex) oc++;
        }
        const livres = Math.max(0, TURNOS_SEMANA - oc);
        livresSemana.push(livres);
        if (!janela && livres >= LIVRE_MIN && sex >= hojeIsoStr) {
          janela = seg >= hojeIsoStr ? seg : hojeIsoStr;
        }
      }

      // 1. conhecimento nos módulos pedidos
      const linha =
        [...chaves].map((c) => matrizPorNome.get(c)).find(Boolean) ?? null;
      const notasMod: Record<string, number> = {};
      let semNota: string[] = [];
      if (linha) {
        const notas = this.matriz.notas(linha);
        const notasCi: Record<string, number> = {};
        for (const [k, v] of Object.entries(notas))
          notasCi[k.trim().toUpperCase()] = v;
        for (const m of modulos) {
          if (m in notasCi) notasMod[m] = notasCi[m];
          else semNota.push(m);
        }
      } else {
        semNota = [...modulos];
      }
      const valoresNotas = Object.values(notasMod);
      const media =
        valoresNotas.length > 0
          ? valoresNotas.reduce((a, b) => a + b, 0) / valoresNotas.length
          : 0;

      // score explicável
      const pCon = modulos.length > 0 ? media / 10 : 0.5; // sem recorte: neutro
      const pAg =
        jan.length > 0
          ? livresSemana.reduce((a, b) => a + b, 0) /
            (TURNOS_SEMANA * jan.length)
          : 0;
      const pCg = Math.max(0, 1 - meus.length / CARGA_CHEIA);
      const score = Math.round(100 * (0.45 * pCon + 0.35 * pAg + 0.2 * pCg));

      let veredito: string;
      if (modulos.length > 0 && Object.keys(notasMod).length === 0) {
        veredito = 'Sem nota nos módulos';
      } else if (!janela) {
        veredito = 'Sem janela no período';
      } else if (
        (modulos.length === 0 || media >= 6) &&
        meus.length < CARGA_CHEIA
      ) {
        veredito = 'Pronto';
      } else {
        veredito = 'Parcial';
      }

      return {
        nome: u.nome || u.login,
        perfil: u.perfil,
        sicla: u.codigoSicla || '',
        clientes: meus.length,
        projetos: meus.map((p) => ({
          cliente: p.cliente,
          golive: p.dataUsoOficial || '',
        })),
        liberaEm,
        livresSemana,
        janela,
        notasModulos: notasMod,
        semNota,
        media: Math.round(media * 10) / 10,
        temMatriz: !!linha,
        score,
        veredito,
      };
    });

    equipe.sort((a, b) => b.score - a.score);
    return {
      equipe,
      semanas: jan.map(([s]) => s),
      modulos,
      turnosSemana: TURNOS_SEMANA,
    };
  }
}
