import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ModeloEmailService } from '../../core/services/modelo-email.service';
import { VARIAVEIS_EMAIL } from '../../core/models/modelo-email.model';
import { ETAPAS } from '../../core/models/projeto.model';

function destacarVariaveis(texto: string): string {
  const escapado = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escapado.replace(
    /\{\{[A-Z_]+\}\}/g,
    (m) => `<mark style="background:#fff3cd;border-radius:3px;padding:0 2px;font-weight:600">${m}</mark>`,
  );
}

@Component({
  selector: 'app-modelo-email-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './modelo-email-form.component.html',
  styleUrl: './modelo-email-form.component.css',
})
export class ModeloEmailFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ModeloEmailService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly etapas = ETAPAS;
  readonly variaveis = VARIAVEIS_EMAIL;
  readonly placeholderAssunto = 'Ex.: Encaminhamento — Levantamento — {{CLIENTE}}';
  readonly placeholderCorpo = 'Escreva o corpo do e-mail. Use {{CLIENTE}}, {{CONSULTOR}}, etc.';

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly modeloId = signal<number | null>(null);
  readonly modeloPadrao = signal(false);
  readonly campoAtivo = signal<'assunto' | 'corpo'>('corpo');

  readonly form = this.fb.nonNullable.group({
    nome: [''],
    etapa: [''],
    assunto: [''],
    corpo: [''],
  });

  readonly previewAssunto = computed(() => {
    const v = this.form.getRawValue().assunto;
    return v ? destacarVariaveis(v) : '<span style="color:var(--muted);font-style:italic">Assunto vazio</span>';
  });

  readonly previewCorpo = computed(() => {
    const v = this.form.getRawValue().corpo;
    return v ? destacarVariaveis(v) : '<span style="color:var(--muted);font-style:italic">Corpo vazio</span>';
  });

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam && idParam !== 'novo') {
      const id = Number(idParam);
      this.modeloId.set(id);
      void this.carregar(id);
    } else {
      this.carregando.set(false);
    }
  }

  private async carregar(id: number): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const m = await this.service.obter(id);
      this.form.patchValue(m);
      this.modeloPadrao.set(m.padrao);
    } catch {
      this.erro.set('Não foi possível carregar o modelo.');
    } finally {
      this.carregando.set(false);
    }
  }

  focarCampo(campo: 'assunto' | 'corpo'): void {
    this.campoAtivo.set(campo);
  }

  inserirVariavel(v: string): void {
    const campo = this.campoAtivo();
    const atual = this.form.getRawValue()[campo] ?? '';
    this.form.patchValue({ [campo]: atual + v });
  }

  async salvar(): Promise<void> {
    if (this.salvando()) return;
    const dados = this.form.getRawValue();
    if (!dados.nome.trim() || !dados.assunto.trim() || !dados.corpo.trim()) {
      this.erro.set('Preencha nome, assunto e corpo do modelo.');
      return;
    }
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const id = this.modeloId();
      if (id) await this.service.atualizar(id, dados);
      else await this.service.criar(dados);
      await this.router.navigate(['/config/modelos-email']);
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível salvar o modelo.',
      );
    } finally {
      this.salvando.set(false);
    }
  }
}
