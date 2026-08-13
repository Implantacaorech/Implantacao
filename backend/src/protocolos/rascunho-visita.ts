import { Protocolo, VideoOrigem } from '../database/entities/protocolo.entity';
import { lerMapa } from './locutores';

/** Rascunho de uma ATIVIDADE do "Registro de Atendimento em Visita" do Portal Rech
 * (portalrech.com.br) — a unidade que a tela de lá chama de protocolo. Não é enviado a
 * lugar nenhum: é o texto/valores prontos para o consultor COLAR/conferir no Portal
 * (Caminho A, decidido em 2026-08-13). O de-para com os `id` internos do Portal
 * (idModulo/idContato) fica de fora de propósito — isso seria a integração via API. */
export interface AtividadeVisitaRascunho {
  /** Módulo classificado pela IA no protocolo — sugestão para o campo "Módulo" do Portal. */
  modulo: string;
  /** Menu principal do SIGER tratado (ex.: `1.4-I`). */
  menu: string;
  /** Texto no molde exato do Portal: PARTICIPANTES / ROTINAS / TAREFAS-OBSERVAÇÕES. */
  descricaoAtividade: string;
}

/** Rascunho completo da visita, montado a partir de UM protocolo (transcrição/gravação). */
export interface RascunhoVisita {
  protocoloId: number;
  cliente: string;
  clienteCodigo: string;
  tituloProtocolo: string;
  /** Nomes dos participantes (do mapa de locutores). Vazio quando a gravação não separou
   * vozes ou ninguém foi renomeado. */
  participantes: string[];
  /** Sugestão de início/fim da visita no formato de `datetime-local` (`YYYY-MM-DDTHH:MM`),
   * derivada da data de criação do protocolo e da duração — o consultor ajusta se a visita
   * não coincide com a gravação. `null` quando não há data de origem. */
  dataInicioSugerida: string | null;
  dataFimSugerida: string | null;
  duracaoSeg: number;
  origem: VideoOrigem;
  status: string;
  atividade: AtividadeVisitaRascunho;
}

/** Cabeçalhos `### <menu> — <nome>` que a IA produz em `menusAbordados` — vira a lista de
 * rotinas trabalhadas, sem o corpo (objetivo/passo a passo) que tornaria a descrição enorme. */
function extrairRotinas(menusAbordados: string): string[] {
  const linhas: string[] = [];
  for (const linha of (menusAbordados || '').split('\n')) {
    const m = /^\s*#{2,}\s*(.+?)\s*$/.exec(linha);
    if (m && m[1].trim()) linhas.push(m[1].trim());
  }
  return linhas;
}

/** Junta os textos não vazios, um por linha, aparando espaços das pontas. */
function juntar(...partes: (string | null | undefined)[]): string {
  return partes
    .map((p) => (p ?? '').trim())
    .filter((p) => p.length > 0)
    .join('\n');
}

/** Formata uma data como `datetime-local` no fuso local do servidor (o Painel roda na
 * mesma máquina/fuso de quem usa). Retorna `null` para data ausente/inválida. */
function paraDatetimeLocal(d: Date | null | undefined): string | null {
  if (!d) return null;
  const t = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(t.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}` +
    `T${p(t.getHours())}:${p(t.getMinutes())}`
  );
}

/** Monta o rascunho da visita a partir de um protocolo já processado. Puramente montagem
 * dos campos que a IA JÁ extraiu — sem nova chamada de IA: rápido, sem custo e reprodutível.
 *
 * Mapa dos blocos da descrição (molde do próprio Portal):
 * - PARTICIPANTES        ← nomes dos locutores (`mapaLocutores`)
 * - ROTINAS              ← menus abordados + menu principal + processos executados
 * - TAREFAS/OBSERVAÇÕES  ← pendências do treinamento + próximos passos + pontos de atenção */
export function montarRascunhoVisita(p: Protocolo): RascunhoVisita {
  const participantes = Object.values(lerMapa(p.mapaLocutores)).filter(
    (n) => n.trim().length > 0,
  );

  const rotinas = extrairRotinas(p.menusAbordados);
  const temMenuPrincipal =
    p.menu && !p.menu.startsWith('Menu não identificado');
  const blocoRotinas = juntar(
    rotinas.length ? rotinas.join('\n') : temMenuPrincipal ? p.menu : '',
    (p.processos || '').trim(),
  );

  const blocoTarefas = juntar(
    p.pendenciasTreinamento,
    p.proximosPassos,
    p.pontosAtencao,
  );

  const descricaoAtividade = [
    '- PARTICIPANTES:',
    participantes.join('\n'),
    '',
    '- ROTINAS:',
    blocoRotinas,
    '',
    '- TAREFAS/OBSERVAÇÕES:',
    blocoTarefas,
  ].join('\n');

  const inicio = paraDatetimeLocal(p.criadoEm);
  const fim =
    p.criadoEm && p.duracaoSeg > 0
      ? paraDatetimeLocal(
          new Date(new Date(p.criadoEm).getTime() + p.duracaoSeg * 1000),
        )
      : inicio;

  return {
    protocoloId: p.id,
    cliente: p.cliente,
    clienteCodigo: p.clienteCodigo,
    tituloProtocolo: p.titulo,
    participantes,
    dataInicioSugerida: inicio,
    dataFimSugerida: fim,
    duracaoSeg: p.duracaoSeg,
    origem: p.videoOrigem,
    status: p.status,
    atividade: {
      modulo: p.modulo,
      menu: p.menu,
      descricaoAtividade,
    },
  };
}
