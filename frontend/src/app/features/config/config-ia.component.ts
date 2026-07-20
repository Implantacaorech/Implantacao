import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfigIaService } from '../../core/services/config-ia.service';
import { ProvedorIa, StatusFinalidadeIa } from '../../core/models/config-ia.model';

/** Ferramentas → Modo IA: configura a chave de IA POR FINALIDADE (Protocolos, Dicionário…),
 * cada uma com provedor próprio (Anthropic ou OpenRouter) e modelo. Campos separados por
 * finalidade — nada de chave global compartilhada. */
@Component({
  selector: 'app-config-ia',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './config-ia.component.html',
  styleUrl: './config-ia.component.css',
})
export class ConfigIaComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ConfigIaService);

  readonly carregando = signal(true);
  readonly salvandoIdx = signal<number | null>(null);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly provedores = signal<ProvedorIa[]>(['anthropic', 'openrouter']);
  readonly finalidades = signal<StatusFinalidadeIa[]>([]);

  readonly form = this.fb.nonNullable.group({
    itens: this.fb.array<
      ReturnType<ConfigIaComponent['criarGrupo']>
    >([]),
  });

  get itens(): FormArray {
    return this.form.get('itens') as FormArray;
  }

  constructor() {
    void this.carregar();
  }

  private criarGrupo(f: StatusFinalidadeIa) {
    return this.fb.nonNullable.group({
      finalidade: [f.finalidade],
      provider: [f.provider as ProvedorIa],
      apiKey: [''],
      modelo: [f.modelo],
    });
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const status = await this.service.status();
      this.provedores.set(status.provedores);
      this.finalidades.set(status.finalidades);
      this.itens.clear();
      for (const f of status.finalidades) this.itens.push(this.criarGrupo(f));
    } catch {
      this.erro.set('Não foi possível carregar a configuração de IA.');
    } finally {
      this.carregando.set(false);
    }
  }

  rotuloProvedor(p: ProvedorIa): string {
    return p === 'openrouter' ? 'OpenRouter' : 'Anthropic';
  }

  async salvar(idx: number): Promise<void> {
    const status = this.finalidades()[idx];
    if (this.salvandoIdx() !== null || status.viaEnv) return;
    const grupo = this.itens.at(idx).getRawValue() as {
      finalidade: string;
      provider: ProvedorIa;
      apiKey: string;
      modelo: string;
    };
    this.salvandoIdx.set(idx);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const res = await this.service.salvar(grupo);
      this.provedores.set(res.provedores);
      this.finalidades.set(res.finalidades);
      this.itens.at(idx).patchValue({ apiKey: '' });
      const nova = res.finalidades[idx];
      this.aviso.set(nova.ativa ? `${nova.rotulo}: chave salva.` : `${nova.rotulo}: chave removida.`);
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível salvar a chave.',
      );
    } finally {
      this.salvandoIdx.set(null);
    }
  }
}
