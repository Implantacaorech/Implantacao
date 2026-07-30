import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PreferenciaUsuario } from '../database/entities/preferencia-usuario.entity';
import {
  CHAVE_PREFERENCIA_RE,
  TAMANHO_MAX_PREFERENCIA,
} from './preferencias.constants';

/** Preferências de tela do usuário LOGADO — hoje, a seleção de filtros de cada tela.
 *
 * O `usuarioId` sempre vem do token (nunca do corpo/URL): não existe caminho para ler ou
 * escrever a preferência de outra pessoa. Ver `preferencias.controller.ts`. */
@Injectable()
export class PreferenciasService {
  private readonly logger = new Logger('PreferenciasService');

  constructor(
    @InjectRepository(PreferenciaUsuario)
    private readonly repo: Repository<PreferenciaUsuario>,
  ) {}

  private validarChave(chave: string): string {
    const c = (chave || '').trim();
    if (!CHAVE_PREFERENCIA_RE.test(c)) {
      throw new BadRequestException(
        'Chave de preferência inválida (use minúsculas, dígitos, ".", "-" ou "_").',
      );
    }
    return c;
  }

  /** Todas as preferências do usuário, já desserializadas, como mapa chave→valor.
   *
   * JSON corrompido (preferência gravada por uma versão anterior da tela, edição manual no
   * banco) é IGNORADO em vez de derrubar a chamada: filtro salvo é conveniência, e perder a
   * tela inteira por causa de uma linha ruim seria um péssimo negócio. */
  async todas(usuarioId: number): Promise<Record<string, unknown>> {
    const linhas = await this.repo.find({ where: { usuarioId } });
    const mapa: Record<string, unknown> = {};
    for (const l of linhas) {
      try {
        mapa[l.chave] = JSON.parse(l.valor);
      } catch {
        this.logger.warn(
          `Preferência "${l.chave}" do usuário ${usuarioId} tem JSON inválido — ignorada.`,
        );
      }
    }
    return mapa;
  }

  async salvar(
    usuarioId: number,
    chave: string,
    valor: unknown,
  ): Promise<void> {
    const c = this.validarChave(chave);
    const json = JSON.stringify(valor ?? null);
    if (json.length > TAMANHO_MAX_PREFERENCIA) {
      throw new BadRequestException(
        `Preferência muito grande (máximo ${TAMANHO_MAX_PREFERENCIA} caracteres).`,
      );
    }
    // upsert em UMA instrução: a tela pode gravar duas vezes em sequência (o usuário mexeu
    // em dois filtros) e um find+insert perderia a corrida com erro de índice único.
    await this.repo.upsert({ usuarioId, chave: c, valor: json }, [
      'usuarioId',
      'chave',
    ]);
  }

  async remover(usuarioId: number, chave: string): Promise<void> {
    await this.repo.delete({ usuarioId, chave: this.validarChave(chave) });
  }
}
