import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { AuthUser } from './decorators/current-user.decorator';
import { PERFIS_CARTEIRA_VE_TODOS } from './constants/perfis';

/**
 * Regra ÚNICA de visibilidade de clientes na Carteira (definição do usuário em 2026-07-28):
 * ADM / Coordenador / Administrativo / Comercial veem TODOS os projetos; GCI / Consultor /
 * Levantador só os projetos em que estão designados — casados por NOME via `projeto_pessoas`
 * (fonte da verdade dos consultores/levantadores) e os espelhos `Projeto.gci` /
 * `Projeto.consultor` (listas separadas por ", ", por isso o match posicional
 * exato/início/meio/fim, portável para o MariaDB de produção e o SQLite dos testes).
 *
 * Usada pela lista (`ProjetosService.listar`) e pela Grade (`PassosService.gradeDeTodos`),
 * para que as duas visões da Carteira respeitem a MESMA hierarquia.
 *
 * `alias` é o alias da tabela de projeto no query — valor controlado internamente, nunca
 * entrada de usuário. Muta o query builder (via `andWhere`) e o devolve para encadear.
 */
export function filtrarCarteiraPorPerfil<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  user: AuthUser,
): SelectQueryBuilder<T> {
  if (PERFIS_CARTEIRA_VE_TODOS.includes(user.perfil)) return qb;
  qb.andWhere(
    `(EXISTS (SELECT 1 FROM projeto_pessoas pp
                WHERE pp.projeto_id = ${alias}.id AND pp.pessoa = :nome)
      OR ${alias}.gci = :nome OR ${alias}.gci LIKE :nomeIni OR ${alias}.gci LIKE :nomeMeio OR ${alias}.gci LIKE :nomeFim
      OR ${alias}.consultor = :nome OR ${alias}.consultor LIKE :nomeIni OR ${alias}.consultor LIKE :nomeMeio OR ${alias}.consultor LIKE :nomeFim)`,
    {
      nome: user.nome,
      nomeIni: `${user.nome}, %`,
      nomeMeio: `%, ${user.nome}, %`,
      nomeFim: `%, ${user.nome}`,
    },
  );
  return qb;
}
