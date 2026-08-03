import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Projeto } from '../entities/projeto.entity';

/** Persistência de `Projeto` — SÓ acesso a dado, sem regra de negócio (Guia Mestre
 * §Responsabilidades → Repository).
 *
 * Fica em `database/repositories/` e não dentro de um módulo porque `Projeto` é entidade
 * TRANSVERSAL: hoje 20+ módulos leem projeto. Repositório de entidade usada por um módulo
 * só deve morar em `<modulo>/repositories/` (é o caso de CronogramaItem/ChecklistItem/
 * Modificacao em plano-cronograma). A regra está em
 * `vault/23 - Padrões/Guia Mestre de Arquitetura de Desenvolvimento.md`.
 *
 * Nota sobre "não achou": quem devolve 404 é o Service, não o Repository — daí o `null`
 * aqui em vez de exceção HTTP. Repository não conhece protocolo. */
@Injectable()
export class ProjetoRepository {
  constructor(
    @InjectRepository(Projeto)
    private readonly repo: Repository<Projeto>,
  ) {}

  async porId(id: number): Promise<Projeto | null> {
    return this.repo.findOne({ where: { id } });
  }
}
