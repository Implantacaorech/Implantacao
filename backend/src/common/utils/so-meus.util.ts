import { Projeto } from '../../database/entities/projeto.entity';
import type { AuthUser } from '../decorators/current-user.decorator';
import { PERFIS_VEEM_TODOS_PROJETOS, temPapel } from '../constants/perfis';

/** `Projeto.gci` e `Projeto.consultor` guardam LISTAS de nomes separadas por ", " (mesma
 * convenção de `filtrarCarteiraPorPerfil`). Comparar com `===` deixava de fora quem não
 * fosse o primeiro nome da lista. */
function nomeNaLista(campo: string | null | undefined, nome: string): boolean {
  if (!campo || !nome) return false;
  return campo.split(',').some((n) => n.trim() === nome);
}

/** Filtra os projetos visíveis ao usuário logado (visão PESSOAL — Home): ADM/Coordenador/
 * Administrativo veem tudo; os demais veem os projetos em que estão designados, como GCI
 * **ou** como consultor. Espelha webapp/app.py:_so_meus e casa com a mesma hierarquia da
 * Carteira (`filtrarCarteiraPorPerfil`).
 *
 * Duas correções de 2026-07-28:
 * 1. usa `temPapel` (TODOS os papéis do usuário), não só o `perfil` principal — a mesma
 *    pessoa acumula cargos, e um Coordenador cadastrado com perfil principal "Consultor"
 *    caía no filtro restrito;
 * 2. o não-ADM enxerga onde é GCI **ou** consultor (antes, quem era GCI perdia os projetos
 *    em que estava designado como consultor, e vice-versa).
 *
 * NÃO é usado pelos painéis de GESTÃO (Coordenação/Atividade/Centro Operacional): lá o
 * escopo é a carteira inteira e quem entra já passou pelo gate do painel de Permissões. */
export function soMeus(projetos: Projeto[], user: AuthUser): Projeto[] {
  if (temPapel(user, ...PERFIS_VEEM_TODOS_PROJETOS)) return projetos;
  return projetos.filter(
    (p) => nomeNaLista(p.gci, user.nome) || nomeNaLista(p.consultor, user.nome),
  );
}
