import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ProjetoFormComponent } from './projeto-form.component';
import { ProjetosService } from '../../core/services/projetos.service';
import { DocumentosService } from '../../core/services/documentos.service';
import { DesignacaoService } from '../../core/services/designacao.service';
import { AuthService } from '../../core/services/auth.service';
import { Projeto } from '../../core/models/projeto.model';

/** Ficha já salva no banco — é o que a tela TEM de mostrar ao abrir para edição. */
const SALVO: Projeto = {
  id: 7,
  cliente: 'ACME Indústria',
  cnpj: '11.222.333/0001-44',
  numeroProjeto: '2026-0042',
  numeroProposta: 'PROP-9',
  tipoDemanda: 'Levantamento',
  ramo: 'Indústria',
  responsavel: 'Maria',
  consultor: 'João',
  gci: 'Ana',
  etapa: 'Agendamento',
  situacao: 'Em risco',
  dataInicio: '2026-07-01',
  dataLevantamento: '2026-07-10',
  dataUsoOficial: '2026-09-01',
  dataEncerramento: '',
  horasCobradas: '120',
  horasBonificadas: '20',
  modulos: 'FAT, CTB',
  contatoNome: 'Carlos',
  contatoEmail: 'carlos@acme.com.br',
  contatoTel: '(51) 99999-0000',
  comercialEmail: 'comercial@rech.com.br',
  contatos: 'Financeiro: Bia',
  observacoes: 'Virada só depois do inventário',
  criadoEm: '',
  atualizadoEm: '',
};

async function montar(id: string) {
  TestBed.configureTestingModule({
    imports: [ProjetoFormComponent],
    providers: [
      provideRouter([]),
      { provide: ProjetosService, useValue: { buscar: () => Promise.resolve(SALVO) } },
      {
        provide: DocumentosService,
        useValue: {
          cabecalho: () => Promise.resolve(null),
          listar: () => Promise.resolve([]),
          eventos: () => Promise.resolve([]),
        },
      },
      {
        provide: DesignacaoService,
        useValue: {
          obterConsultores: () =>
            Promise.resolve({ modulos: [], consultores: [], atuais: {} }),
        },
      },
      {
        provide: AuthService,
        useValue: { usuario: () => ({ perfil: 'ADM', nome: 'A', perfis: ['ADM'] }) },
      },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id }) } },
      },
    ],
  });
  const fixture = TestBed.createComponent(ProjetoFormComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
  return fixture;
}

/** Valor que o usuário realmente VÊ no campo (não o do FormGroup). */
function valorEmTela(fixture: { nativeElement: HTMLElement }, controle: string): string {
  const el = fixture.nativeElement.querySelector<HTMLInputElement | HTMLSelectElement>(
    `[formcontrolname="${controle}"]`,
  );
  if (!el) throw new Error(`Campo "${controle}" não foi renderizado na tela`);
  return el.value;
}

describe('ProjetoFormComponent — edição dos dados do cliente', () => {
  // Regressão do bug de 2026-07-29: os campos vinham de um <ng-template> renderizado por
  // ngTemplateOutlet e o [formGroup] estava só no <form> que o INSERE. Como o template
  // resolve injeção pelo lugar onde é DECLARADO, nenhum formControlName achava o grupo
  // (NG01050) e a ficha abria em branco mesmo com o projeto carregado. Assertar o valor no
  // DOM — e não no FormGroup — é o que pega esse caso: o form estava certo, a tela não.
  it('carrega em tela tudo o que já está salvo', async () => {
    const fixture = await montar('7');
    expect(valorEmTela(fixture, 'cliente')).toBe('ACME Indústria');
    expect(valorEmTela(fixture, 'cnpj')).toBe('11.222.333/0001-44');
    expect(valorEmTela(fixture, 'numeroProjeto')).toBe('2026-0042');
    expect(valorEmTela(fixture, 'numeroProposta')).toBe('PROP-9');
    expect(valorEmTela(fixture, 'ramo')).toBe('Indústria');
    expect(valorEmTela(fixture, 'responsavel')).toBe('Maria');
    expect(valorEmTela(fixture, 'gci')).toBe('Ana');
    expect(valorEmTela(fixture, 'consultor')).toBe('João');
    expect(valorEmTela(fixture, 'modulos')).toBe('FAT, CTB');
    expect(valorEmTela(fixture, 'horasCobradas')).toBe('120');
    expect(valorEmTela(fixture, 'horasBonificadas')).toBe('20');
    expect(valorEmTela(fixture, 'dataInicio')).toBe('2026-07-01');
    expect(valorEmTela(fixture, 'dataLevantamento')).toBe('2026-07-10');
    expect(valorEmTela(fixture, 'dataUsoOficial')).toBe('2026-09-01');
    expect(valorEmTela(fixture, 'contatoNome')).toBe('Carlos');
    expect(valorEmTela(fixture, 'contatoEmail')).toBe('carlos@acme.com.br');
    expect(valorEmTela(fixture, 'contatoTel')).toBe('(51) 99999-0000');
    expect(valorEmTela(fixture, 'contatos')).toBe('Financeiro: Bia');
    expect(valorEmTela(fixture, 'observacoes')).toBe('Virada só depois do inventário');
    expect(valorEmTela(fixture, 'situacao')).toBe('Em risco');
  });

  it('mantém o vínculo com o FormGroup — digitar na tela atualiza o que será salvo', async () => {
    const fixture = await montar('7');
    const campo = fixture.nativeElement.querySelector(
      '[formcontrolname="contatoNome"]',
    ) as HTMLInputElement;
    campo.value = 'Renata';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.form.getRawValue().contatoNome).toBe('Renata');
  });

  it('em "novo projeto" abre com os campos vazios e ligados ao formulário', async () => {
    const fixture = await montar('novo');
    expect(fixture.componentInstance.projetoId()).toBeNull();
    expect(valorEmTela(fixture, 'cliente')).toBe('');
    const campo = fixture.nativeElement.querySelector(
      '[formcontrolname="cliente"]',
    ) as HTMLInputElement;
    campo.value = 'Cliente Novo';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.form.getRawValue().cliente).toBe('Cliente Novo');
  });
});
