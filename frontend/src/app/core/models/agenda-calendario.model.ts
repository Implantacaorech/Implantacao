/** Tela Execução → Agenda — calendário de compromissos dos técnicos (origem SICLA).
 * Espelha `GET /agenda/calendario`. O compromisso tem o MESMO formato de linha da
 * "Alocação de Agendas" do BI (`bi-agenda-alocacao.model.ts`): as duas telas leem a mesma
 * view; o que muda aqui é a janela livre de dias e o gate de menu (`agenda`). */

export interface CompromissoAgenda {
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
  fantasia: string;
  rnsDescricao: string;
  grupoEconomico: string;
}

export interface DiaAgenda {
  dia: string;
  numero: number;
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  compromissos: CompromissoAgenda[];
}

export interface ResumoStatusAgenda {
  status: string;
  quantidade: number;
  percentual: number;
  cor: string;
}

/** Um usuário do Painel (tabela `usuarios`, importada de SICLA.LISTA_TECNICOS) — alimenta
 * o filtro de técnicos da tela e a resolução do usuário logado na carga inicial. */
export interface UsuarioAgenda {
  id: number;
  nome: string;
}

export interface ResultadoAgendaCalendario {
  ini: string;
  fim: string;
  /** Um item POR DIA da janela, mesmo os vazios — a grade desenha direto. */
  dias: DiaAgenda[];
  /** Técnicos distintos com compromisso na janela (alimenta o filtro). */
  responsaveis: string[];
  resumo: ResumoStatusAgenda[];
  totalCompromissos: number;
  erro: string | null;
}
