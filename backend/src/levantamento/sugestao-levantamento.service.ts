import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IaService } from '../ia/ia.service';
import { LevantamentoResposta } from '../database/entities/levantamento-resposta.entity';
import { Protocolo } from '../database/entities/protocolo.entity';
import { ProtocolosService } from '../protocolos/protocolos.service';
import { aplicarNomes, lerMapa } from '../protocolos/locutores';
import { ProjetoRepository } from '../database/repositories/projeto.repository';
import { LevantamentoRespostaService } from './levantamento-resposta.service';

const SISTEMA =
  'Você é um consultor de implantação do ERP SIGER (Rech) preenchendo o documento de ' +
  'LEVANTAMENTO DE PROCESSOS de um cliente a partir da transcrição da reunião de ' +
  'levantamento que acabou de acontecer.\n\n' +
  'Você recebe: (a) a transcrição da reunião, com marcas de tempo [MM:SS], e (b) uma lista ' +
  'numerada de tópicos do questionário, cada um pertencente a um módulo do SIGER.\n\n' +
  'Para cada tópico, responda com o que o CLIENTE disse na reunião sobre aquele assunto — ' +
  'como ele trabalha hoje, o que precisa, o que ficou definido.\n\n' +
  'REGRAS (nesta ordem de importância):\n' +
  '1. NUNCA invente. Se a reunião não tratou do tópico, simplesmente NÃO INCLUA o tópico ' +
  'na resposta. Silêncio é a resposta certa para o que não foi falado — é melhor devolver ' +
  '3 tópicos certos do que 40 preenchidos por dedução.\n' +
  '2. Não deduza a partir do nome do tópico nem do que "costuma ser" num cliente parecido. ' +
  'Só vale o que está na transcrição.\n' +
  '3. Escreva como o consultor escreveria no documento: 3ª pessoa, objetivo, sem "o cliente ' +
  'disse que" e sem citar a reunião. Uma a quatro frases.\n' +
  '4. Se a reunião tratou do tópico mas ficou algo em aberto, escreva o que foi dito e ' +
  'termine com "A confirmar: <o que falta>".\n' +
  '5. `trecho` é a marca de tempo do ponto da transcrição em que o assunto aparece (ex.: ' +
  '"[12:35]") — é o que permite ao consultor conferir a origem. Sem marca de tempo por ' +
  'perto, use "".\n\n' +
  'Responda APENAS com um array JSON (sem texto antes ou depois), no formato:\n' +
  '[{"n": <número do tópico>, "resposta": "<texto>", "trecho": "[MM:SS]"}]\n' +
  'Nenhum tópico tratado na reunião -> responda [].';

/** Quantos tópicos vão por chamada. Lista longa degrada a atenção do modelo — ele começa a
 * responder por dedução justamente no fim, que é onde ninguém confere. */
const TOPICOS_POR_LOTE = 50;
/** Teto de lotes por pedido. Cada lote reenvia a transcrição inteira, então custo e tempo
 * crescem com ele; e um levantamento com mais de 300 pendências não vai ser resolvido por
 * uma reunião só. Quando o corte acontece, ele é DECLARADO na resposta — limite silencioso
 * viraria "a IA não achou nada sobre esses tópicos", que é outra coisa. */
const MAX_LOTES = 6;

export interface SugestaoLinha {
  linhaId: number;
  moduloSigla: string;
  topico: string;
  texto: string;
  /** Marca de tempo da transcrição onde o assunto aparece — a origem, para conferir. */
  trecho: string;
}

export interface ResultadoSugestoes {
  sugestoes: SugestaoLinha[];
  /** Quantos tópicos foram submetidos à IA. */
  analisados: number;
  /** Pendentes que ficaram de fora pelo teto de lotes (0 = nenhum). */
  naoAnalisados: number;
  /** Recado para a tela quando algo relevante aconteceu (nada pendente, corte, IA muda). */
  aviso: string;
}

export interface GravacaoDisponivel {
  id: number;
  titulo: string;
  criadoEm: Date;
  duracaoSeg: number;
  status: string;
  /** Tamanho da transcrição — dá ao consultor a noção de "tem conteúdo aqui". */
  caracteres: number;
}

/** Sugere as respostas do Levantamento a partir da transcrição da reunião gravada.
 *
 * **O que este serviço NÃO faz: gravar.** Ele devolve propostas; quem responde é o GCI, pelo
 * mesmo caminho de sempre (o PATCH por linha, com versão e autoria). A regra vale mesmo
 * quando a sugestão está obviamente certa — um documento de Levantamento é assinado pelo
 * cliente, e "quem escreveu isto?" precisa ter uma resposta que não seja "a IA, sozinha".
 *
 * Só tópicos **pendentes** entram: resposta já digitada e "Não será utilizado." são decisão
 * humana e não são colocadas em dúvida por uma sugestão. */
@Injectable()
export class SugestaoLevantamentoService {
  private readonly logger = new Logger('SugestaoLevantamentoService');

  constructor(
    private readonly respostas: LevantamentoRespostaService,
    private readonly protocolos: ProtocolosService,
    private readonly projetos: ProjetoRepository,
    private readonly ia: IaService,
  ) {}

  disponivel(): boolean {
    return this.ia.disponivel('levantamento');
  }

  /** Nome do cliente do projeto — é a segunda chave de casamento das gravações (ver
   * `ProtocolosService.listarDoProjeto`). Projeto inexistente devolve vazio, e aí só o
   * `projetoId` casa. */
  private async clienteDoProjeto(projetoId: number): Promise<string> {
    return (await this.projetos.porId(projetoId))?.cliente ?? '';
  }

  /** Gravações do projeto que têm transcrição — é o que a tela oferece para escolher. */
  async gravacoes(projetoId: number): Promise<GravacaoDisponivel[]> {
    const cliente = await this.clienteDoProjeto(projetoId);
    const lista = await this.protocolos.listarDoProjeto(projetoId, cliente);
    return lista.map((p) => ({
      id: p.id,
      titulo: p.titulo || p.videoNome || `Gravação #${p.id}`,
      criadoEm: p.criadoEm,
      duracaoSeg: p.duracaoSeg,
      status: p.status,
      caracteres: (p.transcricao || '').length,
    }));
  }

  async sugerir(
    projetoId: number,
    protocoloId: number,
    solicitante?: string,
  ): Promise<ResultadoSugestoes> {
    const gravacao = await this.exigirGravacaoDoProjeto(projetoId, protocoloId);

    await this.respostas.garantirSeed(projetoId);
    const pendentes = (await this.respostas.listar(projetoId)).filter(
      (l) => !l.naoUtilizado && !(l.resposta || '').trim(),
    );
    if (pendentes.length === 0) {
      return this.vazio(
        0,
        0,
        'Não há pergunta pendente neste levantamento — nada a sugerir.',
      );
    }

    // A transcrição vai com os NOMES já aplicados (quando alguém renomeou os locutores):
    // "Ivian: ..." em vez de "P1: ..." deixa a IA distinguir a fala do cliente da fala do
    // consultor, que é a diferença entre "como o cliente trabalha" e "o que propusemos".
    const texto = aplicarNomes(
      gravacao.transcricao,
      lerMapa(gravacao.mapaLocutores),
    );

    const lotes = this.emLotes(pendentes).slice(0, MAX_LOTES);
    const analisados = lotes.reduce((n, l) => n + l.length, 0);
    const naoAnalisados = pendentes.length - analisados;

    const sugestoes: SugestaoLinha[] = [];
    for (const lote of lotes) {
      sugestoes.push(
        ...(await this.sugerirLote(lote, texto, gravacao, {
          solicitante,
          contexto: `levantamento projeto ${projetoId}`,
        })),
      );
    }

    this.logger.log(
      `Projeto ${projetoId}: ${sugestoes.length} sugestão(ões) a partir da gravação ` +
        `${protocoloId}, sobre ${analisados} pergunta(s) pendente(s).`,
    );
    return {
      sugestoes,
      analisados,
      naoAnalisados,
      aviso: this.avisoDe(sugestoes.length, naoAnalisados),
    };
  }

  // ------------------------------------------------------------------------ internos

  private async exigirGravacaoDoProjeto(
    projetoId: number,
    protocoloId: number,
  ): Promise<Protocolo> {
    // Busca DENTRO da lista do projeto, e não por id direto: sem isso, informar o id de uma
    // gravação de outro cliente traria a transcrição dele para cá — a tela oferece só as
    // deste projeto, mas a rota não pode confiar nisso.
    const cliente = await this.clienteDoProjeto(projetoId);
    const doProjeto = await this.protocolos.listarDoProjeto(projetoId, cliente);
    const gravacao = doProjeto.find((p) => p.id === protocoloId);
    if (!gravacao) {
      throw new NotFoundException(
        'Gravação não encontrada para este projeto (ou ainda sem transcrição).',
      );
    }
    return gravacao;
  }

  private vazio(
    analisados: number,
    naoAnalisados: number,
    aviso: string,
  ): ResultadoSugestoes {
    return { sugestoes: [], analisados, naoAnalisados, aviso };
  }

  private avisoDe(quantas: number, naoAnalisados: number): string {
    const corte = naoAnalisados
      ? ` ${naoAnalisados} pergunta(s) ficaram de fora deste pedido (limite por vez) — ` +
        'responda ou revise as sugeridas e peça de novo.'
      : '';
    if (quantas === 0) {
      return (
        'A reunião não trouxe conteúdo para nenhuma das perguntas pendentes. ' +
        'Isso é comum quando a gravação é de treinamento, e não de levantamento.' +
        corte
      );
    }
    return (
      `${quantas} sugestão(ões) a revisar. Nada foi gravado: confira cada texto e clique ` +
      'em "Usar" no que estiver certo.' +
      corte
    );
  }

  private emLotes(linhas: LevantamentoResposta[]): LevantamentoResposta[][] {
    const lotes: LevantamentoResposta[][] = [];
    for (let i = 0; i < linhas.length; i += TOPICOS_POR_LOTE) {
      lotes.push(linhas.slice(i, i + TOPICOS_POR_LOTE));
    }
    return lotes;
  }

  /** Uma chamada de IA para um lote de tópicos.
   *
   * O modelo recebe um número de ORDEM (1, 2, 3…), nunca o id do banco: um id inventado ou
   * trocado gravaria a sugestão na pergunta errada, e o número de ordem é conferido contra o
   * próprio lote antes de virar `linhaId`. */
  private async sugerirLote(
    lote: LevantamentoResposta[],
    transcricao: string,
    gravacao: Protocolo,
    meta?: { solicitante?: string; contexto?: string },
  ): Promise<SugestaoLinha[]> {
    const lista = lote
      .map((l, i) => `${i + 1}. [${l.moduloSigla}] ${l.topico}`)
      .join('\n');
    const user =
      `Cliente: ${gravacao.cliente || '(não informado)'}\n` +
      `Reunião: ${gravacao.titulo || gravacao.videoNome || ''}\n\n` +
      `TÓPICOS DO QUESTIONÁRIO:\n${lista}\n\n` +
      `TRANSCRIÇÃO DA REUNIÃO (com marcas de tempo):\n${transcricao}`;

    const bruto = await this.ia.completar(
      'levantamento',
      {
        system: SISTEMA,
        messages: [{ role: 'user', content: user }],
        maxTokens: 8000,
      },
      meta,
    );

    return this.lerRespostaDaIa(bruto, lote);
  }

  /** Lê o array da IA e o casa com o lote. Descarta em silêncio o que não fizer sentido —
   * número fora da faixa, resposta vazia, item malformado: uma sugestão a menos é um
   * aborrecimento; uma sugestão na pergunta errada é um erro no documento do cliente. */
  private lerRespostaDaIa(
    bruto: string,
    lote: LevantamentoResposta[],
  ): SugestaoLinha[] {
    const itens = this.extrairArray(bruto);
    const vistos = new Set<number>();
    const out: SugestaoLinha[] = [];
    for (const item of itens) {
      const n = Number((item as { n?: unknown }).n);
      // `texto` só vale se vier como string: um objeto aqui viraria "[object Object]" na
      // resposta do cliente, que é pior do que a sugestão não existir.
      const texto = this.comoTexto((item as { resposta?: unknown }).resposta);
      if (!Number.isInteger(n) || n < 1 || n > lote.length) continue;
      if (!texto || vistos.has(n)) continue;
      vistos.add(n);
      const linha = lote[n - 1];
      out.push({
        linhaId: linha.id,
        moduloSigla: linha.moduloSigla,
        topico: linha.topico,
        texto,
        trecho: this.comoTexto((item as { trecho?: unknown }).trecho),
      });
    }
    return out;
  }

  private comoTexto(valor: unknown): string {
    return typeof valor === 'string' ? valor.trim() : '';
  }

  /** O array pedido, mesmo que venha embrulhado em texto ou cercado de ```json. Falhar aqui
   * devolve lista vazia, não exceção: uma resposta ilegível não pode custar os outros lotes,
   * que podem ter vindo perfeitos. */
  private extrairArray(bruto: string): unknown[] {
    const texto = (bruto || '').trim();
    const candidatos = [texto, /\[[\s\S]*\]/.exec(texto)?.[0] ?? ''];
    for (const c of candidatos) {
      if (!c) continue;
      try {
        const dado: unknown = JSON.parse(c);
        if (Array.isArray(dado)) return dado;
      } catch {
        continue;
      }
    }
    this.logger.warn(
      `A IA não devolveu um array JSON legível (${texto.slice(0, 120)}…) — lote ignorado.`,
    );
    return [];
  }
}
