/** Tela Execução → Controle de Atividades — quadro de atividades por cliente.
 * Espelha `GET /atividades/*` (backend `controle-atividades/`). */

export type TipoMembroAtividade = 'interno' | 'cliente';
export type OrigemCartao = 'consultor' | 'cliente';
export type TipoAnexoAtividade = 'arquivo' | 'imagem' | 'link';
export type TipoAviso = 'solicitacao' | 'compartilhado' | 'comentario' | 'prazo';

export interface ResponsavelQuadro {
  usuarioId: number;
  nome: string;
  principal: boolean;
}

export interface QuadroResumo {
  id: number;
  codigoClienteSicla: string;
  nomeCliente: string;
  projetoId: number | null;
  responsaveis: ResponsavelQuadro[];
  abertosInternos: number;
  abertosCompartilhados: number;
  meu: boolean;
}

export interface ListaDeQuadros {
  meus: QuadroResumo[];
  demais: QuadroResumo[];
  /** Consultores que respondem por algum quadro da aba "Demais" — alimenta o filtro. */
  consultores: { usuarioId: number; nome: string }[];
}

export interface ProjetoDisponivel {
  projetoId: number;
  cliente: string;
  etapa: string;
  situacao: string;
  jaTemQuadro: boolean;
}

export interface ColunaQuadro {
  id: number;
  titulo: string;
  ordem: number;
  visivelCliente: boolean;
}

export interface MembroCartao {
  id: number;
  tipo: TipoMembroAtividade;
  usuarioId: number | null;
  nome: string;
  email: string;
  cargo: string;
}

export interface ItemChecklist {
  id: number;
  texto: string;
  feito: boolean;
  feitoPor: string;
}

export interface AnexoCartao {
  id: number;
  tipo: TipoAnexoAtividade;
  nome: string;
  url: string;
  mime: string;
  tamanho: number;
  enviadoPor: string;
}

export interface ComentarioCartao {
  id: number;
  autorNome: string;
  autorTipo: TipoMembroAtividade;
  texto: string;
  criadoEm: string;
}

export interface CartaoAtividade {
  id: number;
  listaId: number;
  titulo: string;
  descricao: string;
  ordem: number;
  visivelCliente: boolean;
  origem: OrigemCartao;
  etiquetas: string[];
  prazo: string;
  concluido: boolean;
  criadoPorNome: string;
  membros: MembroCartao[];
  checklist: ItemChecklist[];
  anexos: AnexoCartao[];
  comentarios: ComentarioCartao[];
}

export interface QuadroCompleto {
  quadro: {
    id: number;
    codigoClienteSicla: string;
    nomeCliente: string;
    projetoId: number | null;
    responsaveis: ResponsavelQuadro[];
  };
  /** O que a TELA habilita. A autorização de verdade é sempre revalidada no backend. */
  podeEditar: boolean;
  podeInteragir: boolean;
  podeCriarCartao: boolean;
  interno: boolean;
  souResponsavel: boolean;
  listas: ColunaQuadro[];
  cartoes: CartaoAtividade[];
  ocultos: {
    cartoesInternos: number;
    colunasInternas: number;
    cartoesEmColunasInternas: number;
  } | null;
}

export interface AchadoBusca {
  cartaoId: number;
  titulo: string;
  codigoClienteSicla: string;
  nomeCliente: string;
  lista: string;
  visivelCliente: boolean;
  concluido: boolean;
  soConsulta: boolean;
}

export interface ResultadoBuscaAtividades {
  termo: string;
  total: number;
  truncado: boolean;
  quadros: number;
  achados: AchadoBusca[];
}

export interface AvisoAtividade {
  id: number;
  tipo: TipoAviso;
  titulo: string;
  texto: string;
  cartaoId: number | null;
  codigoClienteSicla: string;
  criadoEm: string;
}

export interface Etiqueta {
  chave: string;
  nome: string;
}

export interface ConsultorPainel {
  usuarioId: number;
  nome: string;
  perfil: string;
}

export interface ContatoCliente {
  cliente: string;
  nome: string;
  cargo: string;
  email: string;
}
