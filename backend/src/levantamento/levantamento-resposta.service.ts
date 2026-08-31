import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { LevantamentoResposta } from '../database/entities/levantamento-resposta.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { IndiceTopicoService } from '../catalogos/indice-topico.service';

/** Texto gravado na resposta quando a pergunta é marcada como "Não será utilizado." — o
 * documento gerado sai com esta frase, nunca em branco. Espelhado no frontend em
 * `core/models/levantamento.model.ts`; mudou aqui, muda lá. */
export const TEXTO_NAO_UTILIZADO =
  'Este campo foi desconsiderado, pois esta funcionalidade não será utilizada pelo cliente.';

/** Questionário do Levantamento: uma linha por tópico do Índice, semeada dos módulos
 * contratados do projeto, com a resposta digitada pelo consultor. Espelha webapp/db.py
 * (levantamento_seed, levantamento_respostas, levantamento_salvar, levantamento_resumo). */
@Injectable()
export class LevantamentoRespostaService {
  constructor(
    @InjectRepository(LevantamentoResposta)
    private readonly repo: Repository<LevantamentoResposta>,
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    private readonly indice: IndiceTopicoService,
  ) {}

  /** Garante o seed a partir dos módulos contratados do projeto — chamado antes de
   * qualquer leitura das respostas (mesmo padrão do `garantirSeed` do Agendador). */
  async garantirSeed(projetoId: number): Promise<void> {
    const projeto = await this.projetos.findOne({ where: { id: projetoId } });
    if (!projeto) return;
    await this.seed(projetoId, projeto.modulos || '');
  }

  /** Idempotente — não recria nem apaga respostas já digitadas. Devolve o total.
   *
   * `modulosStr` é a lista de CÓDIGOS contratados (o seletor do SICLA grava o código efetivo
   * em `Projeto.modulos`: do adicional quando há, senão do módulo). O Índice é filtrado por
   * esse código (`modulo_num` base ou `adicional_num`), trazendo só as perguntas da
   * contratação — módulo e/ou adicional, conforme o fechamento. */
  async seed(projetoId: number, modulosStr: string): Promise<number> {
    const ja = await this.repo.count({ where: { projetoId } });
    if (ja > 0) return ja;

    const codigos = [
      ...new Set(
        (modulosStr || '')
          .split(/[,;\n]+/)
          .map((m) => m.trim())
          .filter(Boolean),
      ),
    ];
    const topicos = await this.indice.porCodigos(codigos);

    const linhas = topicos.map((t, i) =>
      this.repo.create({
        projetoId,
        ordem: i,
        moduloSigla: t.moduloSigla,
        modulo: t.modulo,
        adicional: t.adicional,
        topico: t.topico,
      }),
    );
    if (linhas.length > 0) await this.repo.save(linhas);
    return linhas.length;
  }

  async listar(projetoId: number): Promise<LevantamentoResposta[]> {
    return this.repo.find({
      where: { projetoId },
      order: { ordem: 'ASC', id: 'ASC' },
    });
  }

  /** Só as linhas que mudaram depois de `desde` — é o que o polling da tela colaborativa
   * consome a cada tique (o projeto inteiro tem centenas de perguntas; trafegar tudo de
   * 5 em 5 segundos, para nada, seria desperdício). */
  async alteradasDesde(
    projetoId: number,
    desde: Date,
  ): Promise<LevantamentoResposta[]> {
    return this.repo.find({
      where: { projetoId, atualizadoEm: MoreThan(desde) },
      order: { ordem: 'ASC', id: 'ASC' },
    });
  }

  /** Grava UMA pergunta — caminho normal da tela (autosave por campo).
   *
   * Concorrência otimista: `versao` é a que o cliente tinha em tela. Se o banco já está
   * numa versão diferente, alguém salvou entre a leitura e esta gravação e o certo é
   * RECUSAR (409) para a tela recarregar o valor do colega, não sobrescrever. Sem `versao`
   * no payload, grava sem conferir (uso administrativo/importação).
   *
   * `naoUtilizado` manda na resposta: ligado, o texto é sempre TEXTO_NAO_UTILIZADO — a
   * regra vive aqui, não na tela, senão bastaria um PATCH fora do navegador para gravar a
   * flag com um texto qualquer. */
  async salvarLinha(
    projetoId: number,
    linhaId: number,
    dados: { resposta?: string; naoUtilizado?: boolean; versao?: number },
    autor: string,
  ): Promise<LevantamentoResposta> {
    const linha = await this.repo.findOne({
      where: { id: linhaId, projetoId },
    });
    if (!linha) throw new NotFoundException('Pergunta não encontrada.');

    if (dados.versao !== undefined && dados.versao !== linha.versao) {
      throw new ConflictException(
        `Esta resposta foi alterada por ${linha.atualizadoPor || 'outro técnico'} enquanto você digitava. O campo foi recarregado com a versão mais recente.`,
      );
    }

    const naoUtilizado = dados.naoUtilizado ?? linha.naoUtilizado;
    linha.naoUtilizado = naoUtilizado;
    linha.resposta = naoUtilizado
      ? TEXTO_NAO_UTILIZADO
      : (dados.resposta ?? linha.resposta).trim();
    linha.versao += 1;
    linha.atualizadoPor = autor;
    linha.atualizadoEm = new Date();
    return this.repo.save(linha);
  }

  /** `respostas` = { [id da linha]: resposta }. Devolve o nº de respostas preenchidas.
   *
   * Só toca nas linhas presentes no payload: mandar a tela inteira e zerar o que não veio
   * apagaria, calado, o que o colega respondeu em outra máquina no meio da edição. Linhas
   * marcadas como "Não será utilizado." também ficam de fora — o texto delas é do backend
   * (ver `salvarLinha`), não do que a tela mandar. */
  async salvar(
    projetoId: number,
    respostas: Record<string, string>,
    autor = '',
  ): Promise<number> {
    const linhas = await this.repo.find({ where: { projetoId } });
    const agora = new Date();
    const alteradas: LevantamentoResposta[] = [];
    let n = 0;
    for (const r of linhas) {
      const bruta = respostas[String(r.id)];
      if (bruta !== undefined && !r.naoUtilizado) {
        const v = bruta.trim();
        if (v !== r.resposta) {
          r.resposta = v;
          r.versao += 1;
          r.atualizadoPor = autor;
          r.atualizadoEm = agora;
          alteradas.push(r);
        }
      }
      if ((r.resposta || '').trim()) n++;
    }
    if (alteradas.length > 0) await this.repo.save(alteradas);
    return n;
  }

  async resumo(
    projetoId: number,
  ): Promise<{ respondidas: number; total: number }> {
    const linhas = await this.repo.find({ where: { projetoId } });
    return {
      respondidas: linhas.filter((l) => (l.resposta || '').trim()).length,
      total: linhas.length,
    };
  }

  /** Chamado por `ProjetosService.excluir` — ver comentário equivalente em
   * cronograma.service.ts. */
  async limparProjeto(projetoId: number): Promise<void> {
    await this.repo.delete({ projetoId });
  }
}
