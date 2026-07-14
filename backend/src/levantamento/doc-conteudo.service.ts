import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DocConteudo,
  DocumentoConteudo,
} from '../database/entities/doc-conteudo.entity';

/** Campos estruturados (espelho do layout) de um documento (levantamento|projeto) por
 * projeto — as telas de edição gravam aqui; a geração lê para preencher o .docx. Espelha
 * webapp/db.py (doc_conteudo, doc_conteudo_salvar). */
@Injectable()
export class DocConteudoService {
  constructor(
    @InjectRepository(DocConteudo)
    private readonly repo: Repository<DocConteudo>,
  ) {}

  async valores(
    projetoId: number,
    doc: DocumentoConteudo,
  ): Promise<Record<string, string>> {
    const linhas = await this.repo.find({ where: { projetoId, doc } });
    return Object.fromEntries(linhas.map((l) => [l.campo, l.valor || '']));
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
