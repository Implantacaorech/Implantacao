import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalleArquivo } from '../../database/entities/walle-arquivo.entity';

/** Persistência do índice de arquivos do acervo Wall-e (`walle_arquivos`). Só CRUD — a
 * regra (o que indexar, como pontuar) mora nos services. */
@Injectable()
export class WalleArquivosRepository {
  constructor(
    @InjectRepository(WalleArquivo)
    private readonly repo: Repository<WalleArquivo>,
  ) {}

  todos(): Promise<WalleArquivo[]> {
    return this.repo.find();
  }

  /** Arquivos vivos na fonte (a busca nunca considera os removidos). */
  ativos(): Promise<WalleArquivo[]> {
    return this.repo.find({ where: { removido: false } });
  }

  porId(id: number): Promise<WalleArquivo | null> {
    return this.repo.findOne({ where: { id } });
  }

  porChat(chatCodigo: number): Promise<WalleArquivo[]> {
    return this.repo.find({
      where: { chatCodigo, removido: false },
      order: { nome: 'ASC' },
    });
  }

  salvar(arquivo: Partial<WalleArquivo>): Promise<WalleArquivo> {
    return this.repo.save(arquivo);
  }

  async marcarRemovido(id: number): Promise<void> {
    await this.repo.update({ id }, { removido: true });
  }

  contarAtivos(): Promise<number> {
    return this.repo.count({ where: { removido: false } });
  }
}
