import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfigDisponibilidadeService } from '../../core/services/config-disponibilidade.service';
import { LinhaOcupacao } from '../../core/models/config-disponibilidade.model';

@Component({
  selector: 'app-config-disponibilidade',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './config-disponibilidade.component.html',
  styleUrl: './config-disponibilidade.component.css',
})
export class ConfigDisponibilidadeComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ConfigDisponibilidadeService);

  readonly dialetos = ['mysql', 'oracle', 'postgresql', 'sqlserver'];

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly testando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly configurado = signal(false);
  readonly amostra = signal<LinhaOcupacao[] | null>(null);

  readonly form = this.fb.nonNullable.group({
    tipo: ['oracle'],
    host: [''],
    porta: [''],
    banco: [''],
    usuario: [''],
    senha: [''],
    url: [''],
    select: [''],
    selectTecnicos: [''],
    oracleLibDir: [''],
    ativo: [false],
    oracleThick: [false],
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const status = await this.service.status();
      this.form.patchValue({ ...status, senha: '' });
      this.configurado.set(status.configurado);
    } catch {
      this.erro.set('Não foi possível carregar a configuração de Disponibilidade.');
    } finally {
      this.carregando.set(false);
    }
  }

  async salvar(): Promise<void> {
    if (this.salvando()) return;
    this.salvando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const dados = this.form.getRawValue();
      const dto = { ...dados };
      if (!dto.senha) delete (dto as Partial<typeof dados>).senha;
      const status = await this.service.salvar(dto);
      this.configurado.set(status.configurado);
      this.form.patchValue({ senha: '' });
      this.aviso.set('Configuração salva.');
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível salvar a configuração.',
      );
    } finally {
      this.salvando.set(false);
    }
  }

  async testar(): Promise<void> {
    if (this.testando()) return;
    this.testando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    this.amostra.set(null);
    try {
      const r = await this.service.testar();
      if (r.ok) {
        this.aviso.set(r.mensagem);
        this.amostra.set(r.amostra);
      } else {
        this.erro.set(r.mensagem);
      }
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível testar a conexão.',
      );
    } finally {
      this.testando.set(false);
    }
  }
}
