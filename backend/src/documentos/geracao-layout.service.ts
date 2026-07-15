import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { readFileSync } from 'fs';
import { Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import {
  ArquivoGerado,
  GeracaoDocumentosService,
} from '../geracao/geracao-documentos.service';
import { ModeloDocumentoService } from '../catalogos/modelo-documento.service';
import { IndiceTopicoService } from '../catalogos/indice-topico.service';
import { DocConteudoService } from '../levantamento/doc-conteudo.service';
import { LevantamentoRespostaService } from '../levantamento/levantamento-resposta.service';
import { CronogramaItensService } from '../plano-cronograma/cronograma-itens.service';

export type SlugDocumentoFiel = 'levantamento' | 'projeto' | 'cronograma' | 'termo';

/** Orquestra a geração fiel de Levantamento/Projeto/Termo (.docx): monta o payload a partir
 * do schema novo (projeto + catálogos + conteúdo estruturado) e chama o docservice — mesmo
 * fluxo de webapp/routes_geracao.py:_gerar_e_anexar_fiel / gerar_layout.gerar(). */
@Injectable()
export class GeracaoLayoutService {
  constructor(
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    private readonly geracao: GeracaoDocumentosService,
    private readonly modelos: ModeloDocumentoService,
    private readonly indice: IndiceTopicoService,
    private readonly docConteudo: DocConteudoService,
    private readonly levantamentoResposta: LevantamentoRespostaService,
    private readonly cronogramaItens: CronogramaItensService,
  ) {}

  async gerar(
    projetoId: number,
    slug: SlugDocumentoFiel,
    modo: 'auto' | 'modelo' = 'auto',
  ): Promise<ArquivoGerado> {
    const projeto = await this.projetos.findOne({ where: { id: projetoId } });
    if (!projeto) throw new NotFoundException('Projeto não encontrado.');

    const modelo = await this.modelos.porSlug(slug);
    if (!modelo)
      throw new NotFoundException(`Modelo de documento '${slug}' não cadastrado.`);
    const caminho = await this.modelos.arquivoPath(modelo.id);
    if (!caminho)
      throw new NotFoundException(`Arquivo do modelo '${slug}' não encontrado.`);
    const modeloBase64 = readFileSync(caminho).toString('base64');

    const modulos = await this.indice.modulos();
    const { linhas: topicos } = await this.indice.listar();
    const docConteudoDoc =
      slug === 'levantamento' || slug === 'projeto'
        ? await this.docConteudo.valores(projetoId, slug)
        : {};
    const respostas = await this.levantamentoResposta.listar(projetoId);
    const cronogramaLinhas =
      slug === 'cronograma' ? await this.cronogramaItens.doProjeto(projetoId) : [];

    const corpo = {
      slug,
      modo,
      modeloBase64,
      projeto: {
        id: projeto.id,
        cliente: projeto.cliente,
        cnpj: projeto.cnpj,
        ramo: projeto.ramo,
        gci: projeto.gci,
        consultor: projeto.consultor,
        modulos: projeto.modulos,
        numeroProjeto: projeto.numeroProjeto,
        dataLevantamento: projeto.dataLevantamento,
        dataEncerramento: projeto.dataEncerramento,
        horasCobradas: projeto.horasCobradas,
        horasBonificadas: projeto.horasBonificadas,
        observacoes: projeto.observacoes,
      },
      docConteudo: docConteudoDoc,
      indiceModulos: modulos.map((m) => ({ sigla: m.sigla, nome: m.nome })),
      indiceTopicos: topicos.map((t) => ({
        moduloSigla: t.moduloSigla,
        topico: t.topico,
        adicional: t.adicional,
      })),
      levantamentoRespostas: respostas.map((r) => ({
        moduloSigla: r.moduloSigla,
        topico: r.topico,
        resposta: r.resposta,
      })),
      cronogramaItens: cronogramaLinhas.map((i) => ({
        etapa: i.etapa,
        topicos: i.topicos,
        horas: i.horas,
        data: i.data,
        modalidade: i.modalidade,
        status: i.status,
      })),
    };

    return this.geracao.postParaArquivo('/gerar/documento-fiel', corpo);
  }
}
