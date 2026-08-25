import { Injectable } from '@nestjs/common';
import { DadosService } from '../dados/dados.service';
import { UsersService } from '../users/users.service';
import {
  addDays,
  ehDataIso,
  hojeIso,
  parseIso,
  toIso,
} from '../cronograma/datas.util';
import {
  COR_STATUS_ALOCACAO,
  DiaAlocacao,
  LinhaAlocacao,
  ResumoStatusAlocacao,
  normalizarLinhaAlocacao,
} from '../bi-agenda-alocacao/bi-agenda-alocacao.constants';

export interface QueryAgendaCalendario {
  ini?: string;
  fim?: string;
}

export interface ResultadoAgendaCalendario {
  ini: string;
  fim: string;
  /** Um item POR DIA do intervalo, mesmo os vazios — a grade da tela desenha direto. */
  dias: DiaAlocacao[];
  /** Técnicos distintos com compromisso no intervalo (alimenta o filtro da tela). */
  responsaveis: string[];
  resumo: ResumoStatusAlocacao[];
  /** Compromissos DISTINTOS por `codigo` — a view traz uma linha POR técnico, então um
   * compromisso com 2 participantes tem 2 linhas e não pode contar dobrado. */
  totalCompromissos: number;
  erro: string | null;
}

/** Maior janela aceita numa chamada — a visão mensal (a maior da tela) pede no máximo 31
 * dias; o dobro dá folga sem deixar alguém varrer o histórico inteiro numa requisição. */
export const MAX_DIAS_JANELA = 62;

/** Tela **Execução → Agenda** — o calendário de compromissos dos técnicos, aberto já
 * filtrado no usuário logado (o filtro em si é aplicado na TELA: o dado que sai daqui é o
 * período inteiro, para a troca "minhas agendas ⇄ todas" não custar outra ida ao SICLA).
 *
 * Mesma origem do BI "Alocação de Agendas - Calendário" (`bi-agenda-alocacao/`), de
 * propósito — o que muda é o recorte: aqui a janela é LIVRE (semana/mês/dia da tela) em vez
 * de mês fechado, e o gate de menu é `agenda` em vez de `dashboards`. */
@Injectable()
export class AgendaService {
  constructor(
    private readonly dados: DadosService,
    private readonly users: UsersService,
  ) {}

  /** Técnicos para o filtro da tela — a TABELA `usuarios` do Painel INTEIRA (com nome),
   * ativos OU NÃO: a maioria dos técnicos importados do SICLA nunca ativou login
   * (218 de 252 em 2026-08-18) e as agendas deles existem do mesmo jeito — cortar por
   * `ativo` escondia quase todo mundo do filtro (defeito apontado pelo usuário). É dela
   * que a tela resolve o usuário logado na carga inicial. Sai só `id` e `nome` de
   * propósito: o resto do cadastro (e-mail, papéis, hash) não pertence a esta tela. */
  async usuarios(): Promise<{ id: number; nome: string }[]> {
    const todos = await this.users.listar();
    return todos
      .filter((u) => (u.nome ?? '').trim() !== '')
      .map((u) => ({ id: u.id, nome: u.nome.trim() }));
  }

  /** Janela [ini, fim] saneada: default = a semana de HOJE (domingo→sábado, o desenho da
   * grade semanal da tela); só `ini` = a semana que começa nele; invertida vira ordenada;
   * mais larga que `MAX_DIAS_JANELA` é aparada pelo fim. */
  periodo(query: QueryAgendaCalendario): { ini: string; fim: string } {
    let ini = ehDataIso(query.ini ?? '') ? (query.ini as string) : '';
    let fim = ehDataIso(query.fim ?? '') ? (query.fim as string) : '';
    if (!ini) {
      const hoje = parseIso(hojeIso());
      ini = toIso(addDays(hoje, -hoje.getUTCDay()));
    }
    if (!fim) fim = toIso(addDays(parseIso(ini), 6));
    if (ini > fim) [ini, fim] = [fim, ini];
    const teto = toIso(addDays(parseIso(ini), MAX_DIAS_JANELA - 1));
    return { ini, fim: fim > teto ? teto : fim };
  }

  private vazio(
    ini: string,
    fim: string,
    erro: string | null,
  ): ResultadoAgendaCalendario {
    return {
      ini,
      fim,
      dias: [],
      responsaveis: [],
      resumo: [],
      totalCompromissos: 0,
      erro,
    };
  }

  async calendario(
    query: QueryAgendaCalendario,
  ): Promise<ResultadoAgendaCalendario> {
    const { ini, fim } = this.periodo(query);
    // Sem checagem prévia de conexão: `consultar` já devolve {ok:false} com a
    // mensagem que diz onde configurar — uma fonte só para o mesmo aviso.

    const r = await this.dados.consultar('sicla.agenda.calendario', {
      // O SQL herdado do BI usa fim EXCLUSIVO (`< :mes_fim`); a janela da tela é inclusiva.
      mes_ini: ini,
      mes_fim: toIso(addDays(parseIso(fim), 1)),
    });
    if (!r.ok) return this.vazio(ini, fim, r.mensagem);

    const linhas = r.linhas.map((l) => normalizarLinhaAlocacao(l));

    const porDia = new Map<string, LinhaAlocacao[]>();
    for (const a of linhas) {
      const lista = porDia.get(a.dia) ?? [];
      lista.push(a);
      porDia.set(a.dia, lista);
    }

    const dias: DiaAlocacao[] = [];
    for (let d = parseIso(ini); toIso(d) <= fim; d = addDays(d, 1)) {
      const iso = toIso(d);
      dias.push({
        dia: iso,
        numero: d.getUTCDate(),
        diaSemana: d.getUTCDay(),
        compromissos: (porDia.get(iso) ?? []).sort((x, y) =>
          x.horaIni.localeCompare(y.horaIni),
        ),
      });
    }

    const responsaveis = [
      ...new Set(linhas.map((a) => a.tecnico).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const contagem = new Map<string, number>();
    for (const a of linhas)
      contagem.set(a.status, (contagem.get(a.status) ?? 0) + 1);
    const total = linhas.length;
    const resumo: ResumoStatusAlocacao[] = [...contagem.entries()]
      .map(([status, quantidade]) => ({
        status,
        quantidade,
        percentual:
          total > 0 ? Math.round((quantidade / total) * 1000) / 10 : 0,
        cor: COR_STATUS_ALOCACAO[status] ?? '#CCCCCC',
      }))
      .sort((a, b) => a.status.localeCompare(b.status));

    return {
      ini,
      fim,
      dias,
      responsaveis,
      resumo,
      totalCompromissos: new Set(linhas.map((a) => a.codigo)).size,
      erro: null,
    };
  }
}
