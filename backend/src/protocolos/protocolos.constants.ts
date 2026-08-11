import { Perfil } from '../common/constants/perfis';
import { StatusProtocolo } from '../database/entities/protocolo.entity';

/** Quem decide o destino de um protocolo: aprovar, reprovar e excluir. Mais restrito que o
 * resto da tela (qualquer autenticado lista/envia/edita) — espelha
 * webapp/routes_protocolos.py:_pode_aprovar.
 *
 * Mora aqui, e não no controller, porque a regra de VISIBILIDADE (protocolos.acesso.ts)
 * precisa da mesma lista: quem aprova tem de enxergar o que vai aprovar. Enquanto a
 * constante era privada do controller, as duas regras se contradiziam em silêncio. */
export const PERFIS_APROVA_PROTOCOLO: Perfil[] = ['ADM', 'Coordenador'];

// Espelha webapp/db.py:PROTO_STATUS/PROTO_MODULOS/PROTO_CAMPOS_TEXTO — mais 'Gravando',
// que só existe no stack novo (reunião sendo gravada e transcrita ao vivo).
export const PROTO_STATUS: StatusProtocolo[] = [
  'Gravando',
  'Pendente',
  'Transcrevendo',
  'Analisando',
  'Em revisão',
  'Aprovado',
  'Reprovado / Ajustar',
  'Erro',
];

/** Status em que existe trabalho em curso — é onde cancelar faz sentido e é de onde o
 * protocolo não conseguia sair sozinho (ver ProcessamentoProtocolosService.cancelar e
 * .recuperarPresos).
 *
 * Mora aqui, e não no service que a usa, porque a vigilância de saúde
 * (`saude/repositories/saude-banco.repository.ts`) precisa da MESMA lista para procurar
 * protocolo preso — e repository importando de service inverte a camada do Guia Mestre.
 * Duas listas separadas divergiriam no primeiro status novo. */
export const STATUS_EM_PROCESSAMENTO: StatusProtocolo[] = [
  'Transcrevendo',
  'Analisando',
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
  // Sai de uma chamada de IA separada (não do JSON da análise) — ver PROTO_CAMPO_RESUMO.
  'resumoCompleto',
  'assuntosRemovidos',
  'pendencias',
] as const;

/** Campo preenchido pela 2ª chamada de IA (resumo completo em texto corrido), fora do
 * JSON da análise — por isso não entra no mapa CHAVE_IA de protocolo-ia.service.ts. */
export const PROTO_CAMPO_RESUMO = 'resumoCompleto';

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
  // Vídeo de aparelho antigo (WhatsApp legado): mesmo demuxer do .mp4, testado em
  // 2026-07-31. Sem isto o upload era recusado por "formato não suportado" mesmo com o
  // transcritor dando conta do arquivo.
  '.3gp',
  '.3g2',
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

// Content-Type do streaming da revisão. Sem ele o <audio>/<video> do navegador tem de
// adivinhar pelo conteúdo — e o .wav das reuniões gravadas (que só existe no stack novo)
// é justamente o caso em que alguns navegadores desistem de tocar.
const MIME_POR_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.3gp': 'video/3gpp',
  '.3g2': 'video/3gpp2',
  '.wmv': 'video/x-ms-wmv',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
  '.wma': 'audio/x-ms-wma',
};

export function tipoMime(nome: string): string {
  const lower = (nome || '').toLowerCase();
  const ext = lower.slice(lower.lastIndexOf('.'));
  return MIME_POR_EXT[ext] ?? 'application/octet-stream';
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
