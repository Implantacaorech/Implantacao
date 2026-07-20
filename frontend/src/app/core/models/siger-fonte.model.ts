export interface ResultadoBuscaSiger {
  id: number;
  caminho: string;
  extensao: string;
  pastaRaiz: string;
  tamanhoBytes: number;
  modificadoEm: string;
  trecho: string | null;
}

export interface StatusBaseConhecimentoSiger {
  totalIndexado: number;
  totalComConteudo: number;
  ultimaImportacaoEm: string | null;
}
