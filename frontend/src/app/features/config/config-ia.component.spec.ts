import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfigIaComponent } from './config-ia.component';
import { ConfigIaService } from '../../core/services/config-ia.service';
import { StatusConfigIa, StatusFinalidadeIa } from '../../core/models/config-ia.model';

function finalidade(over: Partial<StatusFinalidadeIa> = {}): StatusFinalidadeIa {
  return {
    finalidade: 'protocolos',
    rotulo: 'Protocolos de Treinamento',
    descricao: 'Reconferência do texto.',
    ativa: false,
    provider: 'anthropic',
    modelo: '',
    viaEnv: false,
    ...over,
  };
}

function status(over: Partial<StatusConfigIa> = {}): StatusConfigIa {
  return {
    provedores: ['anthropic', 'openrouter'],
    finalidades: [
      finalidade(),
      finalidade({ finalidade: 'dicionario', rotulo: 'Dicionário Inteligente' }),
    ],
    ...over,
  };
}

describe('ConfigIaComponent', () => {
  function montar(service: Partial<ConfigIaService>) {
    TestBed.configureTestingModule({
      imports: [ConfigIaComponent],
      providers: [provideRouter([]), { provide: ConfigIaService, useValue: service }],
    });
    return TestBed.createComponent(ConfigIaComponent);
  }

  it('carrega uma seção por finalidade', async () => {
    const fixture = montar({ status: () => Promise.resolve(status()) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.finalidades()).toHaveLength(2);
    expect(fixture.componentInstance.itens.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Protocolos de Treinamento');
    expect(fixture.nativeElement.textContent).toContain('Dicionário Inteligente');
  });

  it('salva a chave OpenRouter da finalidade escolhida', async () => {
    const salvar = vi
      .fn()
      .mockResolvedValue(
        status({ finalidades: [finalidade({ ativa: true, provider: 'openrouter', modelo: 'anthropic/claude-sonnet-4' }), finalidade({ finalidade: 'dicionario', rotulo: 'Dicionário Inteligente' })] }),
      );
    const fixture = montar({ status: () => Promise.resolve(status()), salvar });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.itens.at(0).patchValue({
      provider: 'openrouter',
      apiKey: 'sk-or-teste',
      modelo: 'anthropic/claude-sonnet-4',
    });
    await fixture.componentInstance.salvar(0);

    expect(salvar).toHaveBeenCalledWith({
      finalidade: 'protocolos',
      provider: 'openrouter',
      apiKey: 'sk-or-teste',
      modelo: 'anthropic/claude-sonnet-4',
    });
    expect(fixture.componentInstance.finalidades()[0].ativa).toBe(true);
  });

  it('não salva quando a finalidade usa chave via variável de ambiente', async () => {
    const salvar = vi.fn();
    const fixture = montar({
      status: () => Promise.resolve(status({ finalidades: [finalidade({ ativa: true, viaEnv: true }), finalidade({ finalidade: 'dicionario' })] })),
      salvar,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.componentInstance.salvar(0);
    expect(salvar).not.toHaveBeenCalled();
  });
});
