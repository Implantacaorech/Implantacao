import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CriarProjetoPayload, ETAPAS, SITUACOES } from '../../core/models/projeto.model';
import { ProjetosService } from '../../core/services/projetos.service';

@Component({
  selector: 'app-projeto-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './projeto-form.component.html',
  styleUrl: './projeto-form.component.css',
})
export class ProjetoFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ProjetosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly etapas = ETAPAS;
  readonly situacoes = SITUACOES;
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly projetoId = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    cliente: ['', Validators.required],
    cnpj: [''],
    numeroProjeto: [''],
    numeroProposta: [''],
    ramo: [''],
    responsavel: [''],
    consultor: [''],
    gci: [''],
    etapa: ['Agendamento'],
    situacao: ['Em andamento'],
    modulos: [''],
    horasCobradas: [''],
    contatoNome: [''],
    contatoEmail: [''],
    contatoTel: [''],
    observacoes: [''],
  });

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam && idParam !== 'novo') {
      const id = Number(idParam);
      this.projetoId.set(id);
      void this.carregar(id);
    }
  }

  private async carregar(id: number): Promise<void> {
    const projeto = await this.service.buscar(id);
    this.form.patchValue(projeto);
  }

  async salvar(): Promise<void> {
    if (this.form.invalid || this.salvando()) return;
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const dto = this.form.getRawValue() as CriarProjetoPayload;
      const id = this.projetoId();
      const salvo = id ? await this.service.atualizar(id, dto) : await this.service.criar(dto);
      await this.router.navigate(['/projetos', salvo.id]);
    } catch (e) {
      const msg =
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível salvar o projeto.';
      this.erro.set(msg);
    } finally {
      this.salvando.set(false);
    }
  }
}
