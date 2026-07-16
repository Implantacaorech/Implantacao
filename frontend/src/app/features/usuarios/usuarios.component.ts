import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CriarUsuarioPayload, PERFIS, Usuario } from '../../core/models/usuario.model';
import { UsuariosService } from '../../core/services/usuarios.service';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css',
})
export class UsuariosComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(UsuariosService);

  readonly perfis = PERFIS;
  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly usuarios = signal<Usuario[]>([]);
  readonly usuarioId = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    nome: [''],
    email: ['', [Validators.required, Validators.email]],
    login: [''],
    codigoSicla: ['', Validators.required],
    perfil: ['Consultor' as Usuario['perfil']],
    senha: [''],
    ativo: [true],
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.usuarios.set(await this.service.listar());
    } catch {
      this.erro.set('Não foi possível carregar os usuários.');
    } finally {
      this.carregando.set(false);
    }
  }

  editar(u: Usuario): void {
    this.usuarioId.set(u.id);
    this.form.patchValue({ ...u, senha: '' });
    window.scrollTo(0, 0);
  }

  limpar(): void {
    this.usuarioId.set(null);
    this.form.reset({ nome: '', email: '', login: '', codigoSicla: '', perfil: 'Consultor', senha: '', ativo: true });
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
    this.aviso.set(null);
    try {
      const dto = { ...dados } as CriarUsuarioPayload;
      if (!dto.senha) delete (dto as Partial<CriarUsuarioPayload>).senha;
      const id = this.usuarioId();
      if (id) await this.service.atualizar(id, dto);
      else await this.service.criar(dto);
      this.aviso.set('Salvo.');
      this.limpar();
      await this.carregar();
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível salvar o usuário.',
      );
    } finally {
      this.salvando.set(false);
    }
  }
}
