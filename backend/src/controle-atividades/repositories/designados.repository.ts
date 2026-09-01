import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjetoPessoa } from '../../database/entities/projeto-pessoa.entity';
import { Projeto } from '../../database/entities/projeto.entity';

/** Leitura da DESIGNAÇÃO do projeto — quem atende o cliente.
 *
 * O usuário definiu em 2026-09-01 que quem abre o quadro de um cliente é "qualquer pessoa
 * designada a atender o Cliente (GCI ou Consultores)", e que esse vínculo **já existe** no
 * cadastro de etapas. Ele mora em `projeto_pessoas` — daí este repository, que só lê. */
@Injectable()
export class DesignadosRepository {
  constructor(
    @InjectRepository(ProjetoPessoa)
    private readonly pessoas: Repository<ProjetoPessoa>,
    @InjectRepository(Projeto)
    private readonly projetos: Repository<Projeto>,
  ) {}

  async doProjeto(projetoId: number): Promise<ProjetoPessoa[]> {
    return this.pessoas.find({ where: { projetoId } });
  }

  /** Projetos em que a pessoa está designada, em qualquer papel. É a lista a partir da qual
   * ela pode abrir um quadro. */
  async projetosDe(usuarioId: number, nome: string): Promise<Projeto[]> {
    const vinculos = await this.pessoas.find({ where: { usuarioId } });
    const ids = [...new Set(vinculos.map((v) => v.projetoId))];
    const porId = ids.length
      ? await this.projetos.findByIds(ids)
      : ([] as Projeto[]);
    // Recuo por NOME para os vínculos antigos, cujo `usuario_id` é nulo porque o nome não
    // casou com nenhum usuário ativo na migração de 2026-08-05. Mesmo recuo que o módulo de
    // passos aplica na autorização.
    const porNome = nome
      ? await this.projetos.find({
          where: [{ consultor: nome }, { gci: nome }],
        })
      : [];
    const todos = new Map<number, Projeto>();
    for (const p of [...porId, ...porNome]) todos.set(p.id, p);
    return [...todos.values()].sort((a, b) =>
      a.cliente.localeCompare(b.cliente, 'pt-BR'),
    );
  }

  async projetoPorId(id: number): Promise<Projeto | null> {
    return this.projetos.findOne({ where: { id } });
  }
}
