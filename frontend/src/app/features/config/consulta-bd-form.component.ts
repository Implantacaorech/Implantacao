import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ConsultaBdService } from '../../core/services/consulta-bd.service';
import { ResultadoExecucaoSql } from '../../core/models/consulta-bd.model';

@Component({
  selector: 'app-consulta-bd-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './consulta-bd-form.component.html',
  styleUrl: './consulta-bd-form.component.css',
})
export class ConsultaBdFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ConsultaBdService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly slugAtual = signal<string | null>(null);
  readonly salvando = signal(false);
  readonly testando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly resultadoTeste = signal<ResultadoExecucaoSql | null>(null);

  readonly form = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    slug: [''],
    sql: ['', Validators.required],
    ordem: [0],
    colunaData: [''],
    colunaSituacao: [''],
    mostrarGrafico: [false],
  });

  constructor() {
    const slugParam = this.route.snapshot.paramMap.get('slug');
    if (slugParam && slugParam !== 'novo') {
      this.slugAtual.set(slugParam);
      void this.carregar(slugParam);
    }
  }

  private async carregar(slug: string): Promise<void> {
    const c = await this.service.obter(slug);
    this.form.patchValue(c);
  }

  async salvar(): Promise<void> {
    if (this.form.invalid || this.salvando()) return;
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const { slug: slugInformado, ...dados } = this.form.getRawValue();
      const slugAtual = this.slugAtual();
      const salvo = slugAtual
        ? await this.service.atualizar(slugAtual, dados)
        : await this.service.criar({ ...dados, slug: slugInformado });
      await this.router.navigate(['/config/consultas-bd', salvo.slug]);
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível salvar a consulta.',
      );
    } finally {
      this.salvando.set(false);
    }
  }

  async testar(): Promise<void> {
    const slug = this.slugAtual();
    if (!slug || this.testando()) return;
    this.testando.set(true);
    this.erro.set(null);
    this.resultadoTeste.set(null);
    try {
      this.resultadoTeste.set(await this.service.testar(slug));
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível testar a consulta.',
      );
    } finally {
      this.testando.set(false);
    }
  }
}
