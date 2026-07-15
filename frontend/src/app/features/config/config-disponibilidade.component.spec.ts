import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfigDisponibilidadeComponent } from './config-disponibilidade.component';
import { ConfigDisponibilidadeService } from '../../core/services/config-disponibilidade.service';
import { StatusConfigDisponibilidade } from '../../core/models/config-disponibilidade.model';

function status(over: Partial<StatusConfigDisponibilidade> = {}): StatusConfigDisponibilidade {
  return {
    tipo: 'oracle',
    host: 'db.local',
    porta: '1521',
    banco: 'SICLA',
    usuario: 'app',
    url: '',
    select: 'SELECT ...',
    selectTecnicos: '',
    oracleLibDir: '',
    ativo: true,
    oracleThick: false,
    configurado: true,
    ...over,
  };
}

describe('ConfigDisponibilidadeComponent', () => {
  function montar(service: Partial<ConfigDisponibilidadeService>) {
    TestBed.configureTestingModule({
      imports: [ConfigDisponibilidadeComponent],
      providers: [provideRouter([]), { provide: ConfigDisponibilidadeService, useValue: service }],
    });
    return TestBed.createComponent(ConfigDisponibilidadeComponent);
  }

  it('pré-preenche o formulário com a config atual, sem senha', async () => {
    const fixture = montar({ status: () => Promise.resolve(status()) });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    expect(comp.form.getRawValue().host).toBe('db.local');
    expect(comp.form.getRawValue().senha).toBe('');
    expect(comp.configurado()).toBe(true);
  });

  it('salvar omite a senha do payload quando em branco', async () => {
    const salvar = vi.fn().mockResolvedValue(status());
    const fixture = montar({ status: () => Promise.resolve(status()), salvar });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.salvar();
    expect(salvar).toHaveBeenCalledWith(expect.not.objectContaining({ senha: expect.anything() }));
  });

  it('testar mostra a amostra retornada quando ok', async () => {
    const testar = vi.fn().mockResolvedValue({
      ok: true,
      mensagem: 'Conexão OK — 2 compromisso(s)',
      amostra: [{ tecnico: 'Ana', data: '2026-07-20', turno: 'manha' }],
    });
    const fixture = montar({ status: () => Promise.resolve(status()), testar });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.testar();
    expect(fixture.componentInstance.amostra()?.length).toBe(1);
    expect(fixture.componentInstance.aviso()).toContain('Conexão OK');
  });

  it('testar mostra erro quando a conexão falha', async () => {
    const testar = vi.fn().mockResolvedValue({ ok: false, mensagem: 'Erro de conexão', amostra: [] });
    const fixture = montar({ status: () => Promise.resolve(status()), testar });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.testar();
    expect(fixture.componentInstance.erro()).toBe('Erro de conexão');
  });
});
