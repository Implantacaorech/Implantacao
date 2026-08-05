import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  ClientesSiclaService,
  ResultadoBusca,
} from '../clientes-sicla/clientes-sicla.service';
import { Projeto } from '../database/entities/projeto.entity';
import { Protocolo } from '../database/entities/protocolo.entity';
import {
  EstadoGravacaoVivo,
  TranscricaoService,
} from '../transcricao/transcricao.service';
import { ProcessamentoProtocolosService } from './processamento-protocolos.service';
import { ProtocolosService } from './protocolos.service';
import { slug } from './protocolos.constants';
import { exigirAcessoProtocolo } from './protocolos.acesso';
import { montarVocabulario } from './vocabulario';
import { FonteAudio, ROTULO_FONTE } from './dto/gravacao.dto';

/** Onde ficam os .wav das reuniões gravadas, dentro da pasta raiz dos protocolos. Fora de
 * 'Videos Pendentes' de propósito: aquela pasta é varrida pelo robô, e uma gravação não
 * pode ser registrada duas vezes (o robô criaria um segundo protocolo para o mesmo áudio). */
export const PASTA_GRAVACOES = 'Gravacoes';

/** Gravação de reunião AO VIVO — presencial (microfone) ou remota pelo Teams (áudio da
 * tela compartilhada). O navegador captura, corta em trechos de ~20 s e envia; cada trecho
 * é transcrito na hora pelo docservice (worker com o modelo aquecido) e o texto vai
 * aparecendo na tela. Ao encerrar, os trechos viram um único .wav e a transcrição completa
 * entra no MESMO pipeline dos vídeos — análise de IA + resumo completo — reaproveitando
 * `ProcessamentoProtocolosService.processar`, que pula a transcrição quando o texto já
 * existe.
 *
 * Este serviço é o dono da máquina de estados da gravação; o docservice só transcreve e
 * junta áudio (não conhece Protocolo nem banco). */
@Injectable()
export class GravacaoProtocolosService {
  private readonly logger = new Logger('GravacaoProtocolosService');

  constructor(
    private readonly protocolos: ProtocolosService,
    private readonly processamento: ProcessamentoProtocolosService,
    private readonly transcricao: TranscricaoService,
    private readonly clientesSicla: ClientesSiclaService,
    @InjectRepository(Projeto)
    private readonly projetos: Repository<Projeto>,
  ) {}

  /** Busca o cliente na MESMA fonte do "Novo Cliente" (passo 1): o **SICLA**, pelo mesmo
   * SQL editável em Consultas BD. A carteira de projetos do painel não serve aqui — ela só
   * tem quem já virou implantação, e uma reunião costuma acontecer ANTES disso (pré-venda,
   * levantamento). Delegar em vez de duplicar garante que uma correção no SQL do passo 1
   * valha aqui também.
   *
   * Reexposto sob a permissão 'protocolos' de propósito: o endpoint original exige
   * 'novo_cliente' (só o Comercial), e quem grava reunião é o consultor. */
  async buscarClientes(termo: string): Promise<ResultadoBusca> {
    return this.clientesSicla.buscar(termo);
  }

  private async protocoloGravando(
    id: number,
    user: AuthUser,
  ): Promise<Protocolo> {
    const p = await this.protocolos.buscar(id);
    if (!p) throw new NotFoundException('Gravação não encontrada.');
    // Gravação é de quem a iniciou — ninguém manda áudio nem encerra a reunião de outro.
    exigirAcessoProtocolo(p, user);
    if (p.status !== 'Gravando') {
      throw new ConflictException(
        `Esta gravação já foi encerrada (status "${p.status}").`,
      );
    }
    return p;
  }

  /** Abre o registro e a sessão no docservice. Se o docservice não responder, o registro
   * é desfeito — não faz sentido deixar um protocolo "Gravando" que nunca vai receber
   * áudio. */
  async iniciar(
    user: AuthUser,
    dados: {
      projetoId?: number;
      clienteCodigo?: string;
      cliente?: string;
      cnpj?: string;
      titulo?: string;
      vocabulario?: string;
      participantes?: number;
      fonte?: FonteAudio;
    },
  ): Promise<{ id: number; cliente: string; titulo: string }> {
    const escolha = await this.resolverCliente(dados);
    const fonte = ROTULO_FONTE[dados.fonte ?? 'microfone'];
    const titulo =
      (dados.titulo || '').trim() || this.tituloPadrao(escolha.cliente);

    const p = await this.protocolos.criarGravacao({
      titulo,
      projetoId: escolha.projetoId,
      cliente: escolha.cliente,
      clienteCodigo: escolha.clienteCodigo,
      // Guardado no registro (e não só passado adiante) porque a retranscrição do arquivo
      // acontece depois, no encerramento, e precisa dos mesmos termos.
      vocabulario: (dados.vocabulario || '').trim(),
      // Só faz sentido separar a partir de 2 vozes; 0/1 desliga a diarização.
      participantes: (dados.participantes ?? 0) >= 2 ? dados.participantes! : 0,
      responsavel: user.nome,
      fonte,
    });
    try {
      await this.transcricao.vivoIniciar(
        p.id,
        montarVocabulario({
          digitado: dados.vocabulario,
          cliente: escolha.cliente,
          titulo,
        }),
      );
    } catch (e) {
      await this.protocolos.excluir(p.id);
      throw e;
    }
    return { id: p.id, cliente: escolha.cliente, titulo };
  }

  /** Decide QUEM é o cliente da gravação a partir do que a tela mandou.
   *
   * Duas entradas possíveis, e as duas convivem:
   * - **projetoId** — veio de uma tela do projeto (o botão do Levantamento). O nome sai da
   *   ficha, que é a informação mais confiável nesse caminho.
   * - **cliente/clienteCodigo** — veio da busca no SICLA. Aí ainda tentamos amarrar um
   *   projeto pelo CNPJ: quando a implantação já existe no painel, a gravação passa a
   *   aparecer ligada a ela sem o usuário ter de escolher duas vezes.
   *
   * Sem nenhum dos dois, a gravação fica sem dono (conteúdo genérico) — é opção válida. */
  private async resolverCliente(dados: {
    projetoId?: number;
    clienteCodigo?: string;
    cliente?: string;
    cnpj?: string;
  }): Promise<{
    projetoId: number | null;
    cliente: string;
    clienteCodigo: string;
  }> {
    if (dados.projetoId) {
      const projeto = await this.projetos.findOne({
        where: { id: dados.projetoId },
      });
      if (!projeto) {
        throw new UnprocessableEntityException(
          'Projeto do cliente não encontrado.',
        );
      }
      return {
        projetoId: projeto.id,
        cliente: projeto.cliente,
        clienteCodigo: (dados.clienteCodigo || '').trim(),
      };
    }

    const cliente = (dados.cliente || '').trim();
    if (!cliente) {
      return { projetoId: null, cliente: '', clienteCodigo: '' };
    }
    const digitos = (dados.cnpj || '').replace(/\D/g, '');
    let projetoId: number | null = null;
    if (digitos.length >= 11) {
      const projetos = await this.projetos.find({ select: ['id', 'cnpj'] });
      projetoId =
        projetos.find((p) => (p.cnpj || '').replace(/\D/g, '') === digitos)
          ?.id ?? null;
    }
    return {
      projetoId,
      cliente,
      clienteCodigo: (dados.clienteCodigo || '').trim(),
    };
  }

  private tituloPadrao(cliente: string): string {
    const agora = new Date();
    const dd = String(agora.getDate()).padStart(2, '0');
    const mm = String(agora.getMonth() + 1).padStart(2, '0');
    const hh = String(agora.getHours()).padStart(2, '0');
    const mi = String(agora.getMinutes()).padStart(2, '0');
    const quando = `${dd}/${mm}/${agora.getFullYear()} ${hh}:${mi}`;
    return cliente
      ? `Reunião ${cliente} — ${quando}`
      : `Reunião gravada — ${quando}`;
  }

  /** Recebe um trecho de áudio e o manda transcrever. */
  async trecho(
    id: number,
    seq: number,
    audio: Buffer,
    user: AuthUser,
  ): Promise<{ inicioSeg: number }> {
    await this.protocoloGravando(id, user);
    return this.transcricao.vivoTrecho(id, seq, audio);
  }

  /** Andamento da gravação (texto parcial). */
  async estado(id: number, user: AuthUser): Promise<EstadoGravacaoVivo> {
    await this.protocoloGravando(id, user);
    const estado = await this.transcricao.vivoEstado(id);
    if (!estado) {
      throw new NotFoundException(
        'A gravação não está mais ativa no servidor (o serviço de transcrição foi reiniciado?).',
      );
    }
    return estado;
  }

  private caminhoDestino(p: Protocolo): { nome: string; caminho: string } {
    const destDir = join(this.processamento.pastaRaiz(), PASTA_GRAVACOES);
    mkdirSync(destDir, { recursive: true });
    const agora = new Date();
    const carimbo =
      `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}` +
      `${String(agora.getDate()).padStart(2, '0')}_` +
      `${String(agora.getHours()).padStart(2, '0')}${String(agora.getMinutes()).padStart(2, '0')}`;
    const base = slug(`${carimbo}_${p.cliente || 'reuniao'}_${p.id}`);
    let nome = `${base}.wav`;
    let caminho = join(destDir, nome);
    let n = 1;
    while (existsSync(caminho)) {
      nome = `${base}_${n}.wav`;
      caminho = join(destDir, nome);
      n += 1;
    }
    return { nome, caminho };
  }

  /** Encerra a gravação: junta o áudio, grava a transcrição e dispara a análise de IA +
   * resumo completo em segundo plano (o mesmo pipeline dos vídeos). */
  async finalizar(
    id: number,
    user: AuthUser,
    opcoes: { titulo?: string; retranscrever?: boolean } = {},
  ): Promise<{ id: number; aviso: string; duracaoSeg: number }> {
    const autor = user.nome;
    const p = await this.protocoloGravando(id, user);
    const { nome, caminho } = this.caminhoDestino(p);
    const r = await this.transcricao.vivoFinalizar(id, caminho);

    const texto = (r.texto || '').trim();
    // Sem texto ao vivo (worker caiu, silêncio total, modelo ainda carregando quando a
    // reunião acabou), o áudio ainda está salvo: cai no pipeline completo, que transcreve
    // o .wav do zero. Melhor que devolver um protocolo vazio.
    const retranscrever = opcoes.retranscrever === true || !texto;

    await this.protocolos.atualizar(id, {
      titulo: (opcoes.titulo || '').trim() || p.titulo,
      videoNome: nome,
      videoCaminho: caminho,
      videoHash: this.protocolos.hash(caminho),
      duracaoSeg: r.duracaoSeg,
      transcricao: retranscrever ? '' : texto,
    });
    const detalhe = retranscrever
      ? 'áudio salvo; será transcrito do zero pelo Whisper'
      : `${r.trechos} trecho(s) transcrito(s) ao vivo`;
    await this.protocolos.atualizarStatus(
      id,
      'Pendente',
      undefined,
      autor || 'gravação',
    );
    await this.protocolos.salvarHistorico(
      id,
      `Gravação encerrada (${Math.round(r.duracaoSeg / 60)} min) — ${detalhe}.`,
      autor || 'gravação',
    );
    if (r.pendentes > 0) {
      this.logger.warn(
        `Gravação ${id} encerrada com ${r.pendentes} trecho(s) sem transcrição.`,
      );
    }

    this.processamento.processarAsync(id, autor || 'gravação');
    return {
      id,
      duracaoSeg: r.duracaoSeg,
      aviso: retranscrever
        ? 'Gravação encerrada. O áudio será transcrito e analisado — acompanhe o andamento na revisão.'
        : 'Gravação encerrada. A IA está montando o protocolo e o resumo completo — acompanhe na revisão.',
    };
  }

  /** Descarta a gravação inteira (áudio e registro). */
  async cancelar(id: number, user: AuthUser): Promise<void> {
    await this.protocoloGravando(id, user);
    await this.transcricao.vivoCancelar(id);
    const p = await this.protocolos.excluir(id);
    if (p?.videoCaminho) this.processamento.apagarArquivo(p.videoCaminho);
  }
}
