import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { PassosComponent } from './passos.component';
import { PassosService } from '../../core/services/passos.service';
import { ProjetosService } from '../../core/services/projetos.service';
import { DesignacaoService } from '../../core/services/designacao.service';
import { PermissoesService } from '../../core/services/permissoes.service';
import { DocumentosService } from '../../core/services/documentos.service';
import { EmailRegistrado, Passo } from '../../core/models/passo.model';
import { Documento } from '../../core/models/documento.model';
import { Projeto } from '../../core/models/projeto.model';

/** E-mail já gerado no passo 10, para a consulta. */
const EMAIL_GERADO: EmailRegistrado = {
  id: 1,
  projetoId: 5,
  passo: 10,
  para: 'dora@rech.com.br',
  assunto: 'Projeto finalizado — pronto para revisão',
  corpo: 'Texto do e-mail.',
  anexo: '',
  status: 'enviado',
  erro: '',
  autor: 'Ana GCI',
  criadoEm: '2026-07-30T12:00:00.000Z',
};

/** Documento do passo 10 (tipo `projeto`) — o vínculo passo↔documento é pelo tipo. */
const DOCUMENTO: Documento = {
  id: 9,
  projetoId: 5,
  tipo: 'projeto',
  arquivo: 'Projeto.docx',
  caminho: 'C:/docs/Projeto.docx',
  origem: 'gerado',
  criadoEm: '2026-07-30T12:00:00.000Z',
};

function projeto(): Projeto {
  return {
    id: 5,
    cliente: 'Cliente Teste',
    cnpj: '',
    numeroProjeto: '',
    numeroProposta: '',
    tipoDemanda: '',
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
    comercialEmail: '',
    contatos: '',
    observacoes: '',
    criadoEm: '',
    atualizadoEm: '',
  };
}

function passo(over: Partial<Passo> = {}): Passo {
  return {
    numero: 1,
    titulo: 'Passo',
    etapa: 'Agendamento',
    responsavel: 'Administrativo',
    depende: [],
    irreversivel: false,
    concluido: false,
    concluidoEm: null,
    concluidoPor: '',
    conferido: false,
    marcado: false,
    dataMarcada: '',
    observacaoRegistrada: '',
    rotuloMarcacao: '',
    redigeEmail: false,
    aceitaAnexoLivre: false,
    bloqueadoPor: [],
    liberado: true,
    motivos: [],
    podeAbrir: false,
    ...over,
  };
}

/** O link "Abrir" do passo, ou `null` se ele não estiver na tela. */
function linkAbrir(fixture: { nativeElement: unknown }): HTMLAnchorElement | null {
  const raiz = fixture.nativeElement as HTMLElement;
  return (
    [...raiz.querySelectorAll('a')].find(
      (a) => (a.textContent ?? '').trim() === 'Abrir',
    ) ?? null
  );
}

describe('PassosComponent', () => {
  let servicoFake: {
    listar: () => Promise<Passo[]>;
    listarRns: () => Promise<[]>;
    pessoas: () => Promise<{ levantadores: []; consultores: [] }>;
    definirPessoas: () => Promise<[]>;
    pessoasPorPapel: (papel: string) => Promise<string[]>;
    concluir: (id: number, numero: number) => Promise<Passo[]>;
    conferir: () => Promise<Passo[]>;
    reabrir: () => Promise<Passo[]>;
    previaEmail: (id: number, numero: number) => Promise<unknown>;
    emailsGerados: () => Promise<EmailRegistrado[]>;
    concluidos: number[];
  };

  async function montar(passos: Passo[], podeAlterarCarteira = true) {
    servicoFake = {
      concluidos: [],
      listar: () => Promise.resolve(passos),
      listarRns: () => Promise.resolve([]),
      pessoas: () => Promise.resolve({ levantadores: [], consultores: [] }),
      definirPessoas: () => Promise.resolve([]),
      // Levantadores vêm do PAPEL 'Levantador' no cadastro, não da lista de consultores.
      pessoasPorPapel: (papel: string) =>
        Promise.resolve(papel === 'Levantador' ? ['Ana GCI', 'Caio GCI'] : []),
      concluir: (_id: number, numero: number) => {
        servicoFake.concluidos.push(numero);
        return Promise.resolve(passos);
      },
      conferir: () => Promise.resolve(passos),
      reabrir: () => Promise.resolve(passos),
      // O backend monta o e-mail (modelo do passo + tokens do projeto) e a tela só revisa.
      previaEmail: () =>
        Promise.resolve({
          para: ['contato@cliente.com'],
          assunto: 'Encerramento da implantação do SIGER® — Cliente Teste',
          corpo: 'Prezado(a) Camila,',
          anexo: 'Termo.docx',
        }),
      emailsGerados: () => Promise.resolve([EMAIL_GERADO]),
    };

    TestBed.configureTestingModule({
      imports: [PassosComponent],
      providers: [
        provideRouter([]),
        { provide: PassosService, useValue: servicoFake },
        {
          provide: DesignacaoService,
          useValue: {
            obterAgendar: () => Promise.resolve({ gci: '', dataLevantamento: '', hojeIso: '' }),
            obterConsultores: () =>
              Promise.resolve({ modulos: [], consultores: ['Ana', 'Bruno'], atuais: {} }),
            obterDefinirGci: () => Promise.resolve({ gciAtual: '', gcis: ['GCI Um'] }),
            agendar: () => Promise.resolve({}),
            definirGci: () => Promise.resolve({}),
          },
        },
        { provide: ProjetosService, useValue: { buscar: () => Promise.resolve(projeto()) } },
        {
          provide: DocumentosService,
          useValue: {
            listar: () => Promise.resolve([DOCUMENTO]),
            baixar: () =>
              Promise.resolve({ blob: new Blob(), filename: 'Projeto.docx' }),
          },
        },
        // Sem Alteração na Carteira a tela vira SÓ CONSULTA — os testes de botão precisam do
        // nível que o painel de Permissões daria. `podeAlterarCarteira: false` simula o
        // COMERCIAL, que tem nível `consulta` no menu e ainda assim responde pelos passos
        // 1 e 5 (ver o teste do passo liberado, mais abaixo).
        {
          provide: PermissoesService,
          useValue: {
            podeAlterar: (menu: string) =>
              menu === 'carteira' ? podeAlterarCarteira : false,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(PassosComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    // O carregamento é feito por um encadeamento de promises no construtor; sem ceder o
    // event loop uma vez, o DOM ainda mostra "Carregando…" quando o teste olha.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    return fixture;
  }

  // O Comercial tem nível `consulta` na Carteira e ainda assim responde pelos passos 1 e 5.
  // Enquanto a coluna de ações dependia só de `soConsulta()`, ele não via botão nenhum e o
  // processo travava no passo 5 — sem nada na tela explicando por quê (achado de 2026-08-05).
  // Quem manda é `liberado`, que já chega do backend com a regra completa (dependências +
  // RN-10): aparece exatamente para quem a API vai aceitar.
  describe('quem só CONSULTA a carteira', () => {
    it('vê a ação do passo que é dele (liberado pelo backend)', async () => {
      const fixture = await montar(
        [passo({ numero: 5, titulo: 'Avançar', responsavel: 'Comercial', liberado: true })],
        false,
      );
      const raiz = fixture.nativeElement as HTMLElement;
      const botoes = [...raiz.querySelectorAll('button')].map((b) =>
        (b.textContent ?? '').trim(),
      );
      expect(botoes).toContain('Concluir');
    });

    it('NÃO vê ação em passo que não é dele', async () => {
      const fixture = await montar(
        [passo({ numero: 10, titulo: 'Criação do Projeto', responsavel: 'GCI', liberado: false, motivos: ['Só o responsável (GCI) pode concluir.'] })],
        false,
      );
      const raiz = fixture.nativeElement as HTMLElement;
      const botoes = [...raiz.querySelectorAll('button')].map((b) =>
        (b.textContent ?? '').trim(),
      );
      expect(botoes).not.toContain('Concluir');
    });

    it('continua enxergando o motivo do bloqueio', async () => {
      const fixture = await montar(
        [passo({ numero: 10, liberado: false, motivos: ['Depende do passo 8 (Indicar o GCI).'] })],
        false,
      );
      const raiz = fixture.nativeElement as HTMLElement;
      expect(raiz.textContent).toContain('Depende do passo 8');
    });
  });

  it('agrupa os passos por macro-etapa, preservando a ordem do processo', async () => {
    const fixture = await montar([
      passo({ numero: 1, etapa: 'Agendamento' }),
      passo({ numero: 2, etapa: 'Agendamento' }),
      passo({ numero: 3, etapa: 'Levantamento' }),
    ]);
    const grupos = fixture.componentInstance.porEtapa();
    expect(grupos.map((g) => g.etapa)).toEqual(['Agendamento', 'Levantamento']);
    expect(grupos[0].itens.map((i) => i.numero)).toEqual([1, 2]);
  });

  it('calcula o progresso pelos passos concluídos', async () => {
    const fixture = await montar([
      passo({ numero: 1, concluido: true }),
      passo({ numero: 2 }),
      passo({ numero: 3 }),
      passo({ numero: 4 }),
    ]);
    expect(fixture.componentInstance.concluidos()).toBe(1);
    expect(fixture.componentInstance.progresso()).toBe(25);
  });

  it('mostra o motivo quando o passo não está liberado para quem olha', async () => {
    const fixture = await montar([
      passo({
        numero: 7,
        titulo: 'Indicar o GCI',
        liberado: false,
        motivos: ['Só o responsável (Coordenador) pode concluir.'],
      }),
    ]);
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Só o responsável (Coordenador) pode concluir.');
  });

  it('os passos que exigem dados abrem formulário em vez de só concluir', async () => {
    // Foi a reclamação do usuário: "Agendar Levantamento" não abria onde informar os
    // levantadores e a data.
    const fixture = await montar([passo()]);
    const c = fixture.componentInstance;
    expect(c.formDoPasso(passo({ numero: 2 }))).toBe('agendar');
    expect(c.formDoPasso(passo({ numero: 8 }))).toBe('designar');
    // Mesma reclamação no passo 9: as RNS ficavam num painel no fim da página, e o passo que
    // as pede só tinha "Concluir" — quem chegava nele não tinha onde digitar.
    expect(c.formDoPasso(passo({ numero: 9 }))).toBe('rns');
    // Passo que não pede nada continua sendo um "Concluir" direto.
    expect(c.formDoPasso(passo({ numero: 3 }))).toBeNull();
  });

  it('os passos 10 e 11 dão o Projeto para ver e baixar na própria linha', async () => {
    // Reclamação do usuário: a Criação e a Conferência do Projeto só deixavam chegar ao
    // documento por dentro de "Registros". Conferir sem poder abrir o arquivo mandava o
    // Administrativo caçar o Projeto em outra tela.
    const fixture = await montar([
      passo({ numero: 10, titulo: 'Criação do Projeto', concluido: true }),
      passo({ numero: 11, titulo: 'Conferência do Projeto' }),
    ]);
    const c = fixture.componentInstance;
    expect(c.documentoParaVer(passo({ numero: 10 }))?.id).toBe(DOCUMENTO.id);
    // O 11 confere o MESMO documento gerado no 10 — não um documento próprio.
    expect(c.documentoParaVer(passo({ numero: 11 }))?.id).toBe(DOCUMENTO.id);
    // Passo sem documento associado não ganha os botões.
    expect(c.documentoParaVer(passo({ numero: 2 }))).toBeNull();

    const raiz = fixture.nativeElement as HTMLElement;
    const visualizar = [...raiz.querySelectorAll('a')].filter(
      (a) => (a.textContent ?? '').trim() === 'Visualizar',
    );
    const baixar = [...raiz.querySelectorAll('button')].filter(
      (b) => (b.textContent ?? '').trim() === 'Baixar',
    );
    expect(visualizar).toHaveLength(2);
    expect(baixar).toHaveLength(2);
  });

  it('o passo 9 continua abrindo as RNS depois de concluído', async () => {
    // A quantidade de RNS é variável ao longo do projeto: trancar a edição na conclusão
    // obrigaria a reabrir o passo só para incluir mais uma.
    const fixture = await montar([passo()]);
    const c = fixture.componentInstance;
    expect(c.formAindaEditavel(passo({ numero: 9, concluido: true }))).toBe(true);
    expect(c.formAindaEditavel(passo({ numero: 9 }))).toBe(false);
    expect(c.formAindaEditavel(passo({ numero: 8, concluido: true }))).toBe(false);
  });

  it('o passo 16 anexa arquivos ao e-mail e mostra o que vai junto', async () => {
    const p16 = passo({
      numero: 16,
      titulo: 'Enviar o cronograma de visitas',
      redigeEmail: true,
      aceitaAnexoLivre: true,
    });
    const fixture = await montar([p16]);
    const c = fixture.componentInstance;

    // O anexo é um documento do projeto de tipo `anexo_passo_16` — sem chamada nova, a tela
    // filtra a lista de documentos que já carregou.
    expect(c.anexosDoEmail(p16)).toEqual([]);
    c.documentos.set([
      { ...DOCUMENTO, id: 31, tipo: 'anexo_passo_16', arquivo: 'Apoio.pdf' },
    ]);
    expect(c.anexosDoEmail(p16).map((d) => d.arquivo)).toEqual(['Apoio.pdf']);
    // Um anexo do passo 16 não vaza para outro passo.
    expect(c.anexosDoEmail(passo({ numero: 15 }))).toEqual([]);

    await c.abrirForm(p16);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('input[type="file"][multiple]')).not.toBeNull();
    expect(raiz.textContent).toContain('Apoio.pdf');
  });

  it('abre o formulário de registro quando o passo cobra assinatura ou e-mail', async () => {
    // Revisão de 2026-07-30: o 7 e o 12 exigem a marcação da assinatura + data; os passos de
    // e-mail ("enviar por aqui") mandam a pessoa redigir antes de concluir.
    const fixture = await montar([passo()]);
    const c = fixture.componentInstance;
    expect(
      c.formDoPasso(passo({ numero: 7, rotuloMarcacao: 'Contrato assinado' })),
    ).toBe('registro');
    expect(
      c.formDoPasso(passo({ numero: 12, rotuloMarcacao: 'Projeto assinado' })),
    ).toBe('registro');
    expect(c.formDoPasso(passo({ numero: 21, redigeEmail: true }))).toBe(
      'registro',
    );
  });

  it('o botão diz o que vai acontecer ao clicar', async () => {
    const fixture = await montar([passo()]);
    const c = fixture.componentInstance;
    expect(c.rotuloAcao(passo({ numero: 21, redigeEmail: true }))).toBe(
      'Redigir e-mail',
    );
    expect(
      c.rotuloAcao(passo({ numero: 7, rotuloMarcacao: 'Contrato assinado' })),
    ).toBe('Registrar');
    expect(c.rotuloAcao(passo({ numero: 2 }))).toBe('Preencher');
  });

  it('recusa concluir o passo de assinatura sem a marcação e a data', async () => {
    const p = passo({
      numero: 7,
      rotuloMarcacao: 'Contrato assinado',
      liberado: true,
    });
    const fixture = await montar([p]);
    const c = fixture.componentInstance;

    await c.salvarRegistro(p);
    expect(c.erro()).toContain('Contrato assinado');
    expect(servicoFake.concluidos).toEqual([]);

    c.marcado = true;
    c.dataMarcada = '';
    await c.salvarRegistro(p);
    expect(c.erro()).toContain('data da assinatura');
    expect(servicoFake.concluidos).toEqual([]);

    c.dataMarcada = '2026-08-03';
    await c.salvarRegistro(p);
    expect(servicoFake.concluidos).toEqual([7]);
  });

  it('abre o e-mail já preenchido pelo modelo do passo', async () => {
    // A pessoa REVISA o texto institucional; não o escreve do zero a cada envio.
    const p = passo({ numero: 21, redigeEmail: true });
    const fixture = await montar([p]);
    const c = fixture.componentInstance;
    await c.abrirForm(p);
    expect(c.emailPara).toBe('contato@cliente.com');
    expect(c.emailAssunto).toContain('Encerramento');
    expect(c.emailAnexo()).toBe('Termo.docx');
  });

  it('lista como levantador SÓ quem tem o papel Levantador', async () => {
    // Regra do usuário: "só devem ser listados nas opções de Levantador(es) os GCI" — e o
    // que define isso é a marcação de papel no cadastro, não ser consultor do projeto.
    const fixture = await montar([passo({ numero: 2, titulo: 'Agendar' })]);
    const c = fixture.componentInstance;
    await c.abrirForm(passo({ numero: 2 }));
    expect(c.formAberto()).toBe(2);
    expect(c.levantadoresDisponiveis()).toEqual(['Ana GCI', 'Caio GCI']);
  });

  it('marca e desmarca pessoa na seleção múltipla, sem repetir', async () => {
    const fixture = await montar([passo()]);
    const c = fixture.componentInstance;
    let sel: string[] = [];
    sel = c.alternarSelecao(sel, 'Ana', true);
    sel = c.alternarSelecao(sel, 'Ana', true);
    sel = c.alternarSelecao(sel, 'Bruno', true);
    expect(sel).toEqual(['Ana', 'Bruno']);
    sel = c.alternarSelecao(sel, 'Ana', false);
    expect(sel).toEqual(['Bruno']);
  });

  it('abre a tela do Levantamento mesmo sem poder CONCLUIR o passo', async () => {
    // Bug do usuário (2026-07-29): o passo 3 é concluído pelo Levantador designado, e o
    // botão "Abrir" seguia essa mesma permissão — quem não era o levantador do projeto via
    // o botão e não conseguia entrar no preenchimento. Abrir é permissão da TELA.
    const fixture = await montar([
      passo({
        numero: 3,
        titulo: 'Realizar o Levantamento de Processo',
        etapa: 'Levantamento',
        responsavel: 'Levantador',
        liberado: false,
        motivos: ['Só o responsável (Levantador) pode concluir.'],
        podeAbrir: true,
      }),
    ]);
    const link = linkAbrir(fixture);
    expect(link?.getAttribute('href')).toBe('/projetos/5/levantamento');
  });

  it('não leva a lugar nenhum quando o perfil não alcança a tela', async () => {
    const fixture = await montar([
      passo({ numero: 3, etapa: 'Levantamento', liberado: true, podeAbrir: false }),
    ]);
    const link = linkAbrir(fixture);
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBeNull();
    expect(link?.getAttribute('aria-disabled')).toBe('true');
  });

  it('continua permitindo abrir a tela depois de o passo ser concluído', async () => {
    // Concluir o passo 3 não pode trancar o acesso ao que foi preenchido.
    const fixture = await montar([
      passo({
        numero: 3,
        etapa: 'Levantamento',
        concluido: true,
        concluidoPor: 'Ana',
        podeAbrir: true,
      }),
    ]);
    expect(linkAbrir(fixture)?.getAttribute('href')).toBe('/projetos/5/levantamento');
  });

  it('só reconhece conferência nos passos 11 e 19', async () => {
    const fixture = await montar([passo()]);
    const c = fixture.componentInstance;
    expect(c.temConferencia(passo({ numero: 11 }))).toBe(true);
    expect(c.temConferencia(passo({ numero: 19 }))).toBe(true);
    expect(c.temConferencia(passo({ numero: 10 }))).toBe(false);
  });

  it('sinaliza quando um passo concluído ainda aguarda conferência', async () => {
    const fixture = await montar([passo()]);
    const c = fixture.componentInstance;
    expect(
      c.aguardandoConferencia(passo({ numero: 11, concluido: true, conferido: false })),
    ).toBe(true);
    expect(
      c.aguardandoConferencia(passo({ numero: 11, concluido: true, conferido: true })),
    ).toBe(false);
  });

  it('mostra os e-mails e documentos do passo a quem só tem consulta', async () => {
    // Exigência do processo: qualquer pessoa com acesso ao menu vê os e-mails gerados e os
    // documentos de cada etapa — e pode BAIXAR o documento mesmo sem poder alterar nada.
    const fixture = await montar([passo({ numero: 10, concluido: true })]);
    const c = fixture.componentInstance;
    const p = passo({ numero: 10 });
    expect(c.emailsDoPasso(p).map((e) => e.id)).toEqual([1]);
    expect(c.documentosDoPasso(p).map((d) => d.arquivo)).toEqual([
      'Projeto.docx',
    ]);
    expect(c.totalRegistros(p)).toBe(2);
    // Passo sem nada produzido não anuncia registro nenhum.
    expect(c.totalRegistros(passo({ numero: 2 }))).toBe(0);
  });

  it('traduz o status do e-mail para linguagem de quem lê', async () => {
    const fixture = await montar([passo()]);
    const c = fixture.componentInstance;
    const base = { id: 1, projetoId: 5, passo: 1 } as EmailRegistrado;
    expect(c.rotuloStatus({ ...base, status: 'enviado' })).toBe('enviado');
    expect(c.rotuloStatus({ ...base, status: 'sem_destinatario' })).toBe(
      'sem destinatário',
    );
    expect(c.rotuloStatus({ ...base, status: 'falhou' })).toBe(
      'falhou no envio',
    );
  });
});
