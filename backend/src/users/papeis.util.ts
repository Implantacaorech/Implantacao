import { PERFIS, Perfil } from '../common/constants/perfis';

/** Papéis de um usuário, a partir da coluna `perfis` (lista) com recuo para `perfil`.
 *
 * A coluna é texto separado por vírgula porque o valor é curto, fechado e sempre lido
 * junto do usuário — uma tabela de vínculo aqui só acrescentaria join sem ganho. O
 * `perfil` continua sendo o principal, e entra na lista mesmo que alguém o esqueça na
 * marcação, para ninguém perder o próprio acesso. */
export function papeisDoUsuario(usuario: {
  perfil: Perfil;
  perfis?: string | null;
}): Perfil[] {
  const daLista = (usuario.perfis ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter((p): p is Perfil => (PERFIS as readonly string[]).includes(p));
  const todos = new Set<Perfil>([usuario.perfil, ...daLista]);
  return [...todos];
}

/** Normaliza uma seleção de papéis vinda da tela para gravar em `perfis`. */
export function normalizarPapeis(papeis: string[] | undefined): Perfil[] {
  const validos = (papeis ?? [])
    .map((p) => p.trim())
    .filter((p): p is Perfil => (PERFIS as readonly string[]).includes(p));
  return [...new Set(validos)];
}
