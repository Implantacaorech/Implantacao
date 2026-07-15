import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DesignacaoService } from '../../core/services/designacao.service';

@Component({
  selector: 'app-agendar-levantamento',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './agendar-levantamento.component.html',
  styleUrl: './agendar-levantamento.component.css',
})
export class AgendarLevantamentoComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(DesignacaoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly gci = signal('');
  readonly hojeIso = signal('');

  readonly form = this.fb.nonNullable.group({
    dataLevantamento: ['', Validators.required],
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const view = await this.service.obterAgendar(this.projetoId);
      this.gci.set(view.gci);
      this.hojeIso.set(view.hojeIso);
      if (view.dataLevantamento) this.form.patchValue({ dataLevantamento: view.dataLevantamento });
    } catch {
      this.erro.set('Não foi possível carregar os dados do agendamento.');
    } finally {
      this.carregando.set(false);
    }
  }

  async salvar(): Promise<void> {
    if (this.form.invalid || this.salvando()) return;
    this.salvando.set(true);
    this.erro.set(null);
    try {
      await this.service.agendar(this.projetoId, this.form.getRawValue().dataLevantamento);
      await this.router.navigate(['/projetos', this.projetoId]);
    } catch (e) {
      const msg =
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível agendar o levantamento.';
      this.erro.set(msg);
    } finally {
      this.salvando.set(false);
    }
  }
}
