import { Projeto } from '../../database/entities/projeto.entity';
import type { AuthUser } from '../decorators/current-user.decorator';
import { PERFIS_VEEM_TODOS_PROJETOS } from '../constants/perfis';

/** Filtra os projetos visíveis ao usuário logado: ADM/Coordenador/Administrativo veem
 * tudo; GCI só onde é o GCI; Consultor só onde é o consultor designado. Espelha
 * webapp/app.py:_so_meus — mesma regra já usada em ProjetosService.listar, extraída aqui
 * para reuso pelas telas executivas (Painel/Atividade/Monitoramento/Home). */
export function soMeus(projetos: Projeto[], user: AuthUser): Projeto[] {
  if (PERFIS_VEEM_TODOS_PROJETOS.includes(user.perfil)) return projetos;
  if (user.perfil === 'GCI') return projetos.filter((p) => p.gci === user.nome);
  return projetos.filter((p) => p.consultor === user.nome);
}
