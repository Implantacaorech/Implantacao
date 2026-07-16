import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LegadoService } from '../../core/services/legado.service';
import { LegadoClienteEstadoService } from '../../core/services/legado-cliente-estado.service';
import { ArquivoBaixavel, GrupoCatalogo, RoleLegado, getRole } from '../../core/models/legado.model';
import { FormLegado } from '../../core/services/legado.service';
import { baixarArquivoLegado } from './baixar.util';

interface LinhaAlteracao {
  modulo: string;
  rotina: string;
  desc: string;
}
interface LinhaResumoModulo {
  modulo: string;
  adicional: string;
  processo: string;
  status: string;
  obs: string;
}
interface LinhaPendencia {
  pendencia: string;
  tecnico: string;
  detalhamento: string;
}
interface LinhaUsuario {
  nome: string;
  email: string;
  atrib: string;
}
interface LinhaModuloIdentificado {
  modulo: string;
  necessidade: string;
  obs: string;
}

type Aba = 'comuns' | 'termo' | 'mapa';

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

@Component({
  selector: 'app-legado-criar-templates',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './criar-templates.component.html',
  styleUrl: './criar-templates.component.css',
})
export class CriarTemplatesComponent {
  private readonly service = inject(LegadoService);
  private readonly clienteEstado = inject(LegadoClienteEstadoService);
  private readonly route = inject(ActivatedRoute);

  readonly rid = this.route.snapshot.paramMap.get('rid') ?? '';
  readonly role: RoleLegado | undefined = getRole(this.rid);

  readonly dias = Array.from({ length: 31 }, (_, i) => i + 1);
  readonly meses = MESES;
  readonly anos = [2025, 2026, 2027, 2028];

  readonly abaAtiva = signal<Aba>('comuns');
  readonly carregandoCatalogo = signal(true);
  readonly gerando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<{ ok: boolean; erro?: string; arquivos: ArquivoBaixavel[] } | null>(null);
  readonly grupos = signal<GrupoCatalogo[]>([]);
  readonly busca = signal('');

  readonly gruposFiltrados = computed(() => {
    const q = this.busca().toLowerCase().trim();
    if (!q) return this.grupos();
    return this.grupos()
      .map((g) => ({
        area: g.area,
        modulos: g.modulos.filter(
          (m) => m.abrev.toLowerCase().includes(q) || (m.descricao || '').toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.modulos.length > 0);
  });
  readonly totalFiltrado = computed(() => this.gruposFiltrados().reduce((n, g) => n + g.modulos.length, 0));

  genTermo = true;
  genMapa = true;

  cliente = this.clienteEstado.atual()?.nome ?? '';
  numeroProjeto = '';

  dataValidacao = '';
  alteracoes: LinhaAlteracao[] = [{ modulo: '', rotina: '', desc: '' }];
  resumoModulos: LinhaResumoModulo[] = [{ modulo: '', adicional: '', processo: '', status: '', obs: '' }];
  termoObs = '';
  pendencias: LinhaPendencia[] = [{ pendencia: '', tecnico: '', detalhamento: '' }];

  responsaveis = '';
  localizacao = '';
  ramo = '';
  produto = '';
  fornecedorAtual = '';
  observacoes = '';
  totalUsuarios = '';
  usuarios: LinhaUsuario[] = [{ nome: '', email: '', atrib: '' }];
  modulosSelecionados = new Set<string>();
  modulosIdentificados: LinhaModuloIdentificado[] = [{ modulo: '', necessidade: 'Sim', obs: '' }];
  cvTotal = '';
  cvCli = '';
  cvProd = '';
  cvFin = '';
  cvNf = '';
  cvFolha = '';
  hCob = '';
  hBon = '';
  hTot = '';

  dataDia: string;
  dataMes: string;
  dataAno: string;

  constructor() {
    const hoje = new Date();
    this.dataDia = String(hoje.getDate()).padStart(2, '0');
    this.dataMes = String(hoje.getMonth() + 1).padStart(2, '0');
    this.dataAno = String(hoje.getFullYear());
    void this.carregarCatalogo();
  }

  async carregarCatalogo(): Promise<void> {
    this.carregandoCatalogo.set(true);
    try {
      this.grupos.set(await this.service.catalogo());
    } catch {
      this.erro.set('Não foi possível carregar o catálogo de módulos.');
    } finally {
      this.carregandoCatalogo.set(false);
    }
  }

  aba(a: Aba): void {
    this.abaAtiva.set(a);
  }

  pad2(n: number): string {
    return String(n).padStart(2, '0');
  }

  alternarModulo(abrev: string, marcado: boolean): void {
    if (marcado) this.modulosSelecionados.add(abrev);
    else this.modulosSelecionados.delete(abrev);
  }

  adicionar<T>(lista: T[], linhaVazia: T): void {
    lista.push(linhaVazia);
  }

  remover<T>(lista: T[], i: number): void {
    if (lista.length > 1) lista.splice(i, 1);
  }

  private rows<T extends Record<string, string>>(chaves: (keyof T)[], linhas: T[]): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const chave of chaves) out[chave as string] = [];
    for (const linha of linhas) {
      const vazia = chaves.every((c) => !String(linha[c] ?? '').trim());
      if (vazia) continue;
      for (const chave of chaves) out[chave as string].push(String(linha[chave] ?? ''));
    }
    return out;
  }

  async gerar(): Promise<void> {
    if (!this.genTermo && !this.genMapa) {
      this.erro.set('Marque ao menos um documento a gerar.');
      return;
    }
    this.gerando.set(true);
    this.erro.set(null);
    try {
      const form: FormLegado = {
        cliente: this.cliente,
        numero_projeto: this.numeroProjeto,
        data_dia: this.dataDia,
        data_mes: this.dataMes,
        data_ano: this.dataAno,
      };
      if (this.genTermo) form['gen_termo'] = 'on';
      if (this.genMapa) form['gen_mapa'] = 'on';

      form['data_validacao'] = this.dataValidacao;
      const alt = this.rows(['modulo', 'rotina', 'desc'], this.alteracoes as unknown as Record<string, string>[]);
      form['alt_modulo'] = alt['modulo'];
      form['alt_rotina'] = alt['rotina'];
      form['alt_desc'] = alt['desc'];
      const tr = this.rows(
        ['modulo', 'adicional', 'processo', 'status', 'obs'],
        this.resumoModulos as unknown as Record<string, string>[],
      );
      form['tr_modulo'] = tr['modulo'];
      form['tr_adic'] = tr['adicional'];
      form['tr_proc'] = tr['processo'];
      form['tr_status'] = tr['status'];
      form['tr_obs'] = tr['obs'];
      form['termo_obs'] = this.termoObs;
      const pend = this.rows(
        ['pendencia', 'tecnico', 'detalhamento'],
        this.pendencias as unknown as Record<string, string>[],
      );
      form['pend_p'] = pend['pendencia'];
      form['pend_t'] = pend['tecnico'];
      form['pend_d'] = pend['detalhamento'];

      form['responsaveis'] = this.responsaveis;
      form['localizacao'] = this.localizacao;
      form['ramo'] = this.ramo;
      form['produto'] = this.produto;
      form['fornecedor_atual'] = this.fornecedorAtual;
      form['observacoes'] = this.observacoes;
      form['total_usuarios'] = this.totalUsuarios;
      const usu = this.rows(['nome', 'email', 'atrib'], this.usuarios as unknown as Record<string, string>[]);
      form['u_nome'] = usu['nome'];
      form['u_email'] = usu['email'];
      form['u_atrib'] = usu['atrib'];
      form['modulos'] = [...this.modulosSelecionados];
      const mb = this.rows(
        ['modulo', 'necessidade', 'obs'],
        this.modulosIdentificados as unknown as Record<string, string>[],
      );
      form['mb_mod'] = mb['modulo'];
      form['mb_nec'] = mb['necessidade'];
      form['mb_obs'] = mb['obs'];
      form['cv_total'] = this.cvTotal;
      form['cv_cli'] = this.cvCli;
      form['cv_prod'] = this.cvProd;
      form['cv_fin'] = this.cvFin;
      form['cv_nf'] = this.cvNf;
      form['cv_folha'] = this.cvFolha;
      form['h_cob'] = this.hCob;
      form['h_bon'] = this.hBon;
      form['h_tot'] = this.hTot;

      this.resultado.set(await this.service.criarTemplates(form));
    } catch {
      this.erro.set('Não foi possível gerar os documentos.');
    } finally {
      this.gerando.set(false);
    }
  }

  async baixar(arquivo: ArquivoBaixavel): Promise<void> {
    await baixarArquivoLegado(this.service, arquivo);
  }
}
