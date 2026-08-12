import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfigIaService } from '../../core/services/config-ia.service';
import { ModeloOpenRouter, ProvedorIa, StatusFinalidadeIa } from '../../core/models/config-ia.model';

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
  readonly modelosOr = signal<ModeloOpenRouter[]>([]);

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
      // Reexibida ao contrário da chave: é endereço de rede, não segredo — e sem ela em tela
      // salvar qualquer outro campo apagaria a configuração local (URL vazia = remover).
      baseUrl: [f.baseUrl],
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
    // Catálogo do OpenRouter para o combo — best-effort, não bloqueia a tela.
    try {
      this.modelosOr.set(await this.service.modelosOpenRouter());
    } catch {
      this.modelosOr.set([]);
    }
  }

  private provedorDe(i: number): ProvedorIa {
    return this.itens.at(i).get('provider')?.value as ProvedorIa;
  }

  ehOpenRouter(i: number): boolean {
    return this.provedorDe(i) === 'openrouter';
  }

  ehLocal(i: number): boolean {
    return this.provedorDe(i) === 'local';
  }

  rotuloProvedor(p: ProvedorIa): string {
    if (p === 'openrouter') return 'OpenRouter';
    if (p === 'local') return 'Serviço local (Ollama, LM Studio…)';
    return 'Anthropic';
  }

  /** Alerta preventivo: no OpenRouter o modelo precisa do prefixo do provedor
   * (ex.: anthropic/claude-sonnet-4). Um id "puro" da Anthropic (claude-opus-4-8) é rejeitado
   * com 400 "not a valid model ID". */
  modeloSuspeito(i: number): boolean {
    const grupo = this.itens.at(i);
    const provider = grupo.get('provider')?.value as ProvedorIa;
    const modelo = ((grupo.get('modelo')?.value as string) ?? '').trim();
    return provider === 'openrouter' && modelo.length > 0 && !modelo.includes('/');
  }

  async salvar(idx: number): Promise<void> {
    const status = this.finalidades()[idx];
    if (this.salvandoIdx() !== null || status.viaEnv) return;
    const grupo = this.itens.at(idx).getRawValue() as {
      finalidade: string;
      provider: ProvedorIa;
      apiKey: string;
      modelo: string;
      baseUrl: string;
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
      const oQue = nova.provider === 'local' ? 'serviço local' : 'chave';
      this.aviso.set(
        nova.ativa ? `${nova.rotulo}: ${oQue} salvo.` : `${nova.rotulo}: configuração removida.`,
      );
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
