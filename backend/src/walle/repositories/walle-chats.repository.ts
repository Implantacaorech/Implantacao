import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalleChat } from '../../database/entities/walle-chat.entity';

/** Persistência dos chats do acervo Wall-e (`walle_chats`). Só CRUD. */
@Injectable()
export class WalleChatsRepository {
  constructor(
    @InjectRepository(WalleChat)
    private readonly repo: Repository<WalleChat>,
  ) {}

  todos(): Promise<WalleChat[]> {
    return this.repo.find({ order: { codigo: 'ASC' } });
  }

  porCodigo(codigo: number): Promise<WalleChat | null> {
    return this.repo.findOne({ where: { codigo } });
  }

  salvar(chat: Partial<WalleChat>): Promise<WalleChat> {
    return this.repo.save(chat);
  }

  contar(): Promise<number> {
    return this.repo.count();
  }
}
