import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { Documento, OrigemDocumento } from '../database/entities/documento.entity';
import { Evento, TipoEvento } from '../database/entities/evento.entity';

/** Histórico de documentos anexados/gerados por projeto + timeline de eventos. Espelha
 * webapp/db.py (Documento, Evento, registrar_evento) — usado pela geração de documentos
 * (§item 3 da migração) para registrar o que foi gerado, e por `ProjetosService.excluir`
 * para não deixar linhas órfãs (ver docs/migracao/03-documento-conversao.md). */
@Injectable()
export class DocumentosService {
  constructor(
    @InjectRepository(Documento) private readonly documentos: Repository<Documento>,
    @InjectRepository(Evento) private readonly eventos: Repository<Evento>,
  ) {}

  private store(): string {
    const dir = join(process.cwd(), 'dados', 'documentos_gerados');
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Grava o buffer recebido do serviço de geração no store local e devolve o nome/caminho
   * a persistir no registro do Documento. Prefixa com o id do projeto + timestamp para
   * nunca colidir entre gerações repetidas do mesmo cliente. */
  salvarArquivoGerado(projetoId: number, nomeSugerido: string, buffer: Buffer): { arquivo: string; caminho: string } {
    const arquivo = `${projetoId}_${Date.now()}_${nomeSugerido}`;
    const caminho = join(this.store(), arquivo);
    writeFileSync(caminho, buffer);
    return { arquivo, caminho };
  }

  async registrarDocumento(
    projetoId: number,
    tipo: string,
    arquivo: string,
    caminho: string,
    origem: OrigemDocumento = 'gerado',
  ): Promise<Documento> {
    return this.documentos.save(this.documentos.create({ projetoId, tipo, arquivo, caminho, origem }));
  }

  async registrarEvento(projetoId: number, tipo: TipoEvento, descricao: string, autor = ''): Promise<Evento> {
    return this.eventos.save(this.eventos.create({ projetoId, tipo, descricao, autor }));
  }

  async listarDocumentos(projetoId: number): Promise<Documento[]> {
    return this.documentos.find({ where: { projetoId }, order: { criadoEm: 'DESC' } });
  }

  async listarEventos(projetoId: number): Promise<Evento[]> {
    return this.eventos.find({ where: { projetoId }, order: { criadoEm: 'DESC' } });
  }

  async buscarDocumento(id: number): Promise<Documento | null> {
    return this.documentos.findOne({ where: { id } });
  }

  /** Chamado por `ProjetosService.excluir` — sem isso, excluir um projeto deixaria
   * Documento/Evento órfãos (mesma categoria de bug já encontrada e corrigida no Flask
   * original, e reproduzida aqui até esta correção — ver §6 da documentação da migração). */
  async limparProjeto(projetoId: number): Promise<void> {
    await this.documentos.delete({ projetoId });
    await this.eventos.delete({ projetoId });
  }
}
