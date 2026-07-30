/** Espelha `GET /bi-indicadores` — as três páginas de Indicadores do `BI_Interno.pbix`
 * (Contratação, Conclusão e % de Utilização das Horas) saem deste mesmo payload. */

export interface LinhaIndicadorBi {
  codigo: number;
  descricao: string;
  cliente: number | null;
  fantasia: string;
  responsavel: string;
  representante: string;
  dataContratacao: string;
  dataEncerramento: string;
  dataCriacao: string;
  dataPrevisaoUso: string;
  dataTransicao: string;
  competenciaContratacao: string;
  competenciaEncerramento: string;
  horasContratadas: number;
  horasRealizadas: number;
  horasSaldo: number;
  horasCobradas: number;
  horasBonificadas: number;
  percentualUtilizacao: number | null;
  posicao: string;
  tipoImplantacao: string;
  area: string;
  tipoSuporte: string;
  statusImp: number;
  grupoEconomico: string;
  leadTimeMeses: number | null;
  concluida: boolean;
}

export interface TotaisIndicadoresBi {
  projetos: number;
  clientes: number;
  horasContratadas: number;
  horasRealizadas: number;
  horasSaldo: number;
  horasCobradas: number;
  horasBonificadas: number;
  percentualUtilizacao: number | null;
  concluidos: number;
  leadTimeMedio: number | null;
}

export interface SerieMensalBi {
  competencia: string;
  projetos: number;
  clientes: number;
  horasContratadas: number;
  horasRealizadas: number;
  horasCobradas: number;
  horasBonificadas: number;
  percentualUtilizacao: number | null;
}

export interface ContagemIndicadorBi {
  chave: string;
  quantidade: number;
  horasContratadas: number;
  horasRealizadas: number;
}

export interface FiltrosIndicadoresBi {
  posicoes: string[];
  tiposImplantacao: string[];
  areas: string[];
  tiposSuporte: string[];
  responsaveis: string[];
  grupos: string[];
}

export interface ResultadoIndicadoresBi {
  competencias: { inicio: string; fim: string };
  linhas: LinhaIndicadorBi[];
  totais: TotaisIndicadoresBi;
  porMesContratacao: SerieMensalBi[];
  porMesConclusao: SerieMensalBi[];
  porPosicao: ContagemIndicadorBi[];
  porTipo: ContagemIndicadorBi[];
  porResponsavel: ContagemIndicadorBi[];
  filtros: FiltrosIndicadoresBi;
  selecionados: FiltrosIndicadoresBi;
  erro: string | null;
}

export interface FiltroIndicadoresBi {
  compIni?: string;
  compFim?: string;
  posicao?: string[];
  tipoImplantacao?: string[];
  area?: string[];
  tipoSuporte?: string[];
  responsavel?: string[];
  grupo?: string[];
}
