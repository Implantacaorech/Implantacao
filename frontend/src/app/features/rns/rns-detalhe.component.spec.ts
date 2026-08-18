import { TestBed } from '@angular/core/testing';
import { RnsDetalheComponent } from './rns-detalhe.component';
import { LinhaRns } from '../../core/models/rns.model';

function linha(over: Partial<LinhaRns> = {}): LinhaRns {
  return {
    pedido: 138643, item: 1, codigo: 141234, cliente: 5001, status: '3',
    sugestao: 'Conversão de histórico de vendas', tipo: '6', subtipo: '', projeto: '',
    prioridadeA: '', prioridade: 12, prioridadeAna: '', disponivel: 'N', temReq: 'S',
    tipoDes: '6-Conversão', statusDes: '3-Aprovada', statusPubDes: '',
    backlogDes: 'Backlog Implantação', faseDes: '', requisitoDes: '',
    dataCri: '2026-08-01', dataDesejada: '', dataPrevista: '2026-09-30',
    dataPrevFimProd: '', dataStatus8: '', dataStatus10: '', diasTriagem: 4,
    resNome: 'Liliana', sigla: 'CNV', fantasia: 'WLG Distribuidora',
    visaoGeral: 'Converter o histórico de vendas', contato: '', versaoAtu: '',
    versaoLib: '', minVerGeracao: '', anaNome: 'Giomar', valCoordenadorDes: '',
    valTecnicoDes: '', valGrupoDes: '', funcaoDes: '', represenDes: '',
    productOwnerDes: '', celula: '', menu: '', turnosPrev: null, timeDes: '',
    pontos: null, protocolo: '', rnsFilhas: '', valorCob: 1500.5,
    detalhamento: 'Layout do arquivo de vendas.', motivo: '', parecerEng: '',
    ...over,
  };
}

describe('RnsDetalheComponent (ficha do resumo completo)', () => {
  function montar(l: LinhaRns) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [RnsDetalheComponent] });
    const fixture = TestBed.createComponent(RnsDetalheComponent);
    fixture.componentRef.setInput('linha', l);
    fixture.detectChanges();
    return fixture;
  }

  it('monta os 6 grupos da ficha, com os campos formatados', () => {
    const fixture = montar(linha());
    const grupos = fixture.componentInstance.grupos();
    expect(grupos.map((g) => g.titulo)).toEqual([
      'Identificação',
      'Datas',
      'Cliente · Produto',
      'Responsáveis',
      'Organização · Produção',
      'Protocolo · RNS · Valor',
    ]);
    const ident = grupos[0].campos;
    expect(ident.find((c) => c.rotulo === 'Pedido / Item')?.valor).toBe('138643 / 1');
    expect(ident.find((c) => c.rotulo === 'Status')?.valor).toBe('3-Aprovada');
    const datas = grupos[1].campos;
    // Data ISO vira dd/mm/aaaa; vazia vira "—" esmaecido.
    expect(datas.find((c) => c.rotulo === 'Criação')?.valor).toBe('01/08/2026');
    expect(datas.find((c) => c.rotulo === 'Desejada')).toMatchObject({ valor: '—', vazio: true });
    // Valor de cobrança em reais (pt-BR).
    const valor = grupos[5].campos.find((c) => c.rotulo === 'Valor cobrança');
    expect(valor?.valor).toContain('1.500,50');
  });

  it('renderiza a visão geral e os textos longos que existirem (e só eles)', () => {
    const el: HTMLElement = montar(
      linha({ motivo: '', parecerEng: '' }),
    ).nativeElement;
    expect(el.querySelector('.rns-det-vg')?.textContent).toContain(
      'Converter o histórico de vendas',
    );
    const longos = [...el.querySelectorAll('.rns-det-txt')].map(
      (n) => n.textContent ?? '',
    );
    expect(longos).toHaveLength(1);
    expect(longos[0]).toContain('Detalhamento');
    expect(longos[0]).toContain('Layout do arquivo de vendas.');
  });
});
