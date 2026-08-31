import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DocConteudo,
  DocumentoConteudo,
} from '../database/entities/doc-conteudo.entity';
import { HerancaProjetoService } from './heranca-projeto.service';

/** Campos estruturados (espelho do layout) de um documento (levantamento|projeto) por
 * projeto — as telas de edição gravam aqui; a geração lê para preencher o .docx. Espelha
 * webapp/db.py (doc_conteudo, doc_conteudo_salvar). */
@Injectable()
export class DocConteudoService {
  constructor(
    @InjectRepository(DocConteudo)
    private readonly repo: Repository<DocConteudo>,
    private readonly heranca: HerancaProjetoService,
  ) {}

  /**
   * Campos gravados para o documento, SEM a herança da etapa 3 — é o que a pessoa
   * efetivamente digitou e salvou. Use quando precisar distinguir "o GCI escreveu isto" de
   * "isto veio do Levantamento"; para exibir ou gerar o documento, use `valores`.
   */
  async valoresSalvos(
    projetoId: number,
    doc: DocumentoConteudo,
  ): Promise<Record<string, string>> {
    const linhas = await this.repo.find({ where: { projetoId, doc } });
    return Object.fromEntries(linhas.map((l) => [l.campo, l.valor || '']));
  }

  /**
   * Campos do documento como a tela e a geração devem enxergá-los.
   *
   * No Projeto (etapa 10) isso inclui a HERANÇA da etapa 3: o documento não é redigido do
   * zero, ele nasce do Levantamento e o GCI ajusta o que for necessário antes de gerar (ver
   * `HerancaProjetoService`). O que o GCI salvou vence; campo ainda vazio cai no valor
   * herdado, recalculado a cada leitura. Como a mesma função alimenta a tela e o
   * `GeracaoLayoutService`, os dois enxergam exatamente o mesmo texto — o documento gerado é
   * o que estava na tela.
   */
  async valores(
    projetoId: number,
    doc: DocumentoConteudo,
  ): Promise<Record<string, string>> {
    const salvos = await this.valoresSalvos(projetoId, doc);
    if (doc !== 'projeto') return salvos;
    const herdados = await this.heranca.valores(projetoId);
    const out: Record<string, string> = { ...herdados };
    for (const [campo, valor] of Object.entries(salvos)) {
      // Só sobrepõe com conteúdo: linha salva em branco é campo nunca preenchido (a tela
      // grava a seção inteira de uma vez), e apagá-la não pode esconder o que veio da
      // etapa 3 — senão o Projeto sairia mais pobre que o Levantamento que o originou.
      if (valor) out[campo] = valor;
      else if (!(campo in out)) out[campo] = '';
    }
    return out;
  }

  async salvar(
    projetoId: number,
    doc: DocumentoConteudo,
    campos: Record<string, string>,
  ): Promise<void> {
    const atuais = await this.repo.find({ where: { projetoId, doc } });
    const porCampo = new Map(atuais.map((l) => [l.campo, l]));
    const paraSalvar: DocConteudo[] = [];
    for (const [campo, valorBruto] of Object.entries(campos)) {
      const valor = (valorBruto || '').trim();
      const existente = porCampo.get(campo);
      if (existente) {
        existente.valor = valor;
        paraSalvar.push(existente);
      } else {
        paraSalvar.push(this.repo.create({ projetoId, doc, campo, valor }));
      }
    }
    if (paraSalvar.length > 0) await this.repo.save(paraSalvar);
  }

  /** Chamado por `ProjetosService.excluir` — ver comentário equivalente em
   * cronograma.service.ts. */
  async limparProjeto(projetoId: number): Promise<void> {
    await this.repo.delete({ projetoId });
  }
}
