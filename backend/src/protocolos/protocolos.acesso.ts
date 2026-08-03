import { ForbiddenException } from '@nestjs/common';
import { temPapel } from '../common/constants/perfis';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { VideoOrigem } from '../database/entities/protocolo.entity';
import { PERFIS_APROVA_PROTOCOLO } from './protocolos.constants';

/** O mínimo de um protocolo para decidir quem pode vê-lo. */
export interface DonoProtocolo {
  responsavel: string;
  videoOrigem: VideoOrigem;
}

/** Visibilidade da tela Transcrição Áudio/Vídeo (regra do usuário, 2026-07-30): cada
 * pessoa vê APENAS o que ela mesma enviou ou gravou — reunião de cliente é material de
 * quem conduziu, não da equipe inteira.
 *
 * Duas exceções, ambas deliberadas:
 * - **Quem aprova** (`PERFIS_APROVA_PROTOCOLO`: ADM e Coordenador) continua vendo tudo —
 *   sem isso ninguém conseguiria administrar nem aprovar o que os outros gravaram.
 * - **Vídeos do robô do SharePoint** (`videoOrigem = 'sharepoint'`) continuam visíveis para
 *   todos: não têm dono (o responsável gravado é 'robô'), vêm de uma pasta compartilhada e
 *   sempre foram a base de conhecimento comum do time. Esconder esses seria esvaziar a tela.
 *
 * A 1ª exceção nasceu cobrindo só o ADM, e isso se contradizia com o gate de aprovação: as
 * rotas `aprovar`/`reprovar`/`excluir` liberam `PERFIS_APROVA_PROTOCOLO` e logo em seguida
 * chamam `exigirAcessoProtocolo`, que barrava o Coordenador em tudo que não fosse dele. Na
 * prática o Coordenador só podia aprovar o que ele mesmo tinha enviado — um aval de si para
 * si, que é justamente o que um gate de aprovação existe para evitar. Alinhar as duas listas
 * mantém a privacidade onde ela foi pedida (o time em geral segue vendo só o seu).
 */
export function podeVerProtocolo(p: DonoProtocolo, user: AuthUser): boolean {
  if (temPapel(user, ...PERFIS_APROVA_PROTOCOLO)) return true;
  if (p.videoOrigem === 'sharepoint') return true;
  return (p.responsavel || '').trim() === (user.nome || '').trim();
}

/** Mesma regra, na forma de guarda: usada em TODA rota por id. Filtrar só a listagem
 * deixaria o conteúdo acessível a quem digitasse o id na URL. */
export function exigirAcessoProtocolo(p: DonoProtocolo, user: AuthUser): void {
  if (!podeVerProtocolo(p, user)) {
    throw new ForbiddenException(
      'Esta transcrição pertence a outro usuário — você só tem acesso às suas.',
    );
  }
}
