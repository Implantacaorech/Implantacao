import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { QuadrosService } from '../quadros.service';
import { ListasRepository } from '../repositories/listas.repository';
import { CartoesRepository } from '../repositories/cartoes.repository';
import { DetalhesCartaoRepository } from '../repositories/detalhes-cartao.repository';
import { EventosAtividadeRepository } from '../repositories/eventos-atividade.repository';
import { PASSO_ORDEM } from '../ordem.util';
import { COLUNA_CONCLUIDO } from '../controle-atividades.constants';
import {
  CartaoImportado,
  PlanoImportacao,
  TrelloInvalidoError,
  lerExportacaoTrello,
} from './trello.parser';

/** Para onde cada lista do Trello vai: uma coluna que já existe, ou uma nova. */
export interface DestinoLista {
  idListaTrello: string;
  /** Id da coluna do Painel; `null` = criar coluna nova com o nome do Trello. */
  listaId: number | null;
}

export interface PreviaImportacao extends PlanoImportacao {
  /** Colunas que o quadro de destino já tem — a tela monta o de/para com isto. */
  colunasDoQuadro: { id: number; titulo: string; visivelCliente: boolean }[];
}

export interface ResultadoImportacao {
  colunasCriadas: number;
  cartoes: number;
  checklistItens: number;
  comentarios: number;
  anexos: number;
  avisos: string[];
}

/** Teto de cartões por importação. Existe para um arquivo enorme (ou adulterado) não virar
 * uma transação de horas segurando o banco — e porque um quadro de implantação com mais de
 * mil cartões é sinal de que se está importando a coisa errada. */
const TETO_CARTOES = 1000;

/** Importa um quadro do Trello para o quadro de um cliente.
 *
 * Duas garantias que valem mais que as demais:
 *
 * 1. **Todo cartão importado nasce INTERNO.** O Trello não tem a noção de "compartilhado com
 *    o cliente", então não há o que mapear — e o default seguro é não mostrar. Importar um
 *    quadro e ver os cartões aparecerem para o cliente seria exatamente o vazamento que o
 *    módulo inteiro existe para impedir.
 * 2. **A prévia não escreve nada.** Quem confirma é a pessoa, vendo antes o que vai entrar e
 *    o que vai ficar de fora. */
@Injectable()
export class ImportacaoTrelloService {
  private readonly logger = new Logger('ImportacaoTrelloService');

  constructor(
    private readonly quadrosSvc: QuadrosService,
    private readonly listas: ListasRepository,
    private readonly cartoes: CartoesRepository,
    private readonly detalhes: DetalhesCartaoRepository,
    private readonly eventos: EventosAtividadeRepository,
  ) {}

  private ler(conteudo: string): PlanoImportacao {
    try {
      return lerExportacaoTrello(conteudo);
    } catch (e) {
      if (e instanceof TrelloInvalidoError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }
  }

  /** Lê o arquivo e mostra o que ENTRARIA, sem gravar nada. */
  async previa(
    user: AuthUser,
    codigoCliente: string,
    conteudo: string,
  ): Promise<PreviaImportacao> {
    const { quadro } = await this.quadrosSvc.exigirEditavel(
      user,
      codigoCliente,
    );
    const plano = this.ler(conteudo);
    const colunas = await this.listas.doQuadro(quadro.id);
    return {
      ...plano,
      colunasDoQuadro: colunas.map((l) => ({
        id: l.id,
        titulo: l.titulo,
        visivelCliente: l.visivelCliente,
      })),
    };
  }

  /** Executa a importação, com o de/para de colunas escolhido na prévia. */
  async importar(
    user: AuthUser,
    codigoCliente: string,
    conteudo: string,
    destinos: DestinoLista[],
  ): Promise<ResultadoImportacao> {
    const { quadro } = await this.quadrosSvc.exigirEditavel(
      user,
      codigoCliente,
    );
    const plano = this.ler(conteudo);

    if (plano.cartoes.length > TETO_CARTOES) {
      throw new BadRequestException(
        `A exportação tem ${plano.cartoes.length} cartões, acima do teto de ${TETO_CARTOES} ` +
          'por importação. Divida o quadro no Trello, ou fale com o Administrador.',
      );
    }

    const colunasExistentes = await this.listas.doQuadro(quadro.id);
    const idsValidos = new Set(colunasExistentes.map((l) => l.id));
    const escolha = new Map(destinos.map((d) => [d.idListaTrello, d.listaId]));

    // ── resolve o destino de cada lista do Trello ──
    let ordemNova =
      colunasExistentes.reduce((m, l) => Math.max(m, l.ordem), 0) + PASSO_ORDEM;
    const destinoPorListaTrello = new Map<string, number>();
    let colunasCriadas = 0;
    // Título por id da coluna — inclui as CRIADAS agora, senão um cartão que cai numa coluna
    // nova chamada "Concluído" não seria marcado como concluído.
    const titulosPorId = new Map(
      colunasExistentes.map((l) => [l.id, l.titulo] as const),
    );

    for (const l of plano.listas) {
      const pedido = escolha.get(l.idTrello);
      if (pedido && idsValidos.has(pedido)) {
        destinoPorListaTrello.set(l.idTrello, pedido);
        continue;
      }
      // Sem escolha (ou com id de outro quadro): cria coluna com o nome do Trello. Nasce
      // INTERNA, pelo mesmo motivo dos cartões — o Trello não sabe o que é compartilhado.
      const nova = await this.listas.criar({
        quadroId: quadro.id,
        titulo: l.titulo,
        visivelCliente: false,
        ordem: ordemNova,
      });
      ordemNova += PASSO_ORDEM;
      colunasCriadas += 1;
      titulosPorId.set(nova.id, nova.titulo);
      destinoPorListaTrello.set(l.idTrello, nova.id);
    }

    // ── cartões ──
    const ordemPorLista = new Map<number, number>();
    let nCheck = 0;
    let nComent = 0;
    let nAnexo = 0;

    for (const c of plano.cartoes) {
      const listaId = destinoPorListaTrello.get(c.idListaTrello);
      if (!listaId) continue;

      const ordem = (ordemPorLista.get(listaId) ?? 0) + PASSO_ORDEM;
      ordemPorLista.set(listaId, ordem);

      const cartao = await this.cartoes.criar({
        listaId,
        quadroId: quadro.id,
        titulo: c.titulo,
        descricao: this.descricaoCom(c),
        ordem,
        // A garantia nº 1 deste service.
        visivelCliente: false,
        origem: 'consultor',
        etiquetas: c.etiquetas.join(','),
        prazo: c.prazo,
        concluidoEm: this.concluidoEm(c, titulosPorId.get(listaId)),
        criadoPorUsuarioId: user.sub,
        criadoPorNome: user.nome,
      });

      for (const [i, item] of c.checklist.entries()) {
        await this.detalhes.incluirItem({
          cartaoId: cartao.id,
          texto: item.texto,
          feito: item.feito,
          ordem: (i + 1) * PASSO_ORDEM,
          feitoPor: item.feito ? 'Trello (importado)' : '',
          feitoEm: item.feito ? new Date() : null,
        });
        nCheck += 1;
      }

      for (const a of c.anexos) {
        await this.detalhes.incluirAnexo({
          cartaoId: cartao.id,
          // Arquivo enviado ao Trello vira LINK: o JSON traz só a URL, que exige sessão do
          // Trello para abrir. Fingir que é anexo do Painel daria um download quebrado.
          tipo: 'link',
          nome: a.nome,
          url: a.url,
          enviadoPor: 'Trello (importado)',
        });
        nAnexo += 1;
      }

      for (const m of c.comentarios) {
        await this.detalhes.incluirComentario({
          cartaoId: cartao.id,
          autorUsuarioId: null,
          autorNome: `${m.autor} (Trello)`,
          autorTipo: 'interno',
          // A data original entra no TEXTO porque `criadoEm` é preenchido pelo banco na
          // inserção: sem isso, uma conversa de meses viraria "tudo comentado hoje".
          texto: m.data ? `[${m.data}] ${m.texto}` : m.texto,
        });
        nComent += 1;
      }
    }

    await this.eventos.registrar({
      quadroId: quadro.id,
      cartaoId: null,
      tipo: 'cartao.criado',
      detalhe: JSON.stringify({
        importacao: 'trello',
        quadroOrigem: plano.nomeQuadro,
        cartoes: plano.cartoes.length,
        colunasCriadas,
      }),
      autorUsuarioId: user.sub,
      autorNome: user.nome,
    });
    this.logger.log(
      `Importação do Trello "${plano.nomeQuadro}" → cliente ${codigoCliente}: ` +
        `${plano.cartoes.length} cartões, ${colunasCriadas} colunas novas.`,
    );

    return {
      colunasCriadas,
      cartoes: plano.cartoes.length,
      checklistItens: nCheck,
      comentarios: nComent,
      anexos: nAnexo,
      avisos: [
        ...plano.avisos,
        'Todos os cartões entraram como INTERNOS. O Trello não distingue o que é do cliente, ' +
          'então compartilhar é decisão sua, cartão a cartão.',
      ],
    };
  }

  /** Descrição do cartão, com os responsáveis do Trello como rodapé quando houver.
   *
   * Conta do Trello não vira usuário do Painel nem contato do SICLA automaticamente — não há
   * chave comum. Em vez de perder a informação ou inventar um vínculo errado, o nome fica
   * anotado e a designação é feita à mão. */
  private descricaoCom(c: CartaoImportado): string {
    const partes = [c.descricao.trim()];
    if (c.membros.length) {
      partes.push(`\n\n— Responsáveis no Trello: ${c.membros.join(', ')}`);
    }
    if (c.etiquetasNaoMapeadas.length) {
      partes.push(
        `\n— Etiquetas do Trello sem equivalente: ${c.etiquetasNaoMapeadas.join(', ')}`,
      );
    }
    return partes.join('').trim().slice(0, 4000);
  }

  /** O cartão entra concluído? Só quando o Trello o marcava concluído, ou quando a coluna de
   * destino é a de conclusão — mesma regra do arraste. */
  private concluidoEm(
    c: CartaoImportado,
    tituloDestino: string | undefined,
  ): Date | null {
    const naColunaDeConclusao =
      (tituloDestino ?? '').localeCompare(COLUNA_CONCLUIDO, 'pt-BR', {
        sensitivity: 'base',
      }) === 0;
    return c.concluido || naColunaDeConclusao ? new Date() : null;
  }
}
