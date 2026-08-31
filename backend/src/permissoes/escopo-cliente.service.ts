import { ForbiddenException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { papeisDoUsuario } from '../users/papeis.util';
import { Perfil } from '../common/constants/perfis';

/** Até onde vai a visão de quem está pedindo o dado.
 *
 * - `interno: true`  → papel interno da Rech: vê tudo, exatamente como sempre viu.
 * - `interno: false` → usuário-cliente: vê SÓ os códigos de cliente listados. */
export type EscopoCliente =
  { interno: true } | { interno: false; codigos: string[] };

/** Escopo dos papéis internos — o comportamento histórico do Painel. Exportado para os
 * testes e para os poucos caminhos que rodam fora de uma requisição (robôs, digest). */
export const ESCOPO_INTERNO: EscopoCliente = { interno: true };

export interface UsuarioEscopo {
  sub: number;
  perfil: Perfil;
  perfis?: Perfil[];
}

/** Resolve o recorte por CLIENTE de um usuário autenticado — a base do acesso do cliente ao
 * BI "Implantação Clientes SIGER" (docs/acesso-cliente-bi.md).
 *
 * **Resolve do BANCO, não do token.** O access token carrega um retrato do login, e o
 * refresh só o reconstrói na renovação: se o escopo viajasse nele, revogar o vínculo de um
 * cliente valeria apenas no próximo refresh — uma janela em que um token ainda válido
 * continua abrindo dados que já não deveria. Lendo o vínculo a cada requisição, revogar (ou
 * desativar o usuário) tem efeito imediato.
 *
 * Sem cache de propósito: é um `findOne` por chave primária numa tabela de dezenas de
 * linhas, dentro de uma requisição que logo em seguida vai buscar milhares de linhas no
 * Oracle. Um cache aqui não compraria nada e custaria a invalidação — justamente a parte
 * que, se falhar, mantém vivo um acesso revogado. */
@Injectable()
export class EscopoClienteService {
  constructor(private readonly users: UsersService) {}

  async escopoDe(
    user: UsuarioEscopo | undefined | null,
  ): Promise<EscopoCliente> {
    if (!user) throw new ForbiddenException('Sessão sem usuário.');

    const usuario = await this.users.buscarPorId(user.sub).catch(() => null);
    // Usuário apagado ou desativado desde a emissão do token: nada de dado. Vale para
    // interno e para cliente — o token continuaria válido até expirar, e este é o ponto
    // onde a desativação passa a valer de imediato.
    if (!usuario || !usuario.ativo) {
      throw new ForbiddenException('Usuário inativo ou inexistente.');
    }

    const papeis = papeisDoUsuario(usuario);
    if (!papeis.includes('Cliente')) return { interno: true };

    const codigos = separarCodigos(usuario.codigoClienteSicla);
    // Fail-closed: papel `Cliente` sem vínculo NÃO vira "sem filtro". Um cadastro
    // incompleto tem que dar tela vazia com aviso, jamais a carteira inteira da Rech.
    // `UsersService` já impede criar/editar um cliente sem código; isto cobre o registro
    // que tenha nascido antes da regra ou sido alterado direto no banco.
    if (!codigos.length) {
      throw new ForbiddenException(
        'Seu usuário é do tipo Cliente mas não tem um cliente vinculado. ' +
          'Fale com o administrador do Painel.',
      );
    }
    return { interno: false, codigos };
  }
}

/** Códigos de cliente de um vínculo (`'123'` ou `'123, 456'`) — sem vazios e sem repetidos.
 *
 * Compara-se como TEXTO: é código de sistema externo, e o SICLA é quem manda no formato.
 * Aparado dos dois lados para o cadastro digitado à mão não criar um escopo que nunca casa. */
export function separarCodigos(bruto: string | null | undefined): string[] {
  const codigos = (bruto ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  return [...new Set(codigos)];
}

/** A linha é visível neste escopo?
 *
 * Fail-closed em dois pontos, e os dois importam:
 * - escopo de cliente com a linha **sem** código identificável (`null`) → NÃO passa. Uma das
 *   origens do BI é SQL editável em Sistema → Consultas BD: se alguém derrubar a coluna do
 *   código, a tela do cliente esvazia em vez de virar um dump de todos os clientes.
 * - qualquer outro caso que não seja "o código bate" → não passa. */
export function linhaVisivel(
  escopo: EscopoCliente,
  codigoCliente: number | string | null | undefined,
): boolean {
  if (escopo.interno) return true;
  if (codigoCliente === null || codigoCliente === undefined) return false;
  const codigo = String(codigoCliente).trim();
  if (!codigo) return false;
  return escopo.codigos.includes(codigo);
}
