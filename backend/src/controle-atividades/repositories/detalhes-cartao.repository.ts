import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AtividadeMembro } from '../../database/entities/atividade-membro.entity';
import { AtividadeChecklistItem } from '../../database/entities/atividade-checklist-item.entity';
import { AtividadeAnexo } from '../../database/entities/atividade-anexo.entity';
import { AtividadeComentario } from '../../database/entities/atividade-comentario.entity';

/** Persistência do CONTEÚDO de um cartão: membros, checklist, anexos e comentários.
 *
 * Um repository só para os quatro porque eles têm o mesmo ciclo de vida (nascem e morrem com
 * o cartão) e são quase sempre lidos juntos — separá-los em quatro classes daria quatro
 * arquivos com três métodos iguais cada. */
@Injectable()
export class DetalhesCartaoRepository {
  constructor(
    @InjectRepository(AtividadeMembro)
    private readonly membros: Repository<AtividadeMembro>,
    @InjectRepository(AtividadeChecklistItem)
    private readonly checklist: Repository<AtividadeChecklistItem>,
    @InjectRepository(AtividadeAnexo)
    private readonly anexos: Repository<AtividadeAnexo>,
    @InjectRepository(AtividadeComentario)
    private readonly comentarios: Repository<AtividadeComentario>,
  ) {}

  // --- membros ---
  async membrosDe(cartaoIds: number[]): Promise<AtividadeMembro[]> {
    if (!cartaoIds.length) return [];
    return this.membros.find({
      where: { cartaoId: In(cartaoIds) },
      order: { id: 'ASC' },
    });
  }
  async incluirMembro(
    dados: Partial<AtividadeMembro>,
  ): Promise<AtividadeMembro> {
    return this.membros.save(this.membros.create(dados));
  }
  async membroPorId(id: number): Promise<AtividadeMembro | null> {
    return this.membros.findOne({ where: { id } });
  }
  async removerMembro(id: number): Promise<void> {
    await this.membros.delete({ id });
  }

  // --- checklist ---
  async checklistDe(cartaoIds: number[]): Promise<AtividadeChecklistItem[]> {
    if (!cartaoIds.length) return [];
    return this.checklist.find({
      where: { cartaoId: In(cartaoIds) },
      order: { ordem: 'ASC', id: 'ASC' },
    });
  }
  async incluirItem(
    dados: Partial<AtividadeChecklistItem>,
  ): Promise<AtividadeChecklistItem> {
    return this.checklist.save(this.checklist.create(dados));
  }
  async itemPorId(id: number): Promise<AtividadeChecklistItem | null> {
    return this.checklist.findOne({ where: { id } });
  }
  async salvarItem(
    item: AtividadeChecklistItem,
  ): Promise<AtividadeChecklistItem> {
    return this.checklist.save(item);
  }
  async removerItem(id: number): Promise<void> {
    await this.checklist.delete({ id });
  }

  // --- anexos ---
  async anexosDe(cartaoIds: number[]): Promise<AtividadeAnexo[]> {
    if (!cartaoIds.length) return [];
    return this.anexos.find({
      where: { cartaoId: In(cartaoIds) },
      order: { id: 'ASC' },
    });
  }
  async incluirAnexo(dados: Partial<AtividadeAnexo>): Promise<AtividadeAnexo> {
    return this.anexos.save(this.anexos.create(dados));
  }
  async anexoPorId(id: number): Promise<AtividadeAnexo | null> {
    return this.anexos.findOne({ where: { id } });
  }
  async removerAnexo(id: number): Promise<void> {
    await this.anexos.delete({ id });
  }

  // --- comentários ---
  async comentariosDe(cartaoIds: number[]): Promise<AtividadeComentario[]> {
    if (!cartaoIds.length) return [];
    return this.comentarios.find({
      where: { cartaoId: In(cartaoIds) },
      order: { criadoEm: 'ASC', id: 'ASC' },
    });
  }
  async incluirComentario(
    dados: Partial<AtividadeComentario>,
  ): Promise<AtividadeComentario> {
    return this.comentarios.save(this.comentarios.create(dados));
  }
}
