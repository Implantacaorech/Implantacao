import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { LevantamentoComponent } from './levantamento.component';
import { LevantamentoService } from '../../core/services/levantamento.service';
import { ProjetosService } from '../../core/services/projetos.service';
import {
  LevantamentoRespostaLinha,
  TEXTO_NAO_UTILIZADO,
} from '../../core/models/levantamento.model';

function linha(over: Partial<LevantamentoRespostaLinha> = {}): LevantamentoRespostaLinha {
  return {
    id: 1,
    projetoId: 5,
    ordem: 0,
    moduloSigla: 'FAT',
    modulo: 'Faturamento',
    adicional: '',
    topico: 'Emissão de nota fiscal',
    resposta: '',
    naoUtilizado: false,
    versao: 0,
    atualizadoPor: '',
    atualizadoEm: null,
    ...over,
  };
}

describe('LevantamentoComponent', () => {
  /** Monta a tela já carregada. `sincronizar` devolve vazio por padrão — cada teste que
   * exercita a edição a várias mãos sobrescreve. */
  async function montar(
    linhas: LevantamentoRespostaLinha[],
    service: Partial<LevantamentoService> = {},
  ) {
    const respondidas = linhas.filter((l) => l.resposta.trim()).length;
    TestBed.configureTestingModule({
      imports: [LevantamentoComponent],
      providers: [
        provideRouter([]),
        {
          provide: LevantamentoService,
          useValue: {
            obter: vi.fn().mockResolvedValue({
              linhas,
              resumo: { respondidas, total: linhas.length },
            }),
            salvarLinha: vi.fn(async (_p: number, id: number, dados: Record<string, unknown>) => ({
              linha: { ...linhas.find((l) => l.id === id)!, ...dados, versao: 1 },
              resumo: { respondidas, total: linhas.length },
            })),
            sincronizar: vi.fn().mockResolvedValue({
              presentes: [],
              linhas: [],
              resumo: { respondidas, total: linhas.length },
              agora: '2026-07-28T10:00:00.000Z',
            }),
            sair: vi.fn().mockResolvedValue(undefined),
            ...service,
          },
        },
        {
          provide: ProjetosService,
          useValue: { buscar: () => Promise.resolve({ cliente: 'Cliente Teste' }) },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: '5' }), queryParamMap: convertToParamMap({}) },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(LevantamentoComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  /** O ponto do recurso: a reunião gravada preenche o questionário — mas nada entra sozinho.
   * O Levantamento é assinado pelo cliente, e a autoria da resposta tem de ser de quem
   * revisou, não da IA. */
  describe('sugestões a partir da reunião gravada', () => {
    const sugestao = {
      linhaId: 1,
      moduloSigla: 'FAT',
      topico: 'Emissão de nota fiscal',
      texto: 'A emissão é feita hoje no sistema antigo, uma a uma.',
      trecho: '[00:10]',
    };

    function comSugestao(extra: Record<string, unknown> = {}) {
      return {
        gravacoes: vi.fn().mockResolvedValue({
          gravacoes: [
            {
              id: 42,
              titulo: 'Reunião de levantamento',
              criadoEm: '2026-08-01T10:00:00.000Z',
              duracaoSeg: 1800,
              status: 'Em revisão',
              caracteres: 1200,
            },
          ],
          iaDisponivel: true,
        }),
        sugerir: vi.fn().mockResolvedValue({
          sugestoes: [sugestao],
          analisados: 1,
          naoAnalisados: 0,
          aviso: '1 sugestão(ões) a revisar.',
        }),
        ...extra,
      };
    }

    it('mostra a proposta ao lado da pergunta, sem tocar no campo', async () => {
      const servico = comSugestao();
      const fixture = await montar([linha({ id: 1, resposta: '' })], servico);
      const comp = fixture.componentInstance;

      await comp.pedirSugestoes(42);
      fixture.detectChanges();

      expect(comp.totalSugestoes()).toBe(1);
      // A resposta continua vazia — a sugestão é proposta, não preenchimento.
      expect(comp.linhas()[0].resposta).toBe('');
      expect(servico.sugerir).toHaveBeenCalledWith(5, 42);
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('A emissão é feita hoje no sistema antigo');
      expect(texto).toContain('[00:10]');
      fixture.destroy();
    });

    it('"Usar" grava pelo mesmo caminho da digitação (com versão), e a sugestão sai da tela', async () => {
      const salvarLinha = vi.fn().mockResolvedValue({
        linha: linha({ id: 1, resposta: sugestao.texto, versao: 4, atualizadoPor: 'Eu' }),
        resumo: { respondidas: 1, total: 1 },
      });
      const fixture = await montar(
        [linha({ id: 1, resposta: '', versao: 3 })],
        comSugestao({ salvarLinha }),
      );
      const comp = fixture.componentInstance;
      await comp.pedirSugestoes(42);

      comp.usarSugestao(1);

      // O texto entra no campo na hora, e a gravação sai pelo autosave de sempre — com a
      // versão que estava em tela, para o backend recusar se um colega gravou antes.
      expect(comp.linhas()[0].resposta).toBe(sugestao.texto);
      expect(comp.totalSugestoes()).toBe(0);
      await vi.waitFor(() => expect(salvarLinha).toHaveBeenCalled());
      expect(salvarLinha).toHaveBeenCalledWith(5, 1, {
        resposta: sugestao.texto,
        naoUtilizado: false,
        versao: 3,
      });
      fixture.destroy();
    });

    it('"Descartar" não escreve nada e some com a proposta', async () => {
      const fixture = await montar([linha({ id: 1, resposta: '' })], comSugestao());
      const comp = fixture.componentInstance;
      await comp.pedirSugestoes(42);

      comp.descartarSugestao(1);

      expect(comp.totalSugestoes()).toBe(0);
      expect(comp.linhas()[0].resposta).toBe('');
      fixture.destroy();
    });

    it('sem chave de IA configurada, a tela diz o que fazer em vez de oferecer o botão', async () => {
      const fixture = await montar(
        [linha({ id: 1 })],
        comSugestao({
          gravacoes: vi.fn().mockResolvedValue({ gravacoes: [], iaDisponivel: false }),
        }),
      );
      const comp = fixture.componentInstance;

      await comp.alternarPainelGravacoes();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Config → IA');
      fixture.destroy();
    });

    it('falha ao ler a reunião vira aviso, não quebra a tela', async () => {
      const fixture = await montar(
        [linha({ id: 1 })],
        comSugestao({ sugerir: vi.fn().mockRejectedValue(new Error('502')) }),
      );
      const comp = fixture.componentInstance;

      await comp.pedirSugestoes(42);

      expect(comp.avisoSugestao()).toContain('Não foi possível ler a reunião');
      expect(comp.sugerindo()).toBe(false);
      fixture.destroy();
    });
  });

  describe('obrigatoriedade', () => {
    it('conta como pendente toda pergunta sem resposta', async () => {
      const fixture = await montar([
        linha({ id: 1, resposta: '' }),
        linha({ id: 2, resposta: 'respondida' }),
        linha({ id: 3, resposta: '   ' }),
      ]);
      expect(fixture.componentInstance.faltam()).toBe(2);
      fixture.destroy();
    });

    it('pergunta marcada como "Não será utilizado." não conta como pendente', async () => {
      const fixture = await montar([
        linha({ id: 1, naoUtilizado: true, resposta: TEXTO_NAO_UTILIZADO }),
      ]);
      expect(fixture.componentInstance.faltam()).toBe(0);
      fixture.destroy();
    });

    it('abre a tela sem cobrar os campos vazios; a revisão das pendências é que cobra', async () => {
      const fixture = await montar([linha({ id: 1, resposta: '' })]);
      const comp = fixture.componentInstance;
      expect(comp.cobrarPendentes()).toBe(false);

      comp.irParaPendente();

      expect(comp.cobrarPendentes()).toBe(true);
      fixture.destroy();
    });

    it('não oferece botão de salvar — o preenchimento é gravado sozinho', async () => {
      const fixture = await montar([linha({ id: 1, resposta: '' })]);
      const html: string = fixture.nativeElement.textContent;
      expect(html).not.toContain('Salvar respostas');
      expect(fixture.nativeElement.querySelector('button[type="submit"]')).toBeNull();
      fixture.destroy();
    });
  });

  describe('flag "Não será utilizado."', () => {
    it('marcar preenche a frase padrão, trava o campo e grava na hora', async () => {
      const salvarLinha = vi.fn().mockResolvedValue({
        linha: linha({ id: 1, naoUtilizado: true, resposta: TEXTO_NAO_UTILIZADO, versao: 1 }),
        resumo: { respondidas: 1, total: 1 },
      });
      const fixture = await montar([linha({ id: 1 })], { salvarLinha });
      const comp = fixture.componentInstance;

      comp.onNaoUtilizado(1, true);
      expect(comp.linhas()[0].resposta).toBe(TEXTO_NAO_UTILIZADO);
      expect(comp.linhas()[0].naoUtilizado).toBe(true);
      expect(salvarLinha).toHaveBeenCalledWith(5, 1, {
        naoUtilizado: true,
        resposta: TEXTO_NAO_UTILIZADO,
        versao: 0,
      });

      await fixture.whenStable();
      fixture.detectChanges();
      const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('#lev-campo-1');
      expect(textarea.disabled).toBe(true);
      fixture.destroy();
    });

    it('desmarcar limpa a frase padrão e o campo volta a ser obrigatório', async () => {
      const fixture = await montar([
        linha({ id: 1, naoUtilizado: true, resposta: TEXTO_NAO_UTILIZADO, versao: 2 }),
      ]);
      const comp = fixture.componentInstance;

      comp.onNaoUtilizado(1, false);

      expect(comp.linhas()[0].resposta).toBe('');
      expect(comp.linhas()[0].naoUtilizado).toBe(false);
      expect(comp.faltam()).toBe(1);
      fixture.destroy();
    });

    it('desmarcar preserva texto que o técnico havia digitado antes de marcar', async () => {
      const fixture = await montar([
        linha({ id: 1, naoUtilizado: true, resposta: 'texto anterior' }),
      ]);
      const comp = fixture.componentInstance;
      comp.onNaoUtilizado(1, false);
      expect(comp.linhas()[0].resposta).toBe('texto anterior');
      fixture.destroy();
    });
  });

  describe('edição a várias mãos', () => {
    it('mostra quem mais está na tela e em qual pergunta', async () => {
      const fixture = await montar([linha({ id: 1 })], {
        sincronizar: vi.fn().mockResolvedValue({
          presentes: [{ usuarioId: 9, nome: 'Bruno', linhaId: 1 }],
          linhas: [],
          resumo: { respondidas: 0, total: 1 },
          agora: '2026-07-28T10:00:00.000Z',
        }),
      });
      const comp = fixture.componentInstance;
      await fixture.whenStable();
      fixture.detectChanges();

      expect(comp.presentes()).toHaveLength(1);
      expect(comp.editores().get(1)).toEqual(['Bruno']);
      expect(fixture.nativeElement.textContent).toContain('Bruno');
      fixture.destroy();
    });

    it('o tique traz a resposta que o colega gravou em outra máquina', async () => {
      const fixture = await montar([linha({ id: 1 }), linha({ id: 2 })], {
        sincronizar: vi.fn().mockResolvedValue({
          presentes: [],
          linhas: [linha({ id: 2, resposta: 'digitado pelo Bruno', versao: 1, atualizadoPor: 'Bruno' })],
          resumo: { respondidas: 1, total: 2 },
          agora: '2026-07-28T10:00:00.000Z',
        }),
      });
      const comp = fixture.componentInstance;
      await fixture.whenStable();

      expect(comp.linhas()[1].resposta).toBe('digitado pelo Bruno');
      expect(comp.linhas()[1].atualizadoPor).toBe('Bruno');
      fixture.destroy();
    });

    it('o tique NÃO sobrescreve o campo que está sendo digitado aqui', async () => {
      const sincronizar = vi.fn().mockResolvedValue({
        presentes: [],
        linhas: [],
        resumo: { respondidas: 0, total: 1 },
        agora: '2026-07-28T10:00:00.000Z',
      });
      const fixture = await montar([linha({ id: 1 })], { sincronizar });
      const comp = fixture.componentInstance;

      comp.onRespostaChange(1, 'estou digitando isto');
      sincronizar.mockResolvedValue({
        presentes: [],
        linhas: [linha({ id: 1, resposta: 'versão do colega', versao: 3 })],
        resumo: { respondidas: 1, total: 1 },
        agora: '2026-07-28T10:00:05.000Z',
      });
      await comp['tique']();

      expect(comp.linhas()[0].resposta).toBe('estou digitando isto');
      fixture.destroy();
    });

    it('conflito (409) mantém a versão do colega no campo e devolve o texto local no aviso', async () => {
      const conflito = new HttpErrorResponse({
        status: 409,
        error: { message: 'Alterada por Bruno.' },
      });
      const obter = vi.fn().mockResolvedValue({
        linhas: [linha({ id: 1, resposta: 'versão do Bruno', versao: 4, atualizadoPor: 'Bruno' })],
        resumo: { respondidas: 1, total: 1 },
      });
      const fixture = await montar([linha({ id: 1 })], {
        salvarLinha: vi.fn().mockRejectedValue(conflito),
      });
      const comp = fixture.componentInstance;
      // a 1ª carga já usou o `obter` do mock padrão; troca só para a releitura do conflito
      (TestBed.inject(LevantamentoService) as unknown as { obter: unknown }).obter = obter;

      comp.onRespostaChange(1, 'meu texto');
      await comp['gravar'](1, { resposta: 'meu texto' });

      expect(comp.linhas()[0].resposta).toBe('versão do Bruno');
      expect(comp.aviso()).toContain('Alterada por Bruno.');
      expect(comp.aviso()).toContain('meu texto');
      fixture.destroy();
    });

    it('o autosave manda a versão que estava em tela', async () => {
      const salvarLinha = vi.fn().mockResolvedValue({
        linha: linha({ id: 1, resposta: 'texto', versao: 8 }),
        resumo: { respondidas: 1, total: 1 },
      });
      const fixture = await montar([linha({ id: 1, versao: 7 })], { salvarLinha });
      const comp = fixture.componentInstance;

      comp.onRespostaChange(1, 'texto');
      comp.onBlur(1);
      await fixture.whenStable();

      expect(salvarLinha).toHaveBeenCalledWith(5, 1, {
        resposta: 'texto',
        naoUtilizado: false,
        versao: 7,
      });
      expect(comp.linhas()[0].versao).toBe(8);
      fixture.destroy();
    });
  });

  describe('salvamento automático (sem botão)', () => {
    it('a resposta que não foi confirmada continua pendente e é reenviada no tique', async () => {
      const salvarLinha = vi
        .fn()
        .mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }))
        .mockResolvedValue({
          linha: linha({ id: 1, resposta: 'texto', versao: 1 }),
          resumo: { respondidas: 1, total: 1 },
        });
      const fixture = await montar([linha({ id: 1 })], { salvarLinha });
      const comp = fixture.componentInstance;

      comp.onRespostaChange(1, 'texto');
      comp.onBlur(1);
      await fixture.whenStable();
      expect(comp.estadoLinha()[1]).toBe('erro');
      expect(comp.naoSalvas()).toBe(1);

      // é o tique do autosave, não um clique, que resolve
      comp['salvarPendentes']();
      await fixture.whenStable();

      expect(salvarLinha).toHaveBeenCalledTimes(2);
      expect(comp.estadoLinha()[1]).toBe('salvo');
      expect(comp.naoSalvas()).toBe(0);
      expect(comp.ultimoSalvamento()).not.toBe('');
      fixture.destroy();
    });

    it('sair da tela grava o que ainda estava esperando o debounce', async () => {
      const salvarLinha = vi.fn().mockResolvedValue({
        linha: linha({ id: 1, resposta: 'digitado e não salvo', versao: 1 }),
        resumo: { respondidas: 1, total: 1 },
      });
      const fixture = await montar([linha({ id: 1 })], { salvarLinha });

      fixture.componentInstance.onRespostaChange(1, 'digitado e não salvo');
      expect(salvarLinha).not.toHaveBeenCalled();

      fixture.destroy();

      expect(salvarLinha).toHaveBeenCalledWith(5, 1, {
        resposta: 'digitado e não salvo',
        naoUtilizado: false,
        versao: 0,
      });
    });

    it('não dispara duas gravações simultâneas da mesma pergunta (409 falso)', async () => {
      let liberar: (v: unknown) => void = () => undefined;
      const salvarLinha = vi.fn().mockReturnValue(
        new Promise((resolve) => {
          liberar = resolve;
        }),
      );
      const fixture = await montar([linha({ id: 1 })], { salvarLinha });
      const comp = fixture.componentInstance;

      comp.onRespostaChange(1, 'texto');
      comp.onBlur(1); // 1ª gravação, ainda em voo
      comp['salvarPendentes'](); // tique do autosave cai em cima

      expect(salvarLinha).toHaveBeenCalledTimes(1);
      liberar({
        linha: linha({ id: 1, resposta: 'texto', versao: 1 }),
        resumo: { respondidas: 1, total: 1 },
      });
      await fixture.whenStable();
      fixture.destroy();
    });
  });
});
