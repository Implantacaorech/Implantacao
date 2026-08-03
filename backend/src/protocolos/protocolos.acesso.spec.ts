import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Perfil } from '../common/constants/perfis';
import {
  DonoProtocolo,
  exigirAcessoProtocolo,
  podeVerProtocolo,
} from './protocolos.acesso';

/** Regra do usuário (2026-07-30): a tela Transcrição Áudio/Vídeo mostra apenas o material
 * de quem está logado. Testado aqui porque a mesma função protege a LISTA e todas as rotas
 * por id — se ela afrouxar, vaza gravação de reunião de cliente entre consultores. */
describe('podeVerProtocolo', () => {
  const usuario = (nome: string, ...perfis: Perfil[]): AuthUser => ({
    sub: 1,
    login: nome.toLowerCase(),
    nome,
    perfil: perfis[0] ?? 'Consultor',
    perfis: perfis.length ? perfis : ['Consultor'],
    codigoSicla: '',
  });

  const proto = (over: Partial<DonoProtocolo> = {}): DonoProtocolo => ({
    responsavel: 'Ana',
    videoOrigem: 'gravacao',
    ...over,
  });

  it('deixa a pessoa ver o que ela mesma gravou', () => {
    expect(podeVerProtocolo(proto(), usuario('Ana'))).toBe(true);
  });

  it('esconde a gravação de outro consultor', () => {
    expect(podeVerProtocolo(proto(), usuario('Bruno'))).toBe(false);
  });

  it('esconde também o upload manual de outra pessoa', () => {
    expect(
      podeVerProtocolo(proto({ videoOrigem: 'upload' }), usuario('Bruno')),
    ).toBe(false);
  });

  it('mantém visível o vídeo do robô do SharePoint (pasta compartilhada, sem dono)', () => {
    expect(
      podeVerProtocolo(
        proto({ responsavel: 'robô', videoOrigem: 'sharepoint' }),
        usuario('Bruno'),
      ),
    ).toBe(true);
  });

  it('ADM continua vendo tudo (é quem administra e aprova)', () => {
    expect(podeVerProtocolo(proto(), usuario('Carla', 'ADM'))).toBe(true);
  });

  it('Coordenador também vê tudo — senão não conseguiria aprovar', () => {
    // Regressão real: a exceção cobria só o ADM, mas as rotas aprovar/reprovar/excluir
    // liberam PERFIS_APROVA_PROTOCOLO (ADM + Coordenador) e chamam exigirAcessoProtocolo
    // logo depois. O Coordenador levava 403 em tudo que não fosse dele — ou seja, só podia
    // aprovar o próprio material, que é o oposto do que um gate de aprovação serve.
    expect(podeVerProtocolo(proto(), usuario('Dora', 'Coordenador'))).toBe(
      true,
    );
  });

  it('quem não aprova continua restrito ao próprio material', () => {
    // A privacidade pedida em 2026-07-30 vale para o time em geral — é isto que não pode
    // afrouxar junto com a correção acima.
    for (const perfil of [
      'Consultor',
      'GCI',
      'Levantador',
      'Administrativo',
      'Comercial',
    ] as Perfil[]) {
      expect(podeVerProtocolo(proto(), usuario('Bruno', perfil))).toBe(false);
    }
  });

  it('vale para papel acumulado, não só o principal', () => {
    expect(
      podeVerProtocolo(proto(), usuario('Carla', 'Consultor', 'ADM')),
    ).toBe(true);
  });

  it('exigirAcessoProtocolo barra com 403 e explica o motivo', () => {
    expect(() => exigirAcessoProtocolo(proto(), usuario('Bruno'))).toThrow(
      ForbiddenException,
    );
    expect(() => exigirAcessoProtocolo(proto(), usuario('Ana'))).not.toThrow();
  });
});
