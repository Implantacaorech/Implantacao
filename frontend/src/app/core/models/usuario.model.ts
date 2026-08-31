import { Perfil } from './auth-user.model';

export const PERFIS: Perfil[] = [
  'ADM',
  'Coordenador',
  'Administrativo',
  'Levantador',
  'GCI',
  'Consultor',
  'Comercial',
  'Cliente',
];

/** O papel do CLIENTE da Rech — externo e EXCLUSIVO: quem o tem não acumula nenhum outro,
 * e enxerga apenas o BI "Implantação Clientes SIGER", recortado no próprio cliente
 * (docs/acesso-cliente-bi.md). O backend recusa a gravação de qualquer combinação. */
export const PAPEL_CLIENTE = 'Cliente';

/** Rótulo de cada papel na tela — 'ADM' é como o valor é gravado desde o Flask. */
export const ROTULO_PERFIL: Record<string, string> = {
  ADM: 'Administrador',
  Coordenador: 'Coordenador',
  Administrativo: 'Administrativo',
  Levantador: 'Levantador',
  GCI: 'GCI',
  Consultor: 'Consultor',
  Comercial: 'Comercial',
  Cliente: 'Cliente (externo)',
};

export interface Usuario {
  id: number;
  login: string;
  nome: string;
  email: string;
  /** Papel principal — o que aparece quando só cabe um rótulo. */
  perfil: Perfil;
  /** Todos os papéis, separados por vírgula. Uma pessoa acumula cargos. */
  perfis?: string;
  codigoSicla: string;
  /** Código do CLIENTE no SICLA — o recorte de dados de quem tem o papel `Cliente`. */
  codigoClienteSicla: string;
  /** SICLA.LISTA_TECNICOS.MODULOCAPACITADO */
  modulosCapacitados: string;
  /** SICLA.LISTA_TECNICOS.SETORDES */
  setorAtuacao: string;
  ativo: boolean;
  criadoEm: string;
}

export interface CriarUsuarioPayload {
  nome?: string;
  email: string;
  login?: string;
  senha: string;
  perfil?: Perfil;
  perfis?: Perfil[];
  codigoSicla?: string;
  codigoClienteSicla?: string;
  modulosCapacitados?: string;
  setorAtuacao?: string;
  ativo?: boolean;
}

export type AtualizarUsuarioPayload = Partial<CriarUsuarioPayload>;

/** Um técnico como vem de `SICLA.LISTA_TECNICOS` — a fonte do cadastro de Usuários. */
export interface TecnicoSicla {
  codigo: string;
  nome: string;
  modulosCapacitados: string;
  email: string;
  setorAtuacao: string;
  /** Já tem usuário no Painel (casado por código SICLA ou e-mail). */
  jaCadastrado: boolean;
  bruto: Record<string, unknown>;
}

export interface ListaTecnicosSicla {
  ok: boolean;
  mensagem: string;
  tecnicos: TecnicoSicla[];
}

export interface ResultadoImportacaoTecnicos {
  ok: boolean;
  mensagem: string;
  criados: number;
  atualizados: number;
  ignorados: { codigo: string; nome: string; motivo: string }[];
}
