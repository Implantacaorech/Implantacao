import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import {
  Documento,
  OrigemDocumento,
} from '../database/entities/documento.entity';
import { Evento, TipoEvento } from '../database/entities/evento.entity';
import { Projeto } from '../database/entities/projeto.entity';
import {
  Cabecalho,
  DocLeve,
  MetricasService,
} from '../metricas/metricas.service';
import { PassosService } from '../passos/passos.service';

// Precedência dos documentos no fluxo — a exclusão respeita as dependências: um documento
// só pode ser excluído se nenhum documento POSTERIOR existir (ex.: exclua o Projeto antes
// do Levantamento). Cronograma e checklist são irmãos (mesmo nível); o Termo depende de
// ambos. Espelha webapp/db.py:DOC_ORDEM/tipo_excluivel.
const DOC_ORDEM: Record<string, number> = {
  levantamento: 0,
  projeto: 1,
  cronograma: 2,
  checklist: 2,
  termo: 3,
};

function tipoExcluivel(tipo: string, tiposExistentes: Set<string>): boolean {
  const rank = DOC_ORDEM[(tipo || '').trim().toLowerCase()];
  if (rank === undefined) return true;
  for (const t of tiposExistentes) {
    const r = DOC_ORDEM[(t || '').trim().toLowerCase()];
    if (r !== undefined && r > rank) return false;
  }
  return true;
}

/** Histórico de documentos anexados/gerados por projeto + timeline de eventos. Espelha
 * webapp/db.py (Documento, Evento, registrar_evento) — usado pela geração de documentos
 * (§item 3 da migração) para registrar o que foi gerado, e por `ProjetosService.excluir`
 * para não deixar linhas órfãs (ver docs/migracao/03-documento-conversao.md). */
@Injectable()
export class DocumentosService {
  constructor(
    @InjectRepository(Documento)
    private readonly documentos: Repository<Documento>,
    @InjectRepository(Evento) private readonly eventos: Repository<Evento>,
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    private readonly metricas: MetricasService,
    // forwardRef: PassosModule importa DocumentosModule (para anexar o e-mail do Outlook)
    // e este importa PassosModule (para concluir o passo do documento) — ciclo real,
    // resolvido do jeito que o Nest prevê.
    @Inject(forwardRef(() => PassosService))
    private readonly passos: PassosService,
  ) {}

  private async buscarProjeto(id: number): Promise<Projeto> {
    const p = await this.projetos.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Projeto não encontrado.');
    return p;
  }

  private async docsDoProjeto(projetoId: number): Promise<DocLeve[]> {
    return (await this.documentos.find({ where: { projetoId } })).map((d) => ({
      tipo: d.tipo,
    }));
  }

  /** Stepper, gates, próxima ação e KPIs da ficha — mesmo cálculo usado no "projeto em
   * foco" da Home (`MetricasService.cabecalho`), aqui exposto para QUALQUER projeto (não só
   * o foco), que é o que a ficha (`projeto_ficha.html`) sempre precisou. */
  async cabecalho(projetoId: number): Promise<Cabecalho> {
    const projeto = await this.buscarProjeto(projetoId);
    return this.metricas.cabecalho(
      projeto,
      await this.docsDoProjeto(projetoId),
    );
  }

  /** Avanço manual de etapa (botão "Avançar para X" da ficha) — exige que o gate da etapa
   * atual esteja OK (mesma regra do avanço automático). Espelha
   * webapp/app.py:projeto_avancar. */
  async avancarEtapa(projetoId: number, autor: string): Promise<Projeto> {
    const projeto = await this.buscarProjeto(projetoId);
    const cab = this.metricas.cabecalho(
      projeto,
      await this.docsDoProjeto(projetoId),
    );
    if (!cab.proxEtapa || !cab.avancarOk) {
      throw new BadRequestException(
        cab.bloqueios.length > 0
          ? cab.bloqueios.join(' · ')
          : 'Avanço de etapa bloqueado.',
      );
    }
    const etapaAnterior = projeto.etapa;
    projeto.etapa = cab.proxEtapa;
    await this.projetos.save(projeto);
    await this.registrarEvento(
      projetoId,
      'etapa',
      `Avançou: ${etapaAnterior} → ${projeto.etapa}`,
      autor,
    );
    return projeto;
  }

  /** Anotação manual na timeline (aba Histórico da ficha). Espelha
   * webapp/app.py:projeto_nota. */
  async adicionarNota(
    projetoId: number,
    nota: string,
    autor: string,
  ): Promise<Evento> {
    if (!nota.trim()) throw new BadRequestException('Informe o texto da nota.');
    return this.registrarEvento(projetoId, 'nota', nota.trim(), autor);
  }

  /** Anexo manual de documento (upload direto pela ficha, distinto dos gerados pelo
   * layout fiel) — sempre `origem: 'importado'`. Espelha webapp/app.py:projeto_anexar. */
  async anexarDocumento(
    projetoId: number,
    tipo: string,
    arquivoOriginal: string,
    buffer: Buffer,
  ): Promise<Documento> {
    const salvo = this.salvarArquivoGerado(projetoId, arquivoOriginal, buffer);
    return this.registrarDocumento(
      projetoId,
      tipo || 'outro',
      salvo.arquivo,
      salvo.caminho,
      'importado',
    );
  }

  /** Exclui um documento SÓ SE nada posterior no fluxo depender dele (DOC_ORDEM) — permite
   * regenerar sem deixar o histórico inconsistente. Espelha
   * webapp/db.py:tipo_excluivel/pode_excluir_documento + webapp/app.py:projeto_doc_excluir. */
  async excluirDocumento(id: number, autor: string): Promise<void> {
    const doc = await this.documentos.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    const outros = await this.documentos.find({
      where: { projetoId: doc.projetoId },
    });
    const tiposExistentes = new Set(
      outros.map((d) => (d.tipo || '').trim().toLowerCase()),
    );
    if (!tipoExcluivel(doc.tipo, tiposExistentes)) {
      throw new BadRequestException(
        'Exclua antes os documentos que dependem deste (respeita o fluxo: Levantamento → Projeto → Cronograma/Checklist → Termo).',
      );
    }
    await this.documentos.delete({ id });
    try {
      unlinkSync(doc.caminho);
    } catch {
      // Arquivo físico já ausente/inacessível — não bloqueia a exclusão do registro
      // (mesmo comportamento tolerante do Flask original, que só usa o caminho para
      // servir download, nunca falha a exclusão por causa dele).
    }
    await this.registrarEvento(
      doc.projetoId,
      'documento',
      `Excluiu ${doc.arquivo} (${doc.tipo})`,
      autor,
    );
  }

  private store(): string {
    const dir = join(process.cwd(), 'dados', 'documentos_gerados');
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Grava o buffer recebido do serviço de geração no store local e devolve o nome/caminho
   * a persistir no registro do Documento. Prefixa com o id do projeto + timestamp para
   * nunca colidir entre gerações repetidas do mesmo cliente. */
  salvarArquivoGerado(
    projetoId: number,
    nomeSugerido: string,
    buffer: Buffer,
  ): { arquivo: string; caminho: string } {
    const arquivo = `${projetoId}_${Date.now()}_${nomeSugerido}`;
    const caminho = join(this.store(), arquivo);
    writeFileSync(caminho, buffer);
    return { arquivo, caminho };
  }

  /** Documento gerado/anexado -> conclui o passo do processo que corresponde a ele.
   *
   * Todo caminho de geração passa por aqui, então este é o único lugar que precisa saber a
   * correspondência. Tipo que não estiver no mapa (por exemplo `email_passo_3`, do anexo do
   * Outlook) simplesmente não conclui passo nenhum. */
  // Números conforme os 19 passos (o passo 3 "Realizar o Levantamento" entrou em 2026-07-28,
  // deslocando +1 tudo a partir do 3): Criação do Projeto = 9, Cronograma = 11,
  // Check-list = 12, Termo = 16.
  private static readonly PASSO_POR_TIPO: Record<string, number> = {
    projeto: 9,
    cronograma: 11,
    checklist: 12,
    termo: 16,
  };

  async registrarDocumento(
    projetoId: number,
    tipo: string,
    arquivo: string,
    caminho: string,
    origem: OrigemDocumento = 'gerado',
    autor = 'sistema',
  ): Promise<Documento> {
    const doc = await this.documentos.save(
      this.documentos.create({ projetoId, tipo, arquivo, caminho, origem }),
    );
    const passo =
      DocumentosService.PASSO_POR_TIPO[(tipo || '').trim().toLowerCase()];
    if (passo) {
      await this.passos.concluirAutomatico(
        projetoId,
        passo,
        autor,
        `Documento ${tipo} gerado`,
      );
    }
    return doc;
  }

  async registrarEvento(
    projetoId: number,
    tipo: TipoEvento,
    descricao: string,
    autor = '',
  ): Promise<Evento> {
    return this.eventos.save(
      this.eventos.create({ projetoId, tipo, descricao, autor }),
    );
  }

  async listarDocumentos(projetoId: number): Promise<Documento[]> {
    return this.documentos.find({
      where: { projetoId },
      order: { criadoEm: 'DESC' },
    });
  }

  async listarEventos(projetoId: number): Promise<Evento[]> {
    return this.eventos.find({
      where: { projetoId },
      order: { criadoEm: 'DESC' },
    });
  }

  async buscarDocumento(id: number): Promise<Documento | null> {
    return this.documentos.findOne({ where: { id } });
  }

  /** Levantamento (.docx) importado mais recente do projeto, se houver — equivalente a
   * webapp/db.py:levantamento_importado. Usado por "Projeto origem" (fonte "importado":
   * reusar o último Levantamento já enviado, sem pedir upload de novo). */
  async ultimoLevantamentoImportado(
    projetoId: number,
  ): Promise<Documento | null> {
    return this.documentos.findOne({
      where: { projetoId, tipo: 'levantamento', origem: 'importado' },
      order: { id: 'DESC' },
    });
  }

  /** Chamado por `ProjetosService.excluir` — sem isso, excluir um projeto deixaria
   * Documento/Evento órfãos (mesma categoria de bug já encontrada e corrigida no Flask
   * original, e reproduzida aqui até esta correção — ver §6 da documentação da migração). */
  async limparProjeto(projetoId: number): Promise<void> {
    await this.documentos.delete({ projetoId });
    await this.eventos.delete({ projetoId });
  }
}
