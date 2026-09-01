import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OnlineComponent } from './online.component';
import { PresencaService } from '../../core/services/presenca.service';
import { PanoramaPresenca } from '../../core/models/presenca.model';

function panorama(over: Partial<PanoramaPresenca> = {}): PanoramaPresenca {
  return {
    agora: '2026-09-01T20:00:00.000Z',
    janelaSegundos: 120,
    intervaloPingSegundos: 45,
    totalUsuarios: 2,
    totalSessoes: 3,
    usuarios: [
      {
        usuarioId: 7,
        nome: 'Everton Remeling',
        perfil: 'ADM',
        telaAtual: 'Controle de Atividades',
        rotaAtual: '/atividades/10482',
        inativoSegundos: 4,
        ocioso: false,
        sessoes: [
          {
            sessao: 'aba-1',
            rota: '/atividades/10482',
            titulo: 'Controle de Atividades',
            visivel: true,
            ip: '10.0.0.9',
            navegador: 'Mozilla/5.0 Chrome/140',
            desdeSegundos: 3600,
            inativoSegundos: 4,
          },
          {
            sessao: 'aba-2',
            rota: '/agenda',
            titulo: 'Agenda',
            visivel: false,
            ip: '10.0.0.9',
            navegador: 'Mozilla/5.0 Chrome/140',
            desdeSegundos: 900,
            inativoSegundos: 70,
          },
        ],
      },
      {
        usuarioId: 9,
        nome: 'Marina Bordignon',
        perfil: 'GCI',
        telaAtual: 'Carteira',
        rotaAtual: '/projetos',
        inativoSegundos: 400,
        ocioso: true,
        sessoes: [
          {
            sessao: 'aba-3',
            rota: '/projetos',
            titulo: 'Carteira',
            visivel: true,
            ip: '10.0.0.14',
            navegador: 'Mozilla/5.0 Firefox/130',
            desdeSegundos: 7200,
            inativoSegundos: 400,
          },
        ],
      },
    ],
    ...over,
  };
}

async function montar(api: Partial<PresencaService> = {}) {
  TestBed.configureTestingModule({
    imports: [OnlineComponent],
    providers: [
      provideRouter([{ path: 'usuarios', children: [] }]),
      {
        provide: PresencaService,
        useValue: { panorama: () => Promise.resolve(panorama()), ...api },
      },
    ],
  });
  const fixture = TestBed.createComponent(OnlineComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('OnlineComponent', () => {
  it('lista quem está no Painel e em que tela', async () => {
    const f = await montar();
    const txt = f.nativeElement.textContent as string;
    expect(txt).toContain('Everton Remeling');
    expect(txt).toContain('Controle de Atividades');
    expect(txt).toContain('Marina Bordignon');
    expect(txt).toContain('Carteira');
  });

  it('separa ativos de ociosos', async () => {
    const f = await montar();
    expect(f.componentInstance.ativos()).toBe(1);
    expect(f.componentInstance.ociosos()).toBe(1);
  });

  it('mostra o resumo de pessoas e abas', async () => {
    const f = await montar();
    const txt = (f.nativeElement.textContent as string).replace(/\s+/g, ' ');
    expect(txt).toContain('2');
    expect(txt).toContain('pessoa(s)');
    expect(txt).toContain('aba(s)');
  });

  it('detalhar abre as abas da pessoa, com IP e navegador', async () => {
    const f = await montar();
    f.componentInstance.alternar(7);
    f.detectChanges();
    const txt = f.nativeElement.textContent as string;
    expect(txt).toContain('10.0.0.9');
    expect(txt).toContain('Chrome');
    expect(txt).toContain('segundo plano');
  });

  it('diz que NÃO há histórico — é o desenho, e a tela precisa deixar claro', async () => {
    const f = await montar();
    expect(f.nativeElement.textContent).toContain('Não há histórico');
  });

  it('avisa quando não há ninguém', async () => {
    const f = await montar({
      panorama: () =>
        Promise.resolve(panorama({ usuarios: [], totalUsuarios: 0, totalSessoes: 0 })),
    } as Partial<PresencaService>);
    expect(f.nativeElement.textContent).toContain('Ninguém no Painel neste momento.');
  });

  it('mostra mensagem quando a carga falha', async () => {
    const f = await montar({
      panorama: () => Promise.reject(new Error('falhou')),
    } as Partial<PresencaService>);
    expect(f.nativeElement.textContent).toContain(
      'Não foi possível carregar quem está online.',
    );
  });

  describe('desde()', () => {
    it('traduz segundos para linguagem de tela ao vivo', async () => {
      const c = (await montar()).componentInstance;
      expect(c.desde(3)).toBe('agora');
      expect(c.desde(42)).toBe('há 42s');
      expect(c.desde(200)).toBe('há 3 min');
      expect(c.desde(3700)).toBe('há 1h01');
    });
  });

  describe('navegador()', () => {
    it('reduz o user-agent ao nome do navegador', async () => {
      const c = (await montar()).componentInstance;
      expect(c.navegador('Mozilla/5.0 Chrome/140 Safari/537')).toBe('Chrome');
      expect(c.navegador('Mozilla/5.0 Firefox/130')).toBe('Firefox');
      expect(c.navegador('Mozilla/5.0 Edg/140')).toBe('Edge');
      expect(c.navegador('')).toBe('—');
    });
  });
});
