import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ProjetosListaComponent } from './projetos-lista.component';
import { ProjetosService } from '../../core/services/projetos.service';
import { PassosService } from '../../core/services/passos.service';
import { AuthService } from '../../core/services/auth.service';
import { Projeto } from '../../core/models/projeto.model';
import { PassoAtualDoProjeto } from '../../core/models/passo.model';

function projeto(id: number, cliente: string): Projeto {
  return {
    id,
    cliente,
    cnpj: '',
    numeroProjeto: '',
    numeroProposta: '',
    ramo: '',
    responsavel: '',
    consultor: '',
    gci: '',
    etapa: 'Agendamento',
    situacao: 'Em andamento',
    dataInicio: '',
    dataLevantamento: '',
    dataUsoOficial: '',
    dataEncerramento: '',
    horasCobradas: '',
    horasBonificadas: '',
    modulos: '',
    contatoNome: '',
    contatoEmail: '',
    contatoTel: '',
    contatos: '',
    observacoes: '',
    criadoEm: '',
    atualizadoEm: '',
  };
}

function atual(
  projetoId: number,
  passo: number | null,
  titulo: string,
  concluidos = 0,
): PassoAtualDoProjeto {
  return {
    projetoId,
    passo,
    titulo,
    responsavel: 'Administrativo',
    etapa: 'Agendamento',
    concluidos,
    total: 18,
  };
}

describe('ProjetosListaComponent — quadro por fase', () => {
  async function montar(projetos: Projeto[], atuais: PassoAtualDoProjeto[]) {
    TestBed.configureTestingModule({
      imports: [ProjetosListaComponent],
      providers: [
        provideRouter([]),
        {
          provide: ProjetosService,
          useValue: {
            listar: () => Promise.resolve({ data: projetos, total: projetos.length }),
          },
        },
        { provide: PassosService, useValue: { atuais: () => Promise.resolve(atuais) } },
        { provide: AuthService, useValue: { usuario: () => ({ perfil: 'ADM', nome: 'A' }) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(ProjetosListaComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    return fixture;
  }

  it('cria uma coluna por PASSO, na ordem do processo', async () => {
    const fixture = await montar(
      [projeto(1, 'ACME'), projeto(2, 'GRX'), projeto(3, 'Alfa')],
      [
        atual(1, 7, 'Incluir a RNI e as RNS'),
        atual(2, 2, 'Agendar Levantamento'),
        atual(3, 10, 'Elaborar o cronograma'),
      ],
    );
    const colunas = fixture.componentInstance.colunas();
    expect(colunas.map((c) => c.numero)).toEqual([2, 7, 10]);
  });

  it('NÃO cria coluna para passo sem projeto — o quadro não fica vazio e largo', async () => {
    // É a diferença em relação a mostrar as 18 fases sempre: com 18 colunas, quase todas
    // ficariam em branco.
    const fixture = await montar(
      [projeto(1, 'ACME'), projeto(2, 'GRX')],
      [atual(1, 2, 'Agendar'), atual(2, 2, 'Agendar')],
    );
    const colunas = fixture.componentInstance.colunas();
    expect(colunas.length).toBe(1);
    expect(colunas[0].projetos.map((p) => p.cliente)).toEqual(['ACME', 'GRX']);
  });

  it('junta na coluna "Processo concluído" quem terminou os 18 passos', async () => {
    const fixture = await montar(
      [projeto(1, 'ACME'), projeto(2, 'GRX')],
      [atual(1, null, 'Processo concluído', 18), atual(2, 5, 'Contrato assinado')],
    );
    const colunas = fixture.componentInstance.colunas();
    expect(colunas[colunas.length - 1].titulo).toBe('Processo concluído');
    expect(colunas[colunas.length - 1].projetos[0].cliente).toBe('ACME');
  });

  it('calcula o progresso do card a partir dos passos concluídos', async () => {
    const fixture = await montar(
      [projeto(1, 'ACME')],
      [atual(1, 10, 'Cronograma', 9)],
    );
    expect(fixture.componentInstance.progresso(1)).toBe(50);
  });

  it('separa "sem informação" de "concluído" — não mente dizendo que terminou', async () => {
    // Projeto que não veio na resposta dos passos NÃO é projeto concluído; rotulá-lo assim
    // faria a carteira afirmar que uma implantação acabou quando ninguém sabe onde ela está.
    const fixture = await montar(
      [projeto(1, 'Sem info'), projeto(2, 'Terminado')],
      [atual(2, null, 'Processo concluído', 18)],
    );
    const colunas = fixture.componentInstance.colunas();
    const titulos = colunas.map((c) => c.titulo);
    expect(titulos).toContain('Processo concluído');
    expect(titulos).toContain('Fase não identificada');
    expect(
      colunas.find((c) => c.titulo === 'Processo concluído')?.projetos[0].cliente,
    ).toBe('Terminado');
    expect(
      colunas.find((c) => c.titulo === 'Fase não identificada')?.projetos[0].cliente,
    ).toBe('Sem info');
    expect(fixture.componentInstance.progresso(1)).toBe(0);
  });
});
