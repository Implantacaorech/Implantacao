export interface ChecklistModeloLinha {
  id?: number;
  ordem?: number;
  modulo: string;
  adicional: string;
  tipo: string;
  integracoes: string;
  golive: string;
  menu: string;
  item: string;
  acao: string;
  seq: string;
}

export interface IndiceTopicoLinha {
  id?: number;
  ordem?: number;
  moduloNum: string;
  moduloSigla: string;
  modulo: string;
  adicionalNum: string;
  adicionalSigla: string;
  adicional: string;
  topico: string;
}

export type TipoModeloDocumento = 'docx' | 'xlsx';

export interface ModeloDocumento {
  id: number;
  slug: string;
  nome: string;
  fase: string;
  tipo: TipoModeloDocumento;
  arquivo: string;
  descricao: string;
  ordem: number;
  atualizadoEm: string;
}

export interface ModeloDocumentoVersao {
  id: number;
  versao: number;
  arquivo: string;
  autor: string;
  motivo: string;
  vigente: boolean;
  criadoEm: string;
}

export interface ModeloDocumentoCampo {
  id?: number;
  secao: string;
  placeholder: string;
  rotulo: string;
  origem: string;
  obrigatorio: boolean;
  observacao: string;
}

export function checklistVazio(): ChecklistModeloLinha {
  return { modulo: '', adicional: '', tipo: '', integracoes: '', golive: '', menu: '', item: '', acao: '', seq: '' };
}

export function indiceVazio(): IndiceTopicoLinha {
  return {
    moduloNum: '',
    moduloSigla: '',
    modulo: '',
    adicionalNum: '',
    adicionalSigla: '',
    adicional: '',
    topico: '',
  };
}

export function campoVazio(): ModeloDocumentoCampo {
  return { secao: '', placeholder: '', rotulo: '', origem: '', obrigatorio: false, observacao: '' };
}
