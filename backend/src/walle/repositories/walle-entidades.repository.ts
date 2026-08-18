import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalleEntidade } from '../../database/entities/walle-entidade.entity';

/** Persistência das entidades extraídas dos arquivos do acervo (`walle_entidades`).
 * Dado 100% derivado: recriado a cada sincronização do arquivo dono. */
@Injectable()
export class WalleEntidadesRepository {
  constructor(
    @InjectRepository(WalleEntidade)
    private readonly repo: Repository<WalleEntidade>,
  ) {}

  todas(): Promise<WalleEntidade[]> {
    return this.repo.find();
  }

  porChat(chatCodigo: number): Promise<WalleEntidade[]> {
    return this.repo.find({ where: { chatCodigo } });
  }

  /** Troca o conjunto de entidades de um arquivo (apaga e regrava — dado derivado). */
  async substituirDoArquivo(
    arquivoId: number,
    entidades: Array<Pick<WalleEntidade, 'chatCodigo' | 'tipo' | 'valor'>>,
  ): Promise<void> {
    await this.repo.delete({ arquivoId });
    if (entidades.length === 0) return;
    await this.repo.save(entidades.map((e) => ({ ...e, arquivoId })));
  }

  async removerDoArquivo(arquivoId: number): Promise<void> {
    await this.repo.delete({ arquivoId });
  }
}
