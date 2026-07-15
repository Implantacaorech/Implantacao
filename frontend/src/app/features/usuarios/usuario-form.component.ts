import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CriarUsuarioPayload, PERFIS } from '../../core/models/usuario.model';
import { UsuariosService } from '../../core/services/usuarios.service';

@Component({
  selector: 'app-usuario-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './usuario-form.component.html',
  styleUrl: './usuario-form.component.css',
})
export class UsuarioFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(UsuariosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly perfis = PERFIS;
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly usuarioId = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    nome: [''],
    email: ['', [Validators.required, Validators.email]],
    login: [''],
    senha: [''],
    perfil: ['Consultor'],
    codigoSicla: ['', Validators.required],
    ativo: [true],
  });

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam && idParam !== 'novo') {
      const id = Number(idParam);
      this.usuarioId.set(id);
      void this.carregar(id);
    }
  }

  private async carregar(id: number): Promise<void> {
    const usuario = await this.service.buscar(id);
    this.form.patchValue({ ...usuario, senha: '' });
  }

  async salvar(): Promise<void> {
    if (this.form.invalid || this.salvando()) return;
    const dados = this.form.getRawValue();
    if (!this.usuarioId() && (!dados.senha || dados.senha.length < 6)) {
      this.erro.set('Informe uma senha com pelo menos 6 caracteres.');
      return;
    }
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const dto = { ...dados } as CriarUsuarioPayload;
      if (!dto.senha) delete (dto as Partial<CriarUsuarioPayload>).senha;
      const id = this.usuarioId();
      const salvo = id ? await this.service.atualizar(id, dto) : await this.service.criar(dto);
      await this.router.navigate(['/usuarios', salvo.id]);
    } catch (e) {
      const msg =
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível salvar o usuário.';
      this.erro.set(msg);
    } finally {
      this.salvando.set(false);
    }
  }
}
