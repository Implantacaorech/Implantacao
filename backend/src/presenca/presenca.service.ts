import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PresencaSessao } from '../database/entities/presenca-sessao.entity';
import { PresencaRepository } from './repositories/presenca.repository';
import {
  EXPURGO_S,
  INTERVALO_PING_S,
  JANELA_ONLINE_S,
  OCIOSO_S,
} from './presenca.constants';

export interface SessaoOnline {
  sessao: string;
  rota: string;
  titulo: string;
  visivel: boolean;
  ip: string;
  navegador: string;
  desdeSegundos: number;
  inativoSegundos: number;
}

export interface UsuarioOnline {
  usuarioId: number;
  nome: string;
  perfil: string;
  /** Tela da sessão que bateu mais recentemente — é "onde a pessoa está" quando há várias. */
  telaAtual: string;
  rotaAtual: string;
  inativoSegundos: number;
  ocioso: boolean;
  sessoes: SessaoOnline[];
}

export interface PanoramaPresenca {
  agora: string;
  janelaSegundos: number;
  intervaloPingSegundos: number;
  totalUsuarios: number;
  totalSessoes: number;
  usuarios: UsuarioOnline[];
}

export interface DadosPing {
  sessao: string;
  rota: string;
  titulo: string;
  visivel: boolean;
}

/** Quem está no Painel agora, e em que tela (docs/controle-acessos.md).
 *
 * A presença é medida por **batida do navegador**, e não pelas requisições que chegam à API.
 * Requisição não serve: uma pessoa parada lendo uma tela não gera nenhuma e sumiria da
 * lista, e `GET /api/projetos` não diz em que TELA ela está — várias telas chamam o mesmo
 * endpoint. A batida carrega a rota e o título que a própria SPA conhece.
 *
 * **Nada de histórico**: a linha é sobrescrita e depois apagada. Ver o comentário da
 * entidade. */
@Injectable()
export class PresencaService {
  constructor(private readonly repo: PresencaRepository) {}

  private segundosDesde(quando: Date, agora: number): number {
    return Math.max(0, Math.round((agora - new Date(quando).getTime()) / 1000));
  }

  /** Registra a batida de uma aba. Cria a sessão na primeira e atualiza nas seguintes. */
  async registrar(
    user: AuthUser,
    dados: DadosPing,
    ip: string,
    navegador: string,
  ): Promise<void> {
    const agora = new Date();
    const existente = await this.repo.porUsuarioSessao(user.sub, dados.sessao);
    await this.repo.salvar({
      ...(existente ?? {}),
      usuarioId: user.sub,
      sessao: dados.sessao,
      nome: user.nome,
      perfil: user.perfil,
      rota: (dados.rota || '').slice(0, 300),
      titulo: (dados.titulo || '').slice(0, 160),
      visivel: dados.visivel,
      ip: ip.slice(0, 60),
      navegador: navegador.slice(0, 200),
      ultimoPing: agora,
    });
    // A tabela se mantém pequena sozinha: quem está usando poda o próprio rastro frio.
    await this.repo.podarDoUsuario(
      user.sub,
      new Date(agora.getTime() - EXPURGO_S * 1000),
    );
  }

  /** Encerra a sessão explicitamente (logout). Sem isto ela sairia sozinha ao esfriar — só
   * que a lista mostraria a pessoa online por mais dois minutos depois de ela ter saído. */
  async encerrar(usuarioId: number, sessao: string): Promise<void> {
    await this.repo.remover(usuarioId, sessao);
  }

  /** Panorama de quem está online agora, agrupado por pessoa. */
  async panorama(): Promise<PanoramaPresenca> {
    const agora = Date.now();
    const desde = new Date(agora - JANELA_ONLINE_S * 1000);
    const linhas = await this.repo.ativasDesde(desde);

    const porUsuario = new Map<number, PresencaSessao[]>();
    for (const l of linhas) {
      const lista = porUsuario.get(l.usuarioId) ?? [];
      lista.push(l);
      porUsuario.set(l.usuarioId, lista);
    }

    const usuarios: UsuarioOnline[] = [...porUsuario.values()].map(
      (sessoes) => {
        // `ativasDesde` já ordena por batida decrescente, então a primeira é a mais recente —
        // e é ela que responde "em que tela a pessoa está".
        const recente = sessoes[0];
        const inativo = this.segundosDesde(recente.ultimoPing, agora);
        return {
          usuarioId: recente.usuarioId,
          nome: recente.nome,
          perfil: recente.perfil,
          telaAtual: recente.titulo,
          rotaAtual: recente.rota,
          inativoSegundos: inativo,
          // Ocioso = a aba está em segundo plano, ou faz tempo que não chega batida.
          ocioso: !recente.visivel || inativo > OCIOSO_S,
          sessoes: sessoes.map((s) => ({
            sessao: s.sessao,
            rota: s.rota,
            titulo: s.titulo,
            visivel: s.visivel,
            ip: s.ip,
            navegador: s.navegador,
            desdeSegundos: this.segundosDesde(s.iniciadoEm, agora),
            inativoSegundos: this.segundosDesde(s.ultimoPing, agora),
          })),
        };
      },
    );

    usuarios.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    return {
      agora: new Date(agora).toISOString(),
      janelaSegundos: JANELA_ONLINE_S,
      intervaloPingSegundos: INTERVALO_PING_S,
      totalUsuarios: usuarios.length,
      totalSessoes: linhas.length,
      usuarios,
    };
  }

  /** Só o número, para o selo do botão na tela de Usuários. */
  async quantosOnline(): Promise<number> {
    const desde = new Date(Date.now() - JANELA_ONLINE_S * 1000);
    const linhas = await this.repo.ativasDesde(desde);
    return new Set(linhas.map((l) => l.usuarioId)).size;
  }
}
