import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiDadosService } from '../../core/services/api-dados.service';
import {
  PainelTokens,
  SondagemToken,
  TokenApiDados,
} from '../../core/models/api-dados.model';

/** Sistema → **Tokens da API de Dados** (só ADM) — o lado CONSUMIDOR do desenho de duas
 * instâncias.
 *
 * É aqui que se cola o token gerado no **Portal API**. A partir do momento em que existe um
 * token ativo, as consultas que ELE autoriza deixam de abrir conexão com o banco e passam a
 * ser pedidas ao Portal API, pelo nome. As demais continuam locais — a virada é por
 * consulta, e é isso que permite fazê-la aos poucos, sem janela.
 *
 * A lista de consultas de cada token **não é digitada**: sai do "Testar", que pergunta ao
 * Portal API o catálogo que aquele token enxerga — e ele já vem recortado. */
@Component({
  selector: 'app-tokens-api',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  templateUrl: './tokens-api.component.html',
  styleUrl: './tokens-api.component.css',
})
export class TokensApiComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ApiDadosService);

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly sondando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  readonly painel = signal<PainelTokens>({
    itens: [],
    descobertas: [],
    consumoRemotoAtivo: false,
  });
  readonly sondagem = signal<SondagemToken | null>(null);
  /** Consultas que o token alcança, descobertas no Testar. */
  readonly consultas = signal<string[]>([]);
  /** Id em edição; `null` = token novo. */
  readonly editando = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    url: ['', Validators.required],
    chave: [''],
    observacao: [''],
    ativo: [true],
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.painel.set(await this.service.tokens());
    } catch {
      this.erro.set(
        'Não foi possível carregar os tokens. Se a API de Dados acabou de entrar, rode as migrations (cd backend && npm run migration:run).',
      );
    } finally {
      this.carregando.set(false);
    }
  }

  /** Pergunta ao Portal API o que este token alcança. É o passo que substitui a digitação:
   * o catálogo devolvido já vem recortado pela autorização do token. */
  async testar(): Promise<void> {
    this.sondando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.sondarToken(
        this.form.controls.url.value,
        this.form.controls.chave.value,
      );
      this.sondagem.set(r);
      if (r.ok) this.consultas.set(r.consultas);
    } catch {
      this.erro.set('Não foi possível falar com o Portal API.');
    } finally {
      this.sondando.set(false);
    }
  }

  editar(t: TokenApiDados): void {
    this.editando.set(t.id);
    this.sondagem.set(null);
    this.consultas.set(t.consultas);
    this.form.patchValue({
      nome: t.nome,
      url: t.url,
      // O token nunca volta do servidor; em branco mantém o gravado.
      chave: '',
      observacao: t.observacao,
      ativo: t.ativo,
    });
  }

  novo(): void {
    this.editando.set(null);
    this.sondagem.set(null);
    this.consultas.set([]);
    this.form.reset({ nome: '', url: '', chave: '', observacao: '', ativo: true });
  }

  async salvar(): Promise<void> {
    if (this.form.invalid) {
      this.erro.set('Informe o nome e o endereço do Portal API.');
      return;
    }
    if (this.editando() === null && !this.form.controls.chave.value.trim()) {
      this.erro.set('Cole o token gerado no Portal API.');
      return;
    }
    if (!this.consultas().length) {
      // Um token sem consultas não consulta nada: a tela ficaria vazia sem explicação.
      this.erro.set(
        'Clique em Testar antes de salvar — é dele que sai a lista de consultas que este token autoriza.',
      );
      return;
    }
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const v = this.form.getRawValue();
      await this.service.salvarToken(this.editando(), {
        ...v,
        consultas: this.consultas(),
      });
      this.aviso.set(
        this.editando() === null ? 'Token cadastrado.' : 'Token atualizado.',
      );
      this.novo();
      await this.carregar();
    } catch {
      this.erro.set('Não foi possível salvar o token.');
    } finally {
      this.salvando.set(false);
    }
  }

  async definirAtivo(t: TokenApiDados, ativo: boolean): Promise<void> {
    try {
      await this.service.definirTokenAtivo(t.id, ativo);
      this.aviso.set(
        ativo
          ? `Token "${t.nome}" ligado — as consultas dele voltam a ir pelo Portal API.`
          : `Token "${t.nome}" desligado — as consultas dele voltam a ir pelo banco local.`,
      );
      await this.carregar();
    } catch {
      this.erro.set('Não foi possível alterar o token.');
    }
  }

  async excluir(t: TokenApiDados): Promise<void> {
    if (
      !confirm(
        `Apagar o token "${t.nome}"? As consultas dele voltam a ser feitas no banco local.`,
      )
    ) {
      return;
    }
    try {
      await this.service.excluirToken(t.id);
      this.aviso.set(`Token "${t.nome}" apagado.`);
      await this.carregar();
    } catch {
      this.erro.set('Não foi possível apagar o token.');
    }
  }
}
