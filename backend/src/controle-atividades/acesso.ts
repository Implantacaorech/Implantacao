import { AtividadeCartao } from '../database/entities/atividade-cartao.entity';
import { AtividadeLista } from '../database/entities/atividade-lista.entity';
import type { TipoMembro } from '../database/entities/atividade-membro.entity';

/** Quem está pedindo, e com que alcance, resolvido UMA vez por requisição.
 *
 * `interno` vem do `EscopoClienteService` (papel `Cliente` → false). `responsavel` vem de
 * `atividade_quadro_responsaveis`. `podeAlterar` é o nível do menu no painel de Permissões. */
export interface ContextoAcesso {
  /** Papel interno da Rech (qualquer um que não seja `Cliente`). */
  interno: boolean;
  /** Códigos de cliente que este usuário alcança. Vazio quando `interno`. */
  codigosCliente: string[];
  /** É responsável PELO QUADRO em questão. Sempre false para usuário-cliente. */
  responsavel: boolean;
  /** Nível `alteracao` no menu `controle_atividades`. */
  podeAlterar: boolean;
}

/** Regras de acesso do módulo, em funções PURAS — sem Nest, sem banco, sem HTTP.
 *
 * Estão aqui, e não espalhadas nos services, porque são a parte do módulo em que um engano
 * não dá erro: dá vazamento. Concentradas e puras, dá para testá-las exaustivamente. */

/** Pode LER o quadro deste cliente?
 *
 * **Interno lê TODOS os quadros** — a fronteira que o módulo protege é Rech ↔ cliente, nunca
 * consultor ↔ consultor. O usuário-cliente lê só os códigos a que está vinculado. */
export function podeLerQuadro(
  ctx: ContextoAcesso,
  codigoClienteDoQuadro: string,
): boolean {
  if (ctx.interno) return true;
  return ctx.codigosCliente.includes(codigoClienteDoQuadro);
}

/** Pode mexer na ESTRUTURA e na audiência do quadro — criar/apagar coluna, criar cartão,
 * compartilhar, mexer em membros e prazos?
 *
 * Só o responsável interno. Quem não responde pelo quadro fica em consulta, e o
 * usuário-cliente nunca alcança isto. */
export function podeEditarQuadro(ctx: ContextoAcesso): boolean {
  return ctx.interno && ctx.responsavel && ctx.podeAlterar;
}

/** Pode CRIAR cartão no quadro?
 *
 * O usuário-cliente PODE (decisão do usuário, 2026-09-01): ele abre uma **solicitação** para
 * a Rech. O interno precisa ser responsável — criar cartão no quadro de outro consultor é
 * escrita, e escrita é do dono. */
export function podeCriarCartao(ctx: ContextoAcesso): boolean {
  if (!ctx.podeAlterar) return false;
  return ctx.interno ? ctx.responsavel : true;
}

/** O cartão criado por este contexto nasce compartilhado?
 *
 * Sim quando quem cria é o cliente: uma solicitação que nascesse interna ficaria invisível
 * para quem acabou de abri-la. A regra "nasce fechado" existe para proteger o bastidor da
 * Rech — e um cartão do cliente não é bastidor da Rech. */
export function nasceCompartilhado(ctx: ContextoAcesso): boolean {
  return !ctx.interno;
}

/** Pode designar um membro DESTE tipo?
 *
 * O cliente designa **apenas consultor da Rech** (decisão do usuário, 2026-09-01): ele pede à
 * Rech, não distribui tarefa entre os próprios colegas — quem faz isso é o consultor. */
export function podeDesignarMembro(
  ctx: ContextoAcesso,
  tipo: TipoMembro,
): boolean {
  if (!ctx.podeAlterar) return false;
  if (ctx.interno) return ctx.responsavel;
  return tipo === 'interno';
}

/** Pode INTERAGIR com um cartão — mover, marcar checklist, comentar, anexar, concluir?
 *
 * Vale para o responsável interno e para o usuário-cliente (no que ele alcança). O interno
 * NÃO responsável fica de fora de propósito: "consulta" é leitura estrita, inclusive de
 * comentário (decisão 6 do §8 do desenho — a rever se a Coordenação pedir). */
export function podeInteragirCartao(ctx: ContextoAcesso): boolean {
  if (!ctx.podeAlterar) return false;
  return ctx.interno ? ctx.responsavel : true;
}

/** A leitura deve ser recortada só ao que é compartilhado com o cliente? */
export function recorteDeCliente(ctx: ContextoAcesso): boolean {
  return !ctx.interno;
}

/** A lista é visível para este contexto? */
export function listaVisivel(
  ctx: ContextoAcesso,
  lista: Pick<AtividadeLista, 'visivelCliente'>,
): boolean {
  return ctx.interno || lista.visivelCliente;
}

/** O cartão é visível para este contexto?
 *
 * Regra fail-closed do §2.2: o cliente vê `cartao.visivel_cliente` **E**
 * `lista.visivel_cliente`. Compartilhar um cartão que está numa coluna interna é permitido —
 * ele só não aparece até chegar a uma coluna compartilhada. */
export function cartaoVisivel(
  ctx: ContextoAcesso,
  cartao: Pick<AtividadeCartao, 'visivelCliente'>,
  lista: Pick<AtividadeLista, 'visivelCliente'> | undefined,
): boolean {
  if (ctx.interno) return true;
  return Boolean(cartao.visivelCliente && lista?.visivelCliente);
}

/** O usuário-cliente pode mover este cartão para esta coluna?
 *
 * Além de o cartão ter de ser visível, o DESTINO precisa ser uma coluna compartilhada —
 * senão o cliente empurraria o próprio cartão para dentro do bastidor da Rech. */
export function podeMoverPara(
  ctx: ContextoAcesso,
  destino: Pick<AtividadeLista, 'visivelCliente'>,
): boolean {
  if (!podeInteragirCartao(ctx)) return false;
  return ctx.interno || destino.visivelCliente;
}
