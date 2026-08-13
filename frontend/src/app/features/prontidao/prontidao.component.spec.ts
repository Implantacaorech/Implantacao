import { TestBed } from '@angular/core/testing';
import { ProntidaoComponent } from './prontidao.component';
import { ProntidaoService } from '../../core/services/prontidao.service';
import { Prontidao } from '../../core/models/prontidao.model';

function fixtureProntidao(): Prontidao {
  return {
    dataAuditoria: '2026-08-12',
    eixos: [
      { numero: 1, nome: 'Segurança', maturidade: 2, resumo: 'resumo seg' },
      { numero: 7, nome: 'Custo por token', maturidade: 1, resumo: 'resumo custo' },
    ],
    achados: [
      {
        codigo: 'C1',
        titulo: 'Segredo JWT',
        severidade: 'critico',
        eixo: 1,
        evidencia: 'configuration.ts:96',
        correcao: 'NODE_ENV=production',
        status: 'corrigido',
        dono: 'software',
        prazo: 'feito',
      },
      {
        codigo: 'A9',
        titulo: 'Custo invisível',
        severidade: 'alto',
        eixo: 7,
        evidencia: 'ia.service.ts:326',
        correcao: 'capturar usage',
        status: 'aberto',
        dono: 'software',
        prazo: '2026-09-09',
      },
    ],
    totais: {
      porSeveridade: { critico: 1, alto: 1, medio: 0, baixo: 0 },
      porStatus: { corrigido: 1, mitigado: 0, aberto: 1 },
      maturidadeMedia: 1.5,
    },
    privacidadeAoVivo: [],
  };
}

function montar(service: Partial<ProntidaoService>) {
  TestBed.configureTestingModule({
    imports: [ProntidaoComponent],
    providers: [{ provide: ProntidaoService, useValue: service }],
  });
  return TestBed.createComponent(ProntidaoComponent);
}

describe('ProntidaoComponent', () => {
  it('exibe os eixos e achados quando a chamada resolve', async () => {
    const fixture = montar({ obter: () => Promise.resolve(fixtureProntidao()) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Prontidão do Sistema');
    expect(texto).toContain('Segurança');
    expect(texto).toContain('C1');
    expect(texto).toContain('Custo invisível');
  });

  it('mostra o alerta ao vivo de privacidade quando há finalidade fora da rede', async () => {
    const dados = fixtureProntidao();
    dados.privacidadeAoVivo = [
      { finalidade: 'protocolos', provider: 'openrouter', viaEnv: false },
    ];
    const fixture = montar({ obter: () => Promise.resolve(dados) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Privacidade (ao vivo)');
    expect(texto).toContain('protocolos');
  });

  it('filtra os achados por severidade', async () => {
    const fixture = montar({ obter: () => Promise.resolve(fixtureProntidao()) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    comp.alternarSeveridade('critico');
    fixture.detectChanges();
    expect(comp.achadosFiltrados().every((a) => a.severidade === 'critico')).toBe(true);
    expect(comp.achadosFiltrados()).toHaveLength(1);
  });

  it('mostra erro quando a chamada falha', async () => {
    const fixture = montar({ obter: () => Promise.reject(new Error('x')) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Não foi possível carregar',
    );
  });
});
