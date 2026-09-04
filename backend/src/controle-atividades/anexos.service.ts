import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { AtividadeAnexo } from '../database/entities/atividade-anexo.entity';
import { DetalhesCartaoRepository } from './repositories/detalhes-cartao.repository';
import { EventosAtividadeRepository } from './repositories/eventos-atividade.repository';
import { CartoesService } from './cartoes.service';
import { podeInteragirCartao } from './acesso';

/** Onde os anexos do módulo moram. Pasta própria (e não a de `documentos_gerados`) porque o
 * ciclo de vida é outro: documento oficial do processo x anexo de conversa. */
export function storeAnexos(): string {
  return join(process.cwd(), 'dados', 'atividades_anexos');
}

/** Nome de arquivo à prova de path traversal — mesma sanitização de `documentos`. */
export function nomeAnexoSeguro(nome: string): string {
  const semDiretorio = basename(String(nome ?? '').replace(/\\/g, '/'));
  const limpo = semDiretorio
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 180);
  return limpo || 'arquivo';
}

const IMAGENS = /^image\//i;

/** Anexos de cartão: arquivo, foto e link.
 *
 * O download passa **obrigatoriamente** por aqui, e não por pasta estática: quem tem o
 * caminho não pode ter um atalho por fora do recorte do cliente. Cada entrega reconfere a
 * permissão do CARTÃO. */
@Injectable()
export class AnexosService {
  constructor(
    private readonly detalhes: DetalhesCartaoRepository,
    private readonly eventos: EventosAtividadeRepository,
    private readonly cartoes: CartoesService,
  ) {}

  private store(): string {
    const dir = storeAnexos();
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  async anexar(
    user: AuthUser,
    cartaoId: number,
    arquivo: {
      originalname: string;
      buffer: Buffer;
      mimetype?: string;
      size?: number;
    },
  ): Promise<AtividadeAnexo> {
    const { cartao, ctx } = await this.cartoes.exigirCartao(user, cartaoId);
    if (!podeInteragirCartao(ctx)) {
      throw new ForbiddenException(
        'Somente consulta: você não é responsável por este quadro.',
      );
    }
    if (!arquivo?.buffer?.length) {
      throw new BadRequestException('Arquivo vazio.');
    }
    // O multer/busboy decodifica o nome do multipart como latin-1; sem esta volta, acento no
    // nome do arquivo chega corrompido (mesmo tratamento do módulo de protocolos).
    const original = Buffer.from(arquivo.originalname, 'latin1').toString(
      'utf8',
    );
    const nome = nomeAnexoSeguro(original);
    const fisico = `${cartao.id}_${Date.now()}_${nome}`;
    writeFileSync(join(this.store(), fisico), arquivo.buffer);

    const anexo = await this.detalhes.incluirAnexo({
      cartaoId: cartao.id,
      tipo: IMAGENS.test(arquivo.mimetype ?? '') ? 'imagem' : 'arquivo',
      nome: original.slice(0, 260),
      arquivo: fisico,
      mime: (arquivo.mimetype ?? '').slice(0, 120),
      tamanho: arquivo.size ?? arquivo.buffer.length,
      enviadoPor: user.nome,
    });
    await this.eventos.registrar({
      quadroId: cartao.quadroId,
      cartaoId: cartao.id,
      tipo: 'anexo.incluido',
      detalhe: JSON.stringify({ nome: anexo.nome }),
      autorUsuarioId: user.sub,
      autorNome: user.nome,
    });
    return anexo;
  }

  /** Anexo do tipo `link`: guarda só a URL, sem baixar nada.
   *
   * Aceita apenas http/https — `javascript:` e `data:` num href que a tela renderiza seriam
   * XSS armazenado. */
  async anexarLink(
    user: AuthUser,
    cartaoId: number,
    url: string,
    nome?: string,
  ): Promise<AtividadeAnexo> {
    const { cartao, ctx } = await this.cartoes.exigirCartao(user, cartaoId);
    if (!podeInteragirCartao(ctx)) {
      throw new ForbiddenException(
        'Somente consulta: você não é responsável por este quadro.',
      );
    }
    const limpa = (url ?? '').trim();
    if (!/^https?:\/\//i.test(limpa)) {
      throw new BadRequestException(
        'O link precisa começar com http:// ou https://.',
      );
    }
    const anexo = await this.detalhes.incluirAnexo({
      cartaoId: cartao.id,
      tipo: 'link',
      nome: (nome ?? limpa).slice(0, 260),
      url: limpa,
      enviadoPor: user.nome,
    });
    await this.eventos.registrar({
      quadroId: cartao.quadroId,
      cartaoId: cartao.id,
      tipo: 'anexo.incluido',
      detalhe: JSON.stringify({ nome: anexo.nome, link: true }),
      autorUsuarioId: user.sub,
      autorNome: user.nome,
    });
    return anexo;
  }

  /** Resolve o anexo para entrega, reconferindo a permissão do cartão. */
  async paraDownload(
    user: AuthUser,
    cartaoId: number,
    anexoId: number,
  ): Promise<{ caminho: string; nome: string; mime: string }> {
    await this.cartoes.exigirCartao(user, cartaoId);
    const anexo = await this.detalhes.anexoPorId(anexoId);
    if (!anexo || anexo.cartaoId !== cartaoId || anexo.tipo === 'link') {
      throw new NotFoundException('Anexo não encontrado.');
    }
    // `nomeAnexoSeguro` de novo na leitura: o valor vem do banco, mas gravado há muito tempo
    // por um caminho que pode ter mudado — barato o bastante para não confiar.
    const caminho = join(this.store(), nomeAnexoSeguro(anexo.arquivo));
    if (!existsSync(caminho)) {
      throw new NotFoundException('Arquivo não está mais no servidor.');
    }
    return {
      caminho,
      nome: anexo.nome,
      mime: anexo.mime || 'application/octet-stream',
    };
  }

  async remover(
    user: AuthUser,
    cartaoId: number,
    anexoId: number,
  ): Promise<void> {
    const { cartao, ctx } = await this.cartoes.exigirCartao(user, cartaoId);
    if (!podeInteragirCartao(ctx)) {
      throw new ForbiddenException(
        'Somente consulta: você não é responsável por este quadro.',
      );
    }
    const anexo = await this.detalhes.anexoPorId(anexoId);
    if (!anexo || anexo.cartaoId !== cartao.id) {
      throw new NotFoundException('Anexo não encontrado.');
    }
    if (anexo.arquivo) {
      try {
        unlinkSync(join(this.store(), nomeAnexoSeguro(anexo.arquivo)));
      } catch {
        // Arquivo já sumiu do disco: o registro sai do mesmo jeito. Mesmo comportamento
        // tolerante de `documentos` — não travar a limpeza por causa do que já não existe.
      }
    }
    await this.detalhes.removerAnexo(anexoId);
    await this.eventos.registrar({
      quadroId: cartao.quadroId,
      cartaoId: cartao.id,
      tipo: 'anexo.removido',
      detalhe: JSON.stringify({ nome: anexo.nome }),
      autorUsuarioId: user.sub,
      autorNome: user.nome,
    });
  }
}
