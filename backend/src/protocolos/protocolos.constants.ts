import { StatusProtocolo } from '../database/entities/protocolo.entity';

// Espelha webapp/db.py:PROTO_STATUS/PROTO_MODULOS/PROTO_CAMPOS_TEXTO.
export const PROTO_STATUS: StatusProtocolo[] = [
  'Pendente',
  'Transcrevendo',
  'Analisando',
  'Em revisão',
  'Aprovado',
  'Reprovado / Ajustar',
  'Erro',
];

export const PROTO_MODULOS = [
  'Fiscal',
  'Estoque',
  'Financeiro',
  'Comercial',
  'Produção',
  'Contábil',
  'Compras',
  'WMS',
  'Folha de Pagamento',
  'Implantação',
  'Consultoria',
  'Módulo a validar',
] as const;

// Campos de conteúdo editáveis na tela de revisão (nome da coluna = nome do input) —
// também as chaves esperadas no JSON devolvido pela análise de IA. A ordem segue as 10
// seções obrigatórias do prompt de protocolo de treinamento (ver protocolo-ia.service.ts).
export const PROTO_CAMPOS_TEXTO = [
  'titulo',
  'modulo',
  'menu',
  'assunto',
  'resumo',
  'objetivo',
  'quandoUtilizar',
  'preRequisitos',
  'menusAbordados',
  'funcionalidades',
  'passoAPasso',
  'processos',
  'definicoes',
  'regrasNegocio',
  'configuracoes',
  'dependencias',
  'pontosAtencao',
  'exemplos',
  'duvidas',
  'pendenciasTreinamento',
  'proximosPassos',
  'resumoTecnico',
  'assuntosRemovidos',
  'pendencias',
] as const;

export type CampoTextoProtocolo = (typeof PROTO_CAMPOS_TEXTO)[number];

// Espelha webapp/protocolos.py:EXTS_VIDEO/EXTS_AUDIO/EXTS/eh_audio — o Whisper transcreve
// vídeo E áudio (extrai o áudio de dentro do vídeo).
export const EXTS_VIDEO = [
  '.mp4',
  '.m4v',
  '.mkv',
  '.avi',
  '.mov',
  '.webm',
  '.wmv',
] as const;

export const EXTS_AUDIO = [
  '.mp3',
  '.wav',
  '.m4a',
  '.aac',
  '.ogg',
  '.oga',
  '.opus',
  '.flac',
  '.wma',
] as const;

export const EXTS: readonly string[] = [...EXTS_VIDEO, ...EXTS_AUDIO];

export function ehAudio(nome: string): boolean {
  const lower = (nome || '').toLowerCase();
  return EXTS_AUDIO.some((ext) => lower.endsWith(ext));
}

// Espelha tools/_common.py:slug — remove acentos, troca não-alfanumérico por "_".
// Marcas diacríticas combinantes (faixa Unicode U+0300-U+036F) são o que sobra da letra
// base depois do normalize('NFKD') (ex.: "ã" -> "a" + U+0303) — construída via
// fromCharCode/RegExp em vez de um literal no código-fonte, para não depender da
// codificação do arquivo (ver lição sobre PYTHONUTF8 em docs/migracao/03-*.md §6).
const MARCAS_DIACRITICAS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g',
);

export function slug(texto: string): string {
  const semAcento = (texto || '')
    .normalize('NFKD')
    .replace(MARCAS_DIACRITICAS, '');
  const limpo = semAcento
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return limpo || 'arquivo';
}
