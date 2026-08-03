import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DefMenu,
  Excecao,
  PermissoesAdminService,
  UsuarioLista,
} from '../../core/services/permissoes-admin.service';
import {
  NivelPermissao,
  PermissoesService,
} from '../../core/services/permissoes.service';

/** Manutenção de Permissões (Gestão, ADM): matriz Papel × Menu (nível nada/consulta/
 * alteracao) + exceções por usuário. A regra vale de imediato (backend é a fonte da verdade;
 * este componente só edita). Menus de Sistema são fixos do Administrador (mostrados travados). */
@Component({
  selector: 'app-permissoes',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './permissoes.component.html',
  styleUrl: './permissoes.component.css',
})
export class PermissoesComponent {
  private readonly api = inject(PermissoesAdminService);
  private readonly perm = inject(PermissoesService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly salvando = signal<string | null>(null);

  readonly menus = signal<DefMenu[]>([]);
  readonly papeis = signal<string[]>([]);
  readonly niveis = signal<NivelPermissao[]>(['nada', 'consulta', 'alteracao']);
  readonly usuarios = signal<UsuarioLista[]>([]);
  /** `${papel}|${menu}` → nível. */
  readonly mapaPapel = signal<Record<string, NivelPermissao>>({});
  readonly excecoes = signal<Excecao[]>([]);

  // Formulário de exceção por usuário.
  readonly excUsuario = signal<number | null>(null);
  readonly excMenu = signal<string>('');
  readonly excNivel = signal<NivelPermissao | 'herdar'>('consulta');

  readonly rotuloNivel: Record<string, string> = {
    nada: 'Nada',
    consulta: 'Consulta',
    alteracao: 'Alteração',
    herdar: 'Herdar do papel',
  };

  /** Menus agrupados por grupo, preservando a ordem do catálogo. */
  readonly grupos = computed(() => {
    const out: { grupo: string; menus: DefMenu[] }[] = [];
    for (const m of this.menus()) {
      let g = out.find((x) => x.grupo === m.grupo);
      if (!g) {
        g = { grupo: m.grupo, menus: [] };
        out.push(g);
      }
      g.menus.push(m);
    }
    return out;
  });

  /** Menus editáveis (não fixos-ADM) — para o seletor de exceção. */
  readonly menusEditaveis = computed(() =>
    this.menus().filter((m) => !m.fixaAdm),
  );

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const d = await this.api.matriz();
      this.menus.set(d.menus);
      this.papeis.set(d.papeis);
      this.niveis.set(d.niveis);
      this.usuarios.set(d.usuarios);
      const mapa: Record<string, NivelPermissao> = {};
      for (const c of d.porPapel) mapa[`${c.papel}|${c.menu}`] = c.nivel;
      this.mapaPapel.set(mapa);
      this.excecoes.set(d.porUsuario);
      if (!this.excMenu() && this.menusEditaveis().length) {
        this.excMenu.set(this.menusEditaveis()[0].chave);
      }
    } catch {
      this.erro.set('Não foi possível carregar as permissões.');
    } finally {
      this.carregando.set(false);
    }
  }

  nivelPapel(papel: string, menu: string): NivelPermissao {
    return this.mapaPapel()[`${papel}|${menu}`] ?? 'nada';
  }

  ehFixa(menu: string): boolean {
    return !!this.menus().find((m) => m.chave === menu)?.fixaAdm;
  }

  async mudarPapel(
    papel: string,
    menu: string,
    nivel: NivelPermissao,
  ): Promise<void> {
    const chave = `papel:${papel}|${menu}`;
    this.salvando.set(chave);
    this.erro.set(null);
    try {
      await this.api.definirNivelDoPapel(papel, menu, nivel);
      this.mapaPapel.update((m) => ({ ...m, [`${papel}|${menu}`]: nivel }));
      await this.perm.carregar(); // pode afetar o próprio menu de quem edita
    } catch {
      this.erro.set('Falha ao salvar. Recarregue e tente de novo.');
      await this.carregar();
    } finally {
      this.salvando.set(null);
    }
  }

  nomeUsuario(id: number): string {
    return this.usuarios().find((u) => u.id === id)?.nome ?? `#${id}`;
  }
  rotuloMenu(chave: string): string {
    return this.menus().find((m) => m.chave === chave)?.rotulo ?? chave;
  }

  async salvarExcecao(): Promise<void> {
    const usuarioId = this.excUsuario();
    const menu = this.excMenu();
    if (!usuarioId || !menu) {
      this.erro.set('Escolha o usuário e o menu da exceção.');
      return;
    }
    this.salvando.set('excecao');
    this.erro.set(null);
    try {
      await this.api.definirExcecaoDoUsuario(usuarioId, menu, this.excNivel());
      await this.carregar();
      await this.perm.carregar();
    } catch {
      this.erro.set('Falha ao salvar a exceção.');
    } finally {
      this.salvando.set(null);
    }
  }

  async removerExcecao(usuarioId: number, menu: string): Promise<void> {
    this.salvando.set(`exc:${usuarioId}|${menu}`);
    this.erro.set(null);
    try {
      await this.api.definirExcecaoDoUsuario(usuarioId, menu, 'herdar');
      await this.carregar();
      await this.perm.carregar();
    } catch {
      this.erro.set('Falha ao remover a exceção.');
    } finally {
      this.salvando.set(null);
    }
  }
}
