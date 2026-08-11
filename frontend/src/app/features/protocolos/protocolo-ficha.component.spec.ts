import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ProtocoloFichaComponent } from './protocolo-ficha.component';
import { ProtocoloService } from '../../core/services/protocolo.service';
import { FichaProtocolo, Protocolo, StatusProtocolo } from '../../core/models/protocolo.model';

function ficha(status: StatusProtocolo): FichaProtocolo {
  return {
    protocolo: {
      id: 9,
      status,
      titulo: 'Treinamento de faturamento',
      videoNome: 'aula.mp4',
      videoOrigem: 'upload',
      transcricao: '',
      logErro: '',
    } as Protocolo,
    podeAprovar: true,
    podeExcluir: true,
    ehAudio: false,
    locutores: [],
    mapaLocutores: {},
  };
}

/** O botão de cancelar é a única saída de 'Transcrevendo'/'Analisando' pela tela: até ele
 * existir, protocolo preso nesses status só era destravado editando o banco à mão. */
describe('ProtocoloFichaComponent — cancelar processamento', () => {
  function montar(service: Partial<ProtocoloService>) {
    TestBed.configureTestingModule({
      imports: [ProtocoloFichaComponent],
      providers: [
        provideRouter([]),
        {
          provide: ProtocoloService,
          useValue: { videoUrl: () => Promise.reject(new Error('sem mídia')), ...service },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '9' }) } } },
      ],
    });
    return TestBed.createComponent(ProtocoloFichaComponent);
  }

  async function abrir(status: StatusProtocolo, service: Partial<ProtocoloService> = {}) {
    const fixture = montar({ ficha: () => Promise.resolve(ficha(status)), ...service });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it.each(['Transcrevendo', 'Analisando'] as StatusProtocolo[])(
    'oferece o cancelamento em "%s"',
    async (status) => {
      const fixture = await abrir(status);
      expect(fixture.componentInstance.emProcessamento()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Cancelar processamento');
      fixture.destroy(); // encerra o polling do status
    },
  );

  it.each(['Pendente', 'Em revisão', 'Erro'] as StatusProtocolo[])(
    'não oferece cancelamento em "%s" — não há trabalho rodando',
    async (status) => {
      const fixture = await abrir(status);
      expect(fixture.componentInstance.emProcessamento()).toBe(false);
      expect(fixture.nativeElement.textContent).not.toContain('Cancelar processamento');
      fixture.destroy();
    },
  );

  it('cancela, mostra o aviso do servidor e recarrega a ficha já destravada', async () => {
    const cancelarProcessamento = vi
      .fn()
      .mockResolvedValue({ cancelado: true, aviso: 'Processamento cancelado.' });
    const carregada = vi
      .fn()
      .mockResolvedValueOnce(ficha('Transcrevendo'))
      .mockResolvedValue(ficha('Erro'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const fixture = montar({ ficha: carregada, cancelarProcessamento });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;

    await comp.cancelar();

    expect(cancelarProcessamento).toHaveBeenCalledWith(9);
    expect(comp.aviso()).toBe('Processamento cancelado.');
    // Volta para 'Erro', que é de onde "Processar agora" funciona de novo.
    expect(comp.protocolo()?.status).toBe('Erro');
    expect(comp.emProcessamento()).toBe(false);
    fixture.destroy();
  });

  it('desistir da confirmação não chama o servidor', async () => {
    const cancelarProcessamento = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fixture = await abrir('Transcrevendo', { cancelarProcessamento });

    await fixture.componentInstance.cancelar();

    expect(cancelarProcessamento).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('falha ao cancelar avisa sem derrubar a tela', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = await abrir('Transcrevendo', {
      cancelarProcessamento: vi.fn().mockRejectedValue(new Error('rede')),
    });

    await fixture.componentInstance.cancelar();

    expect(fixture.componentInstance.erro()).toContain('Não foi possível cancelar');
    expect(fixture.componentInstance.cancelando()).toBe(false);
    fixture.destroy();
  });
});
