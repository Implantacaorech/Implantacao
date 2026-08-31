/** "Alocação de Agendas" — duas páginas do `BI_Interno.pbix` que ficam na aba
 * **BI Implantação**: o Calendário de compromissos dos técnicos e as Horas Aplicadas por RNS
 * de implantação. Ao contrário dos Indicadores (que saem todos de
 * `POWERBI_IMP_RNIMPLANTACAO_2`), estas duas páginas vêm de origens PRÓPRIAS — cada uma tem
 * sua constante de SQL e seu formato de linha.
 *
 * Confirmado por inspeção do relatório (`Report/definition/pages/.../page.json` e
 * `visuals/*.json` do `BI_Interno.pbix`, extraído em 2026-07-29): NENHUMA das duas páginas
 * tem filtro fixo de página ou de relatório restringindo ESPÉCIE ou TIPO_SUPORTE — os dois
 * são slicers de usuário (livres, sem seleção padrão). A única restrição de relatório
 * encontrada (`Report/definition/report.json`, `filterConfig` global) é
 * `LISTA_CLIENTES.TIPO IN ('C')` / `Clientes.TIPO IN ('C')` — cliente de verdade, não
 * prospect — que aqui é feita via o JOIN com `PEDIDOIMP`/`RNS`: uma linha só carrega
 * FANTASIA/GRUPO_ECONOMICO quando está de fato ligada a uma RNS de implantação. */

import { textoAparado } from '../common/utils/texto.util';

// ── Página "Alocação de Agendas - Calendário" ─────────────────────────────────────────

/** Teto de linhas do calendário — folga generosa sobre o volume observado (~1,2 mil/mês). */
export const LIMITE_CALENDARIO = 5000;

/** Rótulo do `STATUS` numérico da agenda — mesmas 4 primeiras chaves de
 * `COR_STATUS_AGENDA` (bi-implantacao), de propósito: é o mesmo vocabulário de status de
 * compromisso, só que esta view nunca guarda 8-Postergada/9-Cancelada (confirmado: só
 * aparecem os códigos 1, 3, 6 e 7 em 5.452 linhas). */
export const STATUS_ALOCACAO: Record<number, string> = {
  1: '1-Solicitada',
  3: '3-Agendada',
  6: '6-Realizada',
  7: '7-Não realizada',
};

export const COR_STATUS_ALOCACAO: Record<string, string> = {
  '1-Solicitada': '#FFFFE0',
  '3-Agendada': '#E0FFE0',
  '6-Realizada': '#FFF5E0',
  '7-Não realizada': '#F5DEB3',
};

/** Um compromisso (uma linha = um técnico daquele compromisso). */
export interface LinhaAlocacao {
  codigo: number;
  dia: string;
  horaIni: string;
  horaFim: string;
  status: string;
  assunto: string;
  minutos: number;
  rns: number | null;
  especie: number;
  especieDes: string;
  tecnico: string;
  tipoSuporte: string;
  /** Observação da agenda no SICLA (pauta, link da reunião…) — pode ser longa. */
  observacao: string;
  fantasia: string;
  rnsDescricao: string;
  grupoEconomico: string;
}

export interface DiaAlocacao {
  dia: string;
  /** Dia do mês (1..31). */
  numero: number;
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  compromissos: LinhaAlocacao[];
}

/** Normaliza uma linha CRUA de `POWERBI_IMP_LISTACOMPROMISSOS_2` (chaves em qualquer caixa,
 * valores de qualquer tipo) para `LinhaAlocacao`. Compartilhada entre o BI "Alocação de
 * Agendas" e a tela Execução → Agenda de propósito: as duas leem a MESMA origem e qualquer
 * divergência de leitura entre elas seria defeito, não escolha. */
export function normalizarLinhaAlocacao(
  bruta: Record<string, unknown>,
): LinhaAlocacao {
  const l: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(bruta)) l[(k || '').toUpperCase()] = v;
  const numero = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    codigo: numero(l.CODIGO),
    dia: textoAparado(l.DIA).slice(0, 10),
    horaIni: textoAparado(l.HORA_INI),
    horaFim: textoAparado(l.HORA_FIM),
    status: STATUS_ALOCACAO[numero(l.STATUS)] ?? textoAparado(l.STATUS),
    assunto: textoAparado(l.ASSUNTO),
    minutos: numero(l.MINUTOS),
    rns:
      l.PEDIDOIMP === null || l.PEDIDOIMP === undefined
        ? null
        : numero(l.PEDIDOIMP),
    especie: numero(l.ESPECIE),
    especieDes: textoAparado(l.ESPECIEDES),
    tecnico: textoAparado(l.TECNICO),
    tipoSuporte: textoAparado(l.TIPO_SUPORTE),
    observacao: textoAparado(l.OBSERVACAO),
    fantasia: textoAparado(l.FANTASIA),
    rnsDescricao: textoAparado(l.RNS_DESCRICAO),
    grupoEconomico: textoAparado(l.GRUPO_ECONOMICO),
  };
}

export interface ResumoStatusAlocacao {
  status: string;
  quantidade: number;
  percentual: number;
  cor: string;
}

// ── Página "Alocação de Agendas - Horas Aplicadas" ────────────────────────────────────

/** Teto de linhas — a view tem 6,3 mil no total; a folga cobre até uma janela bem larga. */
export const LIMITE_HORAS_APLICADAS = 8000;

/** Um compromisso já normalizado (uso interno do serviço — não sai da tela por linha, só
 * agregado por RNS). */
export interface CompromissoHoras {
  rns: number | null;
  horas: number;
  statusFlag:
    | 'encaminhada'
    | 'agendada'
    | 'realizada'
    | 'naoRealizada'
    | 'postergada'
    | 'cancelada';
  fantasia: string;
  rnsDescricao: string;
  responsavel: string;
  tipoSuporte: string;
  grupoEconomico: string;
}

/** Uma RNS agregada — o que a tabela "PROJETOS DE IMPLANTAÇÃO" do BI mostra. */
export interface LinhaHorasAplicadas {
  rns: number;
  fantasia: string;
  rnsDescricao: string;
  responsavel: string;
  tipoSuporte: string;
  grupoEconomico: string;
  qtdCompromissos: number;
  horasEncaminhada: number;
  horasAgendada: number;
  horasRealizada: number;
  horasNaoRealizada: number;
  horasPostergada: number;
  horasCancelada: number;
  horasTotal: number;
  /** % de horas Postergadas sobre o total — a medida "% Horas Postergadas" do BI. */
  percentualPostergada: number | null;
}

export interface TotaisHorasAplicadas {
  rnsQuantidade: number;
  horasEncaminhada: number;
  horasAgendada: number;
  horasRealizada: number;
  horasNaoRealizada: number;
  horasPostergada: number;
  horasCancelada: number;
  horasTotal: number;
  percentualPostergada: number | null;
}
