import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MatrizListaComponent } from './matriz-lista.component';
import { MatrizService } from '../../core/services/matriz.service';
import { MatrizListaView } from '../../core/models/matriz.model';

function view(over: Partial<MatrizListaView> = {}): MatrizListaView {
  return { itens: [], restrito: false, ...over };
}

describe('MatrizListaComponent', () => {
  function montar(service: Partial<MatrizService>) {
    TestBed.configureTestingModule({
      imports: [MatrizListaComponent],
      providers: [provideRouter([]), { provide: MatrizService, useValue: service }],
    });
    return TestBed.createComponent(MatrizListaComponent);
  }

  it('redireciona automaticamente para a própria ficha quando o backend indica redirecionarParaId', async () => {
    const fixture = montar({ listar: () => Promise.resolve(view({ redirecionarParaId: 9 })) });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(navigateSpy).toHaveBeenCalledWith(['/matriz', 9]);
  });

  it('mostra mensagem de acesso restrito quando o usuário não tem ficha própria', async () => {
    const fixture = montar({ listar: () => Promise.resolve(view({ restrito: true })) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('não tem linha na matriz');
  });

  it('lista os técnicos quando o usuário vê tudo', async () => {
    const fixture = montar({
      listar: () =>
        Promise.resolve(
          view({
            itens: [
              { id: 1, nome: 'Ana', setor: 'FAT', dias: '5', notas: '{}', atualizadoEm: null, atualizadoPor: '', qtdNotas: 3 },
            ],
          }),
        ),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ana');
  });

  it('mostra o botão de importar só quando podeAdmin é true', async () => {
    const fixture = montar({ listar: () => Promise.resolve(view({ podeAdmin: true })) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Importar planilha');
  });
});
