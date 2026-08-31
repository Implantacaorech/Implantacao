import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissaoPapel } from '../database/entities/permissao-papel.entity';
import { PermissaoUsuario } from '../database/entities/permissao-usuario.entity';
import { Perfil } from '../common/constants/perfis';
import {
  MENU_CHAVES,
  MENUS,
  NivelPermissao,
  PADRAO_PERMISSOES,
  PAPEIS_PERMISSAO,
  ehFixaAdm,
  ehMenuValido,
  nivelMaior,
} from '../common/constants/menus';

/** Usuário para efeito de permissão — o mínimo que o JWT carrega. */
export interface UsuarioPermissao {
  sub: number;
  perfil: Perfil;
  perfis?: Perfil[];
}

/**
 * RBAC configurável do Painel. Fonte da verdade: tabelas `permissoes_papel` (padrão por
 * papel) e `permissoes_usuario` (exceção por usuário). Mantém tudo em memória (mapas) e
 * recarrega a cada gravação — a base é pequena (17 menus × 7 papéis + poucas exceções).
 *
 * Resolução do nível efetivo de um usuário num menu:
 *   1. ADM sempre `alteracao` (trava de segurança — ninguém se tranca fora).
 *   2. Exceção do usuário, se houver.
 *   3. Senão, o MAIOR nível entre os papéis que o usuário acumula.
 */
@Injectable()
export class PermissoesService implements OnModuleInit {
  constructor(
    @InjectRepository(PermissaoPapel)
    private readonly papelRepo: Repository<PermissaoPapel>,
    @InjectRepository(PermissaoUsuario)
    private readonly usuarioRepo: Repository<PermissaoUsuario>,
  ) {}

  private porPapel = new Map<string, NivelPermissao>(); // `${papel}|${menu}`
  private porUsuario = new Map<string, NivelPermissao>(); // `${usuarioId}|${menu}`

  async onModuleInit(): Promise<void> {
    await this.seedFaltantes();
    await this.recarregar();
  }

  /** Semeia os padrões que ainda NÃO têm linha — idempotente. Semeia a tabela vazia na 1ª
   * vez e, em deploys seguintes, apenas o que é novo, sem sobrescrever o que o admin já
   * configurou.
   *
   * O critério é o PAR (papel, menu), não o menu inteiro. Até 2026-08-31 bastava o menu
   * nunca ter sido visto, e isso escondia um buraco: um PAPEL novo declarado em
   * `PADRAO_PERMISSOES` para um menu que JÁ existia (o caso do `Cliente` em
   * `bi_implantacao`) nunca era semeado — nascia sem linha nenhuma, ou seja, sem acesso a
   * nada, mesmo com o padrão declarado no código. Em dev isso passava despercebido porque
   * o banco é descartável e a tabela nascia vazia; em produção o papel novo simplesmente
   * não funcionaria.
   *
   * Semear por par continua não sobrescrevendo decisão de admin: tirar um acesso pela tela
   * grava o nível `nada` (`salvarPapel` faz upsert), então "sem linha" significa "nunca
   * configurado", nunca "removido de propósito". */
  private async seedFaltantes(): Promise<void> {
    const existentes = await this.papelRepo.find();
    const paresComRegra = new Set(
      existentes.map((r) => `${r.papel}|${r.menu}`),
    );
    const novas: PermissaoPapel[] = [];
    for (const [menu, mapa] of Object.entries(PADRAO_PERMISSOES)) {
      for (const [papel, nivel] of Object.entries(mapa)) {
        if (paresComRegra.has(`${papel}|${menu}`)) continue;
        novas.push(
          this.papelRepo.create({ papel: papel as Perfil, menu, nivel }),
        );
      }
    }
    if (novas.length) await this.papelRepo.save(novas);
  }

  private async recarregar(): Promise<void> {
    this.porPapel = new Map();
    this.porUsuario = new Map();
    for (const p of await this.papelRepo.find()) {
      this.porPapel.set(`${p.papel}|${p.menu}`, p.nivel);
    }
    for (const u of await this.usuarioRepo.find()) {
      this.porUsuario.set(`${u.usuarioId}|${u.menu}`, u.nivel);
    }
  }

  private perfisDe(user: UsuarioPermissao): Perfil[] {
    return user.perfis?.length ? user.perfis : [user.perfil];
  }

  nivelDePapel(papel: Perfil, menu: string): NivelPermissao {
    return this.porPapel.get(`${papel}|${menu}`) ?? 'nada';
  }

  /** Nível efetivo do usuário no menu. Ordem: trava de segurança do ADM (só nos menus
   * fixos-ADM) > exceção do usuário > maior nível entre os papéis. Nos menus NÃO fixos-ADM
   * o Administrador é configurável como qualquer papel (pode até esconder de si mesmo). */
  nivelEfetivo(user: UsuarioPermissao, menu: string): NivelPermissao {
    if (this.perfisDe(user).includes('ADM') && ehFixaAdm(menu)) {
      return 'alteracao';
    }
    const exc = this.porUsuario.get(`${user.sub}|${menu}`);
    if (exc) return exc;
    let n: NivelPermissao = 'nada';
    for (const p of this.perfisDe(user)) {
      n = nivelMaior(n, this.nivelDePapel(p, menu));
    }
    return n;
  }

  podeAlterar(user: UsuarioPermissao, menu: string): boolean {
    return this.nivelEfetivo(user, menu) === 'alteracao';
  }

  /** Mapa menu→nível do usuário logado — alimenta o menu e os guards do Angular. */
  mapaDoUsuario(user: UsuarioPermissao): Record<string, NivelPermissao> {
    const r: Record<string, NivelPermissao> = {};
    for (const m of MENU_CHAVES) r[m] = this.nivelEfetivo(user, m);
    return r;
  }

  /** Matriz completa para a tela de manutenção (ADM). */
  matriz(): {
    menus: typeof MENUS;
    papeis: Perfil[];
    porPapel: { papel: Perfil; menu: string; nivel: NivelPermissao }[];
    porUsuario: { usuarioId: number; menu: string; nivel: NivelPermissao }[];
  } {
    const porPapel: { papel: Perfil; menu: string; nivel: NivelPermissao }[] =
      [];
    for (const papel of PAPEIS_PERMISSAO) {
      for (const m of MENU_CHAVES) {
        porPapel.push({ papel, menu: m, nivel: this.nivelDePapel(papel, m) });
      }
    }
    const porUsuario: {
      usuarioId: number;
      menu: string;
      nivel: NivelPermissao;
    }[] = [];
    for (const [chave, nivel] of this.porUsuario) {
      const [usuarioId, menu] = chave.split('|');
      porUsuario.push({ usuarioId: Number(usuarioId), menu, nivel });
    }
    return { menus: MENUS, papeis: PAPEIS_PERMISSAO, porPapel, porUsuario };
  }

  /** Grava o nível de um papel num menu (upsert). Menus fixos-ADM não são editáveis. */
  async salvarPapel(
    papel: Perfil,
    menu: string,
    nivel: NivelPermissao,
  ): Promise<void> {
    this.exigirMenuEditavel(menu);
    const existente = await this.papelRepo.findOne({ where: { papel, menu } });
    if (existente) {
      existente.nivel = nivel;
      await this.papelRepo.save(existente);
    } else {
      await this.papelRepo.save(this.papelRepo.create({ papel, menu, nivel }));
    }
    await this.recarregar();
  }

  /** Grava (ou remove) a exceção de um usuário num menu. Passar `null` remove a exceção
   * (o usuário volta a herdar o papel). */
  async salvarUsuario(
    usuarioId: number,
    menu: string,
    nivel: NivelPermissao | null,
  ): Promise<void> {
    this.exigirMenuEditavel(menu);
    const existente = await this.usuarioRepo.findOne({
      where: { usuarioId, menu },
    });
    if (nivel === null) {
      if (existente) await this.usuarioRepo.remove(existente);
    } else if (existente) {
      existente.nivel = nivel;
      await this.usuarioRepo.save(existente);
    } else {
      await this.usuarioRepo.save(
        this.usuarioRepo.create({ usuarioId, menu, nivel }),
      );
    }
    await this.recarregar();
  }

  private exigirMenuEditavel(menu: string): void {
    if (!ehMenuValido(menu)) {
      throw new Error(`Menu inválido: ${menu}`);
    }
    const def = MENUS.find((m) => m.chave === menu);
    if (def?.fixaAdm) {
      throw new Error(
        `O menu "${def.rotulo}" é fixo do Administrador e não pode ser reconfigurado.`,
      );
    }
  }
}
